import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';

const svgPath = path.resolve('public', 'logo.svg');
const svgString = fs.readFileSync(svgPath, 'utf8');

function renderPng(width, height) {
  const resvg = new Resvg(svgString, {
    fitTo: {
      mode: 'width',
      value: width,
    },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

async function main() {
  console.log('Generating consistent ClipSync icons across all platforms...');

  // 1. Generate core PNG resolutions
  const p16 = renderPng(16, 16);
  const p24 = renderPng(24, 24);
  const p32 = renderPng(32, 32);
  const p48 = renderPng(48, 48);
  const p64 = renderPng(64, 64);
  const p72 = renderPng(72, 72);
  const p96 = renderPng(96, 96);
  const p128 = renderPng(128, 128);
  const p144 = renderPng(144, 144);
  const p180 = renderPng(180, 180);
  const p192 = renderPng(192, 192);
  const p256 = renderPng(256, 256);
  const p512 = renderPng(512, 512);

  // 2. Web public assets
  fs.writeFileSync(path.resolve('public', 'logo.png'), p512);
  fs.writeFileSync(path.resolve('public', 'favicon-32x32.png'), p32);
  fs.writeFileSync(path.resolve('public', 'favicon-16x16.png'), p16);
  fs.writeFileSync(path.resolve('public', 'apple-touch-icon.png'), p180);

  // 3. Electron Windows app assets
  fs.mkdirSync(path.resolve('electron'), { recursive: true });
  fs.writeFileSync(path.resolve('electron', 'icon.png'), p512);

  // 4. Generate Windows .ico and Web favicon.ico
  console.log('Generating multi-resolution Windows .ico and favicon.ico...');
  const icoBuffer = await pngToIco([
    p16,
    p24,
    p32,
    p48,
    p64,
    p128,
    p256,
  ]);
  fs.writeFileSync(path.resolve('electron', 'icon.ico'), icoBuffer);
  fs.writeFileSync(path.resolve('public', 'favicon.ico'), icoBuffer);

  // 5. Android mipmap icons
  const androidMipmaps = [
    { dir: 'mipmap-mdpi', size: 48, buffer: p48 },
    { dir: 'mipmap-hdpi', size: 72, buffer: p72 },
    { dir: 'mipmap-xhdpi', size: 96, buffer: p96 },
    { dir: 'mipmap-xxhdpi', size: 144, buffer: p144 },
    { dir: 'mipmap-xxxhdpi', size: 192, buffer: p192 },
  ];

  const resBase = path.resolve('android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(resBase)) {
    for (const { dir, buffer } of androidMipmaps) {
      const targetDir = path.join(resBase, dir);
      if (fs.existsSync(targetDir)) {
        fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), buffer);
        fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), buffer);
        fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), buffer);
        console.log(`Updated Android ${dir}`);
      }
    }
  }

  console.log('✅ ALL ICONS SUCCESSFULLY GENERATED AND UNIFIED!');
}

main().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
