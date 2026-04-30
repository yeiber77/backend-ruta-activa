const express = require('express');
const { supabaseAdmin } = require('../config/supabase');

const router = express.Router();

const choferRoleId = Number(process.env.ROLE_CHOFER_ID || process.env.ROL_CHOFER_ID || 3);

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
    choferes: data || [],
    limit,
    offset,
  });
});

module.exports = router;
