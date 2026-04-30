const express = require('express');
const requireCoordinadorBearer = require('../middleware/requireCoordinadorBearer');
const coordinadorRutasRoutes = require('./coordinadorRutas');
const coordinadorChoferesRoutes = require('./coordinadorChoferes');

const router = express.Router();

router.use(requireCoordinadorBearer);
router.use('/rutas', coordinadorRutasRoutes);
router.use('/choferes', coordinadorChoferesRoutes);

module.exports = router;
