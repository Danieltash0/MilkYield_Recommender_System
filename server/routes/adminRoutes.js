const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// The whole admin panel is admin-only
router.use(authenticateToken, requireRole(['admin']));

router.get('/stats', adminController.getStats);

router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.post('/users/:id/reset-password', adminController.resetPassword);
router.delete('/users/:id', adminController.deleteUser);

router.get('/logs', adminController.getLogs);
router.get('/logs/actions', adminController.getLogActions);

router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

module.exports = router;
