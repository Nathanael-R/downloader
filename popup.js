const SERVER_URL = 'http://localhost:3000';

const statusEl = document.getElementById('status');
const captureBtn = document.getElementById('captureBtn');
const processBtn = document.getElementById('processBtn');
const jsonInput = document.getElementById('jsonInput');
const folderNameAuto = document.getElementById('folderNameAuto');
const folderNameManual = document.getElementById('folderNameManual');
const logEl = document.getElementById('log');

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
  logEl.insertBefore(entry, logEl.firstChild);
}

async function checkServer() {
  try {
    const res = await fetch(`${SERVER_URL}/health`, { method: 'GET' });
    if (res.ok) {
      statusEl.textContent = '✓ Server connected';
      statusEl.className = 'status connected';
      captureBtn.disabled = false;
      processBtn.disabled = false;
      log('Server is running', 'success');
      return true;
    }
  } catch (e) {
    // Server not running
  }
  
  statusEl.textContent = '✗ Server not running - Start the local server first';
  statusEl.className = 'status disconnected';
  captureBtn.disabled = true;
  processBtn.disabled = true;
  log('Server not reachable', 'error');
  return false;
}

// Send data to server
async function sendToServer(data, customFolderName = '') {
  log(`Sending project to server...`, 'info');

  try {
    // Add custom folder name to the request
    const payload = {
      ...data,
      customFolderName: customFolderName.trim() || null
    };

    const res = await fetch(`${SERVER_URL}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (res.ok) {
      log(`✓ Created: ${result.projectPath}`, 'success');
      log(`Files: ${result.filesCreated}, Folders: ${result.foldersCreated}`, 'success');
      return true;
    } else {
      log(`Error: ${result.error}`, 'error');
      return false;
    }
  } catch (err) {
    log(`Error: ${err.message}`, 'error');
    return false;
  }
}

// Auto capture from page
captureBtn.addEventListener('click', async () => {
  captureBtn.disabled = true;
  captureBtn.textContent = 'Capturing...';
  log('Requesting project data from page...', 'info');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id) {
      throw new Error('No active tab found');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__RORK_CAPTURED_DATA__ || null
    });

    const capturedData = results?.[0]?.result;

    if (!capturedData) {
      log('No project data captured yet. Try refreshing the page.', 'error');
      log('Or use "Paste JSON" tab to manually paste the data.', 'info');
    } else {
      await sendToServer(capturedData, folderNameAuto.value);
    }

  } catch (err) {
    log(`Error: ${err.message}`, 'error');
  }

  captureBtn.textContent = 'Capture Project';
  captureBtn.disabled = false;
});

// Manual JSON paste
processBtn.addEventListener('click', async () => {
  const jsonText = jsonInput.value.trim();
  
  if (!jsonText) {
    log('Please paste the JSON data first', 'error');
    return;
  }

  processBtn.disabled = true;
  processBtn.textContent = 'Processing...';

  try {
    const data = JSON.parse(jsonText);
    
    // Validate structure
    if (!data?.result?.data?.json?.snapshot) {
      log('Invalid JSON structure. Expected result.data.json.snapshot', 'error');
      log('Make sure you copied the full response from Network tab', 'info');
    } else {
      const snapshotId = data.result.data.json.snapshotId || 'unknown';
      const fileCount = Object.keys(data.result.data.json.snapshot).length;
      log(`Found project: ${snapshotId} (${fileCount} items)`, 'info');
      
      const success = await sendToServer(data, folderNameManual.value);
      if (success) {
        jsonInput.value = ''; // Clear on success
        folderNameManual.value = '';
      }
    }
  } catch (e) {
    log(`Invalid JSON: ${e.message}`, 'error');
  }

  processBtn.textContent = 'Process JSON';
  processBtn.disabled = false;
});

// Check server on popup open
checkServer();
