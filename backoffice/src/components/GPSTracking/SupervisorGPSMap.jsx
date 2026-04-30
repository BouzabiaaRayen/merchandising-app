import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './SupervisorGPSMap.css';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Create active merchandiser icon
const createMerchandiserIcon = (status = 'active') => {
  const color = status === 'active' ? '#22c55e' : '#6b7280';
  return L.divIcon({
    className: 'merchandiser-marker',
    html: `<div class="marker-pulse" style="background-color: ${color};">📍</div>`,
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
  });
};

// Create offline merchandiser icon
const offlineMerchandiserIcon = L.divIcon({
  className: 'merchandiser-marker-offline',
  html: `<div class="marker-static" style="background-color: #9ca3af;">📍</div>`,
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

// Component to auto-fit map bounds
const AutoFitBounds = ({ merchandisers }) => {
  const map = useMap();

  useEffect(() => {
    if (merchandisers && merchandisers.length > 0) {
      const validMerchandisers = merchandisers.filter(
        m => m.latitude && m.longitude && m.latitude !== 0 && m.longitude !== 0
      );

      if (validMerchandisers.length > 0) {
        const bounds = L.latLngBounds(
          validMerchandisers.map(m => [m.latitude, m.longitude])
        );
        
        // Add some padding and max zoom
        const padding = validMerchandisers.length === 1 ? 0.01 : 0.02;
        bounds.pad(padding);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [merchandisers, map]);

  return null;
};

const SupervisorGPSMap = ({ 
  merchandisers = [], 
  selectedMerchandiser = null,
  onMerchandiserSelect = () => {},
  centerOn = null 
}) => {
  const mapRef = useRef(null);
  const [filteredMerchandisers, setFilteredMerchandisers] = useState([]);

  useEffect(() => {
    // Filter out merchandisers with no valid location
    const filtered = merchandisers.filter(m => m && m.latitude && m.longitude);
    setFilteredMerchandisers(filtered);
  }, [merchandisers]);

  // Auto-center on selected merchandiser
  useEffect(() => {
    if (centerOn && selectedMerchandiser && mapRef.current) {
      const map = mapRef.current;
      map.flyTo([selectedMerchandiser.latitude, selectedMerchandiser.longitude], 15, {
        duration: 1.5,
      });
    }
  }, [centerOn, selectedMerchandiser]);

  const getStatusBadge = (status) => {
    if (status === 'active') {
      return <span className="status-badge status-active">🟢 Active</span>;
    } else if (status === 'offline') {
      return <span className="status-badge status-offline">🔴 Offline</span>;
    } else {
      return <span className="status-badge status-idle">🟡 Idle</span>;
    }
  };

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="supervisor-gps-map-container">
      <MapContainer
        ref={mapRef}
        center={[0, 0]}
        zoom={2}
        style={{ height: '100%', width: '100%' }}
        className="supervisor-map"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {filteredMerchandisers.map((merchandiser) => (
          <React.Fragment key={merchandiser.user_id}>
            {/* Accuracy circle */}
            {merchandiser.accuracy && (
              <Circle
                center={[merchandiser.latitude, merchandiser.longitude]}
                radius={merchandiser.accuracy}
                pathOptions={{
                  color: merchandiser.status === 'active' ? '#3b82f6' : '#d1d5db',
                  fillColor: merchandiser.status === 'active' ? '#3b82f6' : '#d1d5db',
                  fillOpacity: 0.1,
                  weight: 1,
                  opacity: 0.5,
                }}
              />
            )}

            {/* Marker */}
            <Marker
              position={[merchandiser.latitude, merchandiser.longitude]}
              icon={
                merchandiser.status === 'active'
                  ? createMerchandiserIcon('active')
                  : offlineMerchandiserIcon
              }
              eventHandlers={{
                click: () => onMerchandiserSelect(merchandiser),
              }}
            >
              <Popup className="merchandiser-popup">
                <div className="popup-content">
                  <h4>{merchandiser.username}</h4>
                  <div className="popup-info">
                    {getStatusBadge(merchandiser.status)}
                    <p>
                      <strong>Latitude:</strong> {merchandiser.latitude.toFixed(6)}
                    </p>
                    <p>
                      <strong>Longitude:</strong> {merchandiser.longitude.toFixed(6)}
                    </p>
                    {merchandiser.accuracy && (
                      <p>
                        <strong>Accuracy:</strong> ±{Math.round(merchandiser.accuracy)} m
                      </p>
                    )}
                    {merchandiser.speed !== undefined && (
                      <p>
                        <strong>Speed:</strong> {merchandiser.speed?.toFixed(2) || 0} m/s
                      </p>
                    )}
                    {merchandiser.heading !== undefined && (
                      <p>
                        <strong>Heading:</strong> {merchandiser.heading?.toFixed(0) || 0}°
                      </p>
                    )}
                    <p>
                      <strong>Last Update:</strong> {formatTime(merchandiser.timestamp)}
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        ))}

        <AutoFitBounds merchandisers={filteredMerchandisers} />
      </MapContainer>

      {filteredMerchandisers.length === 0 && (
        <div className="no-data-overlay">
          <p>No merchandisers with location data</p>
        </div>
      )}
    </div>
  );
};

export default SupervisorGPSMap;
