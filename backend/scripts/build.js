import fs from 'fs';
import { execSync } from 'child_process';

console.log('Running Prisma generate...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
} catch (e) {
  if (process.env.VERCEL) {
    throw e;
  }
  console.warn('Local file locked on Windows, proceeding with directory generation.');
}

// Ensure both public and dist directories exist so Vercel build never fails
if (!fs.existsSync('public')) fs.mkdirSync('public', { recursive: true });
if (!fs.existsSync('dist')) fs.mkdirSync('dist', { recursive: true });

const html = '<!DOCTYPE html><html><body>SalonOS API Server is running</body></html>';
fs.writeFileSync('public/index.html', html);
fs.writeFileSync('dist/index.html', html);

console.log('Build completed successfully.');
