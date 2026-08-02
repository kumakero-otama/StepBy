module.exports = {
  apps: [
    {
      name: "stepby-ui10-dev",
      script: "dev-server.js",
      interpreter: "node",
      cwd: __dirname,
      autorestart: true,
      env: {
        NODE_ENV: "development",
        FRONTEND_HOST: "127.0.0.1",
        FRONTEND_PORT: "3200",
      },
    },
  ],
};
