/**
 * GPS Tracking Service for React Native
 * Handles real-time location updates via WebSocket
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import Constants from 'expo-constants';
import { Geolib } from 'geolib';

const LOCATION_TASK_NAME = 'background-location-task';
const LOCATION_UPDATE_THRESHOLD = 10; // meters - only send if moved 10+ meters

/**
 * GPS Tracking Manager for Expo
 */
export class GPSTrackingManager {
  constructor(wsUrl, onLocationUpdate, onConnectionChange) {
    this.wsUrl = wsUrl;
    this.onLocationUpdate = onLocationUpdate;
    this.onConnectionChange = onConnectionChange;
    this.ws = null;
    this.isConnected = false;
    this.lastLocation = null;
    this.updateIntervalId = null;
    this.heartbeatIntervalId = null;
    this.locationSubscription = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5 seconds
  }

  /**
   * Initialize GPS tracking
   */
  async initialize() {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      // Setup background location tracking
      await Location.requestBackgroundPermissionsAsync();
      
      // Register background task
      await this.registerBackgroundLocationTask();

      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      this.lastLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        speed: location.coords.speed,
        heading: location.coords.heading,
        timestamp: location.timestamp,
      };

      return true;
    } catch (error) {
      console.error('GPS initialization error:', error);
      throw error;
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect(token, userId) {
    return new Promise((resolve, reject) => {
      try {
        // Prepare WebSocket URL with authentication
        const wsUrlWithToken = `${this.wsUrl}?token=${token}`;

        this.ws = new WebSocket(wsUrlWithToken);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.onConnectionChange(true);
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleWebSocketMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnected = false;
          this.onConnectionChange(false);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket closed');
          this.isConnected = false;
          this.onConnectionChange(false);
          this.stopHeartbeat();
          this.attemptReconnect(token, userId);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Start listening to location updates
   */
  async startLocationTracking() {
    try {
      // Subscribe to foreground location updates
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 1, // 1 meter minimum distance
        },
        (location) => {
          this.processLocationUpdate(location);
        }
      );

      // Start background location tracking
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000, // 10 seconds
        distanceInterval: 5, // 5 meters
        showsBackgroundLocationIndicator: true,
      });

      console.log('Location tracking started');
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  }

  /**
   * Stop location tracking
   */
  async stopLocationTracking() {
    try {
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('Location tracking stopped');
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }

  /**
   * Register background location task
   */
  async registerBackgroundLocationTask() {
    try {
      TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
        if (error) {
          console.error('Background location error:', error);
          return;
        }

        if (data) {
          const { locations } = data;
          if (locations.length > 0) {
            const location = locations[locations.length - 1];
            console.log('Background location update:', location);

            // Send to server via WebSocket if significant change
            this.processLocationUpdate(location);
          }
        }
      });

      console.log('Background location task registered');
    } catch (error) {
      console.error('Error registering background task:', error);
    }
  }

  /**
   * Process location update and check if should be sent to server
   */
  processLocationUpdate(location) {
    const currentLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: location.timestamp,
    };

    // Check if location has moved significantly
    if (this.lastLocation && !this.hasMovedSignificantly(currentLocation)) {
      // Location hasn't moved enough, skip sending
      return;
    }

    // Update last location
    this.lastLocation = currentLocation;

    // Send to server if connected
    if (this.isConnected && this.ws) {
      this.sendLocationUpdate(currentLocation);
    }

    // Call callback for UI updates
    this.onLocationUpdate(currentLocation);
  }

  /**
   * Check if location has moved more than threshold
   */
  hasMovedSignificantly(newLocation) {
    if (!this.lastLocation) {
      return true;
    }

    try {
      const distance = Geolib.getDistance(
        {
          latitude: parseFloat(this.lastLocation.latitude),
          longitude: parseFloat(this.lastLocation.longitude),
        },
        {
          latitude: parseFloat(newLocation.latitude),
          longitude: parseFloat(newLocation.longitude),
        }
      );

      return distance >= LOCATION_UPDATE_THRESHOLD;
    } catch (error) {
      console.error('Error calculating distance:', error);
      return true; // Send if error
    }
  }

  /**
   * Send location update via WebSocket
   */
  sendLocationUpdate(location, visitId = null) {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket not connected');
      return;
    }

    try {
      const message = {
        type: 'location_update',
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        altitude: location.altitude,
        speed: location.speed,
        heading: location.heading,
        timestamp: new Date(location.timestamp).toISOString(),
        visit_id: visitId,
      };

      this.ws.send(JSON.stringify(message));
      console.log('Location sent:', message);
    } catch (error) {
      console.error('Error sending location:', error);
    }
  }

  /**
   * Update session status
   */
  sendSessionStatus(status) {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket not connected');
      return;
    }

    try {
      const message = {
        type: 'session_status',
        status: status, // 'active', 'paused', 'stopped'
      };

      this.ws.send(JSON.stringify(message));
      console.log('Session status sent:', status);
    } catch (error) {
      console.error('Error sending session status:', error);
    }
  }

  /**
   * Send heartbeat to keep connection alive
   */
  sendHeartbeat() {
    if (!this.isConnected || !this.ws) {
      return;
    }

    try {
      const message = {
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
      };

      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }

  /**
   * Start heartbeat interval
   */
  startHeartbeat() {
    this.heartbeatIntervalId = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat interval
   */
  stopHeartbeat() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data);
      console.log('WebSocket message:', message);

      switch (message.type) {
        case 'connection_established':
          console.log('Connection established:', message);
          break;
        case 'location_update_ack':
          console.log('Location update acknowledged');
          break;
        case 'session_status_ack':
          console.log('Session status acknowledged');
          break;
        case 'error':
          console.error('Server error:', message.message);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect(token, userId) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect(token, userId).catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect() {
    try {
      this.stopHeartbeat();
      await this.stopLocationTracking();

      if (this.ws) {
        this.sendSessionStatus('stopped');
        this.ws.close();
        this.ws = null;
      }

      this.isConnected = false;
      this.onConnectionChange(false);
      console.log('GPS tracking disconnected');
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  }
}

export default GPSTrackingManager;
