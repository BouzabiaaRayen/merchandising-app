import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { userService, productService, storeService, visitService } from '../services/apiService';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalProducts: 0,
    totalStores: 0,
    totalVisits: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersRes, productsRes, storesRes, visitsRes] = await Promise.all([
        userService.getUsers({ is_active: true }),
        productService.getProducts(),
        storeService.getStores(),
        visitService.getVisits(),
      ]);

      const totalUsersRes = await userService.getUsers();

      setStats({
        totalUsers: totalUsersRes.count ?? 0,
        activeUsers: usersRes.count ?? 0,
        totalProducts: productsRes.count ?? 0,
        totalStores: storesRes.count ?? 0,
        totalVisits: visitsRes.count ?? 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="page-header">
            <h1>Dashboard</h1>
            <p>Welcome to the merchandising backoffice</p>
          </div>

          {loading ? (
            <div className="loading">Loading statistics...</div>
          ) : (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <h3>Total Users</h3>
                  <p className="stat-value">{stats.totalUsers}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <h3>Active Users</h3>
                  <p className="stat-value">{stats.activeUsers}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📦</div>
                <div className="stat-content">
                  <h3>Total Products</h3>
                  <p className="stat-value">{stats.totalProducts}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">🏪</div>
                <div className="stat-content">
                  <h3>Total Stores</h3>
                  <p className="stat-value">{stats.totalStores}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-content">
                  <h3>Total Visits</h3>
                  <p className="stat-value">{stats.totalVisits}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
