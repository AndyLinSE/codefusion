const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

try {
    // Supported file extensions
    const supportedExtensions = [
        '.js', '.jsx', '.ts', '.tsx',  // JavaScript and TypeScript
        '.json', '.md',                // Data and documentation
        '.html', '.css',               // Web files
        '.rules', '.py'                // Other supported types
    ];

    // Expose protected methods that allow the renderer process to use
    // the ipcRenderer without exposing the entire object
    contextBridge.exposeInMainWorld(
        'api', {
            getSupportedExtensions: () => supportedExtensions,
            processFolder: (folderPath, omitPatterns, individualOverrides) => 
                ipcRenderer.invoke('process-folder', folderPath, omitPatterns, individualOverrides),
            saveFile: (content) => 
                ipcRenderer.invoke('save-file', content),
            // File system methods
            getPath: (filePath) => path.normalize(filePath),
            handleFolder: (folderPath) => 
                ipcRenderer.invoke('handle-folder', folderPath)
        }
    );
} catch (error) {
    console.error('Error in preload script:', error);
} 