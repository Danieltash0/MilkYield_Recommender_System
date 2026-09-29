const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Managers see every task; workers and vets only see tasks assigned to them
router.get('/', taskController.getTasks);
router.get('/:id', taskController.getTaskById);

// Assignees (and managers) move their work along
router.patch('/:id/status', taskController.updateStatus);
router.patch('/:id/checklist/:index', taskController.toggleChecklistItem);

// Creating, editing and removing tasks is for admin and manager
router.post('/', requireRole(['admin', 'manager']), taskController.createTask);
router.put('/:id', requireRole(['admin', 'manager']), taskController.updateTask);
router.delete('/:id', requireRole(['admin', 'manager']), taskController.deleteTask);

module.exports = router;
