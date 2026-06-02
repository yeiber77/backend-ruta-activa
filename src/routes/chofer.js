const express = require('express');
const requireChoferBearer = require('../middleware/requireChoferBearer');
const choferRutasRoutes = require('./choferRutas');
const choferEstadoRoutes = require('./choferEstado');

const router = express.Router();

router.use(requireChoferBearer);
router.use('/rutas', choferRutasRoutes);
router.use('/estado', choferEstadoRoutes);

module.exports = router;
