const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { loginLimiter, loginIpLimiter, resetLimiter } = require('../middleware/security');

router.post('/login', loginIpLimiter, loginLimiter, authController.login);
router.post('/logout', authenticateToken, authController.logout);
router.post('/forgot-password', resetLimiter, authController.forgotPassword);
router.get('/me', authenticateToken, authController.me);

module.exports = router;
