import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, Sparkles, Loader2 } from 'lucide-react';
import { FileInfo } from '../../types';

interface InsightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeFile: FileInfo | null;
  mode: 'analyze' | 'chat';
}

const InsightDrawer: React.FC<InsightDrawerProps> = ({ isOpen, onClose, activeFile, mode }) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && activeFile) {
      if (mode === 'analyze') performAnalysis();
      else setChatHistory([{ role: 'assistant', content: `I'm ready to answer questions about **${activeFile.name}**.` }]);
    } else {
      // Reset state on close
      setAnalysis(null);
      setChatHistory([]);
    }
  }, [isOpen, activeFile, mode]);

  const performAnalysis = async () => {
    if (!activeFile) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: activeFile.path })
      });
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!input.trim() || !activeFile) return;
    const userMsg = { role: 'user', content: input };
    setChatHistory(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filePath: activeFile.path, 
          message: input,
          history: chatHistory 
        })
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center space-x-2">
            {mode === 'analyze' ? <Sparkles className="w-5 h-5 text-purple-500" /> : <Bot className="w-5 h-5 text-teal-500" />}
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {mode === 'analyze' ? 'AI Analysis' : 'Document Chat'}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {loading && !analysis && chatHistory.length <= 1 && (
            <div className="flex flex-col items-center justify-center h-64 space-y-3 opacity-70">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Consulting Neural Network...</p>
            </div>
          )}

          {/* Analysis Mode */}
          {mode === 'analyze' && analysis && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
                  <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">Executive Summary</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.summary}</p>
               </div>
               
               <div>
                 <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Semantic Tags</h4>
                 <div className="flex flex-wrap gap-2">
                   {analysis.tags?.map((tag: string, i: number) => (
                     <span key={i} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700">#{tag}</span>
                   ))}
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center border border-gray-100 dark:border-gray-700">
                   <div className="text-xs text-gray-500 mb-1">Suggested Category</div>
                   <div className="font-semibold text-gray-900 dark:text-gray-100">{analysis.category}</div>
                 </div>
                 <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center border border-gray-100 dark:border-gray-700">
                   <div className="text-xs text-gray-500 mb-1">Data Sensitivity</div>
                   <div className={`font-semibold ${analysis.sensitivity === 'High' ? 'text-red-500' : 'text-green-500'}`}>{analysis.sensitivity}</div>
                 </div>
               </div>
            </div>
          )}

          {/* Chat Mode */}
          {mode === 'chat' && (
            <div className="space-y-4">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-sm' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-200 dark:border-gray-700'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && chatHistory.length > 0 && (
                 <div className="flex justify-start">
                   <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm p-4">
                     <div className="flex space-x-1.5">
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                     </div>
                   </div>
                 </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Chat Input */}
        {mode === 'chat' && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Ask a follow-up question..."
                className="w-full pl-4 pr-12 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-sm"
              />
              <button 
                onClick={handleSendChat}
                disabled={loading || !input.trim()}
                className="absolute right-2 p-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default InsightDrawer;
