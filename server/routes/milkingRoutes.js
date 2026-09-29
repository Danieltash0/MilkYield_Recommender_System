const express = require('express');
const router = express.Router();
const milkingController = require('../controllers/milkingController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Every signed-in role can view yields
router.get('/', milkingController.getRecords);
router.get('/summary', milkingController.getSummary);
router.get('/cattle/:id', milkingController.getCattleHistory);
router.get('/:id', milkingController.getRecordById);

// Workers log sessions alongside admin and manager
router.post('/', requireRole(['admin', 'manager', 'worker']), milkingController.createRecord);

// Correcting and removing records is restricted to admin and manager
router.put('/:id', requireRole(['admin', 'manager']), milkingController.updateRecord);
router.delete('/:id', requireRole(['admin', 'manager']), milkingController.deleteRecord);

module.exports = router;
