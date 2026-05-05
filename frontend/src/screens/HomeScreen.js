import React, { useEffect, useRef, useState, useContext } from 'react';
import { AppState } from 'react-native';
import { DailyContext } from '../contexts/DailyContext';
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
import { visitService, storeService, notificationService, gpsService, userService, documentService, scheduleService } from '../services/apiService';
import api, { getWebSocketBaseUrl } from '../services/api';
import StoreMap from '../components/StoreMap';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

// Ref for WebSocket status connection
const statusWebSocketRef = { current: null };

export default function HomeScreen() {
  // Daily context
  const {
    timeWorked, setTimeWorked,
    progress, setProgress,
    storeVisits, setStoreVisits,
    schedule, setSchedule,
    route, setRoute,
    resetDailyState
  } = useContext(DailyContext);
  const { user } = useAuth();
  const navigation = useNavigation();

  // User-scoped AsyncStorage key helper
  const userKey = (key) => user?.id ? `${key}_${user.id}` : key;

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

  // Break state
  const [breakWindowStart, setBreakWindowStart] = useState(null); // e.g. "12:00"
  const [breakWindowEnd, setBreakWindowEnd] = useState(null);     // e.g. "14:00"
  const [breakDuration, setBreakDuration] = useState(null);       // minutes
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState(null);
  const [breakEndTime, setBreakEndTime] = useState(null);
  const [breakElapsed, setBreakElapsed] = useState('00:00');

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


  // On mount, check for daily reset and load data
  useEffect(() => {
    const checkAndResetDay = async () => {
      // Check last reset date
      const today = new Date().toISOString().slice(0, 10);
      const lastReset = await AsyncStorage.getItem('lastResetDate');
      if (lastReset !== today) {
        // Clear all daily state and AsyncStorage keys
        await resetDailyState();
        await AsyncStorage.removeItem(userKey('dayStarted'));
        await AsyncStorage.removeItem(userKey('dayStartTime'));
        setElapsedTime('00:00:00');
        setDayStarted(false);
        setDayStartTime(null);
        setTodayVisits([]);
        setTodayStores([]);
        setProgress(0);
        setStoreVisits({ visited: 0, total: 0 });
        setSchedule([]);
        setRoute([]);
      }
      loadDayStatus();
      fetchHomeData();
      checkLocationPermission();
    };
    checkAndResetDay();

    // AppState listener for app resume
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'active') {
        const today = new Date().toISOString().slice(0, 10);
        const lastReset = await AsyncStorage.getItem('lastResetDate');
        if (lastReset !== today) {
          await resetDailyState();
          await AsyncStorage.removeItem(userKey('dayStarted'));
          await AsyncStorage.removeItem(userKey('dayStartTime'));
          setElapsedTime('00:00:00');
          setDayStarted(false);
          setDayStartTime(null);
          setTodayVisits([]);
          setTodayStores([]);
          setProgress(0);
          setStoreVisits({ visited: 0, total: 0 });
          setSchedule([]);
          setRoute([]);
          loadDayStatus();
          fetchHomeData();
        }
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
  
  // Refresh data when user changes
  useEffect(() => {
    if (user) {
      fetchHomeData();
    }
  }, [user?.id]);

  // At midnight, reset daily state
  useEffect(() => {
    const now = new Date();
    // Calculate local midnight (next day, 00:00:00 local time)
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // next local midnight
    const msUntilMidnight = midnight - now;
    const timer = setTimeout(async () => {
      await resetDailyState();
      await AsyncStorage.removeItem(userKey('dayStarted'));
      await AsyncStorage.removeItem(userKey('dayStartTime'));
      setElapsedTime('00:00:00');
      setDayStarted(false);
      setDayStartTime(null);
      setTodayVisits([]);
      setTodayStores([]);
      setProgress(0);
      setStoreVisits({ visited: 0, total: 0 });
      setSchedule([]);
      setRoute([]);
      fetchHomeData();
    }, msUntilMidnight);
    return () => clearTimeout(timer);
  }, []);
  
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
        setTimeWorked(formatElapsedTime(elapsed));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [dayStarted, dayStartTime, setTimeWorked]);

  const loadDayStatus = async () => {
    try {
      const startTime = await AsyncStorage.getItem(userKey('dayStartTime'));
      const started = await AsyncStorage.getItem(userKey('dayStarted'));
      let validToday = false;
      if (started === 'true' && startTime) {
        const startDate = new Date(parseInt(startTime));
        const today = new Date();
        if (
          startDate.getFullYear() === today.getFullYear() &&
          startDate.getMonth() === today.getMonth() &&
          startDate.getDate() === today.getDate()
        ) {
          validToday = true;
          setDayStarted(true);
          setDayStartTime(parseInt(startTime));
        }
      }
      if (!validToday) {
        // Not a valid session for today, clear everything
        await AsyncStorage.removeItem(userKey('dayStarted'));
        await AsyncStorage.removeItem(userKey('dayStartTime'));
        setDayStarted(false);
        setDayStartTime(null);
        setElapsedTime('00:00:00');
      }
      // Load break state only if validToday
      if (validToday) {
        const breakStart = await AsyncStorage.getItem(userKey('breakStartTime'));
        const breakEnd = await AsyncStorage.getItem(userKey('breakEndTime'));
        if (breakStart) setBreakStartTime(parseInt(breakStart));
        if (breakEnd) setBreakEndTime(parseInt(breakEnd));
        if (breakStart && !breakEnd) setIsOnBreak(true);
      } else {
        setBreakStartTime(null);
        setBreakEndTime(null);
        setIsOnBreak(false);
      }
    } catch (error) {
      console.error('Error loading day status:', error);
    }
  };

  // Break timer
  useEffect(() => {
    let interval;
    if (isOnBreak && breakStartTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - breakStartTime;
        const mins = Math.floor(elapsed / 60000);
        const secs = Math.floor((elapsed % 60000) / 1000);
        setBreakElapsed(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isOnBreak, breakStartTime]);

  // Check if current time is within the break window
  const isBreakWindowActive = () => {
    if (!breakWindowStart || !breakWindowEnd) return false;
    const now = new Date();
    const [sh, sm] = breakWindowStart.split(':').map(Number);
    const [eh, em] = breakWindowEnd.split(':').map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    return nowMins >= startMins && nowMins <= endMins;
  };

  // Check if break window has passed
  const isBreakWindowPassed = () => {
    if (!breakWindowEnd) return false;
    const now = new Date();
    const [eh, em] = breakWindowEnd.split(':').map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const endMins = eh * 60 + em;
    return nowMins > endMins;
  };

  const handleStartBreak = async () => {
    const now = Date.now();
    setIsOnBreak(true);
    setBreakStartTime(now);
    await AsyncStorage.setItem(userKey('breakStartTime'), now.toString());
    await AsyncStorage.removeItem(userKey('breakEndTime'));
  };

  const handleEndBreak = async () => {
    const now = Date.now();
    setIsOnBreak(false);
    setBreakEndTime(now);
    await AsyncStorage.setItem(userKey('breakEndTime'), now.toString());
    const elapsed = now - breakStartTime;
    const mins = Math.round(elapsed / 60000);
    Alert.alert('Pause terminée', `Durée de pause: ${mins} min`);
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
      const todayTotal = todayVisits.length; // Only count current user's visits
      const todayCompleted = completedTodayVisits.length;
      const todayPercent = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;
      const todayRemaining = todayTotal - todayCompleted;

      setProgress(todayPercent);
      setStoreVisits({ visited: todayCompleted, total: todayTotal });

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

      // Fetch today's break schedule, fallback to 12:00–13:00 if missing
      try {
        const schedule = await scheduleService.getTodaySchedule();
        if (schedule && schedule.break_window_start && schedule.break_window_end) {
          setBreakDuration(schedule.allowed_break_duration_minutes);
          // Parse time fields — could be "HH:MM:SS" or "HH:MM"
          const parseTime = (t) => t ? t.substring(0, 5) : null;
          setBreakWindowStart(parseTime(schedule.break_window_start));
          setBreakWindowEnd(parseTime(schedule.break_window_end));
        } else {
          // Fallback: always show break window 12:00–13:00
          setBreakWindowStart('12:00');
          setBreakWindowEnd('13:00');
          setBreakDuration(60);
        }
      } catch (schedErr) {
        // Fallback: always show break window 12:00–13:00
        setBreakWindowStart('12:00');
        setBreakWindowEnd('13:00');
        setBreakDuration(60);
        console.log('No break schedule for today, fallback to 12:00–13:00:', schedErr.message);
      }

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
      const today = new Date().toISOString().split('T')[0];

      const escapeHtml = (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      const formatPdfTime = (value) => {
        if (!value) return '';
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime())
          ? ''
          : parsed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      };

      const normalizeImageSource = (entry) => {
        if (!entry) return '';
        if (typeof entry === 'string') return entry;
        return entry.uri || entry.url || entry.image || entry.photo || '';
      };

      // ── Fetch all data in parallel ──
      const [alertsRes, productsRes] = await Promise.all([
        api.get('/merchandising/competitor-alerts/').catch(() => ({ data: [] })),
        api.get('/merchandising/products/').catch(() => ({ data: [] })),
      ]);
      const allAlerts = (alertsRes.data?.results || alertsRes.data || []).filter(a => a.created_at?.startsWith(today));
      const allProducts = (productsRes.data?.results || productsRes.data || []).filter(p => p.created_at?.startsWith(today) && p.created_by === user?.id);

      const alertTypeLabels = {
        promotion: 'Promotion', price_change: 'Changement de prix',
        new_product: 'Nouveau produit', competitor_activity: 'Activité concurrent',
      };

      // ── Build per-store data ──
      const storeBlocks = [];
      for (const visit of completedVisits) {
        let fullVisit = visit;
        try { fullVisit = await visitService.getVisit(visit.id); } catch (e) {}
        let store = { name: 'Magasin inconnu', address: '' };
        try { if (visit.store) store = await storeService.getStore(visit.store); } catch (e) {}

        const checkIn = fullVisit.check_in_time ? new Date(fullVisit.check_in_time) : null;
        const checkOut = fullVisit.check_out_time ? new Date(fullVisit.check_out_time) : null;
        let duration = '—';
        if (checkIn && checkOut) {
          const diff = Math.floor((checkOut - checkIn) / 1000);
          const h = Math.floor(diff / 3600);
          const m = Math.floor((diff % 3600) / 60);
          duration = h > 0 ? `${h}h ${m}min` : `${m}min`;
        }

        // Break
        let breakStatus = 'none';
        if (fullVisit.break_start_time && fullVisit.break_end_time) breakStatus = 'taken';
        else if (fullVisit.break_window_start && !fullVisit.break_start_time) breakStatus = 'missed';

        storeBlocks.push({
          storeName: store.name,
          storeAddress: store.address || '',
          storeCity: store.city || '',
          checkIn, checkOut, duration,
          breakStatus,
          breakTook: fullVisit.break_took,
          breakDuration: fullVisit.break_duration,
          breakStart: fullVisit.break_start_time,
          breakEnd: fullVisit.break_end_time,
          notes: fullVisit.notes,
          alerts: allAlerts.filter(a => String(a.visit) === String(visit.id) || String(a.store) === String(visit.store)),
          products: allProducts.filter(p => String(p.store) === String(visit.store)),
          photos: fullVisit.photos || [],
          facingData: fullVisit.facing_data || {},
          priceComps: fullVisit.price_comparisons || [],
          ruptures: fullVisit.stock_ruptures || [],
        });
      }

      // ── Totals ──
      let hoursWorked = '0h 0m';
      if (startTime) {
        const elapsed = Date.now() - startTime;
        hoursWorked = `${Math.floor(elapsed / 3600000)}h ${Math.floor((elapsed % 3600000) / 60000)}m`;
      }
      const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const dayStartStr = startTime ? new Date(startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
      const dayEndStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      // ── Build events table rows per store ──
      const buildEventsTable = (s) => {
        const rows = [];

        const addRow = (type, description, time = '', image = '') => {
          rows.push({
            type,
            description,
            time,
            image,
          });
        };

        if (s.checkIn) {
          addRow('Arrivée en magasin', 'Début de visite', formatPdfTime(s.checkIn));
        }

        if (s.breakStatus === 'taken' && s.breakStart && s.breakEnd) {
          const bs = formatPdfTime(s.breakStart);
          const be = formatPdfTime(s.breakEnd);
          addRow(
            'Pause',
            `Pause prise de ${bs || '--:--'} à ${be || '--:--'} (${s.breakTook || '?'} min / ${s.breakDuration || '?'} min)`
          );
        } else if (s.breakStatus === 'missed') {
          addRow('Pause', 'Pause prévue mais non prise', '');
        }

        // Photos
        s.photos.forEach((p, i) => {
          const src = normalizeImageSource(p);
          const label = typeof p === 'object' && (p.fileName || p.name)
            ? `${p.fileName || p.name}`
            : `Photo ${i + 1}`;
          addRow('Photo de visite', `${label} ajoutée pendant la visite`, '', src);
        });

        // Facing
        if (s.facingData?.productSummary?.length > 0) {
          const summary = s.facingData.productSummary.map(ps =>
            `${ps.productName}: attendu ${ps.expected}, observé ${ps.observed} (${ps.gap >= 0 ? '+' : ''}${ps.gap})`
          ).join(' | ');
          addRow(
            'Facing / Linéaire',
            `Grille ${s.facingData.rows}×${s.facingData.columns} — ${s.facingData.totalObservedUnits || 0} unités${summary ? ` — ${summary}` : ''}`,
            '',
            normalizeImageSource(s.facingData.proofPhotoUri)
          );
        }

        // Price comparisons
        s.priceComps.forEach(pc => {
          const diff = pc.ourPrice && pc.competitorPrice ? (pc.competitorPrice - pc.ourPrice).toFixed(2) : '—';
          addRow(
            'Prix concurrent',
            `${pc.productName} — Notre prix: ${pc.ourPrice} TND, ${pc.competitor || 'Concurrent'}: ${pc.competitorPrice} TND (diff: ${diff})`
          );
        });

        // Ruptures
        s.ruptures.forEach(r => {
          addRow('Rupture de stock', r.productName || r.productId || 'Produit non renseigné');
        });

        // Alerts
        s.alerts.forEach(a => {
          const time = formatPdfTime(a.created_at);
          addRow(
            `Alerte — ${alertTypeLabels[a.alert_type] || a.alert_type}`,
            `${a.competitor_brand || ''}${a.description ? ' : ' + a.description : ''}`,
            time,
            normalizeImageSource(a.photo)
          );
        });

        // Products
        s.products.forEach(p => {
          const time = formatPdfTime(p.created_at);
          const details = [p.name, p.brand, p.category, p.price ? `${p.price} TND` : ''].filter(Boolean).join(' — ');
          addRow(
            'Produit ajouté',
            details + (p.description ? ` (${p.description})` : ''),
            time,
            normalizeImageSource(p.image)
          );
        });

        // Notes
        if (s.notes) {
          addRow('Notes', s.notes);
        }

        if (s.checkOut) {
          addRow('Sortie du magasin', 'Fin de visite', formatPdfTime(s.checkOut));
        }

        return rows;
      };

      // ── Store sections HTML ──
      const storesHTML = storeBlocks.map((s, idx) => {
        let breakLine = '';
        if (s.breakStatus === 'taken') {
          const bs = formatPdfTime(s.breakStart);
          const be = formatPdfTime(s.breakEnd);
          breakLine = `<tr><td class="lbl">Pause</td><td colspan="3">&#9989; ${escapeHtml(bs || '--:--')} &rarr; ${escapeHtml(be || '--:--')} (${escapeHtml(s.breakTook || '?')}min / ${escapeHtml(s.breakDuration || '?')}min)</td></tr>`;
        } else if (s.breakStatus === 'missed') {
          breakLine = `<tr><td class="lbl">Pause</td><td colspan="3" style="color:#dc2626;">&#9888;&#65039; Manquée</td></tr>`;
        }

        const events = buildEventsTable(s);
        const photoCount = events.filter((e) => e.image).length;

        const eventsRows = events.length > 0
          ? events.map((e, i) => `
              <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;color:#334155;white-space:nowrap;vertical-align:top;">${escapeHtml(e.time || '—')}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;color:#334155;white-space:nowrap;vertical-align:top;">${escapeHtml(e.type)}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;">${escapeHtml(e.description)}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;vertical-align:top;">${e.image ? `<img src=\"${e.image}\" style=\"max-width:65px;max-height:45px;border-radius:3px;\"/>` : '—'}</td>
              </tr>`).join('')
          : `<tr><td colspan="4" style="padding:12px;text-align:center;color:#94a3b8;font-style:italic;border:1px solid #e2e8f0;">Aucun événement enregistré pour cette visite.</td></tr>`;

        return `
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;page-break-inside:avoid;">
            <!-- Store header -->
            <tr>
              <td colspan="4" style="background:#2563eb;color:#fff;padding:10px 14px;font-size:14px;font-weight:700;">
                <table style="border-collapse:collapse;"><tr>
                  <td style="width:28px;height:28px;border:2px solid #fff;border-radius:50%;text-align:center;vertical-align:middle;font-weight:800;font-size:12px;color:#fff;">${idx + 1}</td>
                  <td style="padding-left:10px;color:#fff;font-size:14px;font-weight:700;">${escapeHtml(s.storeName)}</td>
                </tr></table>
              </td>
            </tr>
            <tr><td colspan="4" style="background:#eff6ff;color:#1d4ed8;padding:6px 14px;font-size:10px;font-weight:700;border-left:1px solid #bfdbfe;border-right:1px solid #bfdbfe;">${events.length} événements consignés • ${photoCount} photos associées</td></tr>
            <!-- Store info -->
            <tr><td class="lbl">Adresse</td><td colspan="2">${escapeHtml(s.storeAddress)}${s.storeCity ? ', ' + escapeHtml(s.storeCity) : ''}</td></tr>
            ${breakLine}
            <!-- Events header -->
            <tr>
              <td style="background:#e0ecff;padding:6px 8px;font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #93c5fd;width:11%;">Heure</td>
              <td style="background:#e0ecff;padding:6px 8px;font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #93c5fd;width:22%;">Type</td>
              <td style="background:#e0ecff;padding:6px 8px;font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #93c5fd;">Description</td>
              <td style="background:#e0ecff;padding:6px 8px;font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #93c5fd;width:14%;">Photo</td>
            </tr>
            ${eventsRows}
          </table>
        `;
      }).join('');

      // ── Full HTML (tables only — no flexbox for PDF compatibility) ──
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { margin: 18mm 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.45; }
  table { border-collapse: collapse; }
  .lbl { width: 100px; font-weight: 700; color: #475569; background: #f8fafc; padding: 5px 14px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  td { font-size: 11px; padding: 5px 14px; border-bottom: 1px solid #f1f5f9; }
</style></head><body>

  <!-- ═══ HEADER ═══ -->
  <table style="width:100%;border-bottom:3px solid #2563eb;margin-bottom:16px;">
    <tr><td colspan="2" style="text-align:center;font-size:20px;font-weight:800;color:#2563eb;letter-spacing:2px;padding:8px 0 12px;">RAPPORT JOURNALIER</td></tr>
    <tr><td style="font-weight:700;color:#475569;width:150px;padding:3px 8px;">Merchandiser</td><td style="padding:3px 8px;">${escapeHtml(`${user?.first_name || ''} ${user?.last_name || user?.username || ''}`.trim())}</td></tr>
    <tr><td style="font-weight:700;color:#475569;padding:3px 8px;">Date</td><td style="padding:3px 8px;">${escapeHtml(dateStr)}</td></tr>
    <tr><td style="font-weight:700;color:#475569;padding:3px 8px;">Début de journée</td><td style="padding:3px 8px;">${escapeHtml(dayStartStr)}</td></tr>
    <tr><td style="font-weight:700;color:#475569;padding:3px 8px;">Fin de journée</td><td style="padding:3px 8px;">${escapeHtml(dayEndStr)}</td></tr>
    <tr><td style="font-weight:700;color:#475569;padding:3px 8px 10px;">Durée totale</td><td style="padding:3px 8px 10px;"><strong>${escapeHtml(hoursWorked)}</strong></td></tr>
  </table>

  <!-- ═══ SUMMARY ═══ -->
  <table style="width:100%;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:18px;background:#f8fafc;">
    <tr>
      <td style="text-align:center;padding:10px 0;width:25%;"><div style="font-size:20px;font-weight:800;color:#2563eb;">${completedVisits.length}</div><div style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Magasins</div></td>
      <td style="text-align:center;padding:10px 0;width:25%;border-left:1px solid #e2e8f0;"><div style="font-size:20px;font-weight:800;color:#2563eb;">${hoursWorked}</div><div style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Heures</div></td>
      <td style="text-align:center;padding:10px 0;width:25%;border-left:1px solid #e2e8f0;"><div style="font-size:20px;font-weight:800;color:#2563eb;">${allAlerts.length}</div><div style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Alertes</div></td>
      <td style="text-align:center;padding:10px 0;width:25%;border-left:1px solid #e2e8f0;"><div style="font-size:20px;font-weight:800;color:#2563eb;">${allProducts.length}</div><div style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Produits</div></td>
    </tr>
  </table>

  <!-- ═══ STORES ═══ -->
  ${storesHTML || '<p style="text-align:center;color:#94a3b8;padding:20px;">Aucune visite enregistrée</p>'}

  <!-- ═══ FOOTER ═══ -->
  <table style="width:100%;margin-top:24px;border-top:1px solid #e2e8f0;">
    <tr><td style="text-align:center;font-size:9px;color:#94a3b8;padding-top:12px;">Rapport généré le ${new Date().toLocaleString('fr-FR')} — Merchandising App &copy; ${new Date().getFullYear()}</td></tr>
  </table>

</body></html>`;

      const { uri } = await Print.printToFileAsync({ html });

      // Upload to backend
      try {
        const fileName = `rapport_${user?.username || 'merchandiser'}_${today}.pdf`;
        await documentService.uploadDocument(
          { uri, type: 'application/pdf', name: fileName },
          {
            title: `Rapport Journalier - ${dateStr}`,
            description: `${user?.first_name || user?.username || 'Merchandiser'} - ${completedVisits.length} magasins, ${hoursWorked} travaillées, ${allAlerts.length} alertes, ${allProducts.length} produits`,
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
      Alert.alert('Erreur', 'Échec de la génération du rapport PDF');
    }
  };

  const handleStartDay = async () => {
    if (dayStarted) {
      // Check if all visits are completed before allowing end day
      const totalVisits = todayVisits.length;
      const completedVisits = todayVisits.filter(v => v.status === 'completed');
      const allCompleted = totalVisits > 0 && completedVisits.length === totalVisits;

      if (totalVisits === 0) {
        Alert.alert(
          'Aucune visite',
          'Aucune visite planifiée pour aujourd\'hui. Vous ne pouvez pas terminer la journée sans visites.'
        );
        return;
      }

      if (!allCompleted) {
        Alert.alert(
          'Travail incomplet',
          `Vous avez complété ${completedVisits.length}/${totalVisits} visites.\nVeuillez terminer toutes les visites avant de finir la journée.`
        );
        return;
      }

      // All visits completed — allow end day
      Alert.alert(
        'Fin de journée',
        'Toutes les visites sont complétées. Voulez-vous terminer votre journée et générer le rapport ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Terminer',
            style: 'destructive',
            onPress: async () => {
              try {
                await AsyncStorage.removeItem(userKey('dayStartTime'));
                await AsyncStorage.removeItem(userKey('dayStarted'));
                await AsyncStorage.removeItem(userKey('breakStartTime'));
                await AsyncStorage.removeItem(userKey('breakEndTime'));
                const savedStartTime = dayStartTime;
                setDayStarted(false);
                setDayStartTime(null);
                setElapsedTime('00:00:00');
                setIsOnBreak(false);
                setBreakStartTime(null);
                setBreakEndTime(null);
                setBreakElapsed('00:00');
                // Notify supervisor dashboard
                if (user?.id) {
                  userService.patchUser(user.id, { day_started: false, day_start_time: null }).catch(() => {});
                }

                Alert.alert('Journée terminée', 'Toutes les visites complétées ! Génération du rapport...');
                await generateEndOfDayPDF(completedVisits, savedStartTime);
              } catch (error) {
                console.error('Error ending day:', error);
                Alert.alert('Erreur', 'Impossible de terminer la journée');
              }
            }
          }
        ]
      );
    } else {
      // Start day
      try {
        const startTime = Date.now();
        await AsyncStorage.setItem(userKey('dayStartTime'), startTime.toString());
        await AsyncStorage.setItem(userKey('dayStarted'), 'true');
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

        {/* 2. Today's Route label + 3. Map */}
        <Text style={styles.routeLabel}>Today's Route</Text>
        <View style={styles.mapContainer}>
          <StoreMap stores={todayStores} height={200} />
        </View>

        {/* 4. Ready to Begin Card */}
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

        {/* 5. Daily Progress */}
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
              <Text style={styles.estimatedTime}>Time worked: {timeWorked}</Text>
            </View>
          )}
        </View>

        {/* 6. Today's Schedule card — pause reminder + stores */}
        <View style={styles.scheduleSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
          </View>

          {/* Break reminder (right under title) */}
          {breakWindowStart && breakWindowEnd && (
            <View style={styles.breakReminder}>
              <MaterialCommunityIcons name="coffee-outline" size={18} color="#f59e0b" />
              <Text style={styles.breakReminderText}>
                Pause: {breakWindowStart} - {breakWindowEnd} ({breakDuration || 30} min)
              </Text>
              {breakEndTime && (
                <View style={styles.breakDoneBadge}>
                  <MaterialCommunityIcons name="check" size={12} color="#10b981" />
                </View>
              )}
            </View>
          )}

          {/* Store list */}
          {todayStores.length > 0 ? (
            todayStores.map((store) => {
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

        {/* Break + End Day buttons (outside the card, only when day started) */}
        {dayStarted && (
          <View>
            {breakWindowStart && breakWindowEnd && !breakEndTime && (
              <TouchableOpacity 
                style={[
                  styles.breakBtn,
                  (!isBreakWindowActive() || isOnBreak === false && isBreakWindowPassed()) && styles.breakBtnDisabled
                ]}
                onPress={isOnBreak ? handleEndBreak : handleStartBreak}
                disabled={!isOnBreak && (!isBreakWindowActive() || isBreakWindowPassed())}
              >
                <MaterialCommunityIcons 
                  name={isOnBreak ? 'pause-circle' : 'coffee'} 
                  size={20} 
                  color="#fff" 
                  style={{ marginRight: 8 }} 
                />
                <Text style={styles.breakBtnText}>
                  {isOnBreak 
                    ? `Fin Pause (${breakElapsed})` 
                    : isBreakWindowPassed() 
                      ? 'Pause manquée' 
                      : `Prendre Pause (${breakWindowStart} - ${breakWindowEnd})`}
                </Text>
              </TouchableOpacity>
            )}
            {breakEndTime && (
              <View style={styles.breakCompletedBanner}>
                <MaterialCommunityIcons name="check-circle" size={18} color="#10b981" />
                <Text style={styles.breakCompletedText}>Pause terminée ✓</Text>
              </View>
            )}
            {/* Only show End Workday if dayStarted is true */}
            {dayStarted && (
              <TouchableOpacity style={styles.endDayBtn} onPress={handleStartDay}>
                <MaterialCommunityIcons name="stop-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.endDayText}>End Workday</Text>
              </TouchableOpacity>
            )}
          </View>
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

  // Route label
  routeLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
  },
  // Schedule Section (stores + break + end day)
  scheduleSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8eaed'
  },
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

  // Break Button
  breakBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  breakBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  breakBtnDisabled: {
    backgroundColor: '#d1d5db',
  },
  breakReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  breakReminderText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  breakDoneBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakCompletedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  breakCompletedText: {
    fontSize: 14,
    color: '#065f46',
    fontWeight: '600',
    marginLeft: 6,
  },

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
