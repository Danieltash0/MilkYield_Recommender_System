const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const { authenticateToken } = require('../middleware/auth');

// Every signed-in role can see yield insight and alerts
router.use(authenticateToken);

router.get('/alerts', recommendationController.getAlerts);
router.get('/trend', recommendationController.getTrend);
router.get('/projection', recommendationController.getHerdProjection);
router.get('/cattle/:id', recommendationController.getForCattle);
router.get('/cattle/:id/projection', recommendationController.getProjection);

module.exports = router;
