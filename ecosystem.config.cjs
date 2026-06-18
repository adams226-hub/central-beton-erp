module.exports = {
  apps: [
    {
      name: 'amp-backend',
      script: 'src/app.js',
      cwd: 'C:\\Users\\iliad\\central-beton-erp\\backend',
      restart_delay: 3000,
      max_restarts: 10,
      autorestart: true,
    },
    {
      name: 'amp-frontend',
      script: 'C:\\Users\\iliad\\central-beton-erp\\frontend\\start-vite.cjs',
      cwd: 'C:\\Users\\iliad\\central-beton-erp\\frontend',
      restart_delay: 3000,
      max_restarts: 10,
      autorestart: true,
    },
  ],
};
