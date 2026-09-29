import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, ROLES } from '../../context/AuthContext';
import { useTasks, useAssignableUsers } from '../../api/useTasks';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { STATUS_OPTIONS } from './TaskForm';
import '../../styles/tasks.css';

const today = () => new Date().toISOString().split('T')[0];
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString();
const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');

const TaskCard = ({ task, canManage, onStatus, onToggle, onEdit, onDelete }) => {
  const checklist = task.checklist || [];
  const done = checklist.filter((i) => i.done).length;
  const overdue = task.status !== 'Completed' && task.due_date && task.due_date < today();

  return (
    <div className={`card task-card${task.status === 'Completed' ? ' task-done' : ''}`}>
      <div className="task-head">
        <h3>{task.title}</h3>
        <span className={`pill priority-${slug(task.priority)}`}>{task.priority}</span>
      </div>

      <dl className="task-meta">
        <div><dt>Assigned to</dt><dd>{task.assigned_to_name || 'Unassigned'}</dd></div>
        <div>
          <dt>Due</dt>
          <dd className={overdue ? 'overdue' : undefined}>
            {task.due_date ? fmtDate(task.due_date) : '—'}{overdue && ' · overdue'}
          </dd>
        </div>
        {task.cattle_id && (
          <div>
            <dt>Cattle</dt>
            <dd><Link to={`/cattle/${task.cattle_id}`}>{task.cattle_name || 'Unnamed'} · {task.cattle_tag}</Link></dd>
          </div>
        )}
      </dl>

      {task.description && <p className="task-desc">{task.description}</p>}

      {checklist.length > 0 && (
        <div className="task-checklist">
          <span className="muted">Checklist {done}/{checklist.length}</span>
          <ul>
            {checklist.map((item, i) => (
              <li key={i}>
                <label className={item.done ? 'checked' : undefined}>
                  <input type="checkbox" checked={item.done} onChange={() => onToggle(task, i)} />
                  {item.text}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card-actions task-actions">
        <select
          value={task.status}
          onChange={(e) => onStatus(task, e.target.value)}
          aria-label={`Status of ${task.title}`}
          className={`status-select status-${slug(task.status)}`}
        >
          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
        {canManage && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(task)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(task)}>Delete</button>
          </>
        )}
      </div>
    </div>
  );
};

const TaskList = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole(ROLES.ADMIN, ROLES.MANAGER);
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [assignee, setAssignee] = useState('');
  const { tasks, loading, error, updateStatus, toggleChecklistItem, deleteTask } = useTasks({
    status,
    assigned_to: assignee
  });
  const users = useAssignableUsers(canManage);
  const [actionError, setActionError] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const report = (result) => setActionError(result.success ? '' : result.error);

  const confirmDelete = async () => {
    setDeleting(true);
    const result = await deleteTask(toDelete.task_id);
    setDeleting(false);
    report(result);
    if (result.success) setToDelete(null);
  };

  const open = tasks.filter((t) => t.status !== 'Completed').length;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>{canManage ? 'Tasks' : 'My tasks'}</h1>
          <p className="muted">{loading ? 'Loading…' : `${open} open of ${tasks.length}`}</p>
        </div>
        {canManage && <Link to="/tasks/add" className="btn btn-primary">New task</Link>}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
        {canManage && (
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Filter by assignee">
            <option value="">Everyone</option>
            {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <Loader />
      ) : tasks.length === 0 ? (
        <div className="card empty">
          <p>{status || assignee ? 'No tasks match these filters.' : 'No tasks yet.'}</p>
        </div>
      ) : (
        <div className="task-grid">
          {tasks.map((t) => (
            <TaskCard
              key={t.task_id}
              task={t}
              canManage={canManage}
              onStatus={async (task, s) => report(await updateStatus(task.task_id, s))}
              onToggle={async (task, i) => report(await toggleChecklistItem(task.task_id, i))}
              onEdit={(task) => navigate(`/tasks/${task.task_id}/edit`)}
              onDelete={(task) => { setActionError(''); setToDelete(task); }}
            />
          ))}
        </div>
      )}

      {toDelete && (
        <Modal
          title="Delete task"
          confirmText="Delete"
          loading={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        >
          <p>Delete <strong>{toDelete.title}</strong>? This cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
};

export default TaskList;
