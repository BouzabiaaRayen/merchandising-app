/**
 * GPS Tracking Screen Component
 * Main component for merchandiser GPS tracking
 */

import React, { useEffect, useState, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../../contexts/AuthContext';
import GPSTrackingManager from '../../services/gps/GPSTrackingManager';

const GPSTrackingScreen = ({ route }) => {
  const { user, token } = useContext(AuthContext);
  const { visitId } = route?.params || {};

  // State management
  const [isTracking, setIsTracking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('stopped'); // active, paused, stopped, offline
  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [loading, setLoading] = useState(false);

  // Refs
  const gpsManagerRef = useRef(null);
  const timerRef = useRef(null);
  const mapRef = useRef(null);

  /**
   * Initialize GPS tracking
   */
  useEffect(() => {
    const initializeTracking = async () => {
      try {
        setLoading(true);

        // Initialize GPS tracking manager
        gpsManagerRef.current = new GPSTrackingManager(
          `wss://${process.env.EXPO_PUBLIC_API_HOST}/ws/gps/tracking/`,
          handleLocationUpdate,
          handleConnectionChange
        );

        // Initialize location permissions
        await gpsManagerRef.current.initialize();

        // Connect to WebSocket server
        await gpsManagerRef.current.connect(token, user.id);

        // Start location tracking
        await gpsManagerRef.current.startLocationTracking();

        setIsTracking(true);
        setSessionStatus('active');

        setLoading(false);
      } catch (error) {
        console.error('Error initializing GPS tracking:', error);
        Alert.alert('Error', 'Failed to initialize GPS tracking: ' + error.message);
        setLoading(false);
      }
    };

    initializeTracking();

    // Cleanup on unmount
    return () => {
      if (gpsManagerRef.current) {
        gpsManagerRef.current.disconnect();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [token, user.id]);

  /**
   * Handle location updates
   */
  const handleLocationUpdate = (location) => {
    setCurrentLocation(location);
    setAccuracy(location.accuracy?.toFixed(1));
    setSpeed((location.speed * 3.6)?.toFixed(1)); // m/s to km/h

    // Add to location history for polyline
    setLocationHistory((prev) => [
      ...prev,
      {
        latitude: location.latitude,
        longitude: location.longitude,
      },
    ]);

    // Calculate total distance
    if (locationHistory.length > 0) {
      const lastLocation = locationHistory[locationHistory.length - 1];
      const distance = calculateDistance(lastLocation, location);
      setTotalDistance((prev) => prev + distance);
    }
  };

  /**
   * Handle WebSocket connection changes
   */
  const handleConnectionChange = (connected) => {
    setIsConnected(connected);
    setSessionStatus(connected ? 'active' : 'offline');

    if (!connected) {
      Alert.alert('Connection Lost', 'Attempting to reconnect...');
    }
  };

  /**
   * Calculate distance between two points (Haversine formula)
   */
  const calculateDistance = (loc1, loc2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (loc2.latitude - loc1.latitude) * (Math.PI / 180);
    const dLon = (loc2.longitude - loc1.longitude) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(loc1.latitude * (Math.PI / 180)) *
        Math.cos(loc2.latitude * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  /**
   * Toggle tracking pause
   */
  const togglePause = () => {
    if (sessionStatus === 'active') {
      gpsManagerRef.current?.sendSessionStatus('paused');
      setSessionStatus('paused');
    } else if (sessionStatus === 'paused') {
      gpsManagerRef.current?.sendSessionStatus('active');
      setSessionStatus('active');
    }
  };

  /**
   * Stop tracking
   */
  const stopTracking = async () => {
    Alert.alert('Stop Tracking', 'Are you sure you want to stop GPS tracking?', [
      {
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: 'Stop',
        onPress: async () => {
          try {
            if (gpsManagerRef.current) {
              gpsManagerRef.current.sendSessionStatus('stopped');
              await gpsManagerRef.current.disconnect();
            }
            setIsTracking(false);
            setSessionStatus('stopped');
          } catch (error) {
            Alert.alert('Error', 'Failed to stop tracking');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  /**
   * Fit map to show all tracked locations
   */
  const fitMapToLocations = () => {
    if (locationHistory.length === 0 || !mapRef.current) return;

    mapRef.current.fitToCoordinates(locationHistory, {
      edgePadding: {
        top: 50,
        right: 50,
        bottom: 50,
        left: 50,
      },
      animated: true,
    });
  };

  /**
   * Format elapsed time
   */
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Start elapsed time timer
   */
  useEffect(() => {
    if (isTracking && sessionStatus === 'active') {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTracking, sessionStatus]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing GPS Tracking...</Text>
      </View>
    );
  }

  const statusColor = {
    active: '#4CAF50',
    paused: '#FF9800',
    stopped: '#F44336',
    offline: '#9E9E9E',
  }[sessionStatus];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />

      {/* Map View */}
      {currentLocation && (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          followsUserLocation
        >
          {/* Current location marker */}
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title="Current Location"
            pinColor="#007AFF"
          />

          {/* Location history polyline */}
          {locationHistory.length > 1 && (
            <Polyline
              coordinates={locationHistory}
              strokeColor="#007AFF"
              strokeWidth={3}
              geodesic
            />
          )}

          {/* Start location marker */}
          {locationHistory.length > 0 && (
            <Marker
              coordinate={{
                latitude: locationHistory[0].latitude,
                longitude: locationHistory[0].longitude,
              }}
              title="Start Location"
              pinColor="#4CAF50"
            />
          )}
        </MapView>
      )}

      {/* Status and Controls Overlay */}
      <View style={styles.overlay}>
        {/* Connection Status */}
        <View style={[styles.statusBar, { backgroundColor: statusColor }]}>
          <MaterialCommunityIcons
            name={isConnected ? 'wifi' : 'wifi-off'}
            size={20}
            color="white"
          />
          <Text style={styles.statusText}>
            {sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}
            {!isConnected && ' (Offline)'}
          </Text>
        </View>

        {/* Stats Container */}
        <ScrollView style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Elapsed Time</Text>
            <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>
              {totalDistance.toFixed(3)} km
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Current Speed</Text>
            <Text style={styles.statValue}>{speed || '0'} km/h</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Position Accuracy</Text>
            <Text style={styles.statValue}>±{accuracy || '0'} m</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Latitude</Text>
            <Text style={styles.statValue}>
              {currentLocation?.latitude.toFixed(6)}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Longitude</Text>
            <Text style={styles.statValue}>
              {currentLocation?.longitude.toFixed(6)}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Locations Recorded</Text>
            <Text style={styles.statValue}>{locationHistory.length}</Text>
          </View>
        </ScrollView>

        {/* Control Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              sessionStatus === 'paused' ? styles.buttonRestart : styles.buttonPause,
            ]}
            onPress={togglePause}
            disabled={sessionStatus === 'offline'}
          >
            <MaterialCommunityIcons
              name={sessionStatus === 'paused' ? 'play' : 'pause'}
              size={24}
              color="white"
            />
            <Text style={styles.buttonText}>
              {sessionStatus === 'paused' ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={fitMapToLocations}
            disabled={locationHistory.length === 0}
          >
            <MaterialCommunityIcons name="map" size={24} color="white" />
            <Text style={styles.buttonText}>Fit Map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonStop]}
            onPress={stopTracking}
          >
            <MaterialCommunityIcons name="stop" size={24} color="white" />
            <Text style={styles.buttonText}>Stop</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '50%',
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  statusBar: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statsContainer: {
    maxHeight: 200,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomColor: '#E0E0E0',
    borderBottomWidth: 1,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    gap: 8,
  },
  buttonPause: {
    backgroundColor: '#FF9800',
  },
  buttonRestart: {
    backgroundColor: '#4CAF50',
  },
  buttonStop: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});

export default GPSTrackingScreen;
