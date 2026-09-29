const express = require('express');
const router = express.Router();
const healthRecordController = require('../controllers/healthRecordController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Every signed-in role can read a cow's health history
router.get('/', healthRecordController.getRecords);
router.get('/:id', healthRecordController.getRecordById);

// Clinical entries are written by vets (and admin)
router.post('/', requireRole(['admin', 'vet']), healthRecordController.createRecord);
router.put('/:id', requireRole(['admin', 'vet']), healthRecordController.updateRecord);
router.delete('/:id', requireRole(['admin', 'vet']), healthRecordController.deleteRecord);

module.exports = router;
