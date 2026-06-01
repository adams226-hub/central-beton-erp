const path = require('path');
const root = path.resolve(__dirname);

module.exports = {
  apps: [
    {
      name: 'amp-backend',
      script: 'src/app.js',
      cwd: path.join(root, 'backend'),
      watch: false,
      env_development: { NODE_ENV: 'development' },
      env_production:  { NODE_ENV: 'production' },
    },
    {
      name: 'amp-frontend',
      script: path.join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'),
      cwd: path.join(root, 'frontend'),
      watch: false,
      env_development: { NODE_ENV: 'development' },
      env_production:  { NODE_ENV: 'production' },
    },
  ],
};
