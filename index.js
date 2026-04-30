require('dotenv').config();

const express = require('express');
const { setupSwagger } = require('./src/config/swagger');
const { registerRoutes } = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
setupSwagger(app, PORT);
registerRoutes(app);

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
