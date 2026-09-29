import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminUsers } from '../../api/useAdmin';
import UserForm from './UserForm';
import '../../styles/admin.css';

const AddUser = () => {
  const { createUser } = useAdminUsers();
  const navigate = useNavigate();

  const handleSubmit = async (form) => {
    const result = await createUser(form);
    if (result.success) navigate('/admin/users');
    return result;
  };

  return (
    <div className="container narrow">
      <div className="page-header">
        <div>
          <h1>Add user</h1>
          <p className="muted">Admins can create any role, including other admins.</p>
        </div>
      </div>
      <UserForm onSubmit={handleSubmit} submitLabel="Create account" isNew />
    </div>
  );
};

export default AddUser;
