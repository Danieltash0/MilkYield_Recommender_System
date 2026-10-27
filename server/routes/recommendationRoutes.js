const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const { authenticateToken } = require('../middleware/auth');

// Every signed-in role can see yield insight and alerts
router.use(authenticateToken);

router.get('/alerts', recommendationController.getAlerts);
router.get('/cattle/:id', recommendationController.getForCattle);

module.exports = router;
