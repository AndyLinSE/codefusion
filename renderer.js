const { ipcRenderer } = require('electron');
const path = require('path');

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const settingsPanel = document.getElementById('settings-panel');
const previewPanel = document.getElementById('preview-panel');
const resultPanel = document.getElementById('result-panel');
const folderPath = document.getElementById('folder-path');
const processBtn = document.getElementById('process-btn');
const previewList = document.getElementById('preview-list');
const previewFilter = document.getElementById('preview-filter');
const includedCount = document.getElementById('included-count');
const excludedCount = document.getElementById('excluded-count');
const charCount = document.getElementById('char-count');
const tokenCount = document.getElementById('token-count');
const codePreview = document.getElementById('code-preview');
const saveBtn = document.getElementById('save-btn');
const newFolderBtn = document.getElementById('new-folder-btn');
const changeFolderBtn = document.getElementById('change-folder-btn');
const loadingOverlay = document.getElementById('loading-overlay');

// Checkbox elements
const omitGit = document.getElementById('omit-git');
const omitNodeModules = document.getElementById('omit-node-modules');
const omitHidden = document.getElementById('omit-hidden');
const omitMedia = document.getElementById('omit-media');
const customOmit = document.getElementById('custom-omit');

let currentFolderPath = '';
let filePreviewData = [];
let individualOverrides = new Set(); // Track individually overridden files

// Media file extensions to ignore
const mediaExtensions = [
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg', 'ico',
    // Audio
    'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma',
    // Video
    'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', '3gp',
    // Other media
    'psd', 'ai', 'eps', 'raw'
];

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFolderSelection(files[0].path);
    }
}

// Click to select folder
dropZone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.style.display = 'none';
    
    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFolderSelection(e.target.files[0].path);
        }
    });
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
});

function handleFolderSelection(path) {
    currentFolderPath = path;
    folderPath.textContent = path;
    dropZone.classList.add('hidden');
    settingsPanel.classList.remove('hidden');
}

// Build omit patterns from UI settings
function buildOmitPatterns() {
    const patterns = [];
    
    if (omitGit.checked) patterns.push(/^\.git/);
    if (omitNodeModules.checked) patterns.push(/^node_modules/);
    if (omitHidden.checked) patterns.push(/^\..*/);
    if (omitMedia.checked) {
        const mediaPattern = new RegExp(`\\.(${mediaExtensions.join('|')})$`, 'i');
        patterns.push(mediaPattern);
    }
    
    const customPatterns = customOmit.value
        .split(',')
        .map(p => p.trim())
        .filter(p => p)
        .map(p => {
            try {
                return new RegExp(p);
            } catch (e) {
                console.warn('Invalid regex pattern:', p);
                return null;
            }
        })
        .filter(p => p !== null);
    
    return [...patterns, ...customPatterns];
}

// Process the folder
async function processFolder() {
    if (!currentFolderPath) return;
    
    loadingOverlay.classList.remove('hidden');
    const omitPatterns = buildOmitPatterns();
    
    try {
        const result = await ipcRenderer.invoke('process-folder', currentFolderPath, omitPatterns);
        
        if (result.success) {
            filePreviewData = result.filePreview;
            updateFilePreview();
            updateStats(result);
            showResults(result);
        } else {
            alert('Error processing folder: ' + result.error);
        }
    } catch (error) {
        alert('Error processing folder: ' + error.message);
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

// Update the file preview list
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getIndentLevel(filePath) {
    return filePath.split(/[\\/]/).length - 1;
}

function getFilePath(path) {
    return path.split(/[\\/]/).join('/');
}

function getParentPath(path) {
    const parts = path.split(/[\\/]/);
    parts.pop();
    return parts.join('/');
}

function isHiddenFile(path) {
    const fileName = path.split(/[\\/]/).pop();
    return fileName.startsWith('.');
}

function getIgnoreReason(file) {
    if (!file || !file.path) return '';
    
    const fileName = file.path.split(/[\\/]/).pop();
    if (!fileName) return '';
    
    const ext = path.extname(fileName).toLowerCase();
    
    if (file.path.startsWith('.git/')) return 'Git directory';
    if (file.path.startsWith('node_modules/')) return 'Node modules directory';
    if (isHiddenFile(file.path)) return 'Hidden file/directory';
    if (file.type === 'file' && ext && !supportedExtensions.includes(ext)) {
        return `File type "${ext}" is not in supported extensions list. Add it to supportedExtensions in main.js to include it.`;
    }
    return '';
}

function updateFilePreview(filterText = '') {
    const lowerFilter = filterText.toLowerCase();
    const filteredFiles = filePreviewData.filter(file => 
        file.path.toLowerCase().includes(lowerFilter)
    );
    
    // Group files by directory
    const filesByDirectory = new Map();
    filteredFiles.forEach(file => {
        const parentPath = getParentPath(file.path);
        if (!filesByDirectory.has(parentPath)) {
            filesByDirectory.set(parentPath, []);
        }
        filesByDirectory.get(parentPath).push(file);
    });

    const included = filteredFiles.filter(f => {
        const isOverridden = individualOverrides.has(f.path);
        return isOverridden ? !f.included : f.included;
    }).length;
    const excluded = filteredFiles.length - included;
    
    includedCount.textContent = `${included} files included`;
    excludedCount.textContent = `${excluded} files excluded`;
    
    previewList.innerHTML = filteredFiles.map(file => {
        const isOverridden = individualOverrides.has(file.path);
        const isIncluded = isOverridden ? !file.included : file.included;
        const indentLevel = getIndentLevel(file.path);
        const isDirectory = file.type === 'directory';
        const hasChildren = filesByDirectory.has(file.path);
        const isHidden = isHiddenFile(file.path);
        const ignoreReason = getIgnoreReason(file);
        
        return `
            <div class="preview-item ${isIncluded ? 'included' : 'excluded'} ${isHidden ? 'hidden-item' : ''}" 
                 style="padding-left: ${indentLevel * 16 + 8}px"
                 data-path="${file.path}"
                 data-type="${file.type}">
                ${!isIncluded && ignoreReason ? `
                    <span class="info-icon" title="${ignoreReason}">ℹ️</span>
                ` : '<span class="info-icon-placeholder"></span>'}
                <button class="toggle-btn" data-path="${file.path}" data-original-state="${file.included}">
                    ${isIncluded ? '✅' : '🚫'}
                </button>
                <span class="file-type">
                    ${file.type}${hasChildren ? ' ▾' : ''}
                    ${isHidden ? '<span class="hidden-indicator">•</span>' : ''}
                </span>
                <span class="file-path">
                    ${getFilePath(file.path)}
                </span>
                <span class="file-size">${formatFileSize(file.size || 0)}</span>
            </div>
        `;
    }).join('');

    // Remove existing event listeners
    const buttons = document.querySelectorAll('.toggle-btn');
    buttons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });

    // Add click handlers for toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const path = e.currentTarget.dataset.path;
            const item = filePreviewData.find(f => f.path === path);
            const isDirectory = item && item.type === 'directory';
            
            // Store current state before changes
            const currentOverrides = new Set(individualOverrides);
            
            if (isDirectory) {
                // Toggle all files in this directory
                const dirPrefix = path + '/';
                const shouldInclude = !isDirectoryIncluded(path);
                
                filePreviewData.forEach(f => {
                    if (f.path.startsWith(dirPrefix)) {
                        const shouldOverride = shouldInclude !== f.included;
                        if (shouldOverride) {
                            individualOverrides.add(f.path);
                        } else {
                            individualOverrides.delete(f.path);
                        }
                    }
                });
                
                // Handle directory itself
                if (shouldInclude !== item.included) {
                    individualOverrides.add(path);
                } else {
                    individualOverrides.delete(path);
                }
            } else {
                // Toggle individual file
                const shouldInclude = !isFileIncluded(path);
                if (shouldInclude !== item.included) {
                    individualOverrides.add(path);
                } else {
                    individualOverrides.delete(path);
                }
            }
            
            // Update UI only if state actually changed
            if (!setsAreEqual(currentOverrides, individualOverrides)) {
                updateFilePreview(filterText);
                updateProcessedContent();
            }
        });
    });

    // Add click handlers for directory items
    document.querySelectorAll('.preview-item[data-type="directory"]').forEach(dir => {
        dir.addEventListener('click', (e) => {
            if (e.target.classList.contains('toggle-btn')) return;
            
            const path = dir.dataset.path;
            const shouldInclude = !isDirectoryIncluded(path);
            const dirPrefix = path + '/';
            
            // Store current state before changes
            const currentOverrides = new Set(individualOverrides);
            
            // Toggle all files in this directory
            filePreviewData.forEach(f => {
                if (f.path.startsWith(dirPrefix)) {
                    const shouldOverride = shouldInclude !== f.included;
                    if (shouldOverride) {
                        individualOverrides.add(f.path);
                    } else {
                        individualOverrides.delete(f.path);
                    }
                }
            });
            
            // Handle directory itself
            const dirItem = filePreviewData.find(f => f.path === path);
            if (dirItem && shouldInclude !== dirItem.included) {
                individualOverrides.add(path);
            } else {
                individualOverrides.delete(path);
            }
            
            // Update UI only if state actually changed
            if (!setsAreEqual(currentOverrides, individualOverrides)) {
                updateFilePreview(filterText);
                updateProcessedContent();
            }
        });
    });
}

// Helper functions for state management
function isFileIncluded(path) {
    const file = filePreviewData.find(f => f.path === path);
    if (!file) return false;
    return individualOverrides.has(path) ? !file.included : file.included;
}

function isDirectoryIncluded(path) {
    const dir = filePreviewData.find(f => f.path === path);
    if (!dir) return false;
    return individualOverrides.has(path) ? !dir.included : dir.included;
}

function setsAreEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const item of a) {
        if (!b.has(item)) return false;
    }
    return true;
}

// Update the updateProcessedContent function
async function updateProcessedContent() {
    if (!currentFolderPath) return;
    
    loadingOverlay.classList.remove('hidden');
    
    try {
        const omitPatterns = buildOmitPatterns();
        const result = await ipcRenderer.invoke('process-folder', currentFolderPath, omitPatterns, Array.from(individualOverrides));
        
        if (result.success) {
            // Update filePreviewData while preserving override states
            const oldOverrides = new Set(individualOverrides);
            filePreviewData = result.filePreview;
            individualOverrides = oldOverrides;
            
            updateStats(result);
            showResults(result);
        } else {
            alert('Error processing folder: ' + result.error);
        }
    } catch (error) {
        alert('Error processing folder: ' + error.message);
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

// Update statistics display
function updateStats(result) {
    charCount.textContent = result.totalCharacters.toLocaleString();
    tokenCount.textContent = result.approxTokens.toLocaleString();
}

// Show results panel
function showResults(result) {
    previewPanel.classList.remove('hidden');
    resultPanel.classList.remove('hidden');
    codePreview.textContent = result.combinedText;
}

// Save combined file
async function saveCombinedFile() {
    try {
        const result = await ipcRenderer.invoke('save-file', codePreview.textContent);
        if (result.success) {
            alert('File saved successfully!');
        }
    } catch (error) {
        alert('Error saving file: ' + error.message);
    }
}

// Reset UI for new folder
function resetUI() {
    // Reset all panels
    settingsPanel.classList.add('hidden');
    previewPanel.classList.add('hidden');
    resultPanel.classList.add('hidden');
    loadingOverlay.classList.add('hidden');
    
    // Clear all input fields and previews
    folderPath.textContent = '';
    previewList.innerHTML = '';
    previewFilter.value = '';
    customOmit.value = '';
    codePreview.textContent = '';
    
    // Reset checkboxes to default state
    omitGit.checked = true;
    omitNodeModules.checked = true;
    omitHidden.checked = true;
    omitMedia.checked = true;
    
    // Reset stats
    includedCount.textContent = '0 files included';
    excludedCount.textContent = '0 files excluded';
    charCount.textContent = '0';
    tokenCount.textContent = '0';
    
    // Reset variables
    currentFolderPath = '';
    filePreviewData = [];
    individualOverrides = new Set();
}

// Event Listeners
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
processBtn.addEventListener('click', processFolder);
previewFilter.addEventListener('input', (e) => updateFilePreview(e.target.value));
saveBtn.addEventListener('click', saveCombinedFile);
newFolderBtn.addEventListener('click', () => {
    resetUI();
    dropZone.classList.remove('hidden');
});
changeFolderBtn.addEventListener('click', () => {
    resetUI();
    dropZone.classList.remove('hidden');
}); 