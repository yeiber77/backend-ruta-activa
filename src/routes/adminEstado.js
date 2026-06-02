const express = require('express');
const { listarBroadcastsRecientes } = require('../utils/estadoBroadcast');

const router = express.Router();

router.get('/notificaciones', async (req, res) => {
  try {
    const broadcasts = await listarBroadcastsRecientes(50);
    return res.status(200).json({ ok: true, notificaciones: broadcasts });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudieron cargar las notificaciones',
      detalle: err.message,
    });
  }
});

module.exports = router;
