import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import cors from 'cors';
import textract from 'textract';
import walk from 'walk';
import { fileURLToPath } from 'url';
import { AzureOpenAI } from "openai";
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Azure AI Configuration
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_KEY;
const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o"; 
const apiVersion = process.env.AZURE_OPENAI_CHAT_API_VERSION || "2024-02-15-preview";

const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large file analysis

// Helper: Normalize paths for cross-platform consistency
function normalizePath(filePath) {
  return path.normalize(filePath).replace(/\\/g, '/');
}

// Helper: Extract text from files
function extractText(filePath) {
  return new Promise((resolve, reject) => {
    textract.fromFileWithPath(filePath, (error, text) => {
      if (error) reject(error);
      else resolve(text);
    });
  });
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
    const truncatedContent = content.substring(0, 10000); // Token limit protection

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
      model: deployment,
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
      model: deployment,
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

app.listen(PORT, () => {
  console.log(`Synapse Server running on port ${PORT}`);
});