const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Every signed-in role can view feeding
router.get('/', feedController.getRecords);

// Workers record feed alongside admin and manager
router.post('/', requireRole(['admin', 'manager', 'worker']), feedController.saveRecord);

// Removing records is restricted to admin and manager
router.delete('/:id', requireRole(['admin', 'manager']), feedController.deleteRecord);

module.exports = router;
