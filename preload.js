const { contextBridge, ipcRenderer, clipboard } = require('electron');
const path = require('path');

console.log('Preload script starting...'); // Debug log

try {
    // Test clipboard availability
    console.log('Testing clipboard availability...'); // Debug log
    console.log('Clipboard object available:', !!clipboard); // Debug log
    
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
                ipcRenderer.invoke('handle-folder', folderPath),
            openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
            // Add clipboard methods with proper error handling
            writeToClipboard: async (text) => {
                console.log('writeToClipboard called with text length:', text?.length); // Debug log
                try {
                    if (!clipboard) {
                        throw new Error('Clipboard API not available');
                    }
                    if (!text) {
                        throw new Error('No text provided to copy');
                    }
                    
                    // Try writing to clipboard
                    console.log('Attempting to write to clipboard...'); // Debug log
                    await clipboard.writeText(text);
                    console.log('Write to clipboard successful'); // Debug log
                    return true;
                } catch (error) {
                    console.error('Clipboard write error - Full details:', {
                        error: error,
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    });
                    throw error;
                }
            },
            readFromClipboard: async () => {
                console.log('readFromClipboard called'); // Debug log
                try {
                    if (!clipboard) {
                        throw new Error('Clipboard API not available');
                    }
                    const text = await clipboard.readText();
                    console.log('Read from clipboard successful, length:', text?.length); // Debug log
                    return text;
                } catch (error) {
                    console.error('Clipboard read error - Full details:', {
                        error: error,
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    });
                    throw error;
                }
            }
        }
    );
    console.log('API exposed successfully'); // Debug log
} catch (error) {
    console.error('Error in preload script - Full details:', {
        error: error,
        name: error.name,
        message: error.message,
        stack: error.stack
    });
} 