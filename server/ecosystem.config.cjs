module.exports = {
  apps: [
    {
      name: 'anime-api',
      script: './dist/main.js',
      cwd: '/root/qik-anime/server',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
