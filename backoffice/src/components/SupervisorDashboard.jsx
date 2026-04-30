/**
 * Supervisor Dashboard Component
 * Real-time map view of merchandiser locations
 */

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import './SupervisorDashboard.css';

// Custom icons
const createMerchantIcon = (status) => {
  const colors = {
    active: 'var(--success)',
    paused: 'var(--warning)',
    offline: 'var(--text-secondary)',
  };

  const color = colors[status] || 'var(--text-secondary)';

  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      ">
        <div style="
          width: 8px;
          height: 8px;
          background-color: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    className: 'merchant-marker',
  });
};

const SupervisorDashboard = () => {
  // State management
  const [merchandisers, setMerchandisers] = useState(new Map());
  const [selectedMerchandiser, setSelectedMerchandiser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    active: 0,
    paused: 0,
    offline: 0,
    total: 0,
  });
  const [filter, setFilter] = useState('all'); // all, active, offline
  const [history, setHistory] = useState(new Map());
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // India center

  // Refs
  const wsRef = useRef(null);
  const mapRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  /**
   * Connect to WebSocket supervisor dashboard
   */
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${process.env.REACT_APP_API_HOST}/ws/supervisor/dashboard/`;

        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('Connected to supervisor dashboard');
          setIsConnected(true);

          // Request initial active locations
          wsRef.current.send(
            JSON.stringify({
              type: 'request_active_locations',
            })
          );
        };

        wsRef.current.onmessage = (event) => {
          handleWebSocketMessage(JSON.parse(event.data));
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        wsRef.current.onclose = () => {
          console.log('Disconnected from supervisor dashboard');
          setIsConnected(false);
          // Attempt to reconnect
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 5000);
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Handle WebSocket messages
   */
  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'supervisor_connected':
        console.log('Supervisor connected:', message);
        break;

      case 'location_update':
        handleLocationUpdate(message.data);
        break;

      case 'status_update':
        handleStatusUpdate(message.data);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  };

  /**
   * Handle location update from merchandiser
   */
  const handleLocationUpdate = (data) => {
    const merchandiserId = data.user_id;

    // Update merchandiser location
    setMerchandisers((prev) => {
      const updated = new Map(prev);
      updated.set(merchandiserId, {
        ...data,
        lastUpdate: new Date().toISOString(),
      });
      return updated;
    });

    // Track history for polyline
    setHistory((prev) => {
      const updated = new Map(prev);
      const currentHistory = updated.get(merchandiserId) || [];
      updated.set(merchandiserId, [
        ...currentHistory,
        {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp,
        },
      ]);
      return updated;
    });
  };

  /**
   * Handle status update
   */
  const handleStatusUpdate = (data) => {
    setMerchandisers((prev) => {
      const updated = new Map(prev);
      const merchandiser = updated.get(data.user_id);
      if (merchandiser) {
        updated.set(data.user_id, {
          ...merchandiser,
          status: data.status,
        });
      }
      return updated;
    });
  };

  /**
   * Update statistics
   */
  useEffect(() => {
    const active = Array.from(merchandisers.values()).filter(
      (m) => m.status === 'active'
    ).length;
    const paused = Array.from(merchandisers.values()).filter(
      (m) => m.status === 'paused'
    ).length;
    const offline = Array.from(merchandisers.values()).filter(
      (m) => m.status === 'offline'
    ).length;

    setStats({
      active,
      paused,
      offline,
      total: merchandisers.size,
    });
  }, [merchandisers]);

  /**
   * Get filtered merchandisers
   */
  const getFilteredMerchandisers = () => {
    const array = Array.from(merchandisers.values());

    switch (filter) {
      case 'active':
        return array.filter((m) => m.status === 'active');
      case 'offline':
        return array.filter((m) => m.status === 'offline');
      default:
        return array;
    }
  };

  /**
   * Format timestamp
   */
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  /**
   * Format distance for history polylines
   */
  const getHistoryCoordinates = (merchandiserId) => {
    const coords = history.get(merchandiserId) || [];
    return coords.map((coord) => [coord.latitude, coord.longitude]);
  };

  const filteredMerchandisers = getFilteredMerchandisers();
  const zoom = 13;

  return (
    <div className="supervisor-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>Real-Time Merchandiser Tracking</h1>
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          <div className="status-dot"></div>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-label">Total</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-item active">
          <div className="stat-label">Active</div>
          <div className="stat-value">{stats.active}</div>
        </div>
        <div className="stat-item paused">
          <div className="stat-label">Paused</div>
          <div className="stat-value">{stats.paused}</div>
        </div>
        <div className="stat-item offline">
          <div className="stat-label">Offline</div>
          <div className="stat-value">{stats.offline}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Map */}
        <div className="map-container">
          <div className="map-header">
            <h2>Map View</h2>
            <div className="filter-group">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
                onClick={() => setFilter('active')}
              >
                Active
              </button>
              <button
                className={`filter-btn ${filter === 'offline' ? 'active' : ''}`}
                onClick={() => setFilter('offline')}
              >
                Offline
              </button>
            </div>
          </div>

          <MapContainer
            ref={mapRef}
            center={mapCenter}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />

            {/* Render merchandiser markers and history */}
            {filteredMerchandisers.map((merchandiser) => (
              <React.Fragment key={merchandiser.user_id}>
                {/* History polyline */}
                {getHistoryCoordinates(merchandiser.user_id).length > 1 && (
                  <Polyline
                    positions={getHistoryCoordinates(merchandiser.user_id)}
                    color="#007AFF"
                    weight={2}
                    opacity={0.7}
                    dashArray="5, 5"
                  />
                )}

                {/* Current location marker */}
                <Marker
                  position={[merchandiser.latitude, merchandiser.longitude]}
                  icon={createMerchantIcon(merchandiser.status)}
                  eventHandlers={{
                    click: () => setSelectedMerchandiser(merchandiser),
                  }}
                >
                  <Popup>
                    <div className="marker-popup">
                      <h3>{merchandiser.username}</h3>
                      <p>
                        <strong>Status:</strong> {merchandiser.status}
                      </p>
                      <p>
                        <strong>Last Update:</strong> {formatTime(merchandiser.timestamp)}
                      </p>
                      <p>
                        <strong>Accuracy:</strong> ±{merchandiser.accuracy?.toFixed(1)} m
                      </p>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            ))}
          </MapContainer>
        </div>

        {/* Sidebar - Merchandiser List */}
        <div className="sidebar">
          <h2>Merchandisers ({filteredMerchandisers.length})</h2>

          <div className="merchandisers-list">
            {filteredMerchandisers.length === 0 ? (
              <p className="no-data">No merchandisers found</p>
            ) : (
              filteredMerchandisers.map((merchandiser) => (
                <div
                  key={merchandiser.user_id}
                  className={`merchandiser-card ${
                    selectedMerchandiser?.user_id === merchandiser.user_id
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => setSelectedMerchandiser(merchandiser)}
                >
                  <div className="card-header">
                    <h3>{merchandiser.username}</h3>
                    <div className={`status-badge ${merchandiser.status}`}>
                      {merchandiser.status}
                    </div>
                  </div>

                  <div className="card-details">
                    <div className="detail-row">
                      <span className="label">Latitude:</span>
                      <span className="value">
                        {merchandiser.latitude.toFixed(6)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Longitude:</span>
                      <span className="value">
                        {merchandiser.longitude.toFixed(6)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Accuracy:</span>
                      <span className="value">
                        ±{merchandiser.accuracy?.toFixed(1)} m
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Speed:</span>
                      <span className="value">
                        {merchandiser.speed?.toFixed(2) || 0} m/s
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Last Update:</span>
                      <span className="value">
                        {formatTime(merchandiser.timestamp)}
                      </span>
                    </div>
                    {merchandiser.visit_id && (
                      <div className="detail-row">
                        <span className="label">Visit ID:</span>
                        <span className="value">{merchandiser.visit_id}</span>
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

export default SupervisorDashboard;
