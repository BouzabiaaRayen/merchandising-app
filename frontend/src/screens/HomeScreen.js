import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import { visitService, storeService, notificationService, gpsService, userService, documentService } from '../services/apiService';
import { getWebSocketBaseUrl } from '../services/api';
import StoreMap from '../components/StoreMap';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

// Ref for WebSocket status connection
const statusWebSocketRef = { current: null };

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [homeData, setHomeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dayStarted, setDayStarted] = useState(false);
  const [dayStartTime, setDayStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [todayStores, setTodayStores] = useState([]);
  const [todayVisits, setTodayVisits] = useState([]);
  const [gpsActive, setGpsActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const locationSubscriptionRef = useRef(null);
  const locationCheckIntervalRef = useRef(null);
  const lastGpsSendRef = useRef(0); // timestamp of last server send

  // Sends a GPS-off alert notification to every supervisor/admin in the system.
  const notifyGPSOffToSupervisors = async () => {
    try {
      const name = user?.first_name || user?.username || 'Merchandiser';
      const supervisorsResp = await userService.getUsers({ role: 'supervisor', page_size: 50 });
      const adminsResp = await userService.getUsers({ role: 'admin', page_size: 50 });
      const targets = [
        ...(Array.isArray(supervisorsResp) ? supervisorsResp : supervisorsResp.results ?? []),
        ...(Array.isArray(adminsResp) ? adminsResp : adminsResp.results ?? []),
      ];
      await Promise.allSettled(
        targets.map((sup) =>
          notificationService.createNotification({
            user: sup.id,
            title: '📍 GPS Turned Off',
            message: `${name} has disabled their GPS tracking.`,
            notification_type: 'system',
            priority: 'urgent',
          })
        )
      );
      console.log(`GPS-off alert sent to ${targets.length} supervisor(s)/admin(s).`);
    } catch (err) {
      console.warn('Failed to notify supervisors of GPS off:', err.message);
    }
  };

  // Send session status update via REST API (fallback if WebSocket unavailable)
  const sendSessionStatusViaREST = async (status) => {
    try {
      // Create a notification to supervisors about the status change
      const name = user?.first_name || user?.username || 'Merchandiser';
      const statusLabel = status === 'active' ? 'enabled' : 'disabled';
      
      const supervisorsResp = await userService.getUsers({ role: 'supervisor', page_size: 50 });
      const adminsResp = await userService.getUsers({ role: 'admin', page_size: 50 });
      const targets = [
        ...(Array.isArray(supervisorsResp) ? supervisorsResp : supervisorsResp.results ?? []),
        ...(Array.isArray(adminsResp) ? adminsResp : adminsResp.results ?? []),
      ];
      
      await Promise.allSettled(
        targets.map((sup) =>
          notificationService.createNotification({
            user: sup.id,
            title: status === 'active' ? '📍 GPS Enabled' : '📍 GPS Disabled',
            message: `${name} has ${statusLabel} their GPS tracking.`,
            notification_type: 'system',
            priority: status === 'active' ? 'high' : 'urgent',
          })
        )
      );
      console.log(`✓ Status update notification sent via REST API (${status})`);
    } catch (error) {
      console.warn('REST API status notification failed:', error.message);
    }
  };

  // Send session status update via WebSocket with REST fallback
  const sendSessionStatusUpdate = async (status) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.warn('Cannot send status: Not authenticated');
        return;
      }

      // Get the correct base URL dynamically (replaces localhost with actual host)
      const baseUrl = getWebSocketBaseUrl();
      console.log('WebSocket base URL:', baseUrl);
      
      // Remove trailing slash and protocol to build proper WebSocket URL
      const hostWithPort = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const protocol = baseUrl.includes('https') ? 'wss' : 'ws';
      const wsUrl = `${protocol}://${hostWithPort}/ws/gps/tracking/?token=${token}`;

      console.log('Attempting WebSocket connection to:', wsUrl.substring(0, wsUrl.lastIndexOf('?')));

      let wsConnected = false;
      
      try {
        if (statusWebSocketRef.current) {
          console.log('WebSocket already exists, closing old connection');
          statusWebSocketRef.current.close();
        }
        
        statusWebSocketRef.current = new WebSocket(wsUrl);
        
        const connectionTimeout = setTimeout(() => {
          if (statusWebSocketRef.current && statusWebSocketRef.current.readyState === 0) {
            console.warn('WebSocket connection timeout after 5s, falling back to REST API');
            statusWebSocketRef.current.close();
            statusWebSocketRef.current = null;
            if (!wsConnected) {
              sendSessionStatusViaREST(status);
            }
          }
        }, 5000);
        
        statusWebSocketRef.current.onopen = () => {
          clearTimeout(connectionTimeout);
          wsConnected = true;
          console.log('✓ Status WebSocket connected');
          // Send status after connection is established
          statusWebSocketRef.current?.send(JSON.stringify({
            type: 'session_status',
            status: status,
          }));
          console.log(`✓ Session status sent via WebSocket: ${status}`);
          
          // Close after sending (give it time to process)
          setTimeout(() => {
            if (statusWebSocketRef.current && statusWebSocketRef.current.readyState === 1) {
              statusWebSocketRef.current.close();
            }
            statusWebSocketRef.current = null;
          }, 1000);
        };

        statusWebSocketRef.current.onerror = (error) => {
          clearTimeout(connectionTimeout);
          if (!wsConnected) {
            console.warn('WebSocket error, falling back to REST API');
            sendSessionStatusViaREST(status);
          }
          statusWebSocketRef.current = null;
        };

        statusWebSocketRef.current.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log('Status WebSocket closed - code:', event.code, 'reason:', event.reason);
          statusWebSocketRef.current = null;
        };

        statusWebSocketRef.current.onmessage = (event) => {
          console.log('Status WebSocket message:', event.data);
        };
      } catch (wsErr) {
        console.error('WebSocket creation error, falling back to REST API:', wsErr.message);
        statusWebSocketRef.current = null;
        sendSessionStatusViaREST(status);
      }
    } catch (error) {
      console.error('Error preparing status update:', error);
    }
  };


  useEffect(() => {
    loadDayStatus();
    fetchHomeData();
    checkLocationPermission();
  }, []);
  
  // Refresh data when user changes
  useEffect(() => {
    if (user) {
      fetchHomeData();
    }
  }, [user?.id]);
  
  // Start GPS tracking
  useEffect(() => {
    const stopTrackingResources = () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
      if (locationCheckIntervalRef.current) {
        clearInterval(locationCheckIntervalRef.current);
        locationCheckIntervalRef.current = null;
      }
    };

    if (gpsActive) {
      startLocationTracking();
      
      // Check location availability every 3 seconds
      locationCheckIntervalRef.current = setInterval(async () => {
        try {
          const isEnabled = await Location.hasServicesEnabledAsync();
          if (!isEnabled) {
            console.log('Location services disabled by user');
            stopTrackingResources();
            setGpsActive(false);
            setLocation(null);

            // Mark user as GPS inactive on the server
            if (user?.id) {
              userService.patchUser(user?.id, { gps_active: false }).catch(() => {});
            }

            // Send GPS-off alert to all supervisors/admins
            await notifyGPSOffToSupervisors();
            
            Alert.alert(
              'GPS Disabled',
              'Location services have been turned off. GPS tracking stopped.',
              [{ text: 'OK' }]
            );
          }
        } catch (error) {
          console.error('Error checking location services:', error);
        }
      }, 3000);
    } else {
      stopTrackingResources();
    }
    
    return () => {
      stopTrackingResources();
    };
  }, [gpsActive, user]);
  
  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        console.log('Location permission already granted');
        await activateGPS();
      } else {
        console.log('Location permission not granted yet');
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
    }
  };
  
  const requestLocationPermission = async () => {
    try {
      console.log('Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('Permission status:', status);
      
      if (status === 'granted') {
        await activateGPS();
        Alert.alert('Success', 'GPS tracking enabled!');
      } else {
        Alert.alert(
          'Permission Required',
          'Location permission is required for GPS tracking. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert('Error', 'Failed to request location permission');
    }
  };
  
  const activateGPS = async () => {
    try {
      setGpsActive(true);
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setLocation(currentLocation);
      console.log('GPS activated:', currentLocation.coords);

      // Mark user as GPS active on the server immediately
      if (user?.id) {
        userService.patchUser(user.id, { gps_active: true }).catch(() => {});
      }

      // Send session status update to supervisors via WebSocket
      await sendSessionStatusUpdate('active');

      // Send initial ping immediately so the supervisor sees active status right away
      lastGpsSendRef.current = Date.now();
      await sendGpsToServer(currentLocation.coords);
    } catch (error) {
      console.error('Error getting current location:', error);
      setGpsActive(false);
    }
  };

  const deactivateGPS = async () => {
    try {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
      if (locationCheckIntervalRef.current) {
        clearInterval(locationCheckIntervalRef.current);
        locationCheckIntervalRef.current = null;
      }

      setGpsActive(false);
      setLocation(null);

      // Send session status update to supervisors via WebSocket BEFORE server patch
      await sendSessionStatusUpdate('stopped');

      // Mark user as GPS inactive on the server immediately
      if (user?.id) {
        userService.patchUser(user.id, { gps_active: false }).catch(() => {});
      }

      // Send GPS-off alert to all supervisors/admins
      await notifyGPSOffToSupervisors();

      Alert.alert('GPS Disabled', 'GPS tracking has been turned off.');
    } catch (error) {
      console.error('Error disabling GPS:', error);
    }
  };

  // Send a GPS position to the server.
  // Tries /gps/track/ first; falls back to POST /gps/ on any failure.
  const sendGpsToServer = async (coords) => {
    // Check if user is authenticated first
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) {
      console.warn('GPS not sent: User is not authenticated');
      return; // Skip GPS sending if not authenticated
    }

    const payload = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? null,
      altitude: coords.altitude ?? null,
      speed: coords.speed ?? null,
      heading: coords.heading ?? null,
    };

    try {
      const result = await gpsService.track(payload);
      console.log('GPS ping sent via /track/ ✓', result?.id ?? '');
    } catch (trackErr) {
      const status = trackErr.response?.status;
      const detail = JSON.stringify(trackErr.response?.data ?? trackErr.message);
      console.warn(`GPS /track/ failed (${status}):`, detail);
      
      // Fall back for ANY failure (400 = missing field, 404 = endpoint missing, etc.)
      try {
        const result = await gpsService.createLocation(payload);
        console.log('GPS ping sent via /gps/ (fallback) ✓', result?.id ?? '');
      } catch (createErr) {
        console.error(
          'GPS fallback /gps/ also failed:',
          createErr.response?.status,
          JSON.stringify(createErr.response?.data ?? createErr.message)
        );
      }
    }
  };

  const handleGpsStatusPress = async () => {
    if (gpsActive) {
      Alert.alert(
        'Turn Off GPS',
        'Do you want to turn off GPS tracking?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Turn Off', style: 'destructive', onPress: deactivateGPS },
        ]
      );
      return;
    }

    await requestLocationPermission();
  };
  
  const startLocationTracking = async () => {
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        async (newLocation) => {
          setLocation(newLocation);
          console.log('GPS Update:', {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            accuracy: newLocation.coords.accuracy
          });

          // Send to server at most once every 30 seconds
          const now = Date.now();
          if (now - lastGpsSendRef.current >= 30000) {
            lastGpsSendRef.current = now;
            await sendGpsToServer(newLocation.coords);
          }
        }
      );
      locationSubscriptionRef.current = subscription;
    } catch (error) {
      console.error('Error tracking location:', error);
      setGpsActive(false);
    }
  };

  useEffect(() => {
    let interval;
    if (dayStarted && dayStartTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - dayStartTime;
        setElapsedTime(formatElapsedTime(elapsed));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [dayStarted, dayStartTime]);

  const loadDayStatus = async () => {
    try {
      const startTime = await AsyncStorage.getItem('dayStartTime');
      const started = await AsyncStorage.getItem('dayStarted');
      if (started === 'true' && startTime) {
        setDayStarted(true);
        setDayStartTime(parseInt(startTime));
      }
    } catch (error) {
      console.error('Error loading day status:', error);
    }
  };

  const fetchHomeData = async () => {
    try {
      setLoading(true);
      
      // Fetch visits data - DON'T filter by user in API, do it client-side
      const today = new Date().toISOString().split('T')[0];
      console.log('=== FETCH HOME DATA START ===');
      console.log('Today\'s date:', today);
      console.log('Current user:', JSON.stringify({
        id: user?.id,
        username: user?.username,
        first_name: user?.first_name,
        role: user?.role
      }, null, 2));
      
      // Fetch ALL visits without filtering to see what we get
      const visitsParams = { limit: 1000 };
      console.log('Fetching visits with params:', visitsParams);
      
      const visitsResponse = await visitService.getVisits(visitsParams);
      const allVisits = visitsResponse.results || visitsResponse;
      
      console.log(`Fetched ${allVisits.length} visits`);
      if (allVisits.length > 0) {
        console.log('Sample visit structure:', JSON.stringify(allVisits[0], null, 2));
        console.log('All visit dates:', allVisits.map(v => v.scheduled_date));
      } else {
        console.log('No visits returned from API!');
      }
      
      // Filter visits for current user if not filtered by API
      // Check various field names that might reference the user
      const userVisits = user?.id 
        ? allVisits.filter(v => {
            const match = v.merchandiser === user.id || 
                         v.user === user.id || 
                         v.merchandiser_id === user.id ||
                         v.user_id === user.id;
            if (!match && allVisits.length > 0) {
              console.log('Visit does not match user:', {
                visit_merchandiser: v.merchandiser,
                visit_user: v.user,
                current_user_id: user.id
              });
            }
            return match;
          })
        : allVisits;
      
      console.log(`Filtered to ${userVisits.length} user visits (from ${allVisits.length} total)`);
      if (userVisits.length > 0) {
        console.log('User visit dates:', userVisits.map(v => v.scheduled_date));
      } else if (allVisits.length > 0) {
        console.log('WARNING: No visits matched current user!');
        console.log('User ID:', user?.id);
        console.log('Visit user fields:', allVisits.slice(0, 3).map(v => ({
          merchandiser: v.merchandiser,
          user: v.user,
          merchandiser_id: v.merchandiser_id,
          user_id: v.user_id
        })));
      }
      
      // Calculate ALL today's visits (scheduled for today) - BEFORE user filtering
      const allTodayVisits = allVisits.filter(v => {
        if (!v.scheduled_date) return false;
        const visitDate = v.scheduled_date.split('T')[0];
        return visitDate === today;
      });
      
      console.log(`Total scheduled visits for today (${today}):`, allTodayVisits.length);
      
      // Calculate today's visits for current user
      const todayVisits = userVisits.filter(v => {
        if (!v.scheduled_date) return false;
        
        // Handle both date formats: "2026-03-02" and "2026-03-02T00:00:00Z"
        const visitDate = v.scheduled_date.split('T')[0];
        console.log('Comparing visit date:', visitDate, 'with today:', today, '- Match:', visitDate === today);
        return visitDate === today;
      });
      
      console.log(`Today's visits for current user (${today}):`, todayVisits.length);
      if (todayVisits.length > 0) {
        console.log('Today\'s visits details:', todayVisits.map(v => ({ 
          id: v.id, 
          store: v.store, 
          scheduled_date: v.scheduled_date,
          status: v.status 
        })));
      }
      
      // Store today's visits for later use
      setTodayVisits(todayVisits);
      
      const scheduledTodayVisits = todayVisits.filter(v => v.status === 'scheduled' || v.status === 'in_progress');
      const completedTodayVisits = todayVisits.filter(v => v.status === 'completed');
      
      console.log(`Today breakdown: ${todayTotal} total scheduled, ${todayVisits.length} for user, ${scheduledTodayVisits.length} scheduled/in-progress, ${completedTodayVisits.length} completed`);
      
      // Calculate monthly visits (current month)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyVisits = userVisits.filter(v => {
        const visitDate = new Date(v.scheduled_date);
        return visitDate.getMonth() === currentMonth && visitDate.getFullYear() === currentYear;
      });
      const completedMonthlyVisits = monthlyVisits.filter(v => v.status === 'completed');
      
      console.log(`Monthly visits: ${monthlyVisits.length} total, ${completedMonthlyVisits.length} completed`);
      
      // Fetch stores data
      const storesResponse = await storeService.getStores({ page_size: 1000 });
      const stores = storesResponse.results || storesResponse;
      
      console.log(`Fetched ${stores.length} stores`);
      if (stores.length > 0) {
        console.log('Sample store:', JSON.stringify(stores[0], null, 2));
      }
      
      // Get stores for today's visits
      const todayStoreIds = todayVisits.map(v => v.store).filter(Boolean);
      console.log('Today\'s store IDs:', todayStoreIds);
      
      const todayStoresList = stores.filter(store => todayStoreIds.includes(store.id));
      
      setTodayStores(todayStoresList);
      
      console.log(`Today's stores: ${todayStoresList.length}`);
      if (todayStoresList.length > 0) {
        console.log('Stores with GPS:', todayStoresList.filter(s => s.latitude && s.longitude).length);
      }
      
      // Calculate stats
      const todayTotal = allTodayVisits.length; // Use ALL scheduled visits for today (not filtered by user)
      const todayCompleted = completedTodayVisits.length;
      const todayPercent = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;
      const todayRemaining = todayTotal - todayCompleted;
      
      const monthlyTotal = monthlyVisits.length;
      const monthlyCompleted = completedMonthlyVisits.length;
      
      // Count active reports (visits in progress)
      const activeReports = userVisits.filter(v => v.status === 'in_progress').length;
      
      const dashboardData = {
        userName: user?.first_name || user?.username || "User",
        monthlyTargets: monthlyCompleted,
        monthlyTotal: monthlyTotal > 0 ? monthlyTotal : 1, // Avoid division by zero
        todayPercent: todayPercent,
        todayTasks: todayRemaining,
        storesVisited: todayCompleted,
        storesTotal: todayTotal,
        activeReports: activeReports
      };
      
      console.log('=== DASHBOARD SUMMARY ===');
      console.log('Today:', today);
      console.log('All visits fetched:', allVisits.length);
      console.log('User visits fetched:', userVisits.length);
      console.log('Today\'s total scheduled visits:', todayTotal);
      console.log('Today\'s user visits:', todayVisits.length, '(scheduled:', scheduledTodayVisits.length, ', completed:', todayCompleted, ')');
      console.log('Monthly visits:', monthlyTotal, '(completed:', monthlyCompleted, ')');
      console.log('Stores today:', todayStoresList.length);
      console.log('Dashboard data:', dashboardData);
      console.log('========================');
      
      setHomeData(dashboardData);

      // Fetch unread notifications count
      try {
        const countResp = await notificationService.getUnreadCount();
        setUnreadCount(countResp?.unread_count ?? 0);
      } catch (e) {
        console.warn('Could not fetch unread count:', e);
      }
      
    } catch (error) {
      console.error('Error fetching home data:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      const errorMsg = error.response 
        ? `Backend error: ${error.response.status}` 
        : 'Cannot connect to backend. Check if backend is running and API URL is correct.';
      
      Alert.alert(
        'Connection Error', 
        `${errorMsg}\n\nAPI URL: ${error.config?.baseURL || 'unknown'}\n\nMake sure:\n1. Backend is running\n2. You're using the correct IP address\n3. Phone and computer are on same network`,
        [{ text: 'OK' }]
      );
      
      // Set default data on error
      setHomeData({
        userName: user?.first_name || user?.username || "User",
        monthlyTargets: 0,
        monthlyTotal: 1,
        todayPercent: 0,
        todayTasks: 0,
        storesVisited: 0,
        storesTotal: 0,
        activeReports: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const formatElapsedTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHomeData();
    setRefreshing(false);
  };

  const generateEndOfDayPDF = async (completedVisits, startTime) => {
    try {
      // Fetch store details for completed visits
      const storesData = [];
      for (const visit of completedVisits) {
        if (visit.store) {
          try {
            const store = await storeService.getStore(visit.store);
            let timeSpent = 'N/A';
            if (visit.check_in_time && visit.check_out_time) {
              const checkIn = new Date(visit.check_in_time);
              const checkOut = new Date(visit.check_out_time);
              const diff = Math.floor((checkOut - checkIn) / 1000);
              const hours = Math.floor(diff / 3600);
              const minutes = Math.floor((diff % 3600) / 60);
              timeSpent = `${hours}h ${minutes}m`;
            }
            storesData.push({
              name: store.name,
              address: store.address,
              checkInTime: visit.check_in_time || visit.checked_in_at,
              checkOutTime: visit.check_out_time,
              timeSpent,
              notes: visit.notes || 'No notes',
            });
          } catch (e) {
            console.error('Error fetching store:', e);
          }
        }
      }

      // Calculate hours worked
      let hoursWorked = '0h 0m';
      if (startTime) {
        const elapsed = Date.now() - startTime;
        const hours = Math.floor(elapsed / (1000 * 60 * 60));
        const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
        hoursWorked = `${hours}h ${minutes}m`;
      }

      const dateStr = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const dayStartStr = startTime ? new Date(startTime).toLocaleTimeString('fr-FR') : null;

      const storesHTML = storesData.map((store, i) => `
        <div style="margin-bottom: 15px; padding: 12px; background: #f8f9fa; border-radius: 8px;">
          <div style="font-weight: bold; color: #2563eb; margin-bottom: 5px;">${i + 1}. ${store.name}</div>
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 3px;">${store.address}</div>
          <div style="font-size: 11px; color: #9ca3af;">
            Check-in: ${store.checkInTime ? new Date(store.checkInTime).toLocaleTimeString('fr-FR') : 'N/A'} |
            Check-out: ${store.checkOutTime ? new Date(store.checkOutTime).toLocaleTimeString('fr-FR') : 'N/A'} |
            Duration: ${store.timeSpent}
          </div>
          ${store.notes !== 'No notes' ? `<div style="font-size: 11px; color: #475569; margin-top: 4px;">Notes: ${store.notes}</div>` : ''}
        </div>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html><head><meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 30px; color: #1e293b; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
          .subtitle { font-size: 14px; color: #64748b; }
          .summary { display: flex; justify-content: space-around; margin: 30px 0; padding: 20px; background: #f1f5f9; border-radius: 10px; }
          .summary-item { text-align: center; }
          .summary-value { font-size: 28px; font-weight: bold; color: #2563eb; margin-bottom: 5px; }
          .summary-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
          .section-title { font-size: 16px; font-weight: bold; color: #1e293b; margin: 25px 0 15px 0; border-left: 4px solid #2563eb; padding-left: 10px; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style></head>
        <body>
          <div class="header">
            <div class="title">DAILY REPORT</div>
            <div class="subtitle">${dateStr}</div>
            <div class="subtitle" style="margin-top: 8px;">Merchandiser: ${user?.first_name || ''} ${user?.last_name || user?.username || ''}</div>
          </div>
          <div class="summary">
            <div class="summary-item">
              <div class="summary-value">${completedVisits.length}</div>
              <div class="summary-label">Stores Visited</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${hoursWorked}</div>
              <div class="summary-label">Hours Worked</div>
            </div>
          </div>
          ${dayStartStr ? `<div style="text-align: center; margin: 20px 0; padding: 12px; background: #d1fae5; border-radius: 8px;">
            <span style="font-weight: bold; color: #065f46;">Day started at:</span>
            <span style="color: #047857; margin-left: 8px;">${dayStartStr}</span>
          </div>` : ''}
          <div class="section-title">Visit Details</div>
          ${storesData.length > 0 ? storesHTML : '<div style="text-align: center; color: #94a3b8; padding: 20px;">No visit details available</div>'}
          <div class="footer">Report generated on ${new Date().toLocaleString('fr-FR')}<br/>Merchandising App © 2026</div>
        </body></html>
      `;

      const { uri } = await Print.printToFileAsync({ html });

      // Upload to backend
      try {
        const fileName = `rapport_${user?.username || 'merchandiser'}_${new Date().toISOString().split('T')[0]}.pdf`;
        await documentService.uploadDocument(
          { uri, type: 'application/pdf', name: fileName },
          {
            title: `Daily Report - ${dateStr}`,
            description: `${user?.first_name || user?.username || 'Merchandiser'} - ${completedVisits.length} stores visited, ${hoursWorked} worked`,
            document_type: 'daily_report',
            merchandiser: user?.id,
          }
        );
        console.log('PDF uploaded to backend');
      } catch (uploadErr) {
        console.error('PDF upload failed:', uploadErr);
      }

      // Open share sheet
      await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      console.error('Error generating end-of-day PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF report');
    }
  };

  const handleStartDay = async () => {
    if (dayStarted) {
      // End day
      Alert.alert(
        'End Day',
        'Are you sure you want to end your day?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End Day',
            style: 'destructive',
            onPress: async () => {
              try {
                // Check if all visits are completed
                const totalVisits = todayVisits.length;
                const completedVisits = todayVisits.filter(v => v.status === 'completed');
                const allCompleted = totalVisits > 0 && completedVisits.length === totalVisits;

                // End the day
                await AsyncStorage.removeItem('dayStartTime');
                await AsyncStorage.removeItem('dayStarted');
                const savedStartTime = dayStartTime;
                setDayStarted(false);
                setDayStartTime(null);
                setElapsedTime('00:00:00');
                // Notify supervisor dashboard
                if (user?.id) {
                  userService.patchUser(user.id, { day_started: false, day_start_time: null }).catch(() => {});
                }

                if (allCompleted) {
                  // Generate PDF report automatically
                  Alert.alert('Day Ended', 'All visits completed! Generating your report...');
                  await generateEndOfDayPDF(completedVisits, savedStartTime);
                } else if (totalVisits === 0) {
                  Alert.alert('Day Ended', 'Your day has ended. No visits were scheduled.');
                } else {
                  Alert.alert(
                    'Day Ended',
                    `Your day has ended.\n${completedVisits.length}/${totalVisits} visits completed.\nPDF report is only generated when all visits are completed.`
                  );
                }
              } catch (error) {
                console.error('Error ending day:', error);
                Alert.alert('Error', 'Failed to end day');
              }
            }
          }
        ]
      );
    } else {
      // Start day
      try {
        const startTime = Date.now();
        await AsyncStorage.setItem('dayStartTime', startTime.toString());
        await AsyncStorage.setItem('dayStarted', 'true');
        setDayStarted(true);
        setDayStartTime(startTime);
        // Notify supervisor dashboard
        if (user?.id) {
          userService.patchUser(user.id, {
            day_started: true,
            day_start_time: new Date(startTime).toISOString(),
          }).catch(() => {});
        }
        Alert.alert('Success', 'Your day has started!');
        navigation.navigate('Planning');
      } catch (error) {
        console.error('Error starting day:', error);
        Alert.alert('Error', 'Failed to start day');
      }
    }
  };

  if (loading || !homeData) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007aff" />
      </View>
    );
  }

  // Helper function to get visit status for a store
  const getStoreVisitStatus = (storeId) => {
    const visit = todayVisits.find(v => v.store === storeId);
    if (!visit) return 'PENDING';
    if (visit.status === 'completed') return 'COMPLETED';
    if (visit.status === 'in_progress') return 'IN PROGRESS';
    return 'PENDING';
  };

  // Get current date formatted
  const getCurrentDate = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="account" size={24} color="#2563eb" />
              </View>
            )}
            <View>
              <Text style={styles.headerTitle}>{[user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'User'}</Text>
              <Text style={styles.headerDate}>{getCurrentDate()}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={{ position: 'relative' }}>
            <MaterialCommunityIcons name="bell-outline" size={24} color="#222" />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* GPS Status Card */}
        <TouchableOpacity 
          style={styles.gpsCard}
          onPress={handleGpsStatusPress}
        >
          <View style={styles.gpsIcon}>
            <MaterialCommunityIcons name="crosshairs-gps" size={28} color="#fff" />
          </View>
          <View style={styles.gpsContent}>
            <Text style={styles.gpsLabel}>GPS Status</Text>
            <View style={styles.gpsStatusRow}>
              <View style={[styles.gpsStatusDot, gpsActive && styles.gpsStatusDotActive]} />
              <Text style={[styles.gpsStatusText, gpsActive && styles.gpsStatusTextActive]}>
                {gpsActive ? 'Signal Active • Tap to Disable' : 'Tap to Enable'}
              </Text>
            </View>
            {gpsActive && location && (
              <Text style={styles.gpsCoords}>
                📍 {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        
        {/* Store Map */}
        <View style={styles.mapContainer}>
          <StoreMap stores={todayStores} height={200} />
        </View>

        {/* Ready to Begin Card */}
        {!dayStarted && (
          <View style={styles.readyCard}>
            <Text style={styles.readyTitle}>Ready to begin?</Text>
            <Text style={styles.readyText}>
              Start your shift to track mileage and store visits for your assigned route.
            </Text>
            <TouchableOpacity style={styles.startWorkdayBtn} onPress={handleStartDay}>
              <MaterialCommunityIcons name="play" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.startWorkdayText}>Start Workday</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Daily Progress */}
        <View style={styles.progressSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Progress</Text>
            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>{homeData.todayPercent}% Complete</Text>
            </View>
          </View>

          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>Store Visits</Text>
            <Text style={styles.progressValue}>
              {homeData.storesVisited} / {homeData.storesTotal} Stores
            </Text>
          </View>

          {dayStarted && (
            <View style={styles.progressItem}>
              <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
              <Text style={styles.estimatedTime}>Estimated finish: {elapsedTime}</Text>
            </View>
          )}
        </View>

        {/* Today's Route */}
        <View style={styles.routeSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Route</Text>
            <TouchableOpacity onPress={onRefresh}>
              <Text style={styles.viewMapLink}>View Map</Text>
            </TouchableOpacity>
          </View>

          {todayStores.length > 0 ? (
            todayStores.slice(0, 3).map((store, index) => {
              const status = getStoreVisitStatus(store.id);
              const statusStyle = status === 'COMPLETED' ? styles.routeStatusCompleted : 
                                 status === 'IN PROGRESS' ? styles.routeStatusInProgress : 
                                 styles.routeStatusPending;
              
              return (
                <View key={store.id} style={styles.routeItem}>
                  <View style={styles.routeIconWrapper}>
                    <MaterialCommunityIcons name="store" size={20} color="#2563eb" />
                  </View>
                  <View style={styles.routeInfo}>
                    <Text style={styles.routeName} numberOfLines={1}>{store.name}</Text>
                    <Text style={styles.routeAddress} numberOfLines={1}>
                      {store.address || store.city}
                    </Text>
                  </View>
                  <View style={[styles.routeStatus, statusStyle]}>
                    <Text style={styles.routeStatusText}>{status}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyRoute}>
              <MaterialCommunityIcons name="map-marker-off" size={32} color="#ccc" />
              <Text style={styles.emptyRouteText}>No stores assigned for today</Text>
            </View>
          )}
        </View>

        {/* End Day Button (shown when day is started) */}
        {dayStarted && (
          <TouchableOpacity style={styles.endDayBtn} onPress={handleStartDay}>
            <MaterialCommunityIcons name="stop-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.endDayText}>End Workday</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { paddingHorizontal: 16, paddingTop: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  
  // Header
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
    paddingVertical: 8
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  bellBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  bellBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  avatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#e8f0fe', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 12
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  headerDate: { fontSize: 13, color: '#666', marginTop: 2 },

  // GPS Card
  gpsCard: {
    backgroundColor: '#4285f4',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4285f4',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  gpsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  gpsContent: { flex: 1 },
  gpsLabel: { fontSize: 13, color: '#fff', marginBottom: 4, fontWeight: '500' },
  gpsStatusRow: { flexDirection: 'row', alignItems: 'center' },
  gpsStatusDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#f59e0b',
    marginRight: 6 
  },
  gpsStatusDotActive: { backgroundColor: '#10b981' },
  gpsStatusText: { fontSize: 14, color: '#fff', fontWeight: 'bold' },
  gpsStatusTextActive: { color: '#fff' },
  gpsCoords: { fontSize: 11, color: 'rgba(255, 255, 255, 0.8)', marginTop: 4 },

  // Map
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },

  // Ready to Begin Card
  readyCard: {
    backgroundColor: '#f8f9fc',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8eaed'
  },
  readyTitle: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 8 },
  readyText: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 },
  startWorkdayBtn: {
    backgroundColor: '#4285f4',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  startWorkdayText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Sections
  progressSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8eaed'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  progressBadge: {
    backgroundColor: '#e8f0fe',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  progressBadgeText: { fontSize: 12, color: '#4285f4', fontWeight: '600' },
  progressItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8
  },
  progressLabel: { fontSize: 14, color: '#666' },
  progressValue: { fontSize: 14, fontWeight: '600', color: '#222' },
  estimatedTime: { fontSize: 13, color: '#666', marginLeft: 6 },

  // Route Section
  routeSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8eaed'
  },
  viewMapLink: { fontSize: 14, color: '#4285f4', fontWeight: '600' },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  routeIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f0fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  routeInfo: { flex: 1 },
  routeName: { fontSize: 14, fontWeight: '600', color: '#222', marginBottom: 2 },
  routeAddress: { fontSize: 12, color: '#666' },
  routeStatus: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  routeStatusCompleted: { backgroundColor: '#10b981' },
  routeStatusInProgress: { backgroundColor: '#f59e0b' },
  routeStatusPending: { backgroundColor: '#6b7280' },
  routeStatusText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  emptyRoute: {
    alignItems: 'center',
    paddingVertical: 24
  },
  emptyRouteText: { fontSize: 14, color: '#999', marginTop: 8 },

  // End Day Button
  endDayBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  endDayText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
