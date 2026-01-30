const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Where to save downloaded projects
const OUTPUT_DIR = path.join(__dirname, '..', 'projects');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main endpoint to process project JSON
app.post('/process', (req, res) => {
  try {
    const data = req.body;
    
    // Extract snapshot from the nested structure
    const snapshot = data?.result?.data?.json?.snapshot;
    const snapshotId = data?.result?.data?.json?.snapshotId || `project_${Date.now()}`;
    
    // Use custom folder name if provided, otherwise use snapshotId
    const folderName = data?.customFolderName || snapshotId;
    
    if (!snapshot) {
      return res.status(400).json({ 
        error: 'Invalid data structure. Expected result.data.json.snapshot' 
      });
    }

    console.log(`\n📦 Processing project: ${folderName}`);
    if (data?.customFolderName) {
      console.log(`   (Original snapshot ID: ${snapshotId})`);
    }
    console.log(`   Items in snapshot: ${Object.keys(snapshot).length}`);

    // Create project directory
    const projectPath = path.join(OUTPUT_DIR, folderName);
    
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    let foldersCreated = 0;
    let filesCreated = 0;
    let errors = [];

    // Process each item in the snapshot
    for (const [itemPath, item] of Object.entries(snapshot)) {
      try {
        const fullPath = path.join(projectPath, itemPath);
        
        if (item.type === 'folder') {
          // Create directory
          if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            foldersCreated++;
            console.log(`   📁 Created folder: ${itemPath}`);
          }
        } else if (item.type === 'file') {
          // Ensure parent directory exists
          const parentDir = path.dirname(fullPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          
          // Write file content
          if (item.contents !== undefined && !item.isBinary) {
            fs.writeFileSync(fullPath, item.contents, 'utf8');
            filesCreated++;
            console.log(`   📄 Created file: ${itemPath}`);
          } else if (item.isBinary) {
            console.log(`   ⚠️  Skipped binary file: ${itemPath}`);
          }
        }
      } catch (itemError) {
        console.error(`   ❌ Error processing ${itemPath}:`, itemError.message);
        errors.push({ path: itemPath, error: itemError.message });
      }
    }

    console.log(`\n✅ Project created successfully!`);
    console.log(`   Location: ${projectPath}`);
    console.log(`   Folders: ${foldersCreated}, Files: ${filesCreated}`);
    
    if (errors.length > 0) {
      console.log(`   Errors: ${errors.length}`);
    }

    res.json({
      success: true,
      projectPath,
      snapshotId,
      foldersCreated,
      filesCreated,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Error processing request:', error);
    res.status(500).json({ error: error.message });
  }
});

// List downloaded projects
app.get('/projects', (req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json({ projects: [] });
    }
    
    const projects = fs.readdirSync(OUTPUT_DIR)
      .filter(name => {
        const fullPath = path.join(OUTPUT_DIR, name);
        return fs.statSync(fullPath).isDirectory();
      })
      .map(name => ({
        name,
        path: path.join(OUTPUT_DIR, name),
        createdAt: fs.statSync(path.join(OUTPUT_DIR, name)).birthtime
      }));
    
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`
🚀 Rork Downloader Server running!
   
   Health: http://localhost:${PORT}/health
   Process: POST http://localhost:${PORT}/process
   Projects: http://localhost:${PORT}/projects
   
   Output directory: ${OUTPUT_DIR}
   
   Waiting for projects from Chrome extension...
  `);
});
