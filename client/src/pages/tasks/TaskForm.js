import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAssignableUsers } from '../../api/useTasks';
import { useCattle } from '../../api/useCattle';

export const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];
export const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'];

export const emptyTask = {
  title: '',
  description: '',
  assigned_to: '',
  cattle_id: '',
  priority: 'Medium',
  due_date: '',
  checklist: []
};

// Shared by AddTask and EditTask
const TaskForm = ({ initial = emptyTask, onSubmit, submitLabel }) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const users = useAssignableUsers();
  const { cattle } = useCattle();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const setItem = (i, text) =>
    setForm({ ...form, checklist: form.checklist.map((item, j) => (j === i ? { ...item, text } : item)) });
  const addItem = () => setForm({ ...form, checklist: [...form.checklist, { text: '', done: false }] });
  const removeItem = (i) => setForm({ ...form, checklist: form.checklist.filter((_, j) => j !== i) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const result = await onSubmit({
      ...form,
      assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      cattle_id: form.cattle_id ? Number(form.cattle_id) : null
    });
    if (!result.success) {
      setError(result.error || 'Something went wrong');
      setSaving(false);
    }
  };

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="form-group">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" maxLength={150} value={form.title} onChange={handleChange} required />
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} value={form.description} onChange={handleChange} />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="assigned_to">Assign to</label>
          <select id="assigned_to" name="assigned_to" value={form.assigned_to} onChange={handleChange}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="cattle_id">Related cattle (optional)</label>
          <select id="cattle_id" name="cattle_id" value={form.cattle_id} onChange={handleChange}>
            <option value="">None</option>
            {cattle.map((c) => (
              <option key={c.cattle_id} value={c.cattle_id}>{c.name || 'Unnamed'} · {c.tag_number}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="priority">Priority</label>
          <select id="priority" name="priority" value={form.priority} onChange={handleChange}>
            {PRIORITY_OPTIONS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="due_date">Due date</label>
          <input id="due_date" name="due_date" type="date" value={form.due_date} onChange={handleChange} />
        </div>
      </div>

      <fieldset className="checklist-editor">
        <legend>Checklist</legend>
        {form.checklist.length === 0 && <p className="muted">No checklist items yet.</p>}
        {form.checklist.map((item, i) => (
          <div className="checklist-row" key={i}>
            <input
              aria-label={`Checklist item ${i + 1}`}
              value={item.text}
              onChange={(e) => setItem(i, e.target.value)}
              placeholder="e.g. Refill water troughs"
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeItem(i)}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={addItem}>Add item</button>
      </fieldset>

      <div className="card-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        <Link to="/tasks" className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  );
};

export default TaskForm;
