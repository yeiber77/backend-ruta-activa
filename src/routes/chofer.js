const express = require('express');
const requireChoferBearer = require('../middleware/requireChoferBearer');
const choferRutasRoutes = require('./choferRutas');

const router = express.Router();

router.use(requireChoferBearer);
router.use('/rutas', choferRutasRoutes);

module.exports = router;
