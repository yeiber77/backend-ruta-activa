const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('../docs/openapi/index');

function setupSwagger(app, port) {
  const specWithServer = {
    ...openapiSpec,
    servers: [
      {
        url: `http://localhost:${port}`,
      },
    ],
  };

  app.use('/api-ruta-activa', swaggerUi.serve, swaggerUi.setup(specWithServer));
}

module.exports = {
  setupSwagger,
};
