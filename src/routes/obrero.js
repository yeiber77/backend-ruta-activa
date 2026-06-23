const express = require('express');
const requireObreroBearer = require('../middleware/requireObreroBearer');
const obreroRutasRoutes = require('./obreroRutas');

const router = express.Router();

router.use(requireObreroBearer);
router.use('/rutas', obreroRutasRoutes);

module.exports = router;
