// Background service worker
// Handles communication between content scripts and popup

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PROJECT_CAPTURED') {
    console.log('[Rork Downloader] Project data received in background', message.data?.result?.data?.json?.snapshotId);
    
    // Store in chrome.storage for persistence
    chrome.storage.local.set({ 
      capturedProject: message.data,
      capturedAt: Date.now()
    });
  }
  
  return true;
});

// Badge to indicate when data is captured
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Rork Downloader] Extension installed');
});
