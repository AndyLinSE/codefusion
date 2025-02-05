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

// Navigation elements
const navLinks = document.querySelectorAll('.nav-step');
const sections = [settingsPanel, previewPanel, resultPanel];
const progressNav = document.querySelector('.progress-nav');

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const sectionId = entry.target.id;
            updateActiveStep(sectionId);
        }
    });
}, { threshold: 0.5 });

// Initialize section observers
sections.forEach(section => {
    if (section) sectionObserver.observe(section);
});

// Update active navigation step
function updateActiveStep(sectionId) {
    const stepMap = {
        'settings-panel': 1,
        'preview-panel': 2,
        'result-panel': 3
    };
    
    const currentStep = stepMap[sectionId];
    if (!currentStep) return;

    // Update progress bar
    progressNav.setAttribute('data-step', currentStep);

    // Update step states
    navLinks.forEach(link => {
        const href = link.getAttribute('href').substring(1);
        const stepNumber = stepMap[href];
        
        // Remove all states first
        link.classList.remove('active', 'completed');
        
        // Add appropriate state
        if (stepNumber === currentStep) {
            link.classList.add('active');
        } else if (stepNumber < currentStep) {
            link.classList.add('completed');
        }
    });
}

// Smooth scroll to section
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);
        if (targetSection && !targetSection.classList.contains('hidden')) {
            targetSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Checkbox elements
const omitGit = document.getElementById('omit-git');
const omitNodeModules = document.getElementById('omit-node-modules');
const omitDist = document.getElementById('omit-dist');
const omitBuild = document.getElementById('omit-build');
const omitOut = document.getElementById('omit-out');
const omitCoverage = document.getElementById('omit-coverage');
const omitTemp = document.getElementById('omit-temp');
const omitVendor = document.getElementById('omit-vendor');
const omitCache = document.getElementById('omit-cache');
const omitHidden = document.getElementById('omit-hidden');
const omitMedia = document.getElementById('omit-media');
const customOmit = document.getElementById('custom-omit');

let currentFolderPath = '';
let filePreviewData = [];
let individualOverrides = new Map(); // Change from Set to Map to store the desired state
let supportedExtensions = window.api.getSupportedExtensions();
let collapsedDirectories = new Set(); // Add this at the top with other state variables

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

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const result = await window.api.handleFolder(files[0].path);
        if (result.success) {
            handleFolderSelection(result.path);
        } else {
            alert('Error selecting folder: ' + result.error);
        }
    }
}

// Click to select folder
dropZone.addEventListener('click', async () => {
    try {
        const dialogResult = await window.api.openFolderDialog();
        if (dialogResult.success) {
            const result = await window.api.handleFolder(dialogResult.path);
            if (result.success) {
                handleFolderSelection(result.path);
            } else {
                alert('Error selecting folder: ' + result.error);
            }
        }
    } catch (error) {
        console.error('Error handling folder selection:', error);
        alert('Failed to select folder: ' + error.message);
    }
});

function handleFolderSelection(path) {
    currentFolderPath = window.api.getPath(path);
    folderPath.textContent = currentFolderPath;
    dropZone.classList.add('hidden');
    settingsPanel.classList.remove('hidden');
    previewPanel.classList.remove('hidden');
    document.getElementById('sticky-nav').classList.remove('hidden');
}

