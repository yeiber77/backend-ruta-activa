const express = require('express');
const { enviarListadoHorarios } = require('../utils/horariosRutasService');

const router = express.Router();

router.get('/', enviarListadoHorarios);

module.exports = router;
