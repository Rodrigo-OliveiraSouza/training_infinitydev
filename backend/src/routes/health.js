const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'training-infinitydev',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
