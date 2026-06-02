const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { CHOFERES_OPERATIVOS } = require('../utils/choferesOperativos');

const router = express.Router();

const choferRoleId = Number(process.env.ROLE_CHOFER_ID || process.env.ROL_CHOFER_ID || 3);

function ordenarChoferes(list) {
  const prioridad = new Map(
    CHOFERES_OPERATIVOS.map((c, i) => [c.nombre.trim().toLowerCase(), i])
  );
  return [...list].sort((a, b) => {
    const na = (a.nombre || a.email || '').trim().toLowerCase();
    const nb = (b.nombre || b.email || '').trim().toLowerCase();
    const pa = prioridad.has(na) ? prioridad.get(na) : 1000;
    const pb = prioridad.has(nb) ? prioridad.get(nb) : 1000;
    if (pa !== pb) return pa - pb;
    return na.localeCompare(nb, 'es');
  });
}

router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email, telefono, rol_id')
    .eq('rol_id', choferRoleId)
    .order('nombre', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo listar choferes',
      detalle: error.message,
    });
  }

  return res.status(200).json({
    ok: true,
    choferes: ordenarChoferes(data || []),
    limit,
    offset,
  });
});

module.exports = router;
