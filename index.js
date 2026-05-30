// index.js
// Zero-friction bootstrap launcher for Render deployments
// This file acts as the default entrypoint when Render runs its default 'node index.js' command.

const { spawn } = require('child_process');
const path = require('path');

console.log("🚀 Starting job-bot via tsx redirect launcher...");

const child = spawn('npx', ['tsx', 'src/app.ts'], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

child.on('close', (code) => {
  process.exit(code || 0);
});
