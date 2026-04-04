import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('accessToken');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Only allow admin users
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin' && user.role !== 'ADMIN') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      return <Navigate to="/login" replace />;
    }
  } catch {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
