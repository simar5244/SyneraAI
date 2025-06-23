// Utility functions for fetching and processing website content
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { convert } from 'html-to-text';

/**
 * Fetches content from a website URL and extracts relevant information
 * @param {string} url - The website URL to fetch
 * @returns {Promise<{content: string, data: {url: string, title: string}}>}
 */
export async function fetchWebsiteContext(url) {
  try {
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Fetch the website content
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 // 10 second timeout
    });
    
    // Parse the HTML
    const dom = new JSDOM(response.data);
    const document = dom.window.document;
    
    // Extract title
    const title = document.title || 'Untitled Page';
    
    // Extract main content
    let content = '';
    
    // Try to get content from main element
    const mainElement = document.querySelector('main');
    if (mainElement) {
      content = mainElement.textContent;
    } else {
      // Fallback to body content
      const bodyContent = document.body.textContent;
      content = bodyContent;
    }
    
    // Clean up the content
    content = convert(content, {
      wordwrap: 130,
      preserveNewlines: true,
      singleNewLineParagraphs: true,
      limits: {
        maxInputLength: 10000 // Limit to prevent excessive processing
      }
    });
    
    // Truncate if too long
    if (content.length > 5000) {
      content = content.substring(0, 5000) + '... [content truncated]';
    }
    
    return {
      content,
      data: {
        url,
        title
      }
    };
  } catch (error) {
    console.error('Error fetching website:', error.message);
    return {
      content: `Failed to fetch website content: ${error.message}`,
      data: {
        url,
        title: 'Error Fetching Website'
      }
    };
  }
}
