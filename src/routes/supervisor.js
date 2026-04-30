const express = require('express');
const requireSupervisorBearer = require('../middleware/requireSupervisorBearer');
const supervisorRutasRoutes = require('./supervisorRutas');
const supervisorVerificacionesRoutes = require('./supervisorVerificaciones');

const router = express.Router();

router.use(requireSupervisorBearer);
router.use('/rutas', supervisorRutasRoutes);
router.use('/verificaciones', supervisorVerificacionesRoutes);

module.exports = router;
