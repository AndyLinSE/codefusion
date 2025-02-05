const { dialog } = require('electron');
const fs = require('fs');
const { loadGitignorePatterns, processDirectory, saveFile } = require('./fileSystem');
const { supportedExtensions, defaultOmitPatterns } = require('./config');

function registerIpcHandlers(ipcMain, mainWindow) {
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
        try {
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

            const { combinedText, filePreview } = await processDirectory(
                folderPath, 
                folderPath, 
                omitPatterns, 
                overridesSet,
                supportedExtensions
            );

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
            return await saveFile(filePath, content);
        }
        return { success: false };
    });
}

module.exports = {
    registerIpcHandlers
}; 