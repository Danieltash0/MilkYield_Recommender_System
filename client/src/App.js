import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, dashboardPathFor, ROLES } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Unauthorized from './pages/auth/Unauthorized';
import Dashboard from './pages/dashboard/Dashboard';
import CattleList from './pages/cattle/CattleList';
import AddCattle from './pages/cattle/AddCattle';
import EditCattle from './pages/cattle/EditCattle';
import CattleProfile from './pages/cattle/CattleProfile';
import UserManagement from './pages/admin/UserManagement';
import AddUser from './pages/admin/AddUser';
import EditUser from './pages/admin/EditUser';
import ActivityLogs from './pages/admin/ActivityLogs';
import Settings from './pages/admin/Settings';

const { ADMIN, MANAGER, VET, WORKER } = ROLES;
const ALL = [ADMIN, MANAGER, VET, WORKER];

function App() {
  const { user } = useAuth();
  const home = user ? dashboardPathFor(user.role) : '/';

  return (
    <Router>
      <div className="app">
        {user && <Navbar />}
        <main className="page-container">
          <Routes>
            {/* Public */}
            <Route path="/" element={user ? <Navigate to={home} replace /> : <Landing />} />
            <Route path="/login" element={user ? <Navigate to={home} replace /> : <Login />} />
            <Route path="/signup" element={user ? <Navigate to={home} replace /> : <Signup />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* One dashboard per role, each guarded to that role */}
            <Route path="/dashboard/admin" element={<ProtectedRoute allowedRoles={[ADMIN]}><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/manager" element={<ProtectedRoute allowedRoles={[MANAGER]}><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/vet" element={<ProtectedRoute allowedRoles={[VET]}><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/worker" element={<ProtectedRoute allowedRoles={[WORKER]}><Dashboard /></ProtectedRoute>} />

            {/* Cattle management */}
            <Route path="/cattle" element={<ProtectedRoute allowedRoles={ALL}><CattleList /></ProtectedRoute>} />
            <Route path="/cattle/add" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER, WORKER]}><AddCattle /></ProtectedRoute>} />
            <Route path="/cattle/:id/edit" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER]}><EditCattle /></ProtectedRoute>} />
            <Route path="/cattle/:id" element={<ProtectedRoute allowedRoles={ALL}><CattleProfile /></ProtectedRoute>} />

            {/* Admin panel */}
            <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={[ADMIN]}><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/users/add" element={<ProtectedRoute allowedRoles={[ADMIN]}><AddUser /></ProtectedRoute>} />
            <Route path="/admin/users/:id/edit" element={<ProtectedRoute allowedRoles={[ADMIN]}><EditUser /></ProtectedRoute>} />
            <Route path="/admin/logs" element={<ProtectedRoute allowedRoles={[ADMIN]}><ActivityLogs /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={[ADMIN]}><Settings /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to={home} replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
