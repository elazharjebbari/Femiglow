const fs = require('fs');
const envVars = {};
try {
  const content = fs.readFileSync('.env', 'utf8');
  content.split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) envVars[m[1]] = m[2];
  });
} catch {}

module.exports = {
  apps: [{
    name: 'web',
    script: 'pnpm',
    args: 'start',
    cwd: '/var/www/femiglow-staging/apps/web',
    env: envVars,
  }],
};
