'use client';

import React, { useState, useRef } from 'react';
import { FaSearch, FaSpinner, FaRobot, FaHistory, FaArrowRight, FaInfoCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';

const COMPANY_CODE = process.env.NEXT_PUBLIC_COMPANY_CODE;

export default function OrgGPT() {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ query: string, timestamp: string }>>([]);
  const [sessionId, setSessionId] = useState<string>(`session_${Date.now()}`);
  const resultRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false); // State for history visibility

  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px; // Slimmer scrollbar
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #E5E7EB; // gray-200
        border-radius: 10px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #A78BFA; // purple-400
        border-radius: 10px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #8B5CF6; // purple-500
      }
      .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: #A78BFA #E5E7EB;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults('');

    try {
      const response = await fetch('/api/claude-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: query.trim(), session_id: sessionId, company: COMPANY_CODE }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Error: ${response.status}`);
      }
      if (response.status !== 200) {
        throw new Error(data.error || `Error: ${response.status}`);
      }

      setResults(data.response || JSON.stringify(data, null, 2));
      
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setHistory(prev => [{ query: query.trim(), timestamp }, ...prev].slice(0, 10));
      setShowHistory(false); // Collapse history after new query
      
      if (resultRef.current) {
        resultRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred with your query');
      console.error('Query error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false); // Collapse history after selecting an item
  };

  return (
    <div className="relative min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mt-4">
            <span className="text-purple-700">Org</span>GPT
          </h1>
          <p className="mt-3 text-lg text-gray-600 max-w-xl mx-auto">
          Get clarity on teams, talent, and trends, instantly.
          </p>
        </div>
        
        {/* Main Query Form and Results Area - MOVED UP */}
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 md:p-8 mb-12">
          <div className="mb-6 flex items-center">
            <div className="bg-purple-100 p-3 rounded-full mr-4 shadow-sm">
              <FaSearch className="h-6 w-6 text-purple-600" />
            </div>
            <h2 className="text-xl md:text-2xl font-semibold text-gray-800">Submit Your Query</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-1.5">
                Enter your question or topic
              </label>
              <div className="relative">
                <textarea
                  id="query"
                  rows={4}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., 'Suggest reskilling paths for at-risk employees' or 'Who should we consider for leadership roles?'"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-800 shadow-sm transition-colors text-base resize-none"
                  required
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                
              </p>
            </div>
            
            <div className="flex justify-end pt-2">
               <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="flex items-center justify-center px-8 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-purple-400 disabled:cursor-not-allowed transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95"
              >
                {isLoading ? (
                  <>
                    <FaSpinner className="animate-spin -ml-1 mr-2.5 h-5 w-5" />
                    Searching...
                  </>
                ) : (
                  <>
                    <FaSearch className="mr-2 h-5 w-5" />
                    Search
                  </>
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-8 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 shadow">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FaInfoCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium">An error occurred</h3>
                  <div className="mt-1 text-sm">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {results && !isLoading && (
            <div className="mt-10 pt-8 border-t border-gray-200" ref={resultRef}>
              <div className="mb-5 flex items-center">
                 <div className="bg-purple-100 p-3 rounded-full mr-4 shadow-sm">
                  <FaArrowRight className="h-6 w-6 text-purple-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-semibold text-gray-800">Query Results</h2>
              </div>
              <div className="bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-200 shadow-inner custom-scrollbar max-h-[600px] overflow-y-auto text-sm">
                <pre className="whitespace-pre-wrap font-mono text-gray-700 leading-relaxed">{results}</pre>
              </div>
            </div>
          )}
          
          {isLoading && !results && (
            <div className="mt-10 pt-8 border-t border-gray-200 text-center">
              <FaSpinner className="animate-spin text-purple-600 mx-auto h-12 w-12 mb-4" />
              <p className="text-lg text-gray-600 font-medium">Digging into the data trenches...</p>
              <p className="text-sm text-gray-500">Please wait a moment.</p>
            </div>
          )}
        </div>

        {/* Collapsible History Section - MOVED DOWN */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 transition-all duration-300 ease-in-out">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex justify-between items-center p-4 md:p-5 hover:bg-gray-50 rounded-t-xl focus:outline-none"
          >
            <div className="flex items-center">
              <FaHistory className="h-5 w-5 text-purple-600 mr-3" />
              <h2 className="text-lg font-semibold text-gray-700">Recent Queries</h2>
            </div>
            {showHistory ? <FaChevronUp className="text-purple-600" /> : <FaChevronDown className="text-purple-600" />}
          </button>

          {showHistory && (
            <div className="p-4 md:p-5 border-t border-gray-200">
              {history.length > 0 ? (
                <div className="space-y-2.5 custom-scrollbar max-h-60 overflow-y-auto pr-2">
                  {history.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg cursor-pointer group transition-colors duration-150"
                      onClick={() => handleHistoryClick(item.query)}
                    >
                      <div className="text-sm font-medium text-purple-800 group-hover:text-purple-900 truncate">{item.query}</div>
                      <div className="text-xs text-purple-600 mt-1">{item.timestamp}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <FaHistory className="mx-auto text-4xl text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No query history yet.</p>
                  <p className="text-xs text-gray-400 mt-1.5">Your past queries will appear here for quick access.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 