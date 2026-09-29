import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest, getAuthHeaders } from '../../api/config';
import { useAdminUsers } from '../../api/useAdmin';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/Loader';
import UserForm from './UserForm';
import '../../styles/admin.css';

const EditUser = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { updateUser } = useAdminUsers();
  const [initial, setInitial] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let active = true;
    apiRequest(`/admin/users/${id}`, { headers: getAuthHeaders() })
      .then((u) => active && setInitial({ name: u.name, email: u.email, role: u.role, status: u.status }))
      .catch(() => active && setInitial(null));
    return () => { active = false; };
  }, [id]);

  const handleSubmit = async (form) => {
    const result = await updateUser(id, form);
    if (result.success) navigate('/admin/users');
    return result;
  };

  if (initial === undefined) return <Loader />;
  if (initial === null) {
    return (
      <div className="container narrow">
        <div className="alert alert-error">User not found.</div>
        <Link to="/admin/users" className="btn btn-outline">Back to users</Link>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <div className="page-header"><h1>Edit user</h1></div>
      <UserForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" isSelf={String(me.user_id) === String(id)} />
    </div>
  );
};

export default EditUser;
