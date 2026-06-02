const express = require('express');
const requireAdminBearer = require('../middleware/requireAdminBearer');
const adminUsuariosRoutes = require('./adminUsuarios');
const rutasRoutes = require('./rutas');
const verificacionesRoutes = require('./verificaciones');
const adminEstadoRoutes = require('./adminEstado');
const adminDespidosRoutes = require('./adminDespidos');

const router = express.Router();

router.use(requireAdminBearer);
router.use('/usuarios', adminUsuariosRoutes);
router.use('/rutas', rutasRoutes);
router.use('/verificaciones', verificacionesRoutes);
router.use('/estado', adminEstadoRoutes);
router.use('/despidos', adminDespidosRoutes);

module.exports = router;
