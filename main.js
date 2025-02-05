const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// Supported file extensions
const supportedExtensions = [
  // JavaScript and TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  
  // Web Development
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
  
  // Documentation and Config
  '.md', '.mdx', '.txt', '.yaml', '.yml', '.toml', '.ini', '.env.example',
  '.json', '.jsonc', '.json5',
  
  // Python
  '.py', '.pyi', '.pyw', '.ipynb',
  
  // Other Programming Languages
  '.java', '.kt', '.scala',          // JVM languages
  '.c', '.cpp', '.h', '.hpp',        // C/C++
  '.cs',                             // C#
  '.go',                             // Go
  '.rb',                             // Ruby
  '.php',                            // PHP
  '.rs',                             // Rust
  '.swift',                          // Swift
  '.sh', '.bash', '.zsh', '.fish',   // Shell scripts
  '.pl', '.pm',                      // Perl
  
  // Config and Build
  '.xml', '.gradle', '.properties',  // Build configs
  '.dockerfile', '.containerfile',   // Container configs
  '.rules'                           // Custom rules
];

function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1200,
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
      additionalPermissions: ['clipboard-read', 'clipboard-write']
    }
  });

  mainWindow.show();
  mainWindow.loadFile('index.html');
}

// Load .gitignore patterns if they exist
function loadGitignorePatterns(folderPath) {
  const gitignorePath = path.join(folderPath, '.gitignore');
  let patterns = [];
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    patterns = gitignoreContent.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(pattern => {
        // Escape special regex characters except * and ?
        let regexPattern = pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        
        // Handle directory-specific patterns
        if (pattern.endsWith('/')) {
          regexPattern = `${regexPattern}.*`;
        }
        
        // Handle patterns starting with /
        if (pattern.startsWith('/')) {
          regexPattern = `^${regexPattern.slice(1)}`;
        } else {
          regexPattern = `.*${regexPattern}`;
        }
        
        return new RegExp(regexPattern, 'i');
      });
  }
  return patterns;
}

// Register IPC handlers
function registerIpcHandlers() {
  // Handler for opening folder dialog
  ipcMain.handle('open-folder-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    }
    return { success: false, error: 'No folder selected' };
  });

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
      { pattern: /[\/\\]\.git[\/\\]|^\.git[\/\\]/, label: 'Git directory' },
      { pattern: /[\/\\]node_modules[\/\\]|^node_modules[\/\\]/, label: 'Node modules directory' },
      { pattern: /(^|[\/\\])\.[^\/\\]+($|[\/\\])/, label: 'Hidden file/directory' },
      { pattern: /[\/\\]dist[\/\\]|^dist[\/\\]/, label: 'Distribution directory' },
      { pattern: /[\/\\]build[\/\\]|^build[\/\\]/, label: 'Build directory' },
      { pattern: /[\/\\]out[\/\\]|^out[\/\\]/, label: 'Output directory' },
      { pattern: /[\/\\]coverage[\/\\]|^coverage[\/\\]/, label: 'Test coverage directory' },
      { pattern: /[\/\\](temp|\.tmp)[\/\\]|^(temp|\.tmp)[\/\\]/, label: 'Temporary files directory' },
      { pattern: /[\/\\]__pycache__[\/\\]|^__pycache__[\/\\]/, label: 'Python cache directory' },
      { pattern: /[\/\\]vendor[\/\\]|^vendor[\/\\]/, label: 'Third-party vendor directory' },
      { pattern: /[\/\\]bin[\/\\]|^bin[\/\\]/, label: 'Binary files directory' },
      { pattern: /[\/\\]obj[\/\\]|^obj[\/\\]/, label: 'Object files directory' },
      { pattern: /[\/\\]target[\/\\]|^target[\/\\]/, label: 'Build target directory' }
    ];

    // Example custom pattern formats (for documentation)
    const customPatternExamples = [
      // These are just examples and won't be used in the actual filtering
      { pattern: 'test\\.js$', description: 'Ignore all test.js files' },
      { pattern: '\\.spec\\.', description: 'Ignore all spec/test files' },
      { pattern: 'backup', description: 'Ignore any path containing "backup"' },
      { pattern: '^src/temp/', description: 'Ignore temp folder only in src directory' },
      { pattern: '\\.min\\.js$', description: 'Ignore minified JavaScript files' },
      { pattern: '(logs?|debug)', description: 'Ignore log or debug folders/files' },
      { pattern: '\\.bak$', description: 'Ignore backup files ending in .bak' },
      { pattern: 'draft.*\\.md$', description: 'Ignore markdown files starting with draft' }
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
          // Only process directory contents if it's not omitted or explicitly included in overrides
          if (!shouldOmit || overridesSet.has(relativePath)) {
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