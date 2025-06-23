document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    let sessionId = localStorage.getItem('chatSessionId');

    // Generate a unique session ID if one doesn't exist
    if (!sessionId) {
        sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('chatSessionId', sessionId);
        console.log('Generated new session ID:', sessionId);
    }

    // Function to add a message to the chat box
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
        const paragraph = document.createElement('p');
        // Basic Markdown-like handling for newlines
        paragraph.innerHTML = text.replace(/\n/g, '<br>'); 
        messageDiv.appendChild(paragraph);
        chatBox.appendChild(messageDiv);
        // Scroll to the bottom
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Function to handle sending a message
    async function sendMessage() {
        const query = userInput.value.trim();
        if (!query) return; // Don't send empty messages

        addMessage(query, 'user');
        userInput.value = ''; // Clear input field
        sendButton.disabled = true; // Disable button while waiting
        addMessage("<i>Thinking...</i>", 'ai'); // Add thinking indicator

        try {
            const response = await fetch('/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: query, session_id: sessionId }),
            });

            // Remove the "Thinking..." message
            const thinkingMessage = chatBox.querySelector('.ai-message:last-child');
            if (thinkingMessage && thinkingMessage.querySelector('i')) {
                chatBox.removeChild(thinkingMessage);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            addMessage(data.response, 'ai');

        } catch (error) {
             // Remove the "Thinking..." message even on error
            const thinkingMessage = chatBox.querySelector('.ai-message:last-child');
            if (thinkingMessage && thinkingMessage.querySelector('i')) {
                chatBox.removeChild(thinkingMessage);
            }
            console.error('Error sending message:', error);
            addMessage(`Sorry, an error occurred: ${error.message}`, 'ai');
        } finally {
            sendButton.disabled = false; // Re-enable button
            userInput.focus();
        }
    }

    // Function to load history
    async function loadHistory() {
        try {
            const response = await fetch(`/conversation/history?session_id=${sessionId}`);
            if (!response.ok) {
                 console.error("Failed to fetch history:", response.status);
                 return; // Don't wipe chat on history load failure
            }
            const data = await response.json();
            // Clear existing messages except the initial greeting
            const initialGreeting = chatBox.querySelector('.ai-message');
            chatBox.innerHTML = '';
            if (initialGreeting) {
                chatBox.appendChild(initialGreeting);
            }
            // Add messages from history
            data.history.forEach(msg => {
                if (msg.role !== 'system') { // Avoid showing system prompts if any
                     addMessage(msg.text, msg.role === 'user' ? 'user' : 'ai');
                }
            });
        } catch (error) {
            console.error('Error loading history:', error);
             // Optionally display an error in the chat
             // addMessage("Could not load previous messages.", 'ai');
        }
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // Load chat history on page load
    loadHistory();
});
