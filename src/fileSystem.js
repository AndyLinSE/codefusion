const fs = require('fs');
const path = require('path');

function loadGitignorePatterns(folderPath) {
    const gitignorePath = path.join(folderPath, '.gitignore');
    let patterns = [];
    if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        patterns = gitignoreContent.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(pattern => {
                let regexPattern = pattern
                    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                    .replace(/\*/g, '.*')
                    .replace(/\?/g, '.');
                
                if (pattern.endsWith('/')) {
                    regexPattern = `${regexPattern}.*`;
                }
                
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

async function processDirectory(dir, folderPath, omitPatterns, overridesSet, supportedExtensions) {
    let combinedText = '';
    let filePreview = [];

    async function processDir(currentDir) {
        const files = await fs.promises.readdir(currentDir);
        
        for (const file of files) {
            const fullPath = path.join(currentDir, file);
            const stat = await fs.promises.stat(fullPath);
            const relativePath = path.relative(folderPath, fullPath);
            
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
                
                if (!shouldOmit || overridesSet.has(relativePath)) {
                    await processDir(fullPath);
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

                if (isIncluded) {
                    try {
                        const content = await fs.promises.readFile(fullPath, 'utf8');
                        const relativeDir = path.relative(folderPath, currentDir);
                        combinedText += `\n// ===== Folder: ${relativeDir || '.'} | File: ${file} =====\n${content}\n`;
                    } catch (error) {
                        console.error(`Error reading file ${fullPath}:`, error);
                    }
                }
            }
        }
    }

    await processDir(dir);
    return { combinedText, filePreview };
}

async function saveFile(filePath, content) {
    try {
        await fs.promises.writeFile(filePath, content, 'utf8');
        return { success: true, filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    loadGitignorePatterns,
    processDirectory,
    saveFile
}; 