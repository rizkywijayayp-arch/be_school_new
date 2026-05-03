// routes/tvRoutes.js
// Presence TV heartbeat & status router
// TV display integration - kept minimal to avoid breaking server
const express = require('express');
const router = express.Router();

// TV heartbeat endpoint (basic placeholder)
router.get('/heartbeat', (req, res) => {
  res.json({ success: true, service: 'tv-heartbeat', timestamp: new Date().toISOString() });
});

// TV status endpoint
router.get('/status', (req, res) => {
  res.json({ success: true, status: 'active', timestamp: new Date().toISOString() });
});

module.exports = router;
