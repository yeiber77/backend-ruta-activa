const express = require('express');
const {
  isEstadoValido,
  listarBroadcastsRecientes,
  crearBroadcastCoordinador,
} = require('../utils/estadoBroadcast');
const { registrarEvento } = require('../utils/auditLog');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const broadcasts = await listarBroadcastsRecientes(30);
    const mios = broadcasts.filter((b) => b.coordinador_id === req.coordinadorActor.id);
    return res.status(200).json({ ok: true, broadcasts: mios });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo listar el historial de estado',
      detalle: err.message,
    });
  }
});

router.post('/broadcast', async (req, res) => {
  const { estado } = req.body || {};
  if (!isEstadoValido(estado)) {
    return res.status(400).json({
      ok: false,
      mensaje: 'estado debe ser "activo" o "finalizado"',
    });
  }

  try {
    const broadcast = await crearBroadcastCoordinador(
      req.coordinadorActor,
      String(estado).trim().toLowerCase()
    );
    void registrarEvento({
      req,
      eventType: 'estado.broadcast_created',
      entityType: 'estado_broadcasts',
      entityId: broadcast?.id,
      accion: 'create',
      resumen: `Coordinador envió aviso de estado «${estado}» a choferes`,
      despues: broadcast,
    });
    return res.status(201).json({
      ok: true,
      mensaje: 'Estado enviado a choferes y administración',
      broadcast,
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo enviar el estado',
      detalle: err.message,
    });
  }
});

module.exports = router;
