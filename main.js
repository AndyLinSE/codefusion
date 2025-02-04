const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // For simplicity; in production, use a preload script
    }
  });

  mainWindow.loadFile('index.html');
  
  // Uncomment for development tools
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

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

// Handle folder processing request
ipcMain.handle('process-folder', async (event, folderPath, userOmitPatterns, individualOverrides = []) => {
  let combinedText = '';
  let filePreview = [];

  // Default patterns to omit
  const defaultOmitPatterns = [
    /^\.git\//,  // Only ignore .git directory, not all files starting with .
    /^node_modules\//  // Only ignore node_modules directory
  ];

  // Combine all patterns
  const gitignorePatterns = loadGitignorePatterns(folderPath);
  const omitPatterns = [...defaultOmitPatterns, ...gitignorePatterns, ...userOmitPatterns];

  // Supported file extensions
  const supportedExtensions = ['.js', '.json', '.md', '.ts', '.html', '.css', '.rules', '.py'];

  async function processDirectory(dir) {
    const files = await fs.promises.readdir(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = await fs.promises.stat(fullPath);
      const relativePath = path.relative(folderPath, fullPath);
      
      // Check if path should be omitted, but respect individual overrides
      const shouldOmit = !individualOverrides.includes(fullPath) && 
                        omitPatterns.some(pattern => pattern.test(relativePath));
      
      if (stat.isDirectory()) {
        filePreview.push({ path: fullPath, type: 'directory', included: !shouldOmit });
        if (!shouldOmit) {
          await processDirectory(fullPath);
        }
      } else {
        const ext = path.extname(file).toLowerCase();
        const isSupported = supportedExtensions.includes(ext);
        const isIncluded = (isSupported && !shouldOmit) || individualOverrides.includes(fullPath);
        
        filePreview.push({ path: fullPath, type: 'file', included: isIncluded });
        
        if (isIncluded) {
          try {
            const content = await fs.promises.readFile(fullPath, 'utf8');
            const relativePath = path.relative(folderPath, dir);
            combinedText += `\n// ===== Folder: ${relativePath || '.'} | File: ${file} =====\n${content}\n`;
          } catch (error) {
            console.error(`Error reading file ${fullPath}:`, error);
          }
        }
      }
    }
  }

  try {
    await processDirectory(folderPath);
    
    const totalCharacters = combinedText.length;
    const approxTokens = Math.ceil(totalCharacters / 4);
    
    return { 
      combinedText, 
      totalCharacters, 
      approxTokens, 
      filePreview,
      success: true 
    };
  } catch (error) {
    console.error('Error processing folder:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Handle save file request
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