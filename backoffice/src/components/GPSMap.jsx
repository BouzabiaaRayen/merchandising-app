import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './GPSMap.css';
import { storeService, userService } from '../services/apiService';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Store marker icon
const createStoreIcon = () => {
  return L.divIcon({
    className: 'store-marker',
    html: `<div class="store-pin">🏪</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};
const storeIcon = createStoreIcon();

// Merchandiser marker icon (small, no label above)
const createMerchIcon = () => {
  return L.divIcon({
    className: 'merch-marker',
    html: `
      <div class="merch-pin-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 130" width="22" height="28">
          <path d="M50 0 C27.9 0 10 17.9 10 40 C10 62.1 50 130 50 130 C50 130 90 62.1 90 40 C90 17.9 72.1 0 50 0 Z" fill="#2563eb"/>
          <circle cx="50" cy="30" r="11" fill="white"/>
          <path d="M30 65 Q30 48 50 48 Q70 48 70 65" fill="white"/>
        </svg>
      </div>
    `,
    iconSize: [22, 28],
    iconAnchor: [11, 28],
    popupAnchor: [0, -30],
  });
};
const merchIcon = createMerchIcon();

// Merchandiser marker: fetches real name from API on popup open if not available
const MerchMarker = ({ loc }) => {
  const [name, setName] = useState(loc.merchandiser_name || null);
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    if (!name && loc.merchandiser_id) {
      setLoading(true);
      try {
        const user = await userService.getUser(loc.merchandiser_id);
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Unknown';
        setName(fullName);
      } catch {
        setName('Unknown');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Marker
      position={[loc.latitude, loc.longitude]}
      icon={merchIcon}
      eventHandlers={{ popupopen: handleOpen }}
    >
      <Popup>
        <div className="map-popup merch-popup">
          <h3>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 130" width="14" height="18" style={{marginRight: 5, verticalAlign: 'middle'}}>
              <path d="M50 0 C27.9 0 10 17.9 10 40 C10 62.1 50 130 50 130 C50 130 90 62.1 90 40 C90 17.9 72.1 0 50 0 Z" fill="#2563eb"/>
              <circle cx="50" cy="30" r="11" fill="white"/>
              <path d="M30 65 Q30 48 50 48 Q70 48 70 65" fill="white"/>
            </svg>
            {loading ? 'Loading...' : (name || 'Merchandiser')}
          </h3>
          {loc.store_name && <p><strong>Store:</strong> {loc.store_name}</p>}
          {loc.status && <p><strong>Status:</strong> {loc.status}</p>}
          {loc.updated_at && (
            <p><strong>Last update:</strong> {new Date(loc.updated_at).toLocaleString()}</p>
          )}
          <p className="coordinates">
            📍 {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
          </p>
        </div>
      </Popup>
    </Marker>
  );
};

// Component to auto-fit map bounds to all markers
const AutoFitBounds = ({ markers }) => {
  const map = useMap();

  useEffect(() => {
    if (markers && markers.length > 0) {
      const valid = markers.filter(m => m.latitude && m.longitude);
      if (valid.length > 0) {
        const bounds = L.latLngBounds(valid.map(m => [m.latitude, m.longitude]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [markers, map]);

  return null;
};

const GPSMap = ({ locations = [], stores: externalStores = null, center, zoom }) => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (externalStores !== null) {
      setStores(externalStores);
      setLoading(false);
      return;
    }
    fetchStores();
  }, [externalStores]);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const data = await storeService.getStores();
      setStores(data.results ?? []);
      setError('');
    } catch (err) {
      console.error('Error fetching stores for map:', err);
      setError('Failed to load store locations');
    } finally {
      setLoading(false);
    }
  };

  const defaultCenter = center || [34.0, 9.0];
  const defaultZoom = zoom || 7;

  const toNumber = (val) => {
    if (typeof val === 'number') return val;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  const isValidCoord = (lat, lng) =>
    lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

  const validStores = stores
    .map(store => ({ ...store, latitude: toNumber(store.latitude), longitude: toNumber(store.longitude) }))
    .filter(store => isValidCoord(store.latitude, store.longitude));

  const validMerchLocations = (locations || [])
    .map(loc => ({ ...loc, latitude: toNumber(loc.latitude), longitude: toNumber(loc.longitude) }))
    .filter(loc => isValidCoord(loc.latitude, loc.longitude));

  const allMarkers = [...validStores, ...validMerchLocations];

  return (
    <div className="gps-map-wrapper">
      {loading && (
        <div className="map-loading">
          <div>Loading map...</div>
        </div>
      )}
      {error && (
        <div className="map-error">
          <div>{error}</div>
        </div>
      )}
      {!loading && allMarkers.length === 0 && (
        <div className="map-empty">
          <div>No locations found</div>
        </div>
      )}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        minZoom={6}
        maxZoom={18}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', borderRadius: '8px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AutoFitBounds markers={allMarkers} />

        {validStores.map((store) => (
          <Marker
            key={`store-${store.id}`}
            position={[store.latitude, store.longitude]}
            icon={storeIcon}
          >
            <Popup>
              <div className="map-popup store-popup">
                <h3>🏪 {store.name}</h3>
                {store.brand && <p><strong>Brand:</strong> {store.brand}</p>}
                {store.address && <p><strong>Address:</strong> {store.address}</p>}
                {store.city && <p><strong>City:</strong> {store.city}</p>}
                {store.phone && <p><strong>Phone:</strong> {store.phone}</p>}
                <p className="coordinates">
                  📍 {store.latitude.toFixed(4)}, {store.longitude.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {validMerchLocations.map((loc, idx) => (
          <MerchMarker key={`merch-${loc.id || idx}`} loc={loc} />
        ))}
      </MapContainer>
    </div>
  );
};

export default GPSMap;
