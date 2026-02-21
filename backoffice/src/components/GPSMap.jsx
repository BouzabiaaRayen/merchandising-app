import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './GPSMap.css';
import { storeService } from '../services/apiService';

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
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

const storeIcon = createStoreIcon();

// Component to auto-fit map bounds to all markers
const AutoFitBounds = ({ stores }) => {
  const map = useMap();

  useEffect(() => {
    if (stores && stores.length > 0) {
      const validStores = stores.filter(
        store => store.latitude && store.longitude
      );

      if (validStores.length > 0) {
        const bounds = L.latLngBounds(
          validStores.map(store => [store.latitude, store.longitude])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [stores, map]);

  return null;
};

const GPSMap = ({ externalStores = null }) => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // If external stores are provided, use them instead of fetching
    if (externalStores !== null) {
      setStores(externalStores);
      setLoading(false);
      return;
    }

    // Otherwise fetch from backend
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

  // Default center for Tunisia
  const defaultCenter = [34.0, 9.0];
  const defaultZoom = 7;

  // Helper to convert coordinate to number
  const toNumber = (val) => {
    if (typeof val === 'number') return val;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  // Filter stores that have valid coordinates
  const validStores = stores.filter(store => {
    const lat = toNumber(store.latitude);
    const lng = toNumber(store.longitude);
    return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }).map(store => ({
    ...store,
    latitude: toNumber(store.latitude),
    longitude: toNumber(store.longitude)
  }));

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
      {!loading && validStores.length === 0 && (
        <div className="map-empty">
          <div>No stores with coordinates found</div>
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

        {/* Auto-fit bounds to show all stores */}
        <AutoFitBounds stores={validStores} />

        {/* Store markers */}
        {validStores.map((store) => (
          <Marker
            key={`store-${store.id}`}
            position={[store.latitude, store.longitude]}
            icon={storeIcon}
          >
            <Popup>
              <div className="map-popup store-popup">
                <h3>🏪 {store.name}</h3>
                {store.brand && (
                  <p><strong>Brand:</strong> {store.brand}</p>
                )}
                {store.address && (
                  <p><strong>Address:</strong> {store.address}</p>
                )}
                {store.city && (
                  <p><strong>City:</strong> {store.city}</p>
                )}
                {store.phone && (
                  <p><strong>Phone:</strong> {store.phone}</p>
                )}
                <p className="coordinates">
                  📍 {typeof store.latitude === 'number' ? store.latitude.toFixed(4) : store.latitude}, {typeof store.longitude === 'number' ? store.longitude.toFixed(4) : store.longitude}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default GPSMap;
