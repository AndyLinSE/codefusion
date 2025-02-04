const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertIcon() {
    const svgBuffer = fs.readFileSync(path.join(__dirname, '../assets/icon.svg'));
    
    // Convert to PNG
    await sharp(svgBuffer)
        .resize(256, 256)
        .png()
        .toFile(path.join(__dirname, '../assets/icon.png'));
    
    // Create favicon sizes
    await sharp(svgBuffer)
        .resize(32, 32)
        .png()
        .toFile(path.join(__dirname, '../assets/favicon.png'));
}

convertIcon().catch(console.error); 