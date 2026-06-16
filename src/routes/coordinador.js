const express = require('express');
const requireCoordinadorBearer = require('../middleware/requireCoordinadorBearer');
const coordinadorRutasRoutes = require('./coordinadorRutas');
const coordinadorChoferesRoutes = require('./coordinadorChoferes');
const coordinadorEstadoRoutes = require('./coordinadorEstado');
const coordinadorAsistenciaRoutes = require('./coordinadorAsistencia');

const router = express.Router();

router.use(requireCoordinadorBearer);
router.use('/rutas', coordinadorRutasRoutes);
router.use('/choferes', coordinadorChoferesRoutes);
router.use('/estado', coordinadorEstadoRoutes);
router.use('/asistencia', coordinadorAsistenciaRoutes);

module.exports = router;
