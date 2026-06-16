const express = require('express');
const { registrarEvento } = require('../utils/auditLog');
const {
  parseFechaISO,
  fetchAsistenciaDiaria,
  validarTrabajadorAsistencia,
  validarPayloadAsistencia,
  upsertRegistroAsistencia,
} = require('../utils/asistenciaTrabajadores');

const router = express.Router();

function coordinadorId(req) {
  return req.coordinadorActor.id;
}

router.get('/', async (req, res) => {
  const fecha = parseFechaISO(req.query.fecha);
  if (!fecha) {
    return res.status(400).json({
      ok: false,
      mensaje: 'fecha es obligatoria en query y debe tener formato YYYY-MM-DD',
    });
  }

  const result = await fetchAsistenciaDiaria(fecha);
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      mensaje: result.mensaje,
      ...(result.detalle && { detalle: result.detalle }),
    });
  }

  return res.status(200).json({
    ok: true,
    fecha: result.fecha,
    trabajadores: result.trabajadores,
    registros: result.registros,
    ...(result.aviso && { aviso: result.aviso }),
  });
});

async function guardarAsistencia(req, res) {
  const validacion = validarPayloadAsistencia(req.body);
  if (!validacion.ok) {
    return res.status(validacion.status).json({
      ok: false,
      mensaje: validacion.mensaje,
    });
  }

  const trabajadorCheck = await validarTrabajadorAsistencia(validacion.payload.trabajador_id);
  if (!trabajadorCheck.ok) {
    return res.status(trabajadorCheck.status).json({
      ok: false,
      mensaje: trabajadorCheck.mensaje,
      ...(trabajadorCheck.detalle && { detalle: trabajadorCheck.detalle }),
    });
  }

  const upsert = await upsertRegistroAsistencia(validacion.payload, coordinadorId(req));
  if (!upsert.ok) {
    return res.status(upsert.status).json({
      ok: false,
      mensaje: upsert.mensaje,
      ...(upsert.detalle && { detalle: upsert.detalle }),
    });
  }

  const { registro, esCreacion } = upsert;
  void registrarEvento({
    req,
    eventType: esCreacion ? 'asistencia.created' : 'asistencia.updated',
    entityType: 'asistencia_trabajadores',
    entityId: registro?.id,
    accion: esCreacion ? 'create' : 'update',
    resumen: `Coordinador ${esCreacion ? 'registró' : 'actualizó'} asistencia de «${trabajadorCheck.trabajador.nombre || trabajadorCheck.trabajador.email}» (${validacion.payload.fecha})`,
    despues: registro,
  });

  return res.status(200).json({
    ok: true,
    registro,
  });
}

router.patch('/', guardarAsistencia);
router.put('/', guardarAsistencia);

module.exports = router;
