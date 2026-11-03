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
console.log('Successfully synced dist to electron/dist');
