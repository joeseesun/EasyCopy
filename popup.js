/**
 * EasyCopy - Chrome Extension
 * Popup script to handle UI interactions
 */

document.addEventListener('DOMContentLoaded', function() {
  // Copy scope elements
  const scopeElements = {
    this_tab: document.getElementById('this_tab'),
    window_tabs: document.getElementById('window_tabs'),
    all_tabs: document.getElementById('all_tabs'),
    all_tabs_by_window: document.getElementById('all_tabs_by_window')
  };
  
  // Copy format elements
  const formatElements = {
    url: document.getElementById('url'),
    title_url: document.getElementById('title_url'),
    title_and_url: document.getElementById('title_and_url'),
    title: document.getElementById('title'),
    markdown: document.getElementById('markdown'),
    bbcode: document.getElementById('bbcode'),
    csv: document.getElementById('csv'),
    json: document.getElementById('json'),
    html: document.getElementById('html'),
    html_table: document.getElementById('html_table')
  };
  
  // Add click events for scope items
  for (const [scope, element] of Object.entries(scopeElements)) {
    element.addEventListener('click', function() {
      // Call background script copy function
      chrome.runtime.sendMessage({
        action: 'copyTabs',
        scope: scope,
        format: 'title_and_url' // Default format: title and URL
      });
      
      // Show success feedback
      showFeedback(element, true);
      
      // Delay closing popup
      setTimeout(() => {
        window.close();
      }, 500);
    });
  }
  
  // Add click events for format items
  for (const [format, element] of Object.entries(formatElements)) {
    element.addEventListener('click', function() {
      // Call background script copy function
      chrome.runtime.sendMessage({
        action: 'copyTabs',
        scope: 'this_tab', // Default scope: current tab
        format: format
      });
      
      // Show success feedback
      showFeedback(element, true);
      
      // Delay closing popup
      setTimeout(() => {
        window.close();
      }, 500);
    });
  }
  
  // Visual feedback function
  function showFeedback(element, success) {
    const originalColor = element.style.backgroundColor;
    element.style.backgroundColor = success ? '#4CAF50' : '#F44336';
    
    setTimeout(() => {
      element.style.backgroundColor = originalColor;
    }, 300);
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'copyResult') {
      if (message.success) {
        // Handle successful copy
      } else {
        // Handle failed copy
      }
    }
  });
});
