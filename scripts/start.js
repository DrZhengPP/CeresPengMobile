#!/usr/bin/env node
// Runs adb reverse before starting Metro so the emulator can always reach localhost:8081
const { execSync, spawn } = require('child_process');

try {
  execSync('adb reverse tcp:8081 tcp:8081', { stdio: 'inherit' });
  console.log('[start] adb reverse tcp:8081 tcp:8081 OK');
} catch {
  console.warn('[start] adb reverse failed (emulator may not be running yet — reconnect manually if needed)');
}

const expo = spawn('npx', ['expo', 'start', '--port', '8081'], {
  stdio: 'inherit',
  shell: true,
});

expo.on('exit', (code) => process.exit(code ?? 0));
