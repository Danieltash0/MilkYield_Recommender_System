const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Any signed-in role can scan a tag and view an animal's code
router.get('/resolve/:code', qrController.resolve);
router.get('/cattle/:id', qrController.getForCattle);

// Whoever registers cattle can label them
router.post('/cattle/:id', requireRole(['admin', 'manager', 'worker']), qrController.createForCattle);

// Bulk label printing and reissuing are for admin and manager
router.get('/', requireRole(['admin', 'manager']), qrController.getAll);
router.post('/generate-missing', requireRole(['admin', 'manager']), qrController.generateMissing);
router.post('/cattle/:id/regenerate', requireRole(['admin', 'manager']), qrController.regenerate);

module.exports = router;
