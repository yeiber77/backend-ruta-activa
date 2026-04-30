const express = require('express');
const requireAdminBearer = require('../middleware/requireAdminBearer');
const adminUsuariosRoutes = require('./adminUsuarios');
const rutasRoutes = require('./rutas');
const verificacionesRoutes = require('./verificaciones');

const router = express.Router();

router.use(requireAdminBearer);
router.use('/usuarios', adminUsuariosRoutes);
router.use('/rutas', rutasRoutes);
router.use('/verificaciones', verificacionesRoutes);

module.exports = router;
