const { spawn } = require('child_process');
const path = require('path');

const proc = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname),
  stdio: 'inherit',
  shell: true,
});

proc.on('exit', (code) => process.exit(code || 0));
proc.on('error', (err) => { console.error(err); process.exit(1); });
