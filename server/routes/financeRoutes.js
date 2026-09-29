const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Farm finances are visible to admin and manager only
router.use(authenticateToken, requireRole(['admin', 'manager']));

router.get('/categories', financeController.getCategories);
router.get('/summary', financeController.getSummary);
router.get('/', financeController.getRecords);
router.get('/:id', financeController.getRecordById);
router.post('/', financeController.createRecord);
router.put('/:id', financeController.updateRecord);
router.delete('/:id', financeController.deleteRecord);

module.exports = router;
