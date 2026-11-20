const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { signupLimiter } = require('../middleware/security');

router.post('/signup', signupLimiter, userController.signup);

// People work can be assigned to (task assignment dropdowns)
router.get('/assignable', authenticateToken, requireRole(['admin', 'manager']), userController.getAssignableUsers);

module.exports = router;
