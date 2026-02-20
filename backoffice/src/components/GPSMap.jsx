import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './GPSMap.css';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const createIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-pin ${color}"></div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -42],
  });
};

// Store marker icon (different design)
const createStoreIcon = () => {
  return L.divIcon({
    className: 'store-marker',
    html: `<div class="store-pin">🏪</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

const activeIcon = createIcon('active');
const completedIcon = createIcon('completed');
const alertIcon = createIcon('alert');
const storeIcon = createStoreIcon();

// Tunisia geographical bounds
const tunisiaBounds = [
  [30.2, 7.5],   // Southwest corner
  [37.5, 11.6]   // Northeast corner
];

const GPSMap = ({ locations = [], stores = [], center = [34.0, 9.0], zoom = 7 }) => {
  const getIcon = (status) => {
    switch (status) {
      case 'active':
      case 'in_progress':
        return activeIcon;
      case 'completed':
        return completedIcon;
      case 'alert':
      case 'delayed':
        return alertIcon;
      default:
        return activeIcon;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
      case 'in_progress':
        return '#10b981'; // green
      case 'completed':
        return '#3b82f6'; // blue
      case 'alert':
      case 'delayed':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  return (
    <div className="gps-map-wrapper">
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={6}
        maxZoom={18}
        maxBounds={tunisiaBounds}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', borderRadius: '8px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {locations.map((location, index) => (
          <React.Fragment key={index}>
            <Marker
              position={[location.latitude, location.longitude]}
              icon={getIcon(location.status)}
            >
              <Popup>
                <div className="map-popup">
                  <h3>{location.name || location.merchandiser_name || 'Unknown'}</h3>
                  {location.store_name && (
                    <p><strong>Store:</strong> {location.store_name}</p>
                  )}
                  <p><strong>Status:</strong> <span className={`status-${location.status}`}>{location.status}</span></p>
                  {location.updated_at && (
                    <p><strong>Last Update:</strong> {new Date(location.updated_at).toLocaleString()}</p>
                  )}
                  {location.accuracy && (
                    <p><strong>Accuracy:</strong> {location.accuracy}m</p>
                  )}
                </div>
              </Popup>
            </Marker>

            {/* Accuracy circle */}
            {location.accuracy && (
              <Circle
                center={[location.latitude, location.longitude]}
                radius={location.accuracy}
                pathOptions={{
                  color: getStatusColor(location.status),
                  fillColor: getStatusColor(location.status),
                  fillOpacity: 0.1,
                  weight: 1,
                }}
              />
            )}
          </React.Fragment>
        ))}

        {/* Store markers */}
        {stores.map((store, index) => (
          <Marker
            key={`store-${store.id}`}
            position={[store.latitude, store.longitude]}
            icon={storeIcon}
          >
            <Popup>
              <div className="map-popup store-popup">
                <h3>🏪 {store.name}</h3>
                {store.address && (
                  <p><strong>Address:</strong> {store.address}</p>
                )}
                {store.city && (
                  <p><strong>City:</strong> {store.city}</p>
                )}
                {store.type && (
                  <p><strong>Type:</strong> {store.type}</p>
                )}
                <p><strong>Status:</strong> <span className={`status-${store.status}`}>{store.status}</span></p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default GPSMap;
