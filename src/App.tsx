import React, { useState, useEffect } from 'react';
import { Settings, Moon, Sun, Cpu } from 'lucide-react';
import KeywordSearch from './components/KeywordSearch';
import ConfigurationPanel from './components/ConfigurationPanel';
import ProgressBar from './components/ProgressBar';
import DirectorySelector from './components/DirectorySelector';
import ErrorLog from './components/ErrorLog';
import SmartFileCard from './components/shared/SmartFileCard';
import InsightDrawer from './components/shared/InsightDrawer';
import { FileInfo, KeywordConfig, Directory, AppError } from './types';

function App() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [keywordConfigs, setKeywordConfigs] = useState<KeywordConfig[]>([]);
  const [baseDirectories, setBaseDirectories] = useState<Directory[]>([]);
  const [targetDirectories, setTargetDirectories] = useState<Directory[]>([]);
  const [errors, setErrors] = useState<AppError[]>([]);
  const [darkMode, setDarkMode] = useState(true); 
  const [isScanning, setIsScanning] = useState(false);

  // AI Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'analyze' | 'chat'>('analyze');
  const [activeFile, setActiveFile] = useState<FileInfo | null>(null);

  // Persist Settings
  useEffect(() => {
    const savedConfig = localStorage.getItem('appConfig');
    if (savedConfig) {
      const { keywordConfigs, baseDirectories, targetDirectories } = JSON.parse(savedConfig);
      setKeywordConfigs(keywordConfigs);
      setBaseDirectories(baseDirectories);
      setTargetDirectories(targetDirectories);
    }
    // Initialize Dark Mode
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('appConfig', JSON.stringify({ keywordConfigs, baseDirectories, targetDirectories }));
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

  const handleSearch = async () => {
    if (baseDirectories.length === 0) {
      addError('Please select at least one base directory first.');
      return;
    }

    setProgress({ current: 0, total: 1 });
    setIsScanning(true);
    setFiles([]);

    try {
      const response = await fetch('http://localhost:3001/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseDirectories, keywordConfigs }),
      });

      const reader = response.body?.getReader();
      let partialData = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        partialData += new TextDecoder().decode(value);
        const lines = partialData.split('\n');
        
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          try {
            const data = JSON.parse(line);
            if (data.results) setFiles(prev => [...data.results]); 
            if (data.filesProcessed) setProgress({ current: data.filesProcessed, total: data.totalFiles });
          } catch (e) { /* Ignore partial chunks */ }
        }
        partialData = lines[lines.length - 1];
      }
    } catch (error) {
      addError('Scan failed: ' + (error as Error).message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileAction = async (file: FileInfo, action: 'move' | 'copy') => {
    const matchingConfig = keywordConfigs.find(config => 
      config.keywords.every(keyword => file.keywords.includes(keyword))
    );

    if (!matchingConfig) {
      addError('No automated destination found for this file type.');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/file-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, action, destination: matchingConfig.destinationFolder }),
      });
      const result = await response.json();
      if (result.success) {
        addError(result.message, 'success');
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
        <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-blue-600 to-cyan-500 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
                <Cpu className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300">
                  Synapse
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">AI Knowledge OS</p>
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

          {/* Scanner Zone */}
          <div className="flex flex-col items-center justify-center space-y-6 py-4">
            <KeywordSearch onSearch={handleSearch} isScanning={isScanning} />
            {progress.total > 0 && (
               <div className="w-full max-w-2xl">
                 <ProgressBar current={progress.current} total={progress.total} />
               </div>
            )}
          </div>

          {/* Results Grid */}
          {files.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Detected Assets <span className="ml-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-sm">{files.length}</span>
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {files.map((file, index) => (
                  <SmartFileCard 
                    key={index} 
                    file={file} 
                    onAnalyze={handleAnalyze}
                    onChat={handleChat}
                    onAction={handleFileAction}
                  />
                ))}
              </div>
            </div>
          )}
          
          {files.length === 0 && !isScanning && (
            <div className="text-center py-24 opacity-40">
              <Cpu className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium">System Idle</p>
              <p className="text-sm">Configure directories and initiate a scan.</p>
            </div>
          )}
        </main>

        {/* Floating Elements */}
        {showConfig && (
          <ConfigurationPanel
            onClose={() => setShowConfig(false)}
            keywordConfigs={keywordConfigs}
            setKeywordConfigs={setKeywordConfigs}
            targetDirectories={targetDirectories}
          />
        )}

        <ErrorLog errors={errors} setErrors={setErrors} />
      </div>
    </div>
  );
}

export default App;