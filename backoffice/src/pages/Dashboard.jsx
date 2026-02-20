import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import GPSMap from '../components/GPSMap';
import { userService, visitService, notificationService, gpsService, storeService } from '../services/apiService';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalMerchandisers: 0,
    merchandiserChange: 0,
    totalSupervisors: 0,
    supervisorChange: 0,
    activeVisits: 0,
    completedVisits: 0,
    completedVisitsChange: 0,
    gpsAlerts: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [gpsLocations, setGpsLocations] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentActivities();
    fetchGPSLocations();
    fetchStores();
    
    // Refresh GPS locations every 30 seconds
    const gpsInterval = setInterval(fetchGPSLocations, 30000);
    return () => clearInterval(gpsInterval);
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch users by role
      const [merchandisersRes, supervisorsRes] = await Promise.all([
        userService.getUsers({ role: 'merchandiser' }).catch(err => {
          console.error('Failed to fetch merchandisers:', err.response?.data || err.message);
          return { count: 0, results: [] };
        }),
        userService.getUsers({ role: 'supervisor' }).catch(err => {
          console.error('Failed to fetch supervisors:', err.response?.data || err.message);
          return { count: 0, results: [] };
        }),
      ]);

      // Fetch visits by status
      const [activeVisitsRes, completedVisitsRes] = await Promise.all([
        visitService.getVisits({ status: 'in_progress' }).catch(err => {
          console.error('Failed to fetch active visits:', err.response?.data || err.message);
          return { count: 0, results: [] };
        }),
        visitService.getVisits({ status: 'completed' }).catch(err => {
          console.error('Failed to fetch completed visits:', err.response?.data || err.message);
          return { count: 0, results: [] };
        }),
      ]);

      // Fetch GPS alerts (urgent notifications)
      const alertsRes = await notificationService.getUrgent().catch(err => {
        console.error('Failed to fetch alerts:', err.response?.data || err.message);
        return { count: 0 };
      });

      setStats({
        totalMerchandisers: merchandisersRes.count || 0,
        merchandiserChange: 0, // Calculate from historical data if available
        totalSupervisors: supervisorsRes.count || 0,
        supervisorChange: 0, // Calculate from historical data if available
        activeVisits: activeVisitsRes.count || 0,
        completedVisits: completedVisitsRes.count || 0,
        completedVisitsChange: 0, // Calculate from historical data if available
        gpsAlerts: alertsRes.count || 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      // Fetch recent visits (last 10)
      const visitsRes = await visitService.getVisits({ 
        ordering: '-updated_at',
        page_size: 10 
      });

      // Transform visits to activity format
      const activities = (visitsRes.results || []).map((visit, index) => {
        const timeAgo = getTimeAgo(visit.updated_at);
        
        if (visit.status === 'completed') {
          return {
            id: visit.id,
            user: visit.merchandiser_name || 'Unknown User',
            action: 'Visit Completed',
            location: visit.store_name || 'Unknown Store',
            time: timeAgo,
            type: 'completed',
          };
        } else if (visit.status === 'in_progress') {
          return {
            id: visit.id,
            user: visit.merchandiser_name || 'Unknown User',
            action: 'checked in',
            location: visit.store_name || 'Unknown Store',
            time: timeAgo,
            type: 'checkin',
          };
        } else if (visit.status === 'cancelled') {
          return {
            id: visit.id,
            user: visit.merchandiser_name || 'Unknown User',
            action: 'Visit Cancelled',
            location: visit.store_name || 'Unknown Store',
            time: timeAgo,
            type: 'delayed',
          };
        }
        
        return {
          id: visit.id,
          user: visit.merchandiser_name || 'Unknown User',
          action: visit.status,
          location: visit.store_name || 'Unknown Store',
          time: timeAgo,
          type: 'report',
        };
      });

      setRecentActivities(activities);
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
      setRecentActivities([]);
    }
  };

  const fetchGPSLocations = async () => {
    try {
      const data = await gpsService.getLocations({ 
        ordering: '-timestamp',
        page_size: 50 // Get latest 50 locations
      });
      
      // Get unique locations (latest per merchandiser/visit)
      const locationMap = new Map();
      (data.results || []).forEach(location => {
        const key = location.merchandiser || location.visit;
        if (!locationMap.has(key)) {
          locationMap.set(key, {
            id: location.id,
            latitude: location.latitude,
            longitude: location.longitude,
            merchandiser_name: location.merchandiser_name,
            store_name: location.store_name,
            status: location.status || 'active',
            accuracy: location.accuracy,
            updated_at: location.timestamp || location.created_at,
          });
        }
      });
      
      setGpsLocations(Array.from(locationMap.values()));
    } catch (error) {
      console.error('Failed to fetch GPS locations:', error);
      // Don't clear locations on error, keep showing last known positions
    }
  };

  const fetchStores = async () => {
    try {
      const data = await storeService.getStores({ page_size: 1000 }); // Get all stores
      
      // Filter stores that have valid coordinates
      const storesWithCoords = (data.results || [])
        .filter(store => store.latitude && store.longitude)
        .map(store => ({
          id: store.id,
          name: store.name,
          latitude: parseFloat(store.latitude),
          longitude: parseFloat(store.longitude),
          address: store.address,
          city: store.city,
          type: store.store_type,
          status: store.status || 'active',
        }));
      
      setStores(storesWithCoords);
    } catch (error) {
      console.error('Failed to fetch stores:', error);
      setStores([]);
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'UNKNOWN';
    
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'JUST NOW';
    if (diffMins < 60) return `${diffMins} MINUTE${diffMins > 1 ? 'S' : ''} AGO`;
    if (diffHours < 24) return `${diffHours} HOUR${diffHours > 1 ? 'S' : ''} AGO`;
    return `${diffDays} DAY${diffDays > 1 ? 'S' : ''} AGO`;
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          {loading ? (
            <div className="loading">Loading statistics...</div>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <div className="stat-icon merchandisers">👤</div>
                    {stats.merchandiserChange !== 0 && (
                      <div className={`stat-change ${stats.merchandiserChange > 0 ? 'positive' : 'negative'}`}>
                        {stats.merchandiserChange > 0 ? '+' : ''}{stats.merchandiserChange}%
                      </div>
                    )}
                  </div>
                  <div className="stat-content">
                    <h3>Total Merchandisers</h3>
                    <p className="stat-value">{stats.totalMerchandisers}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <div className="stat-icon supervisors">👥</div>
                    {stats.supervisorChange !== 0 && (
                      <div className={`stat-change ${stats.supervisorChange > 0 ? 'positive' : 'negative'}`}>
                        {stats.supervisorChange > 0 ? '+' : ''}{stats.supervisorChange}%
                      </div>
                    )}
                  </div>
                  <div className="stat-content">
                    <h3>Total Supervisors</h3>
                    <p className="stat-value">{stats.totalSupervisors}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <div className="stat-icon active">⟳</div>
                    <div className="live-indicator">
                      <span className="live-dot"></span>
                      LIVE
                    </div>
                  </div>
                  <div className="stat-content">
                    <h3>Active Visits</h3>
                    <p className="stat-value">{stats.activeVisits}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <div className="stat-icon completed">✓</div>
                    {stats.completedVisitsChange !== 0 && (
                      <div className={`stat-change ${stats.completedVisitsChange > 0 ? 'positive' : 'negative'}`}>
                        {stats.completedVisitsChange > 0 ? '+' : ''}{stats.completedVisitsChange}%
                      </div>
                    )}
                  </div>
                  <div className="stat-content">
                    <h3>Completed Visits</h3>
                    <p className="stat-value">{stats.completedVisits.toLocaleString()}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <div className="stat-icon alerts">⚠</div>
                    <div className="stat-badge">Today</div>
                  </div>
                  <div className="stat-content">
                    <h3>GPS Alerts</h3>
                    <p className="stat-value">{stats.gpsAlerts}</p>
                  </div>
                </div>
              </div>

              <div className="dashboard-sections">
                <div className="gps-section">
                  <div className="section-header">
                    <div>
                      <h2>GPS Monitoring</h2>
                      <p>Real-time merchandiser locations in Tunisia</p>
                    </div>
                    <a href="#" className="full-view-link">Full View ↗</a>
                  </div>
                  <div className="map-container">
                    <GPSMap 
                      locations={gpsLocations}
                      stores={stores}
                      center={[34.0, 9.0]} 
                      zoom={7} 
                    />
                  </div>
                </div>

                <div className="activities-section">
                  <div className="section-header">
                    <div>
                      <h2>Recent Activities</h2>
                      <p>Live operational log</p>
                    </div>
                    <a href="#" className="view-all-link">VIEW ALL LOGS</a>
                  </div>
                  <div className="activities-list">
                    {recentActivities.length > 0 ? (
                      recentActivities.map((activity) => (
                        <div key={activity.id} className={`activity-item ${activity.type}`}>
                          <div className={`activity-icon ${activity.type}`}>
                            {activity.type === 'checkin' && '📍'}
                            {activity.type === 'alert' && '⚠️'}
                            {activity.type === 'report' && '📄'}
                            {activity.type === 'completed' && '✅'}
                            {activity.type === 'delayed' && '⏱️'}
                          </div>
                          <div className="activity-content">
                            <div className="activity-text">
                              {activity.user && <strong>{activity.user}</strong>}
                              {activity.action && <span> {activity.action}</span>}
                              {activity.alert && <strong>{activity.alert}</strong>}
                              {activity.report && <strong>{activity.report}</strong>}
                            </div>
                            <div className="activity-meta">
                              {activity.location || activity.details} • {activity.time}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                        No recent activities to display
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
