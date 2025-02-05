const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { windowConfig } = require('./src/config');
const { registerIpcHandlers } = require('./src/ipcHandlers');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        show: false,
        ...windowConfig,
        icon: path.join(__dirname, 'assets/icon.ico'),
        webPreferences: {
            ...windowConfig.webPreferences,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.maximize();
    mainWindow.show();
    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    registerIpcHandlers(ipcMain, mainWindow);
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