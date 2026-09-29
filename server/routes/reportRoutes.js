const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Reports include finances, so they share the finance permissions
router.use(authenticateToken, requireRole(['admin', 'manager']));

router.get('/types', reportController.getTypes);
router.get('/', reportController.getReports);
router.post('/', reportController.generateReport);
router.get('/:id', reportController.getReport);
router.delete('/:id', reportController.deleteReport);

module.exports = router;
