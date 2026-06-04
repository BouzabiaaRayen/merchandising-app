import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import CatalogManagement from './pages/CatalogManagement';
import Stores from './pages/Stores';
import VisitsTracking from './pages/VisitsTracking';
import Inventory from './pages/Inventory';
import Notifications from './pages/Notifications';
import Documents from './pages/Documents';
import Reports from './pages/Reports';
import Performance from './pages/Performance';
import LeaveRequests from './pages/LeaveRequests';
import Complaints from './pages/Complaints';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';
import Logs from './pages/Logs';
import GPSMonitoring from './pages/GPSMonitoring';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
        <Route path="/catalog" element={<ProtectedRoute><CatalogManagement /></ProtectedRoute>} />
        <Route path="/catalog/brands" element={<Navigate to="/catalog" replace />} />
        <Route path="/catalog/categories" element={<Navigate to="/catalog" replace />} />
        <Route path="/catalog/products" element={<Navigate to="/catalog" replace />} />
        <Route path="/brands" element={<Navigate to="/catalog" replace />} />
        <Route path="/categories" element={<Navigate to="/catalog" replace />} />
        <Route path="/products" element={<Navigate to="/catalog" replace />} />
        <Route path="/stores" element={<ProtectedRoute><Stores /></ProtectedRoute>} />
        <Route path="/visits-tracking" element={<ProtectedRoute><VisitsTracking /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
        <Route path="/leave-requests" element={<ProtectedRoute><LeaveRequests /></ProtectedRoute>} />
        <Route path="/complaints" element={<ProtectedRoute><Complaints /></ProtectedRoute>} />
        <Route path="/schedules" element={<ProtectedRoute><Complaints /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
        <Route path="/gps-monitoring" element={<ProtectedRoute><GPSMonitoring /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
} // ← this was missing!

export default App;