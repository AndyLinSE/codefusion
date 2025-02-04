const { ipcRenderer } = require('electron');

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
function updateFilePreview(filterText = '') {
    const lowerFilter = filterText.toLowerCase();
    const filteredFiles = filePreviewData.filter(file => 
        file.path.toLowerCase().includes(lowerFilter)
    );
    
    const included = filteredFiles.filter(f => f.included).length;
    const excluded = filteredFiles.length - included;
    
    includedCount.textContent = `${included} files included`;
    excludedCount.textContent = `${excluded} files excluded`;
    
    previewList.innerHTML = filteredFiles.map(file => `
        <div class="preview-item">
            <span>${file.included ? '✅' : '🚫'}</span>
            <span>${file.type === 'directory' ? '📁' : '📄'}</span>
            <span>${file.path}</span>
        </div>
    `).join('');
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