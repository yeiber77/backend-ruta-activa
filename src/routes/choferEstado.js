const express = require('express');
const {
  confirmarBroadcast,
  contarPendientesChofer,
  crearBroadcastChoferFinalizado,
  listarNotificacionesChofer,
} = require('../utils/estadoBroadcast');

const router = express.Router();

function parseBroadcastId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

router.get('/notificaciones', async (req, res) => {
  try {
    const choferId = req.choferActor.id;
    const notificaciones = await listarNotificacionesChofer(choferId);
    const pendientes = notificaciones.filter((n) => n.pendiente).length;
    return res.status(200).json({ ok: true, notificaciones, pendientes });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudieron cargar las notificaciones',
      detalle: err.message,
    });
  }
});

router.get('/pendientes', async (req, res) => {
  try {
    const pendientes = await contarPendientesChofer(req.choferActor.id);
    return res.status(200).json({ ok: true, pendientes });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo contar pendientes',
      detalle: err.message,
    });
  }
});

router.post('/notificaciones/:broadcastId/confirmar', async (req, res) => {
  const broadcastId = parseBroadcastId(req.params.broadcastId);
  if (broadcastId == null) {
    return res.status(400).json({ ok: false, mensaje: 'broadcastId inválido' });
  }

  try {
    const result = await confirmarBroadcast(broadcastId, req.choferActor.id);
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, mensaje: result.mensaje });
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo confirmar',
      detalle: err.message,
    });
  }
});

router.post('/finalizado', async (req, res) => {
  try {
    const broadcast = await crearBroadcastChoferFinalizado(req.choferActor);
    return res.status(201).json({
      ok: true,
      mensaje: 'Finalizado registrado',
      broadcast,
    });
  } catch (err) {
    const status = err.status === 409 ? 409 : 400;
    return res.status(status).json({
      ok: false,
      mensaje: err.message || 'No se pudo registrar finalizado',
      detalle: err.status ? undefined : err.message,
    });
  }
});

module.exports = router;
