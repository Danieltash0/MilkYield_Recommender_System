const Task = require('../models/Task');
const logActivity = require('../utils/logActivity');

const PRIORITY = ['Low', 'Medium', 'High'];
const STATUS = ['Pending', 'In Progress', 'Completed'];
const MANAGERS = ['admin', 'manager'];

const isManager = (req) => MANAGERS.includes(req.user.role);
// Managers can act on any task; everyone else only on tasks assigned to them
const canWorkOn = (req, task) => isManager(req) || task.assigned_to === req.user.userId;

// Keeps only well-formed checklist items: [{ text, done }]
const cleanChecklist = (list) =>
  (Array.isArray(list) ? list : [])
    .filter((i) => i && typeof i.text === 'string' && i.text.trim())
    .map((i) => ({ text: i.text.trim(), done: !!i.done }));

// Returns an error message, or null when the payload is valid
const validate = (b) => {
  if (!b.title || !b.title.trim()) return 'Title is required';
  if (b.title.trim().length > 150) return 'Title must be 150 characters or fewer';
  if (b.priority && !PRIORITY.includes(b.priority)) return 'Invalid priority';
  if (b.due_date && Number.isNaN(Date.parse(b.due_date))) return 'Invalid due date';
  if (b.checklist && !Array.isArray(b.checklist)) return 'Checklist must be a list';
  return null;
};

// Unknown assignee or cattle id
const isBadReference = (err) => err && err.code === 'ER_NO_REFERENCED_ROW_2';

exports.getTasks = async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const assignedTo = isManager(req) ? req.query.assigned_to : req.user.userId;
    res.json(await Task.getTasks({ assignedTo, status }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load tasks' });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.getTaskById(req.params.id);
    if (!task || !canWorkOn(req, task)) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load task' });
  }
};

exports.createTask = async (req, res) => {
  try {
    const problem = validate(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const body = { ...req.body, checklist: cleanChecklist(req.body.checklist) };
    const id = await Task.createTask(body, req.user.userId);
    await logActivity(req, 'task_created', `Created task "${body.title.trim()}"`);
    res.status(201).json({ task_id: id });
  } catch (err) {
    if (isBadReference(err)) return res.status(400).json({ error: 'Assignee or cattle does not exist' });
    console.error(err);
    res.status(500).json({ error: 'Could not create task' });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const problem = validate(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const body = { ...req.body, checklist: cleanChecklist(req.body.checklist) };
    const changed = await Task.updateTask(req.params.id, body);
    if (!changed) return res.status(404).json({ error: 'Task not found' });
    await logActivity(req, 'task_updated', `Updated task #${req.params.id}`);
    res.json({ message: 'Task updated successfully' });
  } catch (err) {
    if (isBadReference(err)) return res.status(400).json({ error: 'Assignee or cattle does not exist' });
    console.error(err);
    res.status(500).json({ error: 'Could not update task' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const task = await Task.getTaskById(req.params.id);
    if (!task || !canWorkOn(req, task)) return res.status(404).json({ error: 'Task not found' });
    await Task.updateStatus(task.task_id, status);
    await logActivity(req, 'task_status', `Marked task "${task.title}" as ${status}`);
    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update status' });
  }
};

exports.toggleChecklistItem = async (req, res) => {
  try {
    const task = await Task.getTaskById(req.params.id);
    if (!task || !canWorkOn(req, task)) return res.status(404).json({ error: 'Task not found' });
    const checklist = cleanChecklist(task.checklist);
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || !checklist[index]) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }
    checklist[index].done = !checklist[index].done;
    await Task.setChecklist(task.task_id, checklist);
    res.json({ checklist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update checklist' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const removed = await Task.deleteTask(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Task not found' });
    await logActivity(req, 'task_deleted', `Deleted task #${req.params.id}`);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete task' });
  }
};
