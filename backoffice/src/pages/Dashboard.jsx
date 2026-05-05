import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import GPSMap from '../components/GPSMap';
import { userService, visitService, notificationService, gpsService, storeService } from '../services/apiService';
import {
  UserCheck, Users, RefreshCw, CheckCircle2, AlertTriangle,
  MapPin, FileText, Clock, Zap,
} from 'lucide-react';
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
    
    // No automatic refresh - load data once on mount
    return () => {};
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

      // Fetch GPS alerts (urgent system notifications about GPS being disabled)
      let alertsRes = await notificationService.getUrgent().catch(err => {
        console.error('Failed to fetch alerts from urgent endpoint:', err.response?.data || err.message);
        return null;
      });

      // Fallback: if urgent endpoint fails or returns nothing, filter all notifications
      if (!alertsRes || (!alertsRes.count && !alertsRes.results?.length)) {
        console.log('Trying fallback: fetching all notifications and filtering by GPS alerts');
        const allNotifs = await notificationService.getNotifications().catch(err => {
          console.error('Failed to fetch notifications:', err.response?.data || err.message);
          return { results: [] };
        });
        // Count system notifications with urgent priority (GPS disable alerts)
        const gpsAlerts = (allNotifs.results || []).filter(n => 
          (n.type === 'GPS_ALERT' || n.notification_type === 'GPS_ALERT' ||
           (n.notification_type === 'system' && n.priority === 'urgent' && n.title?.includes('GPS')))
        );
        alertsRes = { results: gpsAlerts, count: gpsAlerts.length };
      }

      // Handle both count and results array formats
      const gpsAlertsCount = alertsRes?.count || alertsRes?.results?.length || 0;
      console.log('GPS Alerts response:', alertsRes, 'Count:', gpsAlertsCount);

      setStats({
        totalMerchandisers: merchandisersRes.count || 0,
        merchandiserChange: 0, // Calculate from historical data if available
        totalSupervisors: supervisorsRes.count || 0,
        supervisorChange: 0, // Calculate from historical data if available
        activeVisits: activeVisitsRes.count || 0,
        completedVisits: completedVisitsRes.count || 0,
        completedVisitsChange: 0, // Calculate from historical data if available
        gpsAlerts: gpsAlertsCount,
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


      // Get all merchandisers and stores for lookup
      const [merchandisersRes, storesRes] = await Promise.all([
        userService.getUsers({ role: 'merchandiser', page_size: 1000 }),
        storeService.getStores({ page_size: 1000 })
      ]);
      const merchandisers = merchandisersRes.results || [];
      const stores = storesRes.results || [];


      // Helper to get merchandiser name
      const getMerchandiserName = (visit) => {
        if (visit.merchandiser_name) return visit.merchandiser_name;
        if (visit.merchandiser) {
          const merch = merchandisers.find(m => m.id === visit.merchandiser);
          if (merch) return `${merch.first_name || ''} ${merch.last_name || ''}`.trim() || merch.username || 'Unknown User';
        }
        return 'Unknown User';
      };

      // Helper to get store name
      const getStoreName = (visit) => {
        if (visit.store_name) return visit.store_name;
        if (visit.store) {
          const store = stores.find(s => s.id === visit.store);
          if (store) return store.name || 'Unknown Store';
        }
        return 'Unknown Store';
      };


      // Transform visits to activity format
      const activities = (visitsRes.results || []).map((visit, index) => {
        const timeAgo = getTimeAgo(visit.updated_at);
        const userName = getMerchandiserName(visit);
        const storeName = getStoreName(visit);
        if (visit.status === 'completed') {
          return {
            id: visit.id,
            user: userName,
            action: 'Visit Completed',
            location: storeName,
            time: timeAgo,
            type: 'completed',
          };
        } else if (visit.status === 'in_progress') {
          return {
            id: visit.id,
            user: userName,
            action: 'checked in',
            location: storeName,
            time: timeAgo,
            type: 'checkin',
          };
        } else if (visit.status === 'cancelled') {
          return {
            id: visit.id,
            user: userName,
            action: 'Visit Cancelled',
            location: storeName,
            time: timeAgo,
            type: 'delayed',
          };
        }
        return {
          id: visit.id,
          user: userName,
          action: visit.status,
          location: storeName,
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
            <div className="loading-state">
              <Zap className="loading-icon" size={48} />
              <p>Loading dashboard data...</p>
            </div>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <div className="stat-icon merchandisers"><UserCheck size={22} /></div>
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
                    <div className="stat-icon supervisors"><Users size={22} /></div>
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
                    <div className="stat-icon active"><RefreshCw size={22} /></div>
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
                    <div className="stat-icon completed"><CheckCircle2 size={22} /></div>
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

                <div className={`stat-card ${stats.gpsAlerts > 0 ? 'alert-active' : ''}`}>
                  <div className="stat-header">
                    <div className="stat-icon alerts"><AlertTriangle size={22} /></div>
                    <div className="stat-badge">Live</div>
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
                    <a href="#" className="view-all-link" onClick={e => { e.preventDefault(); window.location.href = '/logs'; }}>VIEW ALL LOGS</a>
                  </div>
                  <div className="activities-list">
                    {recentActivities.length > 0 ? (
                      recentActivities.map((activity) => (
                        <div key={activity.id} className={`activity-item ${activity.type}`}>
                          <div className={`activity-icon ${activity.type}`}>
                            {activity.type === 'checkin' && <MapPin size={16} />}
                            {activity.type === 'alert' && <AlertTriangle size={16} />}
                            {activity.type === 'report' && <FileText size={16} />}
                            {activity.type === 'completed' && <CheckCircle2 size={16} />}
                            {activity.type === 'delayed' && <Clock size={16} />}
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
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
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
