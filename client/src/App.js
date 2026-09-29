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
import TaskList from './pages/tasks/TaskList';
import AddTask from './pages/tasks/AddTask';
import EditTask from './pages/tasks/EditTask';
import MilkingRecords from './pages/milking/MilkingRecords';
import LogMilking from './pages/milking/LogMilking';
import EditMilking from './pages/milking/EditMilking';
import CattleMilkHistory from './pages/milking/CattleMilkHistory';
import HealthRecords from './pages/health/HealthRecords';
import AddHealthRecord from './pages/health/AddHealthRecord';
import EditHealthRecord from './pages/health/EditHealthRecord';
import Appointments from './pages/health/Appointments';
import AddAppointment from './pages/health/AddAppointment';
import EditAppointment from './pages/health/EditAppointment';
import ScanQR from './pages/qr/ScanQR';
import ResolveQR from './pages/qr/ResolveQR';
import QRLabels from './pages/qr/QRLabels';
import Finance from './pages/finance/Finance';
import AddFinance from './pages/finance/AddFinance';
import EditFinance from './pages/finance/EditFinance';
import Reports from './pages/reports/Reports';

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
            <Route path="/cattle/:id/milk" element={<ProtectedRoute allowedRoles={ALL}><CattleMilkHistory /></ProtectedRoute>} />

            {/* Milking records */}
            <Route path="/milking" element={<ProtectedRoute allowedRoles={ALL}><MilkingRecords /></ProtectedRoute>} />
            <Route path="/milking/log" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER, WORKER]}><LogMilking /></ProtectedRoute>} />
            <Route path="/milking/:id/edit" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER]}><EditMilking /></ProtectedRoute>} />

            {/* Tasks */}
            <Route path="/tasks" element={<ProtectedRoute allowedRoles={ALL}><TaskList /></ProtectedRoute>} />
            <Route path="/tasks/add" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER]}><AddTask /></ProtectedRoute>} />
            <Route path="/tasks/:id/edit" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER]}><EditTask /></ProtectedRoute>} />

            {/* Vet health */}
            <Route path="/health" element={<ProtectedRoute allowedRoles={ALL}><HealthRecords /></ProtectedRoute>} />
            <Route path="/health/add" element={<ProtectedRoute allowedRoles={[ADMIN, VET]}><AddHealthRecord /></ProtectedRoute>} />
            <Route path="/health/:id/edit" element={<ProtectedRoute allowedRoles={[ADMIN, VET]}><EditHealthRecord /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute allowedRoles={ALL}><Appointments /></ProtectedRoute>} />
            <Route path="/appointments/add" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER, VET]}><AddAppointment /></ProtectedRoute>} />
            <Route path="/appointments/:id/edit" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER, VET]}><EditAppointment /></ProtectedRoute>} />

            {/* QR identification */}
            <Route path="/scan" element={<ProtectedRoute allowedRoles={ALL}><ScanQR /></ProtectedRoute>} />
            <Route path="/qr/labels" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER]}><QRLabels /></ProtectedRoute>} />
            <Route path="/qr/:code" element={<ProtectedRoute allowedRoles={ALL}><ResolveQR /></ProtectedRoute>} />

            {/* Finance and reports */}
            <Route path="/finance" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER]}><Finance /></ProtectedRoute>} />
            <Route path="/finance/add" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER]}><AddFinance /></ProtectedRoute>} />
            <Route path="/finance/:id/edit" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER]}><EditFinance /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={[ADMIN, MANAGER]}><Reports /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to={home} replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
