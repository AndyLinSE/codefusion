const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// Supported file extensions
const supportedExtensions = [
  '.js', '.jsx', '.ts', '.tsx',  // JavaScript and TypeScript
  '.json', '.md',                // Data and documentation
  '.html', '.css',               // Web files
  '.rules', '.py'                // Other supported types
];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // Enable developer tools
  mainWindow.webContents.openDevTools();
}

// Load .gitignore patterns if they exist
function loadGitignorePatterns(folderPath) {
  const gitignorePath = path.join(folderPath, '.gitignore');
  let patterns = [];
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    patterns = gitignoreContent.split('\n')
      .filter(line => line && !line.startsWith('#'))
      .map(pattern => new RegExp(pattern.trim().replace('*', '.*'), 'i'));
  }
  return patterns;
}

// Register IPC handlers
function registerIpcHandlers() {
  // Handler for folder selection
  ipcMain.handle('handle-folder', async (event, folderPath) => {
    try {
      const stats = await fs.promises.stat(folderPath);
      if (stats.isDirectory()) {
        return { success: true, path: folderPath };
      }
      return { success: false, error: 'Selected path is not a directory' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handler for folder processing
  ipcMain.handle('process-folder', async (event, folderPath, userOmitPatterns, individualOverrides = []) => {
    let combinedText = '';
    let filePreview = [];

    // Default patterns to omit with labels
    const defaultOmitPatterns = [
      { pattern: /^\.git\//, label: 'Git directory' },
      { pattern: /^node_modules\//, label: 'Node modules directory' }
    ];

    // Convert gitignore patterns
    const gitignorePatterns = loadGitignorePatterns(folderPath).map(pattern => ({
      pattern,
      label: 'Matched .gitignore pattern'
    }));

    // Convert user patterns
    const labeledUserPatterns = userOmitPatterns.map(pattern => ({
      pattern,
      label: 'Matched custom omit pattern'
    }));

    // Combine all patterns
    const omitPatterns = [...defaultOmitPatterns, ...gitignorePatterns, ...labeledUserPatterns];

    // Convert individualOverrides array to Set for faster lookups
    const overridesSet = new Set(individualOverrides);

    async function processDirectory(dir) {
      const files = await fs.promises.readdir(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = await fs.promises.stat(fullPath);
        const relativePath = path.relative(folderPath, fullPath);
        
        // Check if path should be omitted and get the reason
        let shouldOmit = false;
        let omitReason = '';
        
        if (!overridesSet.has(relativePath)) {
          for (const {pattern, label} of omitPatterns) {
            if (pattern.test(relativePath)) {
              shouldOmit = true;
              omitReason = label;
              break;
            }
          }
        }
        
        if (stat.isDirectory()) {
          filePreview.push({ 
            path: relativePath,
            type: 'directory', 
            included: !shouldOmit,
            size: 0,
            omitReason
          });
          if (!shouldOmit) {
            await processDirectory(fullPath);
          }
        } else {
          const ext = path.extname(file).toLowerCase();
          const isSupported = supportedExtensions.includes(ext);
          if (!isSupported && !omitReason) {
            shouldOmit = true;
            omitReason = `File type "${ext}" is not in supported extensions list`;
          }
          
          const isIncluded = !shouldOmit || overridesSet.has(relativePath);
          
          filePreview.push({ 
            path: relativePath,
            type: 'file', 
            included: isIncluded,
            size: stat.size,
            omitReason: isIncluded ? '' : omitReason
          });

          // Add content to combinedText if file is included
          if (isIncluded) {
            try {
              const content = await fs.promises.readFile(fullPath, 'utf8');
              const relativeDir = path.relative(folderPath, dir);
              combinedText += `\n// ===== Folder: ${relativeDir || '.'} | File: ${file} =====\n${content}\n`;
            } catch (error) {
              console.error(`Error reading file ${fullPath}:`, error);
            }
          }
        }
      }
    }

    try {
      await processDirectory(folderPath);
      return { 
        combinedText, 
        totalCharacters: combinedText.length,
        approxTokens: Math.ceil(combinedText.length / 4),
        filePreview,
        success: true 
      };
    } catch (error) {
      console.error('Error processing folder:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for saving file
  ipcMain.handle('save-file', async (event, content) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Combined File',
      defaultPath: 'combined_code.txt',
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (filePath) {
      try {
        await fs.promises.writeFile(filePath, content, 'utf8');
        return { success: true, filePath };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    return { success: false };
  });
}

app.whenReady().then(() => {
  createWindow();
  registerIpcHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 