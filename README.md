# Rork Project Downloader

A Chrome extension that intercepts project data from rork.com and automatically downloads the complete project structure to your local machine. Perfect for backing up your Rork projects or working on them offline.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   rork.com      │────▶│ Chrome Extension│────▶│  Local Server   │
│  (JSON response)│     │ (intercepts)    │     │ (creates files) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                 ┌─────────────────┐
                                                 │ ./projects/     │
                                                 │   └─ your-app/  │
                                                 │       ├─ app/   │
                                                 │       ├─ ...    │
                                                 └─────────────────┘
```

## Setup

### 1. Start the Local Server

```bash
cd server
npm install
npm start
```

You should see:

```
🚀 Rork Downloader Server running!
   Health: http://localhost:3000/health
```

### 2. Install the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension` folder from this project

### 3. Use It

1. Navigate to your project on `https://rork.com/project-id`
2. Wait for the page to load (the extension will intercept API responses)
3. You'll see a green notification: "✓ Project captured!"
4. Click the extension icon in Chrome toolbar
5. Click **"Capture Project"**
6. Your project will be downloaded to `./projects/[snapshot-id]/`

## Folder Structure

```
downloader/
├── extension/           # Chrome extension
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── content.js
│   └── background.js
├── server/              # Local Node.js server
│   ├── package.json
│   └── server.js
├── projects/            # Downloaded projects appear here
│   └── [snapshot-id]/
└── README.md
```

## Troubleshooting

### Extension says "Server not running"

Make sure the server is running with `npm start` in the `server` folder.

### No data captured

- Refresh the rork.com page
- Make sure you're on a project page (not the homepage)
- Check the browser console for `[Rork Downloader]` logs

### Wrong API endpoint being intercepted

Edit `extension/content.js` and adjust the URL patterns in the `fetch` intercept to match the actual rork.com API endpoints.

## Development

The content script intercepts:

- `fetch()` requests
- `XMLHttpRequest` requests

It looks for JSON responses containing `result.data.json.snapshot` structure.

To debug, open Chrome DevTools on a rork.com page and check the Console for `[Rork Downloader]` messages.
