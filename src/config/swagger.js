const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('../docs/openapi/index');

function setupSwagger(app, port) {
  const publicUrl =
    process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || null;
  const serverUrl = publicUrl || `http://localhost:${port}`;

  const specWithServer = {
    ...openapiSpec,
    servers: [
      {
        url: serverUrl.replace(/\/$/, ''),
      },
    ],
  };

  app.use('/api-ruta-activa', swaggerUi.serve, swaggerUi.setup(specWithServer));
}

module.exports = {
  setupSwagger,
};
