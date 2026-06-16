const express = require('express');
const { parseFechaISO, fetchAsistenciaDiaria } = require('../utils/asistenciaTrabajadores');

const router = express.Router();

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

module.exports = router;
