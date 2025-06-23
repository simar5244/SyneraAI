import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { FaRobot, FaUser, FaSpinner, FaPaperPlane, FaInfoCircle, FaDatabase, FaChevronUp } from 'react-icons/fa';

// Define interface for message objects
interface Message {
  text: string;
  role: 'ai' | 'user';
}

const MESSAGES_TO_SHOW_INITIALLY = 15; // Number of messages to show initially/load more

const DbQueryComponent = () => {
  const greetingMessage: Message = { text: 'Hey, how can I help you today?', role: 'ai' };
  const [allMessages, setAllMessages] = useState<Message[]>([]); // Store all messages (history)
  const [displayedMessages, setDisplayedMessages] = useState<Message[]>([greetingMessage]); // Start with greeting
  const [canLoadMore, setCanLoadMore] = useState(false); // Determines if the 'Load earlier' button shows
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null); // Ref to scroll to bottom
  const sessionId = useRef<string>(`session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const COMPANY_CODE = process.env.NEXT_PUBLIC_COMPANY_CODE;

  // Save session ID to localStorage and set mounted state
  useEffect(() => {
    if (!localStorage.getItem('chatSessionId')) {
      localStorage.setItem('chatSessionId', sessionId.current);
    }
    loadHistory();
    // Set mounted state after initial render
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Scroll to bottom when new message is added or loading finishes
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayedMessages, isLoading]);

  // Effect to determine if the Load More button should be shown
  useEffect(() => {
    setCanLoadMore(allMessages.length > displayedMessages.length);
  }, [allMessages, displayedMessages]);

  const loadHistory = async () => {
    try {
      const response = await fetch(`/api/conversation/history?session_id=${sessionId.current}`);
      if (response.ok) {
        const data = await response.json();
        if (data.history && data.history.length > 0) {
          const formattedHistory = data.history.map((msg: any) => ({
            text: msg.text,
            role: msg.role === 'user' ? 'user' : 'ai'
          }));
          // Set all messages (history only, no greeting here)
          setAllMessages(formattedHistory);
        } else {
           // Ensure empty if no history
           setAllMessages([]);
        }
      } else {
         // Start with just the greeting on error/no history
        setAllMessages([]); // Ensure empty on error
        console.log('No history available or session is new');
      }
    } catch (error) {
      // Start with just the greeting on fetch error
      setAllMessages([]); // Ensure empty on fetch error
      console.error('Error loading history:', error);
    }
  };

  // Function to load more messages
  const loadMoreMessages = () => {
    const currentDisplayedCount = displayedMessages.length;
    const totalHistoryCount = allMessages.length;
    // Calculate how many more to load, up to the total history count
    const nextMessagesToLoadCount = Math.min(MESSAGES_TO_SHOW_INITIALLY, totalHistoryCount - (currentDisplayedCount -1)); // -1 for the greeting
    if (nextMessagesToLoadCount <= 0) return; // Should not happen if canLoadMore is true, but safe check

    const historyStartIndex = Math.max(0, totalHistoryCount - (currentDisplayedCount -1 + nextMessagesToLoadCount));
    const historyEndIndex = totalHistoryCount - (currentDisplayedCount - 1);

    const olderMessages = allMessages.slice(historyStartIndex, historyEndIndex);

    // Prepend older messages to the displayed messages (keeping the greeting potentially)
    setDisplayedMessages(prev => [...olderMessages, ...prev]);
    // canLoadMore state will be updated by the useEffect hook
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || !isMounted) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to both message lists
    const newUserMessageEntry: Message = { text: userMessage, role: 'user' };
    setAllMessages(prev => [...prev, newUserMessageEntry]);
    setDisplayedMessages(prev => [...prev, newUserMessageEntry]);
    
    setIsLoading(true);

    try {
      // Get authentication token
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Call the company-specific web query API
      const response = await fetch('/api/claude-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: userMessage, session_id: sessionId.current, company: COMPANY_CODE }),
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(text || `Error: ${response.status}`); }
      if (!response.ok) { throw new Error(data.error || `Error: ${response.status}`); }

      // Add AI response to both message lists
      const newAiMessageEntry: Message = { text: data.response, role: 'ai' };
      setAllMessages(prev => [...prev, newAiMessageEntry]);
      setDisplayedMessages(prev => [...prev, newAiMessageEntry]);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      // Add error message to both message lists
      const errorEntry: Message = { 
        text: `Sorry, an error occurred: ${errorMessage}. Please make sure you're logged in and have access to your company's data.`, 
        role: 'ai' 
      };
      setAllMessages(prev => [...prev, errorEntry]);
      setDisplayedMessages(prev => [...prev, errorEntry]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col h-[calc(100vh-200px)]"> {/* Adjust height as needed */}
      {/* Explanation Section (Consider moving outside if it shouldn't scroll) */}
      <div className="mb-4 bg-purple-50 rounded-xl border border-purple-100 p-4 shadow-sm flex-shrink-0">
        <div className="flex items-center mb-3">
          <div className="bg-purple-100 p-2 rounded-full mr-3">
            <FaDatabase className="h-5 w-5 text-purple-600" />
          </div>
          <h3 className="font-medium text-lg text-purple-900">How the Database Assistant Works</h3>
        </div>
        <p className="text-gray-700 text-sm">
          This assistant analyzes your company's data using natural language processing. Ask questions about 
          employees, projects, departments, skills, and more. The system will search your company's database 
          and return relevant information.
        </p>
      </div>
      
      {/* Chat container - Flex column, takes remaining space */} 
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col flex-grow">
        {/* Chat messages - Takes most space, scrolls */} 
        <div
          ref={chatBoxRef}
          className="flex-grow overflow-y-auto p-5 space-y-4 custom-scrollbar"
        >
          {/* Load More Button */} 
          {isMounted && canLoadMore && (
            <div className="text-center mb-4">
              <button 
                onClick={loadMoreMessages}
                className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center justify-center mx-auto"
              >
                <FaChevronUp className="mr-1" /> Load earlier messages
              </button>
            </div>
          )}
          
          {/* Only render DISPLAYED messages client-side */} 
          {isMounted && displayedMessages.map((msg, idx) => (
            <div
              key={`${msg.role}-${idx}`}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Message bubbles - styled with purple theme */} 
              <div
                className={`max-w-[80%] rounded-xl shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-purple-100 text-gray-800'
                    : 'bg-white border border-gray-200 text-gray-700'
                } p-3`}
              >
                <div className="flex items-start">
                  {msg.role === 'ai' && <FaRobot className="mr-2 mt-1 text-purple-600 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div
                      className="prose max-w-none text-sm"
                      dangerouslySetInnerHTML={{
                        __html: msg.text
                          .replace(/\n/g, '<br>')
                          .replace(
                            /```([^`]+)```/g,
                            '<pre class="bg-gray-100 p-2 rounded-md my-2 overflow-x-auto text-xs font-mono">$1</pre>'
                          )
                      }}
                    />
                  </div>
                  {msg.role === 'user' && <FaUser className="ml-2 mt-1 text-purple-600 flex-shrink-0" />}
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */} 
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-xl p-3 bg-white border border-gray-200 shadow-sm">
                <div className="flex items-center text-purple-600">
                  <FaRobot className="mr-2 text-purple-600" />
                  <FaSpinner className="animate-spin mr-2" />
                  <span className="text-sm">Processing your query...</span>
                </div>
              </div>
            </div>
          )}
          {/* Empty div to scroll to */} 
          <div ref={messagesEndRef} /> 
        </div>

        {/* Input area - Fixed at the bottom */} 
        <div className="border-t border-gray-200 p-5 bg-white flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about employees, projects, departments, skills..."
              disabled={isLoading || !isMounted} // Disable if not mounted
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800 shadow-sm"
            />
            <button
              type="submit"
              disabled={isLoading || !isMounted} // Disable if not mounted
              className="bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-300 disabled:cursor-not-allowed flex items-center shadow-sm"
            >
              {isLoading ? <FaSpinner className="animate-spin mr-2" /> : <FaPaperPlane className="mr-2" />}
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
      
      {/* Sample queries section (Consider moving outside if it shouldn't scroll) */} 
      <div className="mt-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex-shrink-0">
        <h3 className="font-medium text-purple-800 mb-3 flex items-center">
          <FaInfoCircle className="mr-2" /> Sample Queries
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-purple-50 transition-colors"
            onClick={() => setInput("Who are the most active employees in engineering?")}
          >
            Who are the most active employees in engineering?
          </div>
          <div
            className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-purple-50 transition-colors"
            onClick={() => setInput("Which employees have the most varied skillsets?")}
          >
            Which employees have the most varied skillsets?
          </div>
          <div
            className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-purple-50 transition-colors"
            onClick={() => setInput("Show all the critical priority projects")}
          >
            Show all the critical priority projects
          </div>
          <div
            className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-purple-50 transition-colors"
            onClick={() => setInput("Which employees are overutilized right now?")}
          >
            Which employees are overutilized right now?
          </div>
        </div>
      </div>
    </div>
  );
};

export default DbQueryComponent; 