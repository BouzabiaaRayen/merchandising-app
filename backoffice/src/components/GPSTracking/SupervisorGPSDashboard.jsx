import React, { useEffect, useState, useRef, useCallback } from 'react';
import './SupervisorGPSDashboard.css';
import SupervisorGPSMap from './SupervisorGPSMap';
import { getWebSocketUrl } from '../../services/api';

const SupervisorGPSDashboard = () => {
  const [merchandisers, setMerchandisers] = useState({});
  const [selectedMerchandiser, setSelectedMerchandiser] = useState(null);
  const [isConnected, isConnectedSet] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'offline'
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const [autoCenter, setAutoCenter] = useState(false);

  // Fetch user list to update GPS active status
  const fetchUserStatuses = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch('/api/v1/users/?role=merchandiser&page_size=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      const users = Array.isArray(data) ? data : data.results || [];

      // Update merchandiser GPS status from server
      setMerchandisers((prev) => {
        const updated = { ...prev };
        let changed = false;

        users.forEach((user) => {
          if (!updated[user.id]) {
            updated[user.id] = { user_id: user.id };
          }

          // Update status based on gps_active field
          const newStatus = user.gps_active ? 'active' : 'offline';
          if (updated[user.id].status !== newStatus || updated[user.id].gps_active !== user.gps_active) {
            updated[user.id] = {
              ...updated[user.id],
              user_id: user.id,
              username: user.username,
              gps_active: user.gps_active,
              status: newStatus,
              lastUpdate: new Date().getTime(),
            };
            changed = true;
          }
        });

        return changed ? updated : prev;
      });
    } catch (error) {
      console.warn('Failed to fetch user statuses:', error.message);
    }
  }, []);

  // Establish WebSocket connection
  const connectWebSocket = useCallback(() => {
    try {
      setConnectionStatus('connecting');
      setErrorMessage(null);

      const token = localStorage.getItem('access_token');
      const wsUrl = getWebSocketUrl('/ws/supervisor/dashboard/');
      const wsUrlWithToken = `${wsUrl}?token=${token}`;

      console.log('Connecting to WebSocket:', wsUrl);

      wsRef.current = new WebSocket(wsUrlWithToken);

      wsRef.current.onopen = () => {
        console.log('✓ WebSocket connected');
        isConnectedSet(true);
        setConnectionStatus('connected');
        setErrorMessage(null);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('✗ WebSocket error:', error);
        setConnectionStatus('error');
        setErrorMessage('WebSocket connection error. Retrying in 3 seconds...');
        isConnectedSet(false);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        isConnectedSet(false);
        setConnectionStatus('disconnected');

        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          connectWebSocket();
        }, 3000);
      };
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      setErrorMessage(`Connection error: ${error.message}`);
      setConnectionStatus('error');
    }
  }, [wsUrl]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data) => {
    const type = data.type;

    switch (type) {
      case 'location_broadcast':
        // Update merchandiser location
        setMerchandisers((prev) => {
          const updated = { ...prev };
          const userId = data.user_id;

          if (!updated[userId]) {
            updated[userId] = {};
          }

          updated[userId] = {
            ...updated[userId],
            user_id: userId,
            username: data.username,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            altitude: data.altitude,
            speed: data.speed,
            heading: data.heading,
            visit_id: data.visit_id,
            timestamp: data.timestamp,
            status: data.session_status || 'active',
            lastUpdate: new Date().getTime(),
          };

          return updated;
        });
        break;

      case 'merchandiser_offline':
        // Mark merchandiser as offline
        setMerchandisers((prev) => {
          const updated = { ...prev };
          const userId = data.user_id;

          if (updated[userId]) {
            updated[userId] = {
              ...updated[userId],
              status: 'offline',
              lastUpdate: new Date().getTime(),
            };
          }

          return updated;
        });
        break;

      case 'status_update':
        // Handle status updates (active, paused, stopped, offline)
        setMerchandisers((prev) => {
          const updated = { ...prev };
          const userId = data.data?.user_id || data.user_id;

          if (updated[userId]) {
            updated[userId] = {
              ...updated[userId],
              status: data.data?.status || data.status,
              lastUpdate: new Date().getTime(),
            };
          }

          return updated;
        });
        break;

      case 'connection_established':
        console.log('Connection established:', data);
        break;

      case 'error':
        console.error('Server error:', data.message);
        setErrorMessage(`Server error: ${data.message}`);
        break;

      default:
        console.log('Unknown message type:', type);
    }
  }, []);

  // Initialize WebSocket connection and polling
  useEffect(() => {
    connectWebSocket();
    
    // Start polling user statuses every 2 seconds to catch gps_active changes
    fetchUserStatuses(); // Initial fetch
    pollIntervalRef.current = setInterval(() => {
      fetchUserStatuses();
    }, 2000);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [connectWebSocket, fetchUserStatuses]);

  // Mark merchandisers as offline if no update for 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const offlineThreshold = 5 * 60 * 1000; // 5 minutes

      setMerchandisers((prev) => {
        const updated = { ...prev };
        let changed = false;

        Object.keys(updated).forEach((userId) => {
          const merc = updated[userId];
          const timeSinceUpdate = now - (merc.lastUpdate || 0);

          if (timeSinceUpdate > offlineThreshold && merc.status === 'active') {
            updated[userId] = { ...merc, status: 'offline' };
            changed = true;
          }
        });

        return changed ? updated : prev;
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Get filtered merchandisers list
  const getFilteredMerchandisers = useCallback(() => {
    const list = Object.values(merchandisers);

    return list
      .filter((m) => {
        // Filter by search query
        if (
          searchQuery &&
          !m.username?.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }

        // Filter by status
        if (filterStatus !== 'all' && m.status !== filterStatus) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by status (active first), then by last update
        if (a.status !== b.status) {
          return a.status === 'active' ? -1 : 1;
        }
        return (b.lastUpdate || 0) - (a.lastUpdate || 0);
      });
  }, [merchandisers, searchQuery, filterStatus]);

  const filteredList = getFilteredMerchandisers();
  const activeMerchandisers = Object.values(merchandisers).filter(
    (m) => m.status === 'active'
  ).length;
  const offlineMerchandisers = Object.values(merchandisers).filter(
    (m) => m.status === 'offline'
  ).length;

  const handleMerchandiserSelect = (merchandiser) => {
    setSelectedMerchandiser(merchandiser);
    setAutoCenter(true);
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch {
      return 'Unknown';
    }
  };

  const formatDistance = (lat1, lon1, lat2, lon2) => {
    // Simple distance calculation (not accurate for long distances)
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance < 1 ? (distance * 1000).toFixed(0) + 'm' : distance.toFixed(2) + 'km';
  };

  return (
    <div className="supervisor-gps-dashboard">
      <div className="dashboard-header">
        <h1>📍 Real-Time GPS Tracking</h1>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-label">Total Merchandisers</span>
            <span className="stat-value">{Object.keys(merchandisers).length}</span>
          </div>
          <div className="stat-item active">
            <span className="stat-label">🟢 Active</span>
            <span className="stat-value">{activeMerchandisers}</span>
          </div>
          <div className="stat-item offline">
            <span className="stat-label">🔴 Offline</span>
            <span className="stat-value">{offlineMerchandisers}</span>
          </div>
          <div className={`connection-status ${connectionStatus}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {connectionStatus === 'connected' && 'Connected'}
              {connectionStatus === 'connecting' && 'Connecting...'}
              {connectionStatus === 'disconnected' && 'Disconnected'}
              {connectionStatus === 'error' && 'Error'}
            </span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="error-banner">
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)}>Dismiss</button>
        </div>
      )}

      <div className="dashboard-container">
        {/* Map Section */}
        <div className="map-section">
          <SupervisorGPSMap
            merchandisers={filteredList}
            selectedMerchandiser={selectedMerchandiser}
            onMerchandiserSelect={handleMerchandiserSelect}
            centerOn={autoCenter}
          />
        </div>

        {/* Sidebar */}
        <div className="sidebar-section">
          <div className="sidebar-header">
            <h2>Merchandisers</h2>
            <span className="count-badge">{filteredList.length}</span>
          </div>

          {/* Search and Filters */}
          <div className="search-filter-section">
            <input
              type="text"
              placeholder="Search merchandiser..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />

            <div className="filter-buttons">
              <button
                className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
                onClick={() => setFilterStatus('active')}
              >
                Active
              </button>
              <button
                className={`filter-btn ${filterStatus === 'offline' ? 'active' : ''}`}
                onClick={() => setFilterStatus('offline')}
              >
                Offline
              </button>
            </div>
          </div>

          {/* Merchandiser List */}
          <div className="merchandiser-list">
            {filteredList.length === 0 ? (
              <div className="empty-state">
                <p>No merchandisers found</p>
              </div>
            ) : (
              filteredList.map((merchandiser) => (
                <div
                  key={merchandiser.user_id}
                  className={`merchandiser-item ${
                    selectedMerchandiser?.user_id === merchandiser.user_id ? 'selected' : ''
                  } ${merchandiser.status}`}
                  onClick={() => handleMerchandiserSelect(merchandiser)}
                >
                  <div className="item-header">
                    <div className="item-name">
                      <span
                        className={`status-indicator ${merchandiser.status}`}
                      ></span>
                      <strong>{merchandiser.username}</strong>
                    </div>
                    <span className="status-time">
                      {formatTime(merchandiser.timestamp)}
                    </span>
                  </div>

                  <div className="item-details">
                    <div className="detail-row">
                      <span className="detail-label">Location:</span>
                      <span className="detail-value">
                        {merchandiser.latitude?.toFixed(4)}, {merchandiser.longitude?.toFixed(4)}
                      </span>
                    </div>

                    {merchandiser.accuracy && (
                      <div className="detail-row">
                        <span className="detail-label">Accuracy:</span>
                        <span className="detail-value">
                          ±{Math.round(merchandiser.accuracy)} m
                        </span>
                      </div>
                    )}

                    {merchandiser.speed !== undefined && (
                      <div className="detail-row">
                        <span className="detail-label">Speed:</span>
                        <span className="detail-value">
                          {(merchandiser.speed || 0).toFixed(1)} m/s
                        </span>
                      </div>
                    )}

                    {merchandiser.heading !== undefined && (
                      <div className="detail-row">
                        <span className="detail-label">Heading:</span>
                        <span className="detail-value">
                          {(merchandiser.heading || 0).toFixed(0)}°
                        </span>
                      </div>
                    )}

                    {merchandiser.visit_id && (
                      <div className="detail-row">
                        <span className="detail-label">Visit ID:</span>
                        <span className="detail-value">{merchandiser.visit_id}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorGPSDashboard;
