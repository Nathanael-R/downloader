// Content script that intercepts network requests containing project data
// This runs on rork.com pages

(function() {
  'use strict';

  // ========================================
  // CONFIGURATION - Target specific API
  // ========================================
  var TARGET_KEYWORDS = [
    'fetchSnapshot',
    'projects.fetchSnapshot',
    'project.fetchSnapshot'
  ];
  
  console.log('[Rork Downloader] Content script loaded - listening for:', TARGET_KEYWORDS);
  console.log('[Rork Downloader] Debug: window.fetch exists =', typeof window.fetch);

  // Store captured data globally so popup can access it
  window.__RORK_CAPTURED_DATA__ = null;
  window.__RORK_DEBUG_REQUESTS__ = [];

  // Helper to check if URL matches our target endpoint
  function isTargetRequest(url) {
    if (typeof url !== 'string') return false;
    for (var i = 0; i < TARGET_KEYWORDS.length; i++) {
      var keyword = TARGET_KEYWORDS[i];
      if (url.includes(keyword) || url.includes(encodeURIComponent(keyword))) {
        return true;
      }
    }
    return false;
  }

  // Helper to check if response has project data structure
  function hasProjectData(data) {
    if (data && data.result && data.result.data && data.result.data.json && data.result.data.json.snapshot) {
      return true;
    }
    if (data && data.snapshot) {
      return true;
    }
    if (Array.isArray(data) && data[0] && data[0].result && data[0].result.data && data[0].result.data.json && data[0].result.data.json.snapshot) {
      return true;
    }
    return false;
  }

  // Extract project data from various response formats
  function extractProjectData(data) {
    if (data && data.result && data.result.data && data.result.data.json && data.result.data.json.snapshot) {
      return data;
    }
    if (data && data.snapshot) {
      return { result: { data: { json: data } } };
    }
    if (Array.isArray(data) && data[0] && data[0].result) {
      return data[0];
    }
    return null;
  }

  // Method 1: Intercept fetch requests
  var originalFetch = window.fetch;
  window.fetch = function() {
    var args = arguments;
    var url = '';
    
    if (args[0]) {
      if (typeof args[0] === 'string') {
        url = args[0];
      } else if (args[0].url) {
        url = args[0].url;
      } else if (args[0].toString) {
        url = args[0].toString();
      }
    }
    
    // Log requests for debugging
    if (window.__RORK_DEBUG_REQUESTS__.length < 20) {
      window.__RORK_DEBUG_REQUESTS__.push(url);
      console.log('[Rork Downloader] 📡 Fetch request:', url.substring(0, 100));
    }

    return originalFetch.apply(this, args).then(function(response) {
      var clonedResponse = response.clone();
      
      var shouldCheck = isTargetRequest(url) || 
                        (typeof url === 'string' && (url.includes('trpc') || url.includes('api')));
      
      if (shouldCheck) {
        var contentType = clonedResponse.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          clonedResponse.json().then(function(data) {
            if (isTargetRequest(url)) {
              console.log('[Rork Downloader] 🔍 Target request detected:', url);
              console.log('[Rork Downloader] 📦 Response structure:', Object.keys(data));
            }
            
            if (hasProjectData(data)) {
              var projectData = extractProjectData(data);
              var snapshotId = projectData.result.data.json.snapshotId;
              var snapshot = projectData.result.data.json.snapshot;
              var fileCount = Object.keys(snapshot).length;
              
              console.log('[Rork Downloader] 🎯 Captured project data!', {
                snapshotId: snapshotId,
                fileCount: fileCount
              });
              
              window.__RORK_CAPTURED_DATA__ = projectData;
              
              window.dispatchEvent(new CustomEvent('rork-data-captured', {
                detail: { snapshotId: snapshotId, fileCount: fileCount }
              }));
            }
          }).catch(function() {
            // Ignore parse errors
          });
        }
      }
      
      return response;
    });
  };

  console.log('[Rork Downloader] ✅ Fetch interceptor installed');

  // Method 2: Intercept XMLHttpRequest
  var originalXHROpen = XMLHttpRequest.prototype.open;
  var originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    var self = this;
    
    this.addEventListener('load', function() {
      try {
        var url = self._url;
        
        if (window.__RORK_DEBUG_REQUESTS__.length < 30) {
          window.__RORK_DEBUG_REQUESTS__.push('[XHR] ' + url);
        }
        
        var shouldCheck = isTargetRequest(url) || 
                          (typeof url === 'string' && url.includes('trpc'));
        
        if (shouldCheck) {
          console.log('[Rork Downloader] 🔍 XHR request:', url);
          
          var contentType = self.getResponseHeader('content-type');
          
          if (contentType && contentType.includes('application/json')) {
            var data = JSON.parse(self.responseText);
            
            if (hasProjectData(data)) {
              var projectData = extractProjectData(data);
              console.log('[Rork Downloader] 🎯 Captured project data via XHR!');
              window.__RORK_CAPTURED_DATA__ = projectData;
              
              window.dispatchEvent(new CustomEvent('rork-data-captured', {
                detail: { 
                  snapshotId: projectData.result.data.json.snapshotId,
                  fileCount: Object.keys(projectData.result.data.json.snapshot).length
                }
              }));
            }
          }
        }
      } catch (e) {
        // Ignore
      }
    });

    return originalXHRSend.apply(this, arguments);
  };

  console.log('[Rork Downloader] ✅ XHR interceptor installed');

  // Visual indicator when data is captured
  window.addEventListener('rork-data-captured', function(e) {
    function showIndicator() {
      if (!document.body) {
        setTimeout(showIndicator, 100);
        return;
      }
      
      var indicator = document.createElement('div');
      indicator.style.cssText = 
        'position: fixed;' +
        'top: 20px;' +
        'right: 20px;' +
        'background: #4CAF50;' +
        'color: white;' +
        'padding: 12px 20px;' +
        'border-radius: 8px;' +
        'font-family: -apple-system, sans-serif;' +
        'font-size: 14px;' +
        'z-index: 999999;' +
        'box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
      indicator.textContent = '✓ Project captured! Click extension to download.';
      document.body.appendChild(indicator);
      
      setTimeout(function() {
        indicator.style.opacity = '0';
        indicator.style.transition = 'opacity 0.3s';
        setTimeout(function() {
          indicator.remove();
        }, 300);
      }, 4000);
    }
    
    showIndicator();
  });

})();
