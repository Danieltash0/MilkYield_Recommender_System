import React from 'react';
import { NavLink } from 'react-router-dom';

// Sub-navigation shared by the admin pages
const AdminTabs = () => {
  const tab = ({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab');
  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      <NavLink to="/admin/users" className={tab}>Users</NavLink>
      <NavLink to="/admin/logs" className={tab}>Activity log</NavLink>
      <NavLink to="/admin/settings" className={tab}>Settings</NavLink>
    </nav>
  );
};

export default AdminTabs;
