import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTasks } from '../../api/useTasks';
import Loader from '../../components/Loader';
import TaskForm, { emptyTask } from './TaskForm';
import '../../styles/tasks.css';

const EditTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getTaskById, updateTask } = useTasks();
  const [initial, setInitial] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let active = true;
    getTaskById(id).then((t) => {
      if (!active) return;
      setInitial(
        t && {
          ...emptyTask,
          title: t.title,
          description: t.description || '',
          assigned_to: t.assigned_to || '',
          cattle_id: t.cattle_id || '',
          priority: t.priority,
          due_date: t.due_date || '',
          checklist: t.checklist || []
        }
      );
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSubmit = async (form) => {
    const result = await updateTask(id, form);
    if (result.success) navigate('/tasks');
    return result;
  };

  if (initial === undefined) return <Loader />;
  if (initial === null) {
    return (
      <div className="container narrow">
        <div className="alert alert-error">Task not found.</div>
        <Link to="/tasks" className="btn btn-outline">Back to tasks</Link>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <div className="page-header"><h1>Edit task</h1></div>
      <TaskForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" />
    </div>
  );
};

export default EditTask;
