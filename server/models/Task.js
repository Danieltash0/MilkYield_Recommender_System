const db = require('../utils/database');

// Joins in the names the task list shows, so the client needs one request
const SELECT = `
  SELECT t.task_id, t.title, t.description, t.assigned_to, t.assigned_by, t.cattle_id,
         t.priority, t.status, t.due_date, t.checklist, t.completed_at, t.created_at,
         assignee.name AS assigned_to_name, assigner.name AS assigned_by_name,
         c.name AS cattle_name, c.tag_number AS cattle_tag
  FROM tasks t
  LEFT JOIN users assignee ON assignee.user_id = t.assigned_to
  LEFT JOIN users assigner ON assigner.user_id = t.assigned_by
  LEFT JOIN cattle c ON c.cattle_id = t.cattle_id`;

// Open work first, then by due date (undated last), then priority, then newest
const ORDER = `
  ORDER BY t.status = 'Completed', t.due_date IS NULL, t.due_date,
           FIELD(t.priority, 'High', 'Medium', 'Low'), t.created_at DESC`;

const checklistJson = (list) => (list && list.length ? JSON.stringify(list) : null);

exports.getTasks = async ({ assignedTo, status } = {}) => {
  const where = [];
  const params = [];
  if (assignedTo) {
    where.push('t.assigned_to = ?');
    params.push(assignedTo);
  }
  if (status) {
    where.push('t.status = ?');
    params.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await db.execute(`${SELECT} ${clause} ${ORDER}`, params);
  return rows;
};

exports.getTaskById = async (id) => {
  const [rows] = await db.execute(`${SELECT} WHERE t.task_id = ?`, [id]);
  return rows[0];
};

exports.createTask = async (t, assignedBy) => {
  const [result] = await db.execute(
    `INSERT INTO tasks (title, description, assigned_to, assigned_by, cattle_id, priority, due_date, checklist)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.title.trim(),
      t.description || null,
      t.assigned_to || null,
      assignedBy,
      t.cattle_id || null,
      t.priority || 'Medium',
      t.due_date || null,
      checklistJson(t.checklist)
    ]
  );
  return result.insertId;
};

exports.updateTask = async (id, t) => {
  const [result] = await db.execute(
    `UPDATE tasks SET title=?, description=?, assigned_to=?, cattle_id=?, priority=?, due_date=?, checklist=?
     WHERE task_id=?`,
    [
      t.title.trim(),
      t.description || null,
      t.assigned_to || null,
      t.cattle_id || null,
      t.priority || 'Medium',
      t.due_date || null,
      checklistJson(t.checklist),
      id
    ]
  );
  return result.affectedRows;
};

exports.updateStatus = async (id, status) => {
  const [result] = await db.execute(
    `UPDATE tasks SET status = ?, completed_at = IF(? = 'Completed', NOW(), NULL) WHERE task_id = ?`,
    [status, status, id]
  );
  return result.affectedRows;
};

exports.setChecklist = async (id, checklist) => {
  await db.execute('UPDATE tasks SET checklist = ? WHERE task_id = ?', [checklistJson(checklist), id]);
};

exports.deleteTask = async (id) => {
  const [result] = await db.execute('DELETE FROM tasks WHERE task_id = ?', [id]);
  return result.affectedRows;
};
