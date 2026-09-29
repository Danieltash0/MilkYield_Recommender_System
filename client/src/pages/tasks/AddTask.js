import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../../api/useTasks';
import TaskForm from './TaskForm';
import '../../styles/tasks.css';

const AddTask = () => {
  const { createTask } = useTasks();
  const navigate = useNavigate();

  const handleSubmit = async (form) => {
    const result = await createTask(form);
    if (result.success) navigate('/tasks');
    return result;
  };

  return (
    <div className="container narrow">
      <div className="page-header"><h1>New task</h1></div>
      <TaskForm onSubmit={handleSubmit} submitLabel="Create task" />
    </div>
  );
};

export default AddTask;
