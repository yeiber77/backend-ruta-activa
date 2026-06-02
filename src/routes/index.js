const rootRoutes = require('./root');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const coordinadorRoutes = require('./coordinador');
const choferRoutes = require('./chofer');
const supervisorRoutes = require('./supervisor');
const representanteRoutes = require('./representante');
const denunciasComentariosRoutes = require('./denunciasComentarios');
const asistenteIaRoutes = require('./asistenteIa');
const horariosRutasRoutes = require('./horariosRutas');

function registerRoutes(app) {
  app.use(rootRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/coordinador', coordinadorRoutes);
  app.use('/api/chofer', choferRoutes);
  app.use('/api/supervisor', supervisorRoutes);
  app.use('/api/representante', representanteRoutes);
  app.use('/api/denuncias-comentarios', denunciasComentariosRoutes);
  app.use('/api/asistente-ia', asistenteIaRoutes);
  app.use('/api/horarios-rutas', horariosRutasRoutes);
}

module.exports = { registerRoutes };
