import React from 'react';
import { Search, Loader2, Radio } from 'lucide-react';

interface KeywordSearchProps {
  onSearch: () => void;
  isScanning: boolean;
}

const KeywordSearch: React.FC<KeywordSearchProps> = ({ onSearch, isScanning }) => {
  return (
    <div className="w-full flex flex-col items-center">
      <button
        onClick={onSearch}
        disabled={isScanning}
        className={`
          relative group overflow-hidden rounded-2xl p-1 transition-all duration-300
          ${isScanning ? 'opacity-80 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
        `}
      >
        <div className={`
          absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-400 
          ${isScanning ? 'animate-pulse' : ''} 
        `} />
        
        <div className="relative bg-white dark:bg-gray-900 rounded-xl px-8 py-4 flex items-center gap-3">
          {isScanning ? (
            <>
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              <div className="flex flex-col items-start">
                <span className="text-base font-bold text-gray-800 dark:text-white">Scanning File System...</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Analyzing content & metadata</span>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                <Radio className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-base font-bold text-gray-800 dark:text-white">Initiate Deep Scan</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-blue-500 transition-colors">Find, tag, and organize assets</span>
              </div>
              <Search className="w-5 h-5 text-gray-300 dark:text-gray-600 ml-4 group-hover:text-blue-500 transition-colors" />
            </>
          )}
        </div>
      </button>
    </div>
  );
};

export default KeywordSearch;