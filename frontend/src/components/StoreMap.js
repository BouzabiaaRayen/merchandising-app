import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const StoreMap = ({ stores = [], height = 250, showLoading = true }) => {
  const [region, setRegion] = useState(null);

  useEffect(() => {
    console.log('=== STOREMAP DEBUG ===');
    console.log('Stores received:', stores.length);
    if (stores.length > 0) {
      console.log('First store:', JSON.stringify(stores[0], null, 2));
      stores.forEach((store, idx) => {
        console.log(`Store ${idx}: ${store.name}, lat: ${store.latitude}, lng: ${store.longitude}`);
      });
    }
    
    if (stores && stores.length > 0) {
      calculateRegion();
    } else {
      // Default to Tunisia center
      setRegion({
        latitude: 34.0,
        longitude: 9.0,
        latitudeDelta: 8,
        longitudeDelta: 8,
      });
    }
  }, [stores]);

  const calculateRegion = () => {
    // Filter stores with valid coordinates
    const validStores = stores.filter(store => {
      const lat = parseFloat(store.latitude);
      const lng = parseFloat(store.longitude);
      return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    });

    if (validStores.length === 0) {
      setRegion({
        latitude: 34.0,
        longitude: 9.0,
        latitudeDelta: 8,
        longitudeDelta: 8,
      });
      return;
    }

    if (validStores.length === 1) {
      setRegion({
        latitude: parseFloat(validStores[0].latitude),
        longitude: parseFloat(validStores[0].longitude),
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
      return;
    }

    // Calculate bounds for multiple stores
    let minLat = parseFloat(validStores[0].latitude);
    let maxLat = parseFloat(validStores[0].latitude);
    let minLng = parseFloat(validStores[0].longitude);
    let maxLng = parseFloat(validStores[0].longitude);

    validStores.forEach(store => {
      const lat = parseFloat(store.latitude);
      const lng = parseFloat(store.longitude);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.5; // Add padding
    const lngDelta = (maxLng - minLng) * 1.5;

    setRegion({
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta, 0.05),
      longitudeDelta: Math.max(lngDelta, 0.05),
    });
  };

  const getValidStores = () => {
    return stores.filter(store => {
      const lat = parseFloat(store.latitude);
      const lng = parseFloat(store.longitude);
      return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    });
  };

  const validStores = getValidStores();

  if (!region && showLoading) {
    return (
      <View style={[styles.container, { height }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  if (validStores.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer, { height }]}>
        <MaterialCommunityIcons name="map-marker-off-outline" size={48} color="#bbb" />
        <Text style={styles.emptyText}>No stores with GPS coordinates</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={styles.map}
        region={region}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        loadingEnabled={true}
        mapType="standard"
      >
        {validStores.map((store) => (
          <Marker
            key={`store-${store.id}`}
            coordinate={{
              latitude: parseFloat(store.latitude),
              longitude: parseFloat(store.longitude),
            }}
          >
            <View style={styles.customMarker}>
              <Text style={styles.markerEmoji}>🏪</Text>
            </View>
            <Callout style={styles.callout}>
              <View style={styles.calloutContent}>
                <Text style={styles.calloutTitle}>{store.name}</Text>
                {store.address && (
                  <Text style={styles.calloutText}>📍 {store.address}</Text>
                )}
                {store.city && (
                  <Text style={styles.calloutText}>🏙️ {store.city}</Text>
                )}
                {store.phone && (
                  <Text style={styles.calloutText}>📞 {store.phone}</Text>
                )}
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      {validStores.length > 0 && (
        <View style={styles.storeCount}>
          <MaterialCommunityIcons name="map-marker-multiple" size={16} color="#2563eb" />
          <Text style={styles.storeCountText}>{validStores.length} store{validStores.length !== 1 ? 's' : ''}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f4fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    backgroundColor: '#f0f4fa',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#999',
  },
  customMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerEmoji: {
    fontSize: 20,
  },
  callout: {
    borderRadius: 8,
    padding: 0,
    width: 200,
  },
  calloutContent: {
    padding: 10,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#222',
    marginBottom: 6,
  },
  calloutText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  storeCount: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  storeCountText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563eb',
  },
});

export default StoreMap;
