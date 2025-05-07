import { spawnSync } from 'child_process';

console.log('🔨 Building renderer...');
let result = spawnSync('vite', ['build'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status);

console.log('📦 Packaging Electron app...');
result = spawnSync('npx', ['electron-builder', '--publish=never'], { stdio: 'inherit' });
process.exit(result.status);