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
import HealthRecords from './pages/health/HealthRecords';
import AddHealthRecord from './pages/health/AddHealthRecord';
import EditHealthRecord from './pages/health/EditHealthRecord';
import Appointments from './pages/health/Appointments';
import AddAppointment from './pages/health/AddAppointment';
import EditAppointment from './pages/health/EditAppointment';

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

            {/* Vet health */}
            <Route path="/health" element={<ProtectedRoute allowedRoles={ALL}><HealthRecords /></ProtectedRoute>} />
            <Route path="/health/add" element={<ProtectedRoute allowedRoles={[ADMIN, VET]}><AddHealthRecord /></ProtectedRoute>} />
            <Route path="/health/:id/edit" element={<ProtectedRoute allowedRoles={[ADMIN, VET]}><EditHealthRecord /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute allowedRoles={ALL}><Appointments /></ProtectedRoute>} />
            <Route path="/appointments/add" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER, VET]}><AddAppointment /></ProtectedRoute>} />
            <Route path="/appointments/:id/edit" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER, VET]}><EditAppointment /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to={home} replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