// Build omit patterns from UI settings
function buildOmitPatterns() {
    const patterns = [];
    
    if (omitGit.checked) patterns.push(/^\.git/);
    if (omitNodeModules.checked) patterns.push(/^node_modules/);
    if (omitDist.checked) patterns.push(/^dist/);
    if (omitBuild.checked) patterns.push(/^build/);
    if (omitOut.checked) patterns.push(/^out/);
    if (omitCoverage.checked) patterns.push(/^coverage/);
    if (omitTemp.checked) patterns.push(/^temp\/|^\.tmp/);
    if (omitVendor.checked) patterns.push(/^vendor/);
    if (omitCache.checked) patterns.push(/^__pycache__\/|^\.cache/);
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
    
    try {
        // Clear existing overrides when reprocessing
        individualOverrides.clear();
        collapsedDirectories.clear();

        const omitPatterns = buildOmitPatterns();
        const result = await window.api.processFolder(currentFolderPath, omitPatterns, Array.from(individualOverrides.entries())
            .filter(([_, included]) => !included)
            .map(([path]) => path));
        
        if (result.success) {
            filePreviewData = result.filePreview;
            
            // Set initial collapsed state: collapse ignored directories, expand included ones
            filePreviewData.forEach(file => {
                if (file.type === 'directory' && !file.included) {
                    collapsedDirectories.add(getFilePath(file.path));
                }
            });
            
            updateFilePreview(document.getElementById('preview-filter').value || '');
            updateStats(result);
            showResults(result);

            // Scroll to preview panel with offset for sticky header
            const navHeight = document.querySelector('.sticky-nav').offsetHeight;
            const yOffset = -navHeight - 20; // Additional 20px buffer
            const y = previewPanel.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
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
    // Normalize path separators to forward slashes
    return path.replace(/\\/g, '/');
}

function getParentPath(path) {
    // Normalize path separators to forward slashes
    const normalizedPath = path.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    parts.pop();
    return parts.join('/');
}

function isHiddenFile(path) {
    const fileName = path.split(/[\\/]/).pop();
    return fileName.startsWith('.');
}

function getIgnoreReason(file) {
    if (!file || !file.path) return '';
    
    // If we have an explicit omit reason from the main process, use that
    let reason = file.omitReason;
    
    // Fallback checks for any cases not caught by main process
    if (!reason) {
        const fileName = file.path.split(/[\\/]/).pop();
        if (!fileName) return '';
        
        if (isHiddenFile(file.path)) reason = 'Hidden file/directory';
    }

    // For ignored directories, add instruction about how to view contents
    if (reason && file.type === 'directory' && !file.included) {
        return `${reason}. Uncheck the corresponding omit box above and click "Process Folder" to view contents.`;
    }
    
    return reason || '';
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

    // Helper function to check if file should be visible
    function shouldBeVisible(file) {
        // Get normalized path and log debug info
        const path = getFilePath(file.path);
        console.log(`Checking visibility for: ${path}`);
        console.log(`Type: ${file.type}, Included: ${file.included}`);
        console.log(`Current collapsed directories:`, Array.from(collapsedDirectories));

        // Always show the root directory
        if (file.type === 'directory' && !path.includes('/')) {
            console.log('Root directory - always visible');
            return true;
        }

        // Check if any parent directory is collapsed
        for (const collapsedDir of collapsedDirectories) {
            // If this is a directory that's collapsed, show it (but its children will be hidden)
            if (file.type === 'directory' && path === collapsedDir) {
                console.log(`Directory ${path} is collapsed but showing itself`);
                return true;
            }

            // If this item is under a collapsed directory, hide it
            if (path.startsWith(collapsedDir + '/')) {
                console.log(`Item is under collapsed directory ${collapsedDir} - hiding`);
                return false;
            }
        }

        console.log(`No collapsed parent directories found - showing`);
        return true;
    }

    // Filter files based on visibility
    const visibleFiles = filteredFiles.filter(shouldBeVisible);
    console.log(`Visible files after filtering: ${visibleFiles.length}`);
    
    previewList.innerHTML = visibleFiles.map(file => {
        const isOverridden = individualOverrides.has(file.path);
        const isIncluded = isOverridden ? individualOverrides.get(file.path) : file.included;
        const indentLevel = getIndentLevel(file.path);
        const isDirectory = file.type === 'directory';
        const hasChildren = filesByDirectory.has(file.path);
        const isHidden = isHiddenFile(file.path);
        const ignoreReason = getIgnoreReason(file);
        const isCollapsed = isDirectory && collapsedDirectories.has(getFilePath(file.path));
        
        return `
            <div class="preview-item ${isIncluded ? 'included' : 'excluded'} ${isHidden ? 'hidden-item' : ''}" 
                 style="padding-left: ${indentLevel * 16 + 8}px"
                 data-path="${file.path}"
                 data-type="${file.type}">
                <span class="info-icon${(!isIncluded && ignoreReason) ? ' active' : ''}"
                      ${(!isIncluded && ignoreReason) ? `data-tooltip="${ignoreReason}"` : ''}>
                    ${(!isIncluded && ignoreReason) ? 'ℹ️' : ''}
                </span>
                <button class="toggle-btn" data-path="${file.path}" data-original-state="${file.included}">
                    ${isIncluded ? '✓' : '×'}
                </button>
                <span class="file-type" data-arrow="${isDirectory ? (isCollapsed ? '▸' : '▾') : ''}">
                    ${file.type}
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

    // Add click handlers for toggle buttons - only handle inclusion/exclusion
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const path = e.currentTarget.dataset.path;
            const item = filePreviewData.find(f => f.path === path);
            const isDirectory = item && item.type === 'directory';
            
            // Store current state before changes
            const currentOverrides = new Map(individualOverrides);
            
            if (isDirectory) {
                // Toggle all files in this directory
                const dirPrefix = getFilePath(path) + '/';
                const shouldInclude = !isDirectoryIncluded(path);
                
                filePreviewData.forEach(f => {
                    if (getFilePath(f.path).startsWith(dirPrefix)) {
                        individualOverrides.set(f.path, shouldInclude);
                    }
                });
                
                // Handle directory itself
                individualOverrides.set(path, shouldInclude);
            } else {
                // Toggle individual file
                const shouldInclude = !isFileIncluded(path);
                individualOverrides.set(path, shouldInclude);
            }
            
            // Update UI only if state actually changed
            if (!setsAreEqual(currentOverrides, individualOverrides)) {
                updateFilePreview(document.getElementById('preview-filter').value || '');
                updateProcessedContent();
            }
        });
    });

    // Remove any existing click handler
    previewList.removeEventListener('click', handleDirectoryClick);
    
    // Add the click handler to the container
    previewList.addEventListener('click', handleDirectoryClick);

    // Calculate included/excluded stats
    const stats = filteredFiles.reduce((acc, f) => {
        const isOverridden = individualOverrides.has(f.path);
        const isIncluded = isOverridden ? individualOverrides.get(f.path) : f.included;
        
        if (isIncluded) {
            acc[f.type === 'directory' ? 'includedDirs' : 'includedFiles']++;
        } else {
            acc[f.type === 'directory' ? 'excludedDirs' : 'excludedFiles']++;
        }
        return acc;
    }, { includedFiles: 0, excludedFiles: 0, includedDirs: 0, excludedDirs: 0 });
    
    console.log('Stats:', stats);
    
    includedCount.textContent = `${stats.includedFiles} files and ${stats.includedDirs} directories included`;
    excludedCount.textContent = `${stats.excludedFiles} files and ${stats.excludedDirs} directories excluded`;
    excludedCount.title = 'Files within excluded directories are not counted. Uncheck the corresponding omit box and click "Process Folder" to include them.';
}

// Helper functions for state management
function isFileIncluded(path) {
    const file = filePreviewData.find(f => f.path === path);
    if (!file) return false;
    return individualOverrides.has(path) ? individualOverrides.get(path) : file.included;
}

function isDirectoryIncluded(path) {
    const dir = filePreviewData.find(f => f.path === path);
    if (!dir) return false;
    return individualOverrides.has(path) ? individualOverrides.get(path) : dir.included;
}

function setsAreEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
        if (!b.has(key) || b.get(key) !== value) return false;
    }
    return true;
}

// Update the updateProcessedContent function
async function updateProcessedContent() {
    if (!currentFolderPath) return;
    
    loadingOverlay.classList.remove('hidden');
    
    try {
        const omitPatterns = buildOmitPatterns();
        const overridesArray = Array.from(individualOverrides.entries())
            .filter(([_, included]) => !included)
            .map(([path]) => path);
        const result = await window.api.processFolder(currentFolderPath, omitPatterns, overridesArray);
        
        if (result.success) {
            // Update filePreviewData while preserving override states
            const oldOverrides = new Map(individualOverrides);
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
    
    // Add copy to clipboard button if it doesn't exist
    if (!document.getElementById('copy-btn')) {
        const copyBtn = document.createElement('button');
        copyBtn.id = 'copy-btn';
        copyBtn.className = 'secondary-button';
        copyBtn.innerHTML = '📋 Copy to Clipboard';
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(codePreview.textContent);
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '✓ Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
                copyBtn.innerHTML = '❌ Failed to copy';
                setTimeout(() => {
                    copyBtn.innerHTML = '📋 Copy to Clipboard';
                }, 2000);
            }
        });
        // Insert the copy button before the save button
        saveBtn.parentNode.insertBefore(copyBtn, saveBtn);
    }
}

// Save combined file
async function saveCombinedFile() {
    try {
        const result = await window.api.saveFile(codePreview.textContent);
        if (result.success) {
            alert('File saved successfully!');
        }
    } catch (error) {
        alert('Error saving file: ' + error.message);
    }
}

// Reset UI for new folder
function resetUI() {
    currentFolderPath = '';
    filePreviewData = [];
    individualOverrides.clear();
    
    // Reset form elements
    folderPath.textContent = '';
    customOmit.value = '';
    omitGit.checked = true;
    omitNodeModules.checked = true;
    omitDist.checked = true;
    omitBuild.checked = true;
    omitOut.checked = true;
    omitCoverage.checked = true;
    omitTemp.checked = true;
    omitVendor.checked = true;
    omitCache.checked = true;
    omitHidden.checked = true;
    omitMedia.checked = true;
    
    // Reset preview and results
    previewList.innerHTML = '';
    includedCount.textContent = '0 files included';
    excludedCount.textContent = '0 files excluded';
    
    // Hide panels and navigation
    settingsPanel.classList.add('hidden');
    previewPanel.classList.add('hidden');
    resultPanel.classList.add('hidden');
    document.getElementById('sticky-nav').classList.add('hidden');
    
    // Show drop zone
    dropZone.classList.remove('hidden');
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

// Define the directory click handler outside updateFilePreview
function handleDirectoryClick(e) {
    // If the user clicked the toggle button, do nothing
    if (e.target.closest('.toggle-btn')) return;

    // Otherwise, if this is a directory row, toggle collapse
    const dirItem = e.target.closest('.preview-item[data-type="directory"]');
    if (!dirItem) return; // not a directory
    
    console.log('Directory clicked:', dirItem.dataset.path);
    
    const normalizedPath = getFilePath(dirItem.dataset.path);
    console.log('Normalized path:', normalizedPath);
    console.log('Collapsed directories before:', Array.from(collapsedDirectories));
    
    if (collapsedDirectories.has(normalizedPath)) {
        console.log('Removing from collapsed directories');
        collapsedDirectories.delete(normalizedPath);
    } else {
        console.log('Adding to collapsed directories');
        collapsedDirectories.add(normalizedPath);
    }
    
    console.log('Collapsed directories after:', Array.from(collapsedDirectories));
    updateFilePreview(document.getElementById('preview-filter').value || '');
}

// Add event listener for pattern help button
document.getElementById('show-pattern-help').addEventListener('click', (e) => {
    const helpSection = document.getElementById('pattern-help');
    const isHidden = helpSection.classList.contains('hidden');
    helpSection.classList.toggle('hidden');
    e.target.textContent = isHidden ? 'Hide Pattern Examples' : 'Show Pattern Examples';
}); 