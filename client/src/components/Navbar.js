import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth, dashboardPathFor, ROLES } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const link = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to={dashboardPathFor(user.role)} className="brand">
          <span className="brand-mark" aria-hidden="true">D</span>
          DairyDan
        </Link>

        <div className="nav-menu">
          <NavLink to={dashboardPathFor(user.role)} className={link}>
            Dashboard
          </NavLink>
          <NavLink to="/cattle" className={link}>
            Cattle
          </NavLink>
          {(user.role === ROLES.ADMIN || user.role === ROLES.MANAGER) && (
            <NavLink to="/finance" className={link}>
              Finance
            </NavLink>
          )}
          {user.role === ROLES.ADMIN && (
            <span className="nav-soon" title="Coming in a later branch">Users</span>
          )}
        </div>

        <div className="nav-user">
          <span className="user-name">{user.name}</span>
          <span className="role-pill">{user.role}</span>
          <button onClick={handleLogout} className="btn btn-outline btn-sm">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
