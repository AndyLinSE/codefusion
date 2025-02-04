const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const toIco = require('to-ico');

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
        
    // Create ICO file (contains both 256x256 and 32x32 sizes)
    const png256 = await sharp(svgBuffer)
        .resize(256, 256)
        .png()
        .toBuffer();
        
    const png32 = await sharp(svgBuffer)
        .resize(32, 32)
        .png()
        .toBuffer();
        
    const ico = await toIco([png256, png32]);
    
    fs.writeFileSync(path.join(__dirname, '../assets/icon.ico'), ico);
}

convertIcon().catch(console.error); 