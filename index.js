require('dotenv').config();

const express = require('express');
const { setupSwagger } = require('./src/config/swagger');
const { registerRoutes } = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json());
setupSwagger(app, PORT);
registerRoutes(app);

app.listen(PORT, HOST, () => {
  const publicUrl =
    process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || null;
  console.log(`Servidor escuchando en ${HOST}:${PORT}`);
  if (publicUrl) {
    console.log(`URL pública: ${publicUrl}`);
    console.log(`Health: ${publicUrl}/api/health`);
  } else if (!isProd) {
    const { execSync } = require('child_process');
    let lanIp = '';
    try {
      lanIp = execSync('ipconfig getifaddr en0', { encoding: 'utf8' }).trim();
    } catch {
      lanIp = '(ipconfig getifaddr en0)';
    }
    console.log(`Red local (EXPO_PUBLIC_API_URL): http://${lanIp}:${PORT}`);
  }
});
