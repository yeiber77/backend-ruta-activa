const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ mensaje: 'RutaActiva API — servidor Express en marcha' });
});

module.exports = router;
