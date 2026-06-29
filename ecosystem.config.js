module.exports = {
  apps: [
    {
      name: 'echorura-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
    },
  ],
};
