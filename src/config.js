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

const windowConfig = {
    width: 800,
    height: 800,
    webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        additionalPermissions: ['clipboard-read', 'clipboard-write']
    }
};

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

module.exports = {
    supportedExtensions,
    windowConfig,
    defaultOmitPatterns
}; 