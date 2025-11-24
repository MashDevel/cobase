import { spawn } from 'child_process';
import waitOn from 'wait-on';

let electron, vite;

function exitHandler(code = 0) {
  if (vite) vite.kill();
  if (electron) electron.kill();
  process.exit(code);
}

process.on('SIGINT', () => exitHandler(0));
process.on('SIGTERM', () => exitHandler(0));
process.on('exit', exitHandler);
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  exitHandler(1);
});

console.log('🚀 Starting Vite dev server...');
vite = spawn('vite', { stdio: 'inherit' });

vite.on('error', err => {
  console.error('❌ Failed to launch Vite:', err);
  exitHandler(1);
});

waitOn({ resources: ['http://localhost:3040'], timeout: 30000 }, err => {
  if (err) {
    console.error('❌ Vite did not start in time:', err);
    exitHandler(1);
  }

  console.log('⚡ Vite is ready. Launching Electron...');
  electron = spawn('npx', ['electron', '.'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
  });

  electron.stdout.on('data', data => process.stdout.write(`[electron] ${data}`));
  electron.stderr.on('data', data => process.stderr.write(`[electron] ${data}`));

  electron.on('close', code => {
    console.log(`🛑 Electron exited with code ${code}`);
    exitHandler(code);
  });

  electron.on('error', err => {
    console.error('❌ Failed to start Electron:', err);
    exitHandler(1);
  });
});
