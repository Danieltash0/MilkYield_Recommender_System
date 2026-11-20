import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, dashboardPathFor, ROLES } from '../context/AuthContext';
import Logo from './Logo';
import Icon from './Icon';

const DRAWER_QUERY = '(max-width: 1023px)';
const COLLAPSED_KEY = 'dairydan_sidebar_collapsed';

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
};

// App navigation. A fixed sidebar on desktop that can be collapsed to an icon
// rail (remembered between visits); below 1024px it becomes a top bar whose menu
// button slides the full sidebar in as a drawer.
const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1');
  const isDrawer = useMediaQuery(DRAWER_QUERY);
  const isRail = collapsed && !isDrawer;

  // The content column's margin follows the sidebar width (see App.css)
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    return () => document.body.classList.remove('sidebar-collapsed');
  }, [collapsed]);

  // Close the drawer after navigating, and on Escape
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isAdmin = user.role === ROLES.ADMIN;
  const canSeeFinance = isAdmin || user.role === ROLES.MANAGER;
  const canLogFeed = user.role !== ROLES.VET;
  const home = dashboardPathFor(user.role);

  const items = [
    { to: home, label: 'Dashboard', icon: 'grid' },
    { to: '/cattle', label: 'Cattle', icon: 'tag' },
    { to: '/milking', label: 'Milking', icon: 'drop' },
    canLogFeed && { to: '/feed/log', label: 'Feed', icon: 'trend' },
    { to: '/tasks', label: 'Tasks', icon: 'checklist' },
    { to: '/health', label: 'Health', icon: 'pulse' },
    { to: '/scan', label: 'Scan QR', icon: 'qr' },
    canSeeFinance && { to: '/finance', label: 'Finance', icon: 'wallet' },
    // /admin redirects to /admin/users; linking to it keeps the item active on every admin page
    isAdmin && { to: '/admin', label: 'Admin', icon: 'shield' }
  ].filter(Boolean);

  const link = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <header className="topbar">
        <button
          className="icon-btn"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
        >
          <Icon name="menu" size={22} />
        </button>
        <Link to={home} className="brand"><Logo />DairyDan</Link>
        <span className="avatar avatar-sm" aria-hidden="true">{initials}</span>
      </header>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <aside id="app-sidebar" className={`sidebar${open ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-head">
          <Link to={home} className="brand brand-light" title={isRail ? 'DairyDan' : undefined}>
            <Logo /><span className="brand-text">DairyDan</span>
          </Link>
          {/* Desktop: collapse/expand the sidebar. Drawer: hide it. */}
          <button
            className="icon-btn sidebar-toggle"
            onClick={() => (isDrawer ? setOpen(false) : setCollapsed((c) => !c))}
            aria-label={isDrawer ? 'Close menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={isDrawer ? open : !collapsed}
            aria-controls="app-sidebar"
            title={isDrawer ? 'Close menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name="sidebar" size={20} />
          </button>
        </div>

        <nav className="nav-menu" aria-label="Main">
          <span className="nav-section">Menu</span>
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} className={link} title={isRail ? i.label : undefined}>
              <Icon name={i.icon} size={20} />
              <span className="nav-label">{i.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="nav-user">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <div className="nav-user-text">
            <span className="user-name">{user.name}</span>
            <span className="user-role">{user.role}</span>
          </div>
          <button onClick={handleLogout} className="icon-btn" aria-label="Log out" title="Log out">
            <Icon name="logout" size={20} />
          </button>
        </div>
      </aside>
    </>
  );
};

export default Navbar;
