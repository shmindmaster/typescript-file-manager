import React, { useState } from 'react';
import { Folder, X, Plus, FolderOpen } from 'lucide-react';
import { Directory } from '../types';

interface DirectorySelectorProps {
  label: string;
  directories: Directory[];
  setDirectories: React.Dispatch<React.SetStateAction<Directory[]>>;
}

const DirectorySelector: React.FC<DirectorySelectorProps> = ({ label, directories, setDirectories }) => {
  const [newDirectory, setNewDirectory] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleAddDirectory = () => {
    if (newDirectory && !directories.some(d => d.path === newDirectory)) {
      setDirectories([...directories, { path: newDirectory }]);
      setNewDirectory('');
    }
  };

  const handleRemoveDirectory = (index: number) => {
    setDirectories(directories.filter((_, i) => i !== index));
  };

  // Helper to simulate browsing (since browsers restrict direct FS access)
  const handleBrowse = () => {
    // In a real Electron app, this would open a native dialog
    const mockPath = "C:/Users/User/Documents/Project_" + Math.floor(Math.random() * 1000);
    setNewDirectory(mockPath);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-blue-500" />
          {label}
        </label>
        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
          {directories.length} Active
        </span>
      </div>

      {/* Input Area */}
      <div className={`flex items-center bg-gray-50 dark:bg-gray-900/50 border rounded-xl transition-all duration-200 ${isFocused ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-700'}`}>
        <div className="pl-3 pr-2 text-gray-400">
          <Folder className="w-5 h-5" />
        </div>
        <input
          className="flex-grow bg-transparent border-none py-3 text-gray-700 dark:text-gray-200 text-sm focus:ring-0 placeholder-gray-400"
          type="text"
          placeholder="Enter path (e.g., C:/Projects)"
          value={newDirectory}
          onChange={(e) => setNewDirectory(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddDirectory()}
        />
        <button
          onClick={handleBrowse}
          className="px-3 py-1.5 mr-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-md transition-colors"
        >
          Browse
        </button>
        <button
          onClick={handleAddDirectory}
          disabled={!newDirectory}
          className="m-1 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Directory List */}
      {directories.length > 0 && (
        <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
          {directories.map((dir, index) => (
            <div 
              key={index} 
              className="group flex items-center justify-between p-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300 font-mono truncate" title={dir.path}>
                  {dir.path}
                </span>
              </div>
              <button
                onClick={() => handleRemoveDirectory(index)}
                className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DirectorySelector;