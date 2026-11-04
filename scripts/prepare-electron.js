import fs from 'fs';
import path from 'path';

const src = path.resolve('dist');
const dest = path.resolve('electron', 'dist');

if (!fs.existsSync(src)) {
  console.error('Error: dist folder does not exist. Run npm run build first.');
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });

// Ensure all asset paths in electron/dist/index.html use relative paths
const htmlPath = path.join(dest, 'index.html');
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  // Replace absolute root paths with relative paths
  html = html.replace(/src="\/assets\//g, 'src="./assets/');
  html = html.replace(/href="\/assets\//g, 'href="./assets/');
  html = html.replace(/href="\/favicon/g, 'href="./favicon');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Fixed relative asset paths in electron/dist/index.html');
}

console.log('Successfully synced dist to electron/dist');
