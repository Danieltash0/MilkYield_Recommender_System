const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

const SCHEDULERS = ['admin', 'manager', 'vet'];

// Every signed-in role can see what visits are coming up
router.get('/', appointmentController.getAppointments);
router.get('/vets', appointmentController.getVets);
router.get('/:id', appointmentController.getAppointmentById);

// Admin, manager and vets book and manage visits
router.post('/', requireRole(SCHEDULERS), appointmentController.createAppointment);
router.put('/:id', requireRole(SCHEDULERS), appointmentController.updateAppointment);
router.patch('/:id/status', requireRole(SCHEDULERS), appointmentController.updateStatus);
router.delete('/:id', requireRole(['admin', 'manager']), appointmentController.deleteAppointment);

module.exports = router;
