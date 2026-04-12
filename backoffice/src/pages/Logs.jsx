import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { visitService, userService, storeService } from '../services/apiService';
import './Dashboard.css';

const Logs = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const [visitsRes, merchandisersRes, storesRes] = await Promise.all([
          visitService.getVisits({ ordering: '-updated_at', page_size: 100 }),
          userService.getUsers({ role: 'merchandiser', page_size: 1000 }),
          storeService.getStores({ page_size: 1000 })
        ]);
        const merchandisers = merchandisersRes.results || [];
        const stores = storesRes.results || [];
        const getMerchandiserName = (visit) => {
          if (visit.merchandiser_name) return visit.merchandiser_name;
          if (visit.merchandiser) {
            const merch = merchandisers.find(m => m.id === visit.merchandiser);
            if (merch) return `${merch.first_name || ''} ${merch.last_name || ''}`.trim() || merch.username || 'Unknown User';
          }
          return 'Unknown User';
        };
        const getStoreName = (visit) => {
          if (visit.store_name) return visit.store_name;
          if (visit.store) {
            const store = stores.find(s => s.id === visit.store);
            if (store) return store.name || 'Unknown Store';
          }
          return 'Unknown Store';
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
        const acts = (visitsRes.results || []).map((visit) => {
          const timeAgo = getTimeAgo(visit.updated_at);
          const userName = getMerchandiserName(visit);
          const storeName = getStoreName(visit);
          let action = visit.status;
          if (visit.status === 'completed') action = 'Visit Completed';
          else if (visit.status === 'in_progress') action = 'Checked In';
          else if (visit.status === 'cancelled') action = 'Visit Cancelled';
          return {
            id: visit.id,
            user: userName,
            action,
            location: storeName,
            time: timeAgo,
          };
        });
        setActivities(acts);
      } catch (err) {
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <h2>All Activity Logs</h2>
          {loading ? (
            <div className="loading">Loading logs...</div>
          ) : activities.length === 0 ? (
            <div className="no-data">No logs found.</div>
          ) : (
            <div className="tracking-table-container">
              <table className="tracking-table">
                <thead>
                  <tr>
                    <th>MERCHANDISER</th>
                    <th>ACTION</th>
                    <th>STORE</th>
                    <th>WHEN</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr key={a.id}>
                      <td>{a.user}</td>
                      <td>{a.action}</td>
                      <td>{a.location}</td>
                      <td>{a.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Logs;
