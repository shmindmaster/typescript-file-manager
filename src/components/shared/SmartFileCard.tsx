import React from 'react';
import { FileText, BrainCircuit, MessageSquare, ArrowRight, Copy } from 'lucide-react';
import { FileInfo } from '../../types';

interface SmartFileCardProps {
  file: FileInfo;
  onAnalyze: (file: FileInfo) => void;
  onChat: (file: FileInfo) => void;
  onAction: (file: FileInfo, action: 'move' | 'copy') => void;
}

const SmartFileCard: React.FC<SmartFileCardProps> = ({ file, onAnalyze, onChat, onAction }) => {
  return (
    <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-200 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          {file.keywords.length > 0 && (
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold uppercase tracking-wider rounded-full">
              {file.keywords[0]}
            </span>
          )}
        </div>
        
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate mb-1" title={file.name}>
          {file.name}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-4" title={file.path}>
          {file.path}
        </p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex space-x-2">
          <button 
            onClick={() => onAnalyze(file)}
            className="flex items-center px-2 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
          >
            <BrainCircuit className="w-3.5 h-3.5 mr-1.5" />
            Analyze
          </button>
          <button 
            onClick={() => onChat(file)}
            className="flex items-center px-2 py-1.5 text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 rounded-md hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
            Chat
          </button>
        </div>

        <div className="flex space-x-1">
           <button onClick={() => onAction(file, 'move')} title="Move File" className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
             <ArrowRight className="w-4 h-4" />
           </button>
           <button onClick={() => onAction(file, 'copy')} title="Copy File" className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
             <Copy className="w-4 h-4" />
           </button>
        </div>
      </div>
    </div>
  );
};

export default SmartFileCard;
