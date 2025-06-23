'use client';
import React, { useEffect, useState } from 'react';

// Ensure we're loading and saving conversation history per report ID
const loadConversationHistory = async (reportId) => {
  try {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return [];
    
    const response = await fetch(`/api/conversations?reportId=${reportId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.conversations || [];
  } catch (error) {
    console.error('Error loading conversation history:', error);
    return [];
  }
};

// Save conversation history with report ID
const saveConversationHistory = async (reportId, conversations) => {
  try {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        reportId,
        conversations
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error saving conversation history:', error);
    return false;
  }
};

// In the useEffect where we load the report data, also load the conversation history
useEffect(() => {
  const fetchReportData = async () => {
    // ... existing code to fetch report ...
    
    // Also load conversation history for this specific report
    if (reportId) {
      const history = await loadConversationHistory(reportId);
      setChatHistory(history);
    }
  };
  
  fetchReportData();
}, [reportId]);

// Update the handleChatSubmit function to save conversations per report
const handleChatSubmit = async (e) => {
  e.preventDefault();
  // ... existing code ...
  
  try {
    // ... existing API call ...
    
    // Add the new messages to chat history
    const updatedHistory = [
      ...chatHistory,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: data.response }
    ];
    
    // Update state
    setChatHistory(updatedHistory);
    
    // Save the updated conversation history with the report ID
    await saveConversationHistory(reportId, updatedHistory);
    
    // ... rest of existing code ...
  } catch (error) {
    // ... error handling ...
  }
};

// ... existing code ... 