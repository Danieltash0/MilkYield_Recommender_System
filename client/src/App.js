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
import AdminDashboard from './pages/dashboard/AdminDashboard';
import ManagerDashboard from './pages/dashboard/ManagerDashboard';
import VetDashboard from './pages/dashboard/VetDashboard';
import WorkerDashboard from './pages/dashboard/WorkerDashboard';
import CattleList from './pages/cattle/CattleList';
import AddCattle from './pages/cattle/AddCattle';
import EditCattle from './pages/cattle/EditCattle';
import CattleProfile from './pages/cattle/CattleProfile';

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
            <Route path="/dashboard/admin" element={<ProtectedRoute allowedRoles={[ADMIN]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/manager" element={<ProtectedRoute allowedRoles={[MANAGER]}><ManagerDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/vet" element={<ProtectedRoute allowedRoles={[VET]}><VetDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/worker" element={<ProtectedRoute allowedRoles={[WORKER]}><WorkerDashboard /></ProtectedRoute>} />

            {/* Cattle management */}
            <Route path="/cattle" element={<ProtectedRoute allowedRoles={ALL}><CattleList /></ProtectedRoute>} />
            <Route path="/cattle/add" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER, WORKER]}><AddCattle /></ProtectedRoute>} />
            <Route path="/cattle/:id/edit" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER]}><EditCattle /></ProtectedRoute>} />
            <Route path="/cattle/:id" element={<ProtectedRoute allowedRoles={ALL}><CattleProfile /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to={home} replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
