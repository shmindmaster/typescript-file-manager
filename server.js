import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import cors from 'cors';
import textract from 'textract';
import walk from 'walk';
import { fileURLToPath } from 'url';
import { AzureOpenAI } from "openai";
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Use /app/data in Docker, current directory in development
const DATA_DIR = process.env.DATA_DIR || __dirname;
const INDEX_FILE = path.join(DATA_DIR, 'synapse_memory.json');

const app = express();
const PORT = process.env.PORT || 3001;

// Azure AI Configuration
const chatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o";
const embedDeployment = process.env.AZURE_OPENAI_EMBED_DEPLOYMENT || "text-embedding-3-small";

const client = new AzureOpenAI({ 
  endpoint: process.env.AZURE_OPENAI_ENDPOINT, 
  apiKey: process.env.AZURE_OPENAI_KEY, 
  apiVersion: process.env.AZURE_OPENAI_CHAT_API_VERSION || "2024-02-15-preview", 
  deployment: chatDeployment
}); 

// Validate Azure OpenAI credentials before initializing client
if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_KEY) {
  console.error('ERROR: Azure OpenAI credentials not configured. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY in .env');
  process.exit(1);
}

// Persistent Vector Store
let vectorStore = [];

// Load Memory on Startup
async function loadMemory() {
  if (existsSync(INDEX_FILE)) {
    console.log("🧠 Loading Synapse Memory...");
    const data = await fs.readFile(INDEX_FILE, 'utf-8');
    vectorStore = JSON.parse(data);
    console.log(`✅ Memory Loaded: ${vectorStore.length} chunks indexed.`);
  }
}

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large file analysis

// Helper: Normalize paths for cross-platform consistency
function normalizePath(filePath) {
  return path.normalize(filePath).replace(/\\/g, '/');
}

// Helper: Extract text from files
function extractText(filePath) {
  return new Promise((resolve) => {
    textract.fromFileWithPath(filePath, (error, text) => {
      if (error) resolve(""); 
      else resolve(text);
    });
  });
}

// Split text into overlapping chunks (Context Window Optimization)
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

