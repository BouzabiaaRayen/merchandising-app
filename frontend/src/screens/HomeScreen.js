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
  Image,
  Animated
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
  const [gpsPermissionGranted, setGpsPermissionGranted] = useState(null);
  const [gpsServicesEnabled, setGpsServicesEnabled] = useState(null);
  const [location, setLocation] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const locationSubscriptionRef = useRef(null);
  const locationCheckIntervalRef = useRef(null);
  const lastGpsSendRef = useRef(0); // timestamp of last server send
  const reportedGpsActiveRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

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
      syncGpsTrackingState({ requestPermission: true });
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

        syncGpsTrackingState();
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

  const stopTrackingResources = ({ keepMonitor = false } = {}) => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    if (!keepMonitor && locationCheckIntervalRef.current) {
      clearInterval(locationCheckIntervalRef.current);
      locationCheckIntervalRef.current = null;
    }
  };

  const updateReportedGpsState = async (nextActive, { notifyOff = false } = {}) => {
    const wasActive = reportedGpsActiveRef.current;
    if (wasActive === nextActive) {
      return;
    }

    reportedGpsActiveRef.current = nextActive;

    try {
      if (nextActive) {
        if (user?.id) {
          userService.patchUser(user.id, { gps_active: true }).catch(() => {});
        }
        await sendSessionStatusUpdate('active');
        return;
      }

      await sendSessionStatusUpdate('stopped');
      if (user?.id) {
        userService.patchUser(user.id, { gps_active: false }).catch(() => {});
      }
      if (notifyOff && wasActive) {
        await notifyGPSOffToSupervisors();
      }
    } catch (error) {
      console.error('Error updating reported GPS state:', error);
    }
  };

  const setGpsInactive = async ({ notifyOff = false, clearLocation = true } = {}) => {
    stopTrackingResources({ keepMonitor: true });
    setGpsActive(false);
    if (clearLocation) {
      setLocation(null);
    }
    await updateReportedGpsState(false, { notifyOff });
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
  
  const startLocationTracking = async () => {
    if (locationSubscriptionRef.current) {
      setGpsActive(true);
      return;
    }

    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(currentLocation);
      setGpsActive(true);
      console.log('GPS activated:', currentLocation.coords);

      await updateReportedGpsState(true);

      lastGpsSendRef.current = Date.now();
      await sendGpsToServer(currentLocation.coords);

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        async (newLocation) => {
          setLocation(newLocation);
          setGpsActive(true);
          console.log('GPS Update:', {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            accuracy: newLocation.coords.accuracy,
          });

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
      await setGpsInactive();
    }
  };

  const syncGpsTrackingState = async ({ requestPermission = false } = {}) => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      setGpsServicesEnabled(servicesEnabled);

      let permission = await Location.getForegroundPermissionsAsync();
      if (
        requestPermission &&
        permission.status !== 'granted' &&
        permission.canAskAgain !== false
      ) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      const permissionGranted = permission.status === 'granted';
      setGpsPermissionGranted(permissionGranted);

      if (!servicesEnabled || !permissionGranted) {
        await setGpsInactive({ notifyOff: true });
        return;
      }

      await startLocationTracking();
    } catch (error) {
      console.error('Error syncing GPS tracking state:', error);
      await setGpsInactive();
    }
  };

  useEffect(() => {
    syncGpsTrackingState();

    locationCheckIntervalRef.current = setInterval(() => {
      syncGpsTrackingState();
    }, 5000);

    return () => {
      stopTrackingResources();
    };
  }, [user?.id]);

  // Breathing pulse animation for GPS status dot
  useEffect(() => {
    if (gpsActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0.3);
    }
  }, [gpsActive]);

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
    Alert.alert('Break ended', `Break duration: ${mins} min`);
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
      
      // Fetch visits — pass merchandiser param so backend filters it if supported
      const visitsParams = { limit: 1000 };
      if (user?.id) visitsParams.merchandiser = user.id;
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
      
      // Type-safe ID extractor — handles number, string, or nested object {id, pk}
      const toIdStr = (val) => {
        if (val == null) return '';
        if (typeof val === 'object') return String(val.id ?? val.pk ?? '');
        return String(val);
      };
      const uid = user?.id != null ? String(user.id) : null;

      // Filter client-side as a safety net in case backend ignores the param
      const userVisits = uid
        ? allVisits.filter(v => {
            const match =
              toIdStr(v.merchandiser)    === uid ||
              toIdStr(v.user)            === uid ||
              toIdStr(v.merchandiser_id) === uid ||
              toIdStr(v.user_id)         === uid;
            if (!match) {
              console.log('Visit skipped — user mismatch:', {
                visit_merchandiser: v.merchandiser,
                visit_user: v.user,
                uid,
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
          : parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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
        promotion: 'Promotion', price_change: 'Price Change',
        new_product: 'New Product', competitor_activity: 'Competitor Activity',
      };

      // ── Build per-store data ──
      const storeBlocks = [];
      for (const visit of completedVisits) {
        let fullVisit = visit;
        try { fullVisit = await visitService.getVisit(visit.id); } catch (e) {}
        let store = { name: 'Unknown Store', address: '' };
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
          aiAnalysis: fullVisit.facing_data && !Array.isArray(fullVisit.facing_data)
            ? fullVisit.facing_data.aiAnalysis || null
            : null,
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
      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const dayStartStr = startTime ? new Date(startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';
      const dayEndStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

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
          addRow('Store Arrival', 'Visit started', formatPdfTime(s.checkIn));
        }

        if (s.breakStatus === 'taken' && s.breakStart && s.breakEnd) {
          const bs = formatPdfTime(s.breakStart);
          const be = formatPdfTime(s.breakEnd);
          addRow(
            'Break',
            `Break taken from ${bs || '--:--'} to ${be || '--:--'} (${s.breakTook || '?'} min / ${s.breakDuration || '?'} min)`
          );
        } else if (s.breakStatus === 'missed') {
          addRow('Break', 'Scheduled break not taken', '');
        }

        // Photos
        s.photos.forEach((p, i) => {
          const src = normalizeImageSource(p);
          const label = typeof p === 'object' && (p.fileName || p.name)
            ? `${p.fileName || p.name}`
            : `Photo ${i + 1}`;
          addRow('Visit Photo', `${label} added during the visit`, '', src);
        });

        // Facing
        if (s.facingData?.productSummary?.length > 0) {
          const summary = s.facingData.productSummary.map(ps =>
            `${ps.productName}: expected ${ps.expected}, observed ${ps.observed} (${ps.gap >= 0 ? '+' : ''}${ps.gap})`
          ).join(' | ');
          addRow(
            'Facing / Shelf',
            `Grid ${s.facingData.rows}x${s.facingData.columns} - ${s.facingData.totalObservedUnits || 0} units${summary ? ` - ${summary}` : ''}`,
            '',
            normalizeImageSource(s.facingData.proofPhotoUri)
          );
        }

        if (s.aiAnalysis?.summary || s.aiAnalysis?.products?.length || s.aiAnalysis?.detections?.length) {
          const aiSummary = s.aiAnalysis.summary || {};
          const detectedProducts = (s.aiAnalysis.products || []).filter((product) => Number(product?.detectedCount) > 0);
          const detections = s.aiAnalysis.detections || [];
          addRow(
            'AI Shelf Analysis',
            `${detectedProducts.length} detected products, ${detections.length} detections${aiSummary.outOfStockCount ? `, ${aiSummary.outOfStockCount} stockouts` : ''}`,
            formatPdfTime(s.aiAnalysis.analyzedAt),
            normalizeImageSource(s.aiAnalysis.imageUri)
          );

          detectedProducts.forEach((product) => {
            addRow(
              'AI Product',
              `${product.productName || 'Unnamed product'} - detected: ${product.detectedCount ?? 0}`,
              formatPdfTime(s.aiAnalysis.analyzedAt)
            );
          });

          detections.forEach((detection) => {
            addRow(
              'AI Detection',
              `${detection.label || detection.productName || 'Detection'}`,
              formatPdfTime(s.aiAnalysis.analyzedAt)
            );
          });
        }

        // Price comparisons
        s.priceComps.forEach(pc => {
          const diff = pc.ourPrice && pc.competitorPrice ? (pc.competitorPrice - pc.ourPrice).toFixed(2) : '—';
          addRow(
            'Competitor Price',
            `${pc.productName} - Our price: ${pc.ourPrice} TND, ${pc.competitor || 'Competitor'}: ${pc.competitorPrice} TND (diff: ${diff})`
          );
        });

        // Ruptures
        s.ruptures.forEach(r => {
          addRow('Out of Stock', r.productName || r.productId || 'Unnamed product');
        });

        // Alerts
        s.alerts.forEach(a => {
          const time = formatPdfTime(a.created_at);
          addRow(
            `Alert - ${alertTypeLabels[a.alert_type] || a.alert_type}`,
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
            'Product Added',
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
          addRow('Store Departure', 'Visit completed', formatPdfTime(s.checkOut));
        }

        return rows;
      };

      // ── Store sections HTML ──
      const storesHTML = storeBlocks.map((s, idx) => {
        let breakLine = '<span class="store-meta-pill">No break scheduled</span>';
        if (s.breakStatus === 'taken') {
          const bs = formatPdfTime(s.breakStart);
          const be = formatPdfTime(s.breakEnd);
          breakLine = `<span class="store-meta-pill success">Break taken ${escapeHtml(bs || '--:--')} -> ${escapeHtml(be || '--:--')} (${escapeHtml(s.breakTook || '?')} min)</span>`;
        } else if (s.breakStatus === 'missed') {
          breakLine = '<span class="store-meta-pill danger">Missed break</span>';
        }

        const events = buildEventsTable(s);
        const photoCount = events.filter((e) => e.image).length;
        const checkInLabel = formatPdfTime(s.checkIn) || '--:--';
        const checkOutLabel = formatPdfTime(s.checkOut) || '--:--';
        const alertCount = s.alerts.length;
        const productCount = s.products.length;

        const eventsRows = events.length > 0
          ? events.map((e, i) => `
              <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fbff'};">
                <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#334155;white-space:nowrap;vertical-align:top;">${escapeHtml(e.time || '—')}</td>
                <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
                  <span style="display:inline-block;padding:4px 8px;border-radius:999px;background:#e0ecff;color:#1d4ed8;font-size:10px;font-weight:700;">${escapeHtml(e.type)}</span>
                </td>
                <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;color:#475569;vertical-align:top;line-height:1.55;">${escapeHtml(e.description)}</td>
                <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:center;vertical-align:top;">
                  ${e.image ? `<div style="display:inline-block;padding:3px;border:1px solid #dbeafe;border-radius:10px;background:#eff6ff;"><img src=\"${e.image}\" style=\"display:block;max-width:72px;max-height:52px;border-radius:7px;\"/></div>` : '<span style="color:#94a3b8;font-weight:600;">None</span>'}
                </td>
              </tr>`).join('')
          : `<tr><td colspan="4" style="padding:16px;text-align:center;color:#94a3b8;font-style:italic;border-bottom:1px solid #e2e8f0;">No events recorded for this visit.</td></tr>`;

        return `
          <table class="store-card">
            <tr>
              <td>
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:0;">
                      <table style="width:100%;border-collapse:collapse;">
                        <tr>
                          <td style="padding:0 0 14px 0;">
                            <table style="width:100%;border-collapse:collapse;">
                              <tr>
                                <td style="width:44px;vertical-align:top;">
                                  <div class="store-index">${idx + 1}</div>
                                </td>
                                <td style="padding-left:10px;vertical-align:top;">
                                  <div class="store-title">${escapeHtml(s.storeName)}</div>
                                  <div class="store-subtitle">${escapeHtml(s.storeAddress || 'Address not provided')}${s.storeCity ? `, ${escapeHtml(s.storeCity)}` : ''}</div>
                                </td>
                                <td style="text-align:right;vertical-align:top;">
                                  <div class="store-duration">${escapeHtml(s.duration || '—')}</div>
                                  <div class="store-duration-label">Visit Duration</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <table class="store-summary-grid">
                        <tr>
                          <td>
                            <div class="metric-label">Arrival</div>
                            <div class="metric-value">${escapeHtml(checkInLabel)}</div>
                          </td>
                          <td>
                            <div class="metric-label">Departure</div>
                            <div class="metric-value">${escapeHtml(checkOutLabel)}</div>
                          </td>
                          <td>
                            <div class="metric-label">Alerts</div>
                            <div class="metric-value">${alertCount}</div>
                          </td>
                          <td>
                            <div class="metric-label">Products</div>
                            <div class="metric-value">${productCount}</div>
                          </td>
                          <td>
                            <div class="metric-label">Photos</div>
                            <div class="metric-value">${photoCount}</div>
                          </td>
                        </tr>
                      </table>

                      <table style="width:100%;border-collapse:collapse;margin:14px 0 16px 0;">
                        <tr>
                          <td style="padding:0;">${breakLine}</td>
                        </tr>
                      </table>

                      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
                        <tr>
                          <td class="section-heading">Activity Log</td>
                        </tr>
                      </table>

                      <table class="events-table">
                        <tr>
                          <td class="events-head time">Time</td>
                          <td class="events-head type">Type</td>
                          <td class="events-head desc">Description</td>
                          <td class="events-head photo">Photo</td>
                        </tr>
                        ${eventsRows}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        `;
      }).join('');

      // ── Full HTML (tables only — no flexbox for PDF compatibility) ──
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { margin: 18mm 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.5; background: #ffffff; }
  table { width: 100%; border-collapse: collapse; }
  .page-shell { padding: 4px 0 0; }
  .hero-card { margin-bottom: 18px; border-radius: 18px; overflow: hidden; background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); }
  .hero-top td { padding: 24px 24px 10px 24px; border: none; }
  .hero-kicker { display: inline-block; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,0.14); color: #dbeafe; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .hero-title { margin-top: 14px; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; }
  .hero-subtitle { margin-top: 6px; color: rgba(219, 234, 254, 0.92); font-size: 11px; line-height: 1.6; }
  .hero-meta td { width: 33.33%; padding: 14px 24px 22px 24px; border: none; vertical-align: top; }
  .hero-meta-label { color: rgba(191, 219, 254, 0.82); font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .hero-meta-value { margin-top: 5px; color: #ffffff; font-size: 14px; font-weight: 700; }
  .section-heading { padding: 0 0 8px 0; color: #0f172a; font-size: 12px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border: none; }
  .summary-grid { margin-bottom: 18px; }
  .summary-grid td { width: 25%; padding: 0 6px; border: none; vertical-align: top; }
  .summary-card { min-height: 88px; padding: 16px 14px; border: 1px solid #dbe7ff; border-radius: 16px; background: #f8fbff; }
  .summary-label { color: #64748b; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .summary-value { margin-top: 8px; color: #0f172a; font-size: 20px; font-weight: 800; }
  .summary-subtext { margin-top: 4px; color: #475569; font-size: 10px; }
  .store-card { margin-bottom: 18px; border: 1px solid #dbe7ff; border-radius: 20px; overflow: hidden; background: #ffffff; page-break-inside: avoid; }
  .store-card > tbody > tr > td { padding: 18px 18px 16px 18px; border: none; }
  .store-index { width: 34px; height: 34px; line-height: 34px; text-align: center; border-radius: 50%; background: #dbeafe; color: #1d4ed8; font-size: 13px; font-weight: 800; }
  .store-title { color: #0f172a; font-size: 15px; font-weight: 800; }
  .store-subtitle { margin-top: 4px; color: #64748b; font-size: 10px; line-height: 1.5; }
  .store-duration { color: #0f172a; font-size: 15px; font-weight: 800; text-align: right; }
  .store-duration-label { margin-top: 4px; color: #64748b; font-size: 9px; font-weight: 700; letter-spacing: 0.7px; text-transform: uppercase; }
  .store-summary-grid { margin-bottom: 2px; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
  .store-summary-grid td { width: 20%; padding: 12px 10px; border-right: 1px solid #e2e8f0; background: #f8fafc; text-align: center; }
  .store-summary-grid td:last-child { border-right: none; }
  .metric-label { color: #64748b; font-size: 9px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
  .metric-value { margin-top: 5px; color: #0f172a; font-size: 14px; font-weight: 800; }
  .store-meta-pill { display: inline-block; padding: 7px 12px; border-radius: 999px; background: #e2e8f0; color: #334155; font-size: 10px; font-weight: 700; }
  .store-meta-pill.success { background: #dcfce7; color: #166534; }
  .store-meta-pill.danger { background: #fee2e2; color: #b91c1c; }
  .events-table { border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
  .events-head { padding: 10px; background: #eff6ff; color: #1d4ed8; font-size: 9px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid #bfdbfe; }
  .events-head.time { width: 12%; }
  .events-head.type { width: 20%; }
  .events-head.photo { width: 15%; }
  .footer-note { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 9px; }
</style></head><body>
<div class="page-shell">
  <table class="hero-card">
    <tr class="hero-top">
      <td>
        <div class="hero-kicker">Merchandising App</div>
        <div class="hero-title">Daily Report</div>
        <div class="hero-subtitle">A clean and structured summary of the field day, including visits, alerts, tracked products, and the activity log for each store.</div>
      </td>
    </tr>
    <tr class="hero-meta">
      <td>
        <div class="hero-meta-label">Merchandiser</div>
        <div class="hero-meta-value">${escapeHtml(`${user?.first_name || ''} ${user?.last_name || user?.username || ''}`.trim())}</div>
      </td>
      <td>
        <div class="hero-meta-label">Report Date</div>
        <div class="hero-meta-value">${escapeHtml(dateStr)}</div>
      </td>
      <td>
        <div class="hero-meta-label">Time Range</div>
        <div class="hero-meta-value">${escapeHtml(dayStartStr)} → ${escapeHtml(dayEndStr)}</div>
      </td>
    </tr>
  </table>

  <table style="margin-bottom:8px;"><tr><td class="section-heading">Overview</td></tr></table>
  <table class="summary-grid">
    <tr>
      <td>
        <div class="summary-card">
          <div class="summary-label">Stores Visited</div>
          <div class="summary-value">${completedVisits.length}</div>
          <div class="summary-subtext">Visits completed today</div>
        </div>
      </td>
      <td>
        <div class="summary-card">
          <div class="summary-label">Time Worked</div>
          <div class="summary-value">${escapeHtml(hoursWorked)}</div>
          <div class="summary-subtext">From ${escapeHtml(dayStartStr)} to ${escapeHtml(dayEndStr)}</div>
        </div>
      </td>
      <td>
        <div class="summary-card">
          <div class="summary-label">Alerts Raised</div>
          <div class="summary-value">${allAlerts.length}</div>
          <div class="summary-subtext">Across all categories</div>
        </div>
      </td>
      <td>
        <div class="summary-card">
          <div class="summary-label">Products Logged</div>
          <div class="summary-value">${allProducts.length}</div>
          <div class="summary-subtext">Products recorded during the day</div>
        </div>
      </td>
    </tr>
  </table>

  <table style="margin-bottom:8px;"><tr><td class="section-heading">Store Details</td></tr></table>
  ${storesHTML || '<div style="text-align:center;color:#94a3b8;padding:28px 0;">No visits recorded for this day.</div>'}

  <div class="footer-note">Report generated on ${new Date().toLocaleString('en-US')} — Merchandising App &copy; ${new Date().getFullYear()}</div>
</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html });

      // Upload to backend
      try {
        const fileName = `report_${user?.username || 'merchandiser'}_${today}.pdf`;
        await documentService.uploadDocument(
          { uri, type: 'application/pdf', name: fileName },
          {
            title: `Daily Report - ${dateStr}`,
            description: `${user?.first_name || user?.username || 'Merchandiser'} - ${completedVisits.length} stores, ${hoursWorked} worked, ${allAlerts.length} alerts, ${allProducts.length} products`,
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
      Alert.alert('Error', 'Failed to generate the PDF report');
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
          'No visits',
          'No visits are scheduled for today. You cannot end the day without visits.'
        );
        return;
      }

      if (!allCompleted) {
        Alert.alert(
          'Work incomplete',
          `You have completed ${completedVisits.length}/${totalVisits} visits.\nPlease finish all visits before ending the day.`
        );
        return;
      }

      // All visits completed — allow end day
      Alert.alert(
        'End of day',
        'All visits are complete. Do you want to end your day and generate the report?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End Day',
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

                Alert.alert('Day completed', 'All visits are complete. Generating the report...');
                await generateEndOfDayPDF(completedVisits, savedStartTime);
              } catch (error) {
                console.error('Error ending day:', error);
                Alert.alert('Error', 'Unable to end the day');
              }
            }
          }
        ]
      );
    } else {
      // Start day
      if (!gpsActive) {
        Alert.alert(
          'GPS Required',
          'You cannot start the workday until phone location is turned on and detected.'
        );
        return;
      }

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

  const getGpsStatusText = () => {
    if (gpsActive) {
      return 'Signal Active';
    }

    if (gpsServicesEnabled === false) {
      return 'Location Off';
    }

    if (gpsPermissionGranted === false) {
      return 'Permission Off';
    }

    return 'Checking Location';
  };

  const getGpsStatusHint = () => {
    if (gpsActive) {
      return 'Live phone location detected';
    }

    if (gpsServicesEnabled === false) {
      return 'Turn on device location to resume GPS tracking';
    }

    if (gpsPermissionGranted === false) {
      return 'Enable location permission in phone settings';
    }

    return 'Waiting for device GPS status';
  };

  const canStartWorkday = dayStarted || gpsActive;

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

        {/* GPS Status Pill */}
        <View style={[styles.gpsPillRow, !gpsActive && styles.gpsPillRowOff]}>
          <MaterialCommunityIcons
            name={gpsActive ? 'map-marker' : 'map-marker-off'}
            size={14}
            color={gpsActive ? '#10b981' : '#d97706'}
          />
          <Text style={[styles.gpsPillText, { color: gpsActive ? '#059669' : '#92400e' }]}>
            {gpsActive ? 'GPS Active' : getGpsStatusText()}
          </Text>
          {gpsActive ? (
            <Animated.View style={[styles.gpsDot, { opacity: pulseAnim }]} />
          ) : (
            <View style={[styles.gpsDot, { backgroundColor: '#f59e0b' }]} />
          )}
        </View>

        {/* ─── BEFORE DAY STARTED ─── */}
        {!dayStarted && (
          <>
            {/* Prominent Start Workday card */}
            <View style={styles.startCard}>
              <Text style={styles.startCardTitle}>Ready to begin?</Text>
              <Text style={styles.startCardSub}>
                Start your shift to track your store visits for the day.
              </Text>
              {!gpsActive && (
                <Text style={styles.startCardHint}>
                  Turn on phone location first to start your workday.
                </Text>
              )}
              <TouchableOpacity
                style={[styles.bigStartBtn, !canStartWorkday && styles.bigStartBtnDisabled]}
                onPress={handleStartDay}
                disabled={!canStartWorkday}
              >
                <MaterialCommunityIcons name="play-circle" size={22} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.bigStartText}>Start Workday</Text>
              </TouchableOpacity>
            </View>

            {/* Faded preview of what's coming */}
            <View style={styles.fadedWrapper} pointerEvents="none">
              {/* Daily Progress preview */}
              <View style={styles.progressSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Daily Progress</Text>
                  <View style={styles.progressBadge}>
                    <Text style={styles.progressBadgeText}>{homeData.todayPercent}% Complete</Text>
                  </View>
                </View>
                <View style={styles.progressItem}>
                  <Text style={styles.progressLabel}>Store Visits</Text>
                  <Text style={styles.progressValue}>{homeData.storesVisited} / {homeData.storesTotal} Stores</Text>
                </View>
              </View>

              {/* Daily Agenda preview */}
              <View style={styles.agendaCard}>
                <View style={styles.agendaHeader}>
                  <Text style={styles.sectionTitle}>Daily Agenda</Text>
                  <View style={styles.agendaCounter}>
                    <Text style={styles.agendaCounterText}>{homeData.storesVisited}/{homeData.storesTotal} visits</Text>
                  </View>
                </View>
                {todayStores.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="calendar-blank-outline" size={44} color="#d1d5db" />
                    <Text style={styles.emptyStateTitle}>No stores assigned today</Text>
                    <Text style={styles.emptyStateSub}>Your agenda will appear here once visits are planned.</Text>
                  </View>
                ) : (
                  todayStores.slice(0, 3).map((store) => (
                    <View key={store.id} style={styles.agendaItem}>
                      <View style={styles.agendaItemIcon}>
                        <MaterialCommunityIcons name="store-outline" size={18} color="#2563eb" />
                      </View>
                      <Text style={styles.agendaItemName} numberOfLines={1}>{store.name}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        )}

        {/* ─── DURING SHIFT ─── */}
        {dayStarted && (
          <>
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
                <Text style={styles.progressValue}>{homeData.storesVisited} / {homeData.storesTotal} Stores</Text>
              </View>
              <View style={styles.progressItem}>
                <MaterialCommunityIcons name="clock-outline" size={16} color="#6b7280" />
                <Text style={styles.estimatedTime}>Time worked: {timeWorked}</Text>
              </View>
            </View>

            {/* Daily Agenda — merged route + schedule */}
            <View style={styles.agendaCard}>
              <View style={styles.agendaHeader}>
                <Text style={styles.sectionTitle}>Daily Agenda</Text>
                <View style={styles.agendaCounter}>
                  <Text style={styles.agendaCounterText}>{homeData.storesVisited}/{homeData.storesTotal} visits</Text>
                </View>
              </View>

              {/* Break reminder */}
              {breakWindowStart && breakWindowEnd && (
                <View style={styles.breakReminder}>
                  <MaterialCommunityIcons name="coffee-outline" size={18} color="#f59e0b" />
                  <Text style={styles.breakReminderText}>
                    Break: {breakWindowStart} – {breakWindowEnd} ({breakDuration || 30} min)
                  </Text>
                  {breakEndTime && (
                    <View style={styles.breakDoneBadge}>
                      <MaterialCommunityIcons name="check" size={12} color="#10b981" />
                    </View>
                  )}
                </View>
              )}

              {/* Store list or single empty state */}
              {todayStores.length > 0 ? (
                todayStores.map((store) => {
                  const status = getStoreVisitStatus(store.id);
                  const statusStyle =
                    status === 'COMPLETED'   ? styles.routeStatusCompleted :
                    status === 'IN PROGRESS' ? styles.routeStatusInProgress :
                                              styles.routeStatusPending;
                  return (
                    <View key={store.id} style={styles.agendaItem}>
                      <View style={styles.agendaItemIcon}>
                        <MaterialCommunityIcons name="store-outline" size={18} color="#2563eb" />
                      </View>
                      <View style={styles.agendaItemInfo}>
                        <Text style={styles.agendaItemName} numberOfLines={1}>{store.name}</Text>
                        {(store.address || store.city) && (
                          <Text style={styles.agendaItemSub} numberOfLines={1}>{store.address || store.city}</Text>
                        )}
                      </View>
                      <View style={[styles.statusBadge, statusStyle]}>
                        <Text style={styles.statusBadgeText}>{status}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={44} color="#d1d5db" />
                  <Text style={styles.emptyStateTitle}>No stores assigned today</Text>
                  <Text style={styles.emptyStateSub}>Your agenda will appear here once visits are planned.</Text>
                </View>
              )}

            </View>

            {/* Today's Route card */}
            <View style={styles.agendaCard}>
              <View style={styles.agendaHeader}>
                <Text style={styles.sectionTitle}>Today's Route</Text>
              </View>
              <View style={styles.mapContainerInCard}>
                <StoreMap stores={todayStores} height={200} />
              </View>
            </View>

            {/* Break button */}
            {breakWindowStart && breakWindowEnd && !breakEndTime && (
              <TouchableOpacity
                style={[
                  styles.breakBtn,
                  !isOnBreak && (!isBreakWindowActive() || isBreakWindowPassed()) && styles.breakBtnDisabled,
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
                    ? `End Break (${breakElapsed})`
                    : isBreakWindowPassed()
                      ? 'Break window passed'
                      : `Take Break (${breakWindowStart} – ${breakWindowEnd})`}
                </Text>
              </TouchableOpacity>
            )}
            {breakEndTime && (
              <View style={styles.breakCompletedBanner}>
                <MaterialCommunityIcons name="check-circle" size={18} color="#10b981" />
                <Text style={styles.breakCompletedText}>Break completed ✓</Text>
              </View>
            )}

            {/* End Workday at the bottom */}
            <TouchableOpacity style={styles.endDayBtn} onPress={handleStartDay}>
              <MaterialCommunityIcons name="stop-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.endDayText}>End Workday</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { paddingHorizontal: 16, paddingTop: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingVertical: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  bellBadge: {
    position: 'absolute', top: -6, right: -8, backgroundColor: '#ef4444',
    borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#fff',
  },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarImg: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  headerDate: { fontSize: 12, color: '#9ca3af', marginTop: 1 },

  // GPS Pill
  gpsPillRow: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: '#f0fdf4', borderRadius: 20, paddingHorizontal: 12,
    paddingVertical: 6, marginBottom: 14, borderWidth: 1, borderColor: '#bbf7d0',
  },
  gpsPillRowOff: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  gpsPillText: { fontSize: 12, fontWeight: '600', marginHorizontal: 5 },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },

  // Start card (pre-shift)
  startCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 14,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  startCardTitle: { fontSize: 21, fontWeight: '800', color: '#111827', marginBottom: 6 },
  startCardSub: { fontSize: 14, color: '#6b7280', lineHeight: 21, marginBottom: 16 },
  startCardHint: {
    fontSize: 13, color: '#b45309', marginBottom: 12,
    backgroundColor: '#fffbeb', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
  },
  bigStartBtn: {
    backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  bigStartBtnDisabled: { backgroundColor: '#9ca3af' },
  bigStartText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Faded wrapper (pre-shift preview)
  fadedWrapper: { opacity: 0.35 },

  // Progress section
  progressSection: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  progressBadge: { backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  progressBadgeText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  progressItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  progressLabel: { fontSize: 14, color: '#6b7280' },
  progressValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  estimatedTime: { fontSize: 13, color: '#6b7280', marginLeft: 6 },

  // Agenda card (merged route + schedule)
  agendaCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  agendaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  agendaCounter: { backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  agendaCounterText: { fontSize: 12, color: '#059669', fontWeight: '600' },
  agendaItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  agendaItemIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  agendaItemInfo: { flex: 1, marginRight: 8 },
  agendaItemName: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  agendaItemSub: { fontSize: 12, color: '#9ca3af' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyStateTitle: { fontSize: 15, fontWeight: '600', color: '#6b7280', marginTop: 10, marginBottom: 4 },
  emptyStateSub: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },

  // Status badges
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeStatusCompleted: { backgroundColor: '#059669' },
  routeStatusInProgress: { backgroundColor: '#f59e0b' },
  routeStatusPending: { backgroundColor: '#9ca3af' },

  // Map
  mapContainerInCard: {
    marginHorizontal: -16,
    marginBottom: -16,
    overflow: 'hidden',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },

  // Break
  breakReminder: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 12, borderWidth: 1, borderColor: '#fde68a',
  },
  breakReminderText: { fontSize: 13, color: '#92400e', fontWeight: '500', marginLeft: 8, flex: 1 },
  breakDoneBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center' },
  breakBtn: {
    backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  breakBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  breakBtnDisabled: { backgroundColor: '#d1d5db' },
  breakCompletedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ecfdf5', borderRadius: 8, paddingVertical: 10,
    marginBottom: 10, borderWidth: 1, borderColor: '#a7f3d0',
  },
  breakCompletedText: { fontSize: 14, color: '#065f46', fontWeight: '600', marginLeft: 6 },

  // End Day
  endDayBtn: {
    backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  endDayText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
