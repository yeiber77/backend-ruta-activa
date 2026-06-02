const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

/** Comprobación rápida: GET /api/health */
router.get('/', (req, res) => {
  res.json({
    ok: true,
    mensaje: 'RutaActiva API activa',
    ts: new Date().toISOString(),
    auth_version: 2,
  });
});

router.get('/supabase', async (req, res) => {
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudo verificar Supabase',
      detalle: error.message,
    });
  }

  res.json({
    ok: true,
    mensaje: 'Conexión con Supabase correcta',
    buckets: data.length,
  });
});

module.exports = router;