// Cosine Similarity Helper
function cosineSimilarity(vecA, vecB) {
  let dot = 0.0, normA = 0.0, normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 1. Smart Scan Endpoint (Preserves existing logic + prepares for AI)
app.post('/api/search', async (req, res) => {
  const { baseDirectories, keywordConfigs } = req.body;
  const results = [];
  let filesProcessed = 0;
  let totalFiles = 0;

  // Note: In a production version, we would offload this walker to a worker thread
  for (const directory of baseDirectories) {
    const walker = walk.walk(directory.path, { followLinks: false });

    walker.on('file', async (root, stats, next) => {
      totalFiles++;
      const filePath = path.join(root, stats.name);
      
      // Skip system files and node_modules
      if (stats.name.startsWith('.') || filePath.includes('node_modules')) {
        filesProcessed++;
        next();
        return;
      }

      try {
        const content = await extractText(filePath);
        // Hybrid Search: Matches keywords OR if content seems relevant
        const matchedConfigs = keywordConfigs.filter(config => 
          config.keywords.every(keyword => 
            content.toLowerCase().includes(keyword.toLowerCase())
          )
        );

        if (matchedConfigs.length > 0) {
          results.push({
            name: stats.name,
            path: normalizePath(filePath),
            keywords: matchedConfigs.flatMap(config => config.keywords),
            size: stats.size,
            type: path.extname(stats.name)
          });
        }
      } catch (error) {
        // Silent fail on unreadable files
      }
      
      filesProcessed++;
      // Send progress updates
      if (filesProcessed % 5 === 0) {
        res.write(JSON.stringify({ filesProcessed, totalFiles }) + '\n');
      }
      next();
    });

    walker.on('end', () => {
      if (directory === baseDirectories[baseDirectories.length - 1]) {
        res.write(JSON.stringify({ results, totalFiles, filesProcessed }));
        res.end();
      }
    });
  }
});

// 2. NEW: AI Analysis Endpoint
app.post('/api/analyze', async (req, res) => {
  const { filePath } = req.body;
  
  try {
    const content = await extractText(filePath);
    // Token limit protection: 10,000 characters ≈ 2,500 tokens for GPT-4
    const MAX_CONTENT_LENGTH_FOR_ANALYSIS = 10000;
    const truncatedContent = content.substring(0, MAX_CONTENT_LENGTH_FOR_ANALYSIS);

    const prompt = `
      Analyze the following file content and return a strictly valid JSON object (no markdown formatting).
      The JSON must have these keys:
      - "summary": A 2-sentence executive summary.
      - "tags": Array of 5 technical or thematic tags.
      - "category": Suggested folder name.
      - "sensitivity": "High" (if contains PII/Keys) or "Low".
      
      Content:
      ${truncatedContent}
    `;

    const response = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are an intelligent file system auditor. Return JSON only." },
        { role: "user", content: prompt }
      ],
      model: chatDeployment,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    res.json({ success: true, analysis });

  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. NEW: Chat with File (RAG)
app.post('/api/chat', async (req, res) => {
  const { filePath, message, history } = req.body;

  try {
    const content = await extractText(filePath);
    const context = content.substring(0, 15000); 

    const messages = [
      { role: "system", content: "You are a helpful assistant. Answer the user's question based ONLY on the file content provided below." },
      ...history.slice(-4), // Keep last 4 turns for context
      { role: "user", content: `File Context:\n${context}\n\nUser Question: ${message}` }
    ];

    const response = await client.chat.completions.create({
      messages,
      model: chatDeployment,
    });

    res.json({ success: true, reply: response.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. File Actions (Move/Copy)
app.post('/api/file-action', async (req, res) => {
  const { file, action, destination } = req.body;
  const sourcePath = path.resolve(file.path);
  const destPath = path.resolve(destination, file.name);

  try {
    if (action === 'move') {
      await fs.rename(sourcePath, destPath);
    } else if (action === 'copy') {
      await fs.copyFile(sourcePath, destPath);
    }
    res.json({ success: true, message: `File ${action}d successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Indexing Endpoint with Persistence & Chunking
app.post('/api/index-files', async (req, res) => {
  const { baseDirectories } = req.body;
  let newVectors = []; // Temp store to append
  let filesProcessed = 0;
  let totalFiles = 0;

  for (const directory of baseDirectories) {
    const walker = walk.walk(directory.path, { followLinks: false });

    walker.on('file', async (root, stats, next) => {
      const filePath = path.join(root, stats.name);
      if (stats.name.startsWith('.') || filePath.includes('node_modules')) {
        next();
        return;
      }
      totalFiles++;

      try {
        const content = await extractText(filePath);
        if (content && content.length > 50) {
           // Chunking Strategy
           const chunks = chunkText(content);
           
           // Limit to first 5 chunks per file to save tokens/time for this demo
           const limitedChunks = chunks.slice(0, 5); 

           for (const chunk of limitedChunks) {
             const embeddingResponse = await client.embeddings.create({
               model: embedDeployment,
               input: chunk,
               encoding_format: "float",
             });
             
             newVectors.push({
               id: `${filePath}-${Date.now()}-${Math.random()}`,
               name: stats.name,
               path: normalizePath(filePath),
               embedding: embeddingResponse.data[0].embedding,
               preview: chunk // Store actual text chunk for RAG
             });
           }
        }
      } catch (error) {
        console.error(`Skipping ${filePath}: ${error.message}`);
      }
      
      filesProcessed++;
      res.write(JSON.stringify({ filesProcessed, totalFiles, status: 'indexing' }) + '\n');
      next();
    });

    walker.on('end', async () => {
      if (directory === baseDirectories[baseDirectories.length - 1]) {
        // Merge and Save - Remove old entries for same paths, then add new ones
        vectorStore = [...vectorStore.filter(v => !newVectors.find(n => n.path === v.path)), ...newVectors];
        await fs.writeFile(INDEX_FILE, JSON.stringify(vectorStore));
        
        res.write(JSON.stringify({ success: true, count: vectorStore.length, status: 'complete' }));
        res.end();
      }
    });
  }
});

// 6. Check Index Status
app.get('/api/index-status', (req, res) => {
  res.json({ hasIndex: vectorStore.length > 0, count: vectorStore.length });
});

// 7. Enhanced Semantic Search with Deduplication
app.post('/api/semantic-search', async (req, res) => {
  const { query } = req.body;
  if (!query || vectorStore.length === 0) return res.status(400).json({ error: 'Invalid query or empty index.' });

  try {
    const queryResponse = await client.embeddings.create({
      model: embedDeployment,
      input: query,
      encoding_format: "float",
    });
    const queryEmbedding = queryResponse.data[0].embedding;

    // Search & Deduplicate (Group chunks by file)
    const rawResults = vectorStore.map(doc => ({
      ...doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .filter(doc => doc.score > 0.25); // Filter noise

    // Deduplicate: Return top file match only once
    const uniqueFiles = new Map();
    rawResults.forEach(r => {
      if (!uniqueFiles.has(r.path)) {
        uniqueFiles.set(r.path, {
          name: r.name,
          path: r.path,
          keywords: [`${(r.score * 100).toFixed(0)}% Match`],
          analysis: {
            summary: r.preview.substring(0, 150) + "...", // Show the relevant chunk
            category: "Semantic Result",
            tags: ["Vector Match"],
            sensitivity: "Low"
          }
        });
      }
    });

    res.json({ results: Array.from(uniqueFiles.values()).slice(0, 12) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Production Serving ---
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app build
  app.use(express.static(path.join(__dirname, 'dist')));

  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Start server after memory is loaded
(async () => {
  await loadMemory();
  
  app.listen(PORT, () => {
    console.log(`Synapse Neural Core running on port ${PORT}`);
    if (process.env.NODE_ENV === 'production') {
      console.log(`🚀 Production Mode: Serving static assets`);
    }
  });
})();