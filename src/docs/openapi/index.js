const base = require('./base');
const rootPaths = require('./root');
const healthPaths = require('./health');
const authPaths = require('./auth');
const adminPaths = require('./admin');
const rutasOpenapiPaths = require('./rutas');
const verificacionesOpenapiPaths = require('./verificaciones');
const coordinadorOpenapiPaths = require('./coordinador');
const representanteOpenapiPaths = require('./representante');
const asistenciaOpenapiPaths = require('./asistencia');

module.exports = {
  ...base,
  paths: {
    ...rootPaths,
    ...healthPaths,
    ...authPaths,
    ...adminPaths,
    ...rutasOpenapiPaths,
    ...verificacionesOpenapiPaths,
    ...coordinadorOpenapiPaths,
    ...representanteOpenapiPaths,
    ...asistenciaOpenapiPaths,
  },
};
