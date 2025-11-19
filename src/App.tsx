import React, { useState, useEffect } from 'react';
import { Settings, Moon, Sun, Cpu } from 'lucide-react';
import SemanticSearchBar from './components/SemanticSearchBar';
import ConfigurationPanel from './components/ConfigurationPanel';
import ProgressBar from './components/ProgressBar';
import DirectorySelector from './components/DirectorySelector';
import ErrorLog from './components/ErrorLog';
import FileGrid from './components/FileGrid';
import WelcomeWizard from './components/WelcomeWizard';
import InsightDrawer from './components/shared/InsightDrawer';
import { FileInfo, KeywordConfig, Directory, AppError } from './types';
import { apiUrl } from './utils/api';

function App() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [keywordConfigs, setKeywordConfigs] = useState<KeywordConfig[]>([]);
  const [baseDirectories, setBaseDirectories] = useState<Directory[]>([]);
  const [targetDirectories, setTargetDirectories] = useState<Directory[]>([]);
  const [errors, setErrors] = useState<AppError[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [showWelcomeWizard, setShowWelcomeWizard] = useState(true);

  // New AI State
  const [isIndexing, setIsIndexing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasIndex, setHasIndex] = useState(false);
  
  // AI Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'analyze' | 'chat'>('analyze');
  const [activeFile, setActiveFile] = useState<FileInfo | null>(null);

  // Persist Settings & Check Index Status
  useEffect(() => {
    const savedConfig = localStorage.getItem('appConfig');
    if (savedConfig) {
      const { keywordConfigs, baseDirectories, targetDirectories } = JSON.parse(savedConfig);
      setKeywordConfigs(keywordConfigs);
      setBaseDirectories(baseDirectories);
      setTargetDirectories(targetDirectories);
      setShowWelcomeWizard(false);
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setDarkMode(true);
    }
    
    // Check if server has loaded memory
    fetch(apiUrl('/api/index-status'))
      .then(res => res.json())
      .then(data => {
        if (data.hasIndex) {
          setHasIndex(true);
        }
      })
      .catch(() => {
        // Server might not be running, ignore
      });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (keywordConfigs.length > 0) {
      localStorage.setItem('appConfig', JSON.stringify({ keywordConfigs, baseDirectories, targetDirectories }));
    }
  }, [keywordConfigs, baseDirectories, targetDirectories]);

  // --- Actions ---

  const handleAnalyze = (file: FileInfo) => {
    setActiveFile(file);
    setDrawerMode('analyze');
    setDrawerOpen(true);
  };

  const handleChat = (file: FileInfo) => {
    setActiveFile(file);
    setDrawerMode('chat');
    setDrawerOpen(true);
  };

  const handleIndexFiles = async () => {
    if (baseDirectories.length === 0) return addError('Please select at least one base directory.');
    
    setIsIndexing(true);
    setProgress({ current: 0, total: 1 });
    
    try {
      const response = await fetch(apiUrl('/api/index-files'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseDirectories }),
      });
      
      // Stream progress logic
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line) continue;
          try {
            const data = JSON.parse(line);
            if (data.filesProcessed) setProgress({ current: data.filesProcessed, total: data.totalFiles });
            if (data.status === 'complete') setHasIndex(true);
          } catch (e) { console.error(e); }
        }
      }
      addError('System indexing complete. You can now ask questions.', 'success');
    } catch (error) {
      addError('Indexing failed: ' + (error as Error).message);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleSemanticSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(apiUrl('/api/semantic-search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setFiles(data.results);
    } catch (error) {
      addError('Search failed: ' + (error as Error).message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileAction = async (file: FileInfo, action: 'move' | 'copy') => {
    // Find matching config: ALL keywords must be present in the filename
    // This ensures files only match when they contain all configured keywords
    const matchingConfig = keywordConfigs.find(config => 
      config.keywords.every(k => file.name.toLowerCase().includes(k.toLowerCase()))
    );
    
    if (!matchingConfig) {
      addError('No automated destination found based on file name match.');
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/file-action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, action, destination: matchingConfig.destinationFolder }),
      });
      const result = await response.json();
      if (result.success) {
        addError(result.message, 'success');
        // Remove file from view if moved
        if (action === 'move') {
           setFiles(prev => prev.filter(f => f.path !== file.path));
        }
      } else {
        addError(`Error: ${result.message}`);
      }
    } catch (error) {
      addError(`Error: ${(error as Error).message}`);
    }
  };

  const addError = (message: string, type: 'error' | 'success' = 'error') => {
    setErrors(prev => [...prev, { message, type, timestamp: new Date() }]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200 font-sans">
      
      <InsightDrawer 
        isOpen={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        activeFile={activeFile}
        mode={drawerMode}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${drawerOpen ? 'mr-0 md:mr-96' : ''}`}>
        {/* Header */}
        <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-blue-600 to-cyan-500 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
                <Cpu className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300">
                  Synapse
                </h1>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">AI Knowledge OS</p>
                  <span className="text-[10px] text-gray-300 dark:text-gray-700">•</span>
                  <span className={`text-[10px] font-bold flex items-center gap-1 ${hasIndex ? 'text-green-500' : 'text-amber-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${hasIndex ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
                    Memory {hasIndex ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="flex items-center px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl hover:opacity-90 transition-opacity font-medium text-sm shadow-sm"
              >
                <Settings className="w-4 h-4 mr-2" />
                Config
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-grow max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
          
          {/* Configuration Zone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
               <DirectorySelector
                label="Input Sources"
                directories={baseDirectories}
                setDirectories={setBaseDirectories}
              />
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <DirectorySelector
                label="Sort Destinations"
                directories={targetDirectories}
                setDirectories={setTargetDirectories}
              />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center space-y-6 py-4">
            <SemanticSearchBar 
              onIndex={handleIndexFiles}
              onSearch={handleSemanticSearch}
              isIndexing={isIndexing}
              isSearching={isSearching}
              hasIndex={hasIndex}
            />
            {(isIndexing || progress.total > 0) && (
               <ProgressBar current={progress.current} total={progress.total} />
            )}
          </div>

          {/* Use the new FileGrid Component */}
          <FileGrid 
            files={files}
            onAnalyze={handleAnalyze}
            onChat={handleChat}
            onAction={handleFileAction}
          />
          
          {files.length === 0 && !isIndexing && !isSearching && (
            <div className="text-center py-24 opacity-40">
              <Cpu className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium">Knowledge Base Ready</p>
              <p className="text-sm">Build an index to start chatting with your files.</p>
            </div>
          )}
        </main>

        {/* Modals */}
        {showConfig && (
          <ConfigurationPanel
            onClose={() => setShowConfig(false)}
            keywordConfigs={keywordConfigs}
            setKeywordConfigs={setKeywordConfigs}
            targetDirectories={targetDirectories}
          />
        )}

        {showWelcomeWizard && (
          <WelcomeWizard
            onComplete={() => setShowWelcomeWizard(false)}
            setBaseDirectories={setBaseDirectories}
            setTargetDirectories={setTargetDirectories}
            setKeywordConfigs={setKeywordConfigs}
          />
        )}

        <ErrorLog errors={errors} setErrors={setErrors} />
      </div>
    </div>
  );
}

export default App;