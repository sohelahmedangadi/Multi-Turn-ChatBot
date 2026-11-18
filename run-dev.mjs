import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('======================================================');
console.log('🚀 Starting CosmoAI (Chroma DB + Backend + Frontend)...');
console.log('======================================================\n');

// 1. Spawn Chroma DB Vector Store (Port 8000)
let chroma = null;
try {
  chroma = spawn('python', [path.join(__dirname, 'scripts', 'start-chroma.py')], {
    stdio: 'inherit',
    cwd: __dirname,
  });
  chroma.on('error', (err) => {
    console.warn('ℹ️ Python Chroma background daemon not started:', err.message);
  });
} catch (e) {}

// 2. Spawn Express Backend (Port 5000)
const server = spawn(process.execPath, [path.join(__dirname, 'server', 'index.js')], {
  stdio: 'inherit',
  cwd: __dirname,
});

server.on('error', (err) => {
  console.error('❌ Failed to start Express backend:', err);
});

server.on('exit', (code, signal) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ Express backend stopped unexpectedly (code: ${code}, signal: ${signal})`);
  }
});

// 3. Spawn Vite Frontend (Port 3000)
// Using process.execPath directly on vite.js avoids Windows .cmd shell/EINVAL issues and DEP0190
const clientViteBin = path.join(__dirname, 'client', 'node_modules', 'vite', 'bin', 'vite.js');
const rootViteBin = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
const viteBin = fs.existsSync(clientViteBin) ? clientViteBin : rootViteBin;

const client = fs.existsSync(viteBin)
  ? spawn(process.execPath, [viteBin], {
      stdio: 'inherit',
      cwd: path.join(__dirname, 'client'),
    })
  : spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--prefix', 'client', 'run', 'dev'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

client.on('error', (err) => {
  console.error('❌ Failed to start Vite frontend:', err);
});

const cleanup = () => {
  console.log('\n🛑 Shutting down CosmoAI services...');
  try { if (chroma) chroma.kill(); } catch (e) {}
  try { server.kill(); } catch (e) {}
  try { client.kill(); } catch (e) {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);


