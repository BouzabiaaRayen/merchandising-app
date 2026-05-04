import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { visitService, storeService, notificationService, scheduleService, productService } from '../services/apiService';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAKE_ARTICLES = [
  { id: 'art-1', name: 'Warda Bidha Spaghetti N°3', meta: '500g • Semoule dure', price: '2.450 TND', status: 'rupture', color: '#f4d48e', icon: 'pasta' },
  { id: 'art-2', name: 'Warda Bidha Spaghetti N°5', meta: '500g • Cuisson rapide', price: '2.600 TND', status: 'rupture-active', color: '#efbc71', icon: 'pasta' },
  { id: 'art-3', name: 'Warda Bidha Penne Rigate', meta: '400g • Format familial', price: '2.950 TND', status: 'rupture', color: '#e2c68c', icon: 'pasta' },
  { id: 'art-4', name: 'Warda Bidha Coquillettes', meta: '500g • Pates fines', price: '2.300 TND', status: 'rupture', color: '#f6e3bb', icon: 'pasta' },
  { id: 'art-5', name: 'Warda Bidha Farfalle', meta: '400g • Qualite premium', price: '3.100 TND', status: 'rupture', color: '#f2d69a', icon: 'pasta' },
  { id: 'art-6', name: 'Warda Bidha Linguine', meta: '500g • Long format', price: '2.850 TND', status: 'rupture', color: '#f0cc84', icon: 'pasta' },
  { id: 'art-7', name: 'Warda Bidha Macaroni', meta: '500g • Tube court', price: '2.700 TND', status: 'rupture', color: '#ebc47a', icon: 'pasta' },
  { id: 'art-8', name: 'Warda Bidha Vermicelle', meta: '250g • Soupe et dessert', price: '1.950 TND', status: 'rupture-active', color: '#f7dfad', icon: 'pasta' },
  { id: 'art-9', name: 'Warda Bidha Nouilles Fines', meta: '500g • Texture legere', price: '2.550 TND', status: 'rupture', color: '#f3d8a2', icon: 'pasta' },
  { id: 'art-10', name: 'Warda Bidha Tagliatelle', meta: '400g • Rubans larges', price: '3.450 TND', status: 'rupture', color: '#e7c27f', icon: 'pasta' },
  { id: 'art-11', name: 'Warda Bidha Fusilli', meta: '500g • Helicoidal', price: '2.990 TND', status: 'rupture', color: '#f0ce8e', icon: 'pasta' },
  { id: 'art-12', name: 'Warda Bidha Lasagnes', meta: '500g • Feuilles pretes', price: '4.200 TND', status: 'rupture', color: '#dcb476', icon: 'pasta' },
  { id: 'art-13', name: 'Warda Bidha Cannelloni', meta: '250g • Pates a farcir', price: '3.850 TND', status: 'rupture', color: '#e9c988', icon: 'pasta' },
  { id: 'art-14', name: "Warda Bidha Cheveux d'Ange", meta: '250g • Coupe extra fine', price: '2.100 TND', status: 'rupture-active', color: '#f5ddac', icon: 'pasta' },
  { id: 'art-15', name: 'Warda Bidha Mini Penne', meta: '400g • Format enfant', price: '2.650 TND', status: 'rupture', color: '#efd095', icon: 'pasta' },
];

const parseTndPrice = (priceText) => {
  const parsed = Number(String(priceText).replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatTndPrice = (value) => `${Number(value || 0).toFixed(3)} TND`;

const DEFAULT_FACING_ROWS = 4;
const DEFAULT_FACING_COLUMNS = 6;
const OWNER_BRANDS = ['Warda', 'Lepidor', 'Spiga', "Moulin d'Or", 'Saida'];
const MIN_STACK_DEPTH = 1;
const MAX_STACK_DEPTH = 20;

const createGridCells = (rows, columns, fill = true) =>
  Array.from({ length: rows * columns }, () => fill);

const createSlotAssignments = (rows, columns) =>
  Array.from({ length: rows * columns }, () => ({ productId: null, depth: 0 }));

const getExpectedTargetsFromGrid = (products, totalSlots) => {
  if (!products.length || totalSlots <= 0) return {};
  const targets = {};
  for (let i = 0; i < totalSlots; i += 1) {
    const product = products[i % products.length];
    targets[product.id] = (targets[product.id] || 0) + 1;
  }
  return targets;
};

const VISIT_PROGRESS_KEY = (visitId) => `visitProgress_${visitId}`;

const saveVisitProgress = async (visitId, updates) => {
  try {
    const existing = await AsyncStorage.getItem(VISIT_PROGRESS_KEY(visitId));
    const current = existing ? JSON.parse(existing) : {};
    const merged = { ...current, ...updates };
    await AsyncStorage.setItem(VISIT_PROGRESS_KEY(visitId), JSON.stringify(merged));
  } catch (e) {
    console.error('Error saving visit progress:', e);
  }
};

const loadVisitProgress = async (visitId) => {
  try {
    const data = await AsyncStorage.getItem(VISIT_PROGRESS_KEY(visitId));
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Error loading visit progress:', e);
    return null;
  }
};

export default function VisitExecutionScreen({ route, navigation }) {
  const { visitId } = route.params;
  const { user } = useAuth();

  // Core state
  const [visit, setVisit] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [locationChecked, setLocationChecked] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);
  const [checkOutTime, setCheckOutTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [activeTab, setActiveTab] = useState('events');
  const [articleQuery, setArticleQuery] = useState('');

  // Photos state
  const [photos, setPhotos] = useState([]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Break state
  const [breakStartTime, setBreakStartTime] = useState(null);
  const [breakEndTime, setBreakEndTime] = useState(null);
  const [breakDuration, setBreakDuration] = useState(null);
  const [breakWindowStart, setBreakWindowStart] = useState(null);
  const [breakWindowEnd, setBreakWindowEnd] = useState(null);
  const [breakElapsedTime, setBreakElapsedTime] = useState('00:00:00');
  const [isOnBreak, setIsOnBreak] = useState(false);

  // Completion state
  const [stockUpdateCompleted, setStockUpdateCompleted] = useState(false);
  const [priceComparisonCompleted, setPriceComparisonCompleted] = useState(false);
  const [alertCompleted, setAlertCompleted] = useState(false);
  const [productCompleted, setProductCompleted] = useState(false);

  // Articles state
  const [articles, setArticles] = useState(() =>
    FAKE_ARTICLES.map((article) => ({
      ...article,
      isRupture: article.status === 'rupture-active',
    }))
  );

  // Price comparison state — FIX: added competitorFacing and photo back
  const [competitorName, setCompetitorName] = useState('Warda');
  const [priceComparisons, setPriceComparisons] = useState(() =>
    FAKE_ARTICLES.slice(0, 8).map((article) => ({
      id: article.id,
      name: article.name,
      ourPrice: parseTndPrice(article.price),
      competitorPrice: '',
      competitorFacing: '',
      photo: null,
    }))
  );
  const [showPriceModal, setShowPriceModal] = useState(false);

  // Facing grid state
  const [facingGridRows, setFacingGridRows] = useState(String(DEFAULT_FACING_ROWS));
  const [facingGridColumns, setFacingGridColumns] = useState(String(DEFAULT_FACING_COLUMNS));
  const [facingGridCells, setFacingGridCells] = useState(() =>
    createGridCells(DEFAULT_FACING_ROWS, DEFAULT_FACING_COLUMNS, true)
  );
  const [slotAssignments, setSlotAssignments] = useState(() =>
    createSlotAssignments(DEFAULT_FACING_ROWS, DEFAULT_FACING_COLUMNS)
  );
  const [activeSlotIndex, setActiveSlotIndex] = useState(null);
  const [activeSlotDepthInput, setActiveSlotDepthInput] = useState('1');
  const [facingProofPhoto, setFacingProofPhoto] = useState(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showSlotAssignModal, setShowSlotAssignModal] = useState(false);
  const [simpleFacingCounts, setSimpleFacingCounts] = useState({});

  const facingProducts = articles.slice(0, 8);
  const expectedTargetsFromGrid = getExpectedTargetsFromGrid(facingProducts, facingGridCells.length);

  const buildInitialSimpleFacingCounts = () => {
    const next = {};
    facingProducts.forEach((product) => {
      next[product.id] = Number(expectedTargetsFromGrid[product.id] || 0);
    });
    return next;
  };

  // Alert modal state
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertBrand, setAlertBrand] = useState('');
  const [alertType, setAlertType] = useState('');
  const [showAlertTypeDropdown, setShowAlertTypeDropdown] = useState(false);
  const [alertDescription, setAlertDescription] = useState('');
  const [alertPhoto, setAlertPhoto] = useState(null);
  const [alertSubmitting, setAlertSubmitting] = useState(false);

  // Product modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [showProductCategoryDropdown, setShowProductCategoryDropdown] = useState(false);
  const [productPrice, setProductPrice] = useState('');
  const [productSku, setProductSku] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPhoto, setProductPhoto] = useState(null);
  const [productSubmitting, setProductSubmitting] = useState(false);

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchVisitData();
    getCurrentLocation();
  }, []);

  // Visit timer
  useEffect(() => {
    let interval;
    if (checkInTime && !checkOutTime) {
      interval = setInterval(() => {
        const diff = Math.floor((new Date() - new Date(checkInTime)) / 1000);
        setElapsedTime(formatDuration(diff));
      }, 1000);
    } else if (checkInTime && checkOutTime) {
      const diff = Math.floor((new Date(checkOutTime) - new Date(checkInTime)) / 1000);
      setElapsedTime(formatDuration(diff));
    }
    return () => { if (interval) clearInterval(interval); };
  }, [checkInTime, checkOutTime]);

  // Break timer
  useEffect(() => {
    let breakInterval;
    if (isOnBreak && breakStartTime) {
      breakInterval = setInterval(() => {
        const diff = Math.floor((new Date() - new Date(breakStartTime)) / 1000);
        setBreakElapsedTime(formatDuration(diff));
      }, 1000);
    } else if (breakEndTime && breakStartTime) {
      const diff = Math.floor((new Date(breakEndTime) - new Date(breakStartTime)) / 1000);
      setBreakElapsedTime(formatDuration(diff));
    }
    return () => { if (breakInterval) clearInterval(breakInterval); };
  }, [isOnBreak, breakStartTime, breakEndTime]);

  // GPS monitor
  useEffect(() => {
    let locationCheckInterval;
    if (location) {
      locationCheckInterval = setInterval(async () => {
        try {
          const isEnabled = await Location.hasServicesEnabledAsync();
          if (!isEnabled) {
            setLocation(null);
            setDistance(null);
            setLocationChecked(true);
            try {
              await notificationService.createNotification({
                user: user?.id,
                title: 'GPS Alert - During Visit',
                message: `${user?.first_name || user?.username || 'Merchandiser'} disabled GPS during visit at ${store?.name || 'Unknown Store'}`,
                type: 'GPS_ALERT',
                is_urgent: true,
              });
            } catch (notifError) {
              console.error('Failed to send GPS alert:', notifError.message);
            }
            Alert.alert('GPS Disabled', 'Location services have been turned off.', [{ text: 'OK' }]);
          }
        } catch (error) {
          console.error('Error checking location services:', error);
        }
      }, 3000);
    }
    return () => { if (locationCheckInterval) clearInterval(locationCheckInterval); };
  }, [location]);

  useEffect(() => {
    if (location && store) calculateDistance(store);
  }, [location, store]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const formatDuration = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toUpperCase();
  };

  const getGPSStatus = () => {
    if (!locationChecked) return { text: 'GPS: CHECKING...', color: '#f59e0b' };
    if (!location) return { text: 'GPS: DISABLED', color: '#ef4444' };
    if (!store?.latitude || !store?.longitude) return { text: 'GPS: STORE LOCATION NOT SET', color: '#ef4444' };
    if (distance === null || distance === undefined) return { text: 'GPS: CALCULATING...', color: '#3b82f6' };
    return { text: `GPS ACTIVE: ${distance}M FROM STORE`, color: '#3b82f6' };
  };

  // FIX: restored areRequiredEventsCompleted
  const areRequiredEventsCompleted = () =>
    photos.length > 0 && priceComparisonCompleted;

  const calculateCompletionPercentage = () => {
    let completed = 0;
    const total = 3;
    if (photos.length > 0) completed++;
    if (stockUpdateCompleted) completed++;
    if (priceComparisonCompleted) completed++;
    return Math.round((completed / total) * 100);
  };

  // ─── Data fetching ───────────────────────────────────────────────────────────

  const fetchVisitData = async () => {
    try {
      const visitData = await visitService.getVisit(visitId);
      setVisit(visitData);
      setNotes(visitData.notes || '');
      setCheckInTime(visitData.check_in_time || visitData.checked_in_at);

      try {
        const todaySchedule = await scheduleService.getTodaySchedule();
        if (todaySchedule) {
          setBreakDuration(todaySchedule.allowed_break_duration_minutes);
          setBreakWindowStart(todaySchedule.break_window_start);
          setBreakWindowEnd(todaySchedule.break_window_end);
        }
      } catch (scheduleErr) {
        console.log('No schedule found for today:', scheduleErr.message);
      }

      if (visitData.break_start_time) setBreakStartTime(visitData.break_start_time);
      if (visitData.break_end_time) setBreakEndTime(visitData.break_end_time);
      if (visitData.status === 'completed' && visitData.check_out_time) {
        setCheckOutTime(visitData.check_out_time);
      }

      if (visitData.store) {
        const storeData = await storeService.getStore(visitData.store);
        setStore(storeData);
        if (location && storeData.latitude && storeData.longitude) {
          calculateDistance(storeData);
        }
      }

      const savedProgress = await loadVisitProgress(visitId);
      if (savedProgress) {
        if (savedProgress.alertCompleted) setAlertCompleted(true);
        if (savedProgress.productCompleted) setProductCompleted(true);
        if (savedProgress.stockUpdateCompleted) setStockUpdateCompleted(true);
        if (savedProgress.priceComparisonCompleted) setPriceComparisonCompleted(true);
        if (savedProgress.photos?.length > 0) setPhotos(savedProgress.photos);
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        const [alertsRes, productsRes] = await Promise.all([
          api.get('/merchandising/competitor-alerts/').catch(() => null),
          api.get('/merchandising/products/').catch(() => null),
        ]);
        if (alertsRes) {
          const allAlerts = alertsRes.data?.results || alertsRes.data || [];
          const visitAlerts = allAlerts.filter(
            (a) => String(a.visit) === String(visitId) ||
              (a.created_at?.startsWith(today) && String(a.store) === String(visitData.store))
          );
          if (visitAlerts.length > 0) setAlertCompleted(true);
        }
        if (productsRes) {
          const allProducts = productsRes.data?.results || productsRes.data || [];
          const visitProducts = allProducts.filter(
            (p) => p.created_at?.startsWith(today) &&
              String(p.store) === String(visitData.store) &&
              String(p.created_by) === String(user?.id)
          );
          if (visitProducts.length > 0) setProductCompleted(true);
        }
      } catch (e) {
        console.log('Could not check existing alerts/products:', e.message);
      }
    } catch (error) {
      console.error('Error fetching visit data:', error);
      Alert.alert('Error', 'Failed to load visit details');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for GPS verification');
        setLocationChecked(true);
        return;
      }
      const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(currentLocation);
      setLocationChecked(true);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationChecked(true);
    }
  };

  const calculateDistance = (storeData) => {
    if (!location || !storeData.latitude || !storeData.longitude) return;
    const storeLat = parseFloat(storeData.latitude);
    const storeLng = parseFloat(storeData.longitude);
    const userLat = parseFloat(location.coords.latitude);
    const userLng = parseFloat(location.coords.longitude);
    if (isNaN(storeLat) || isNaN(storeLng) || isNaN(userLat) || isNaN(userLng)) { setDistance(null); return; }
    if (storeLat < -90 || storeLat > 90 || storeLng < -180 || storeLng > 180 ||
        userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) { setDistance(null); return; }
    const R = 6371e3;
    const φ1 = userLat * Math.PI / 180;
    const φ2 = storeLat * Math.PI / 180;
    const Δφ = (storeLat - userLat) * Math.PI / 180;
    const Δλ = (storeLng - userLng) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    setDistance(Math.round(R * c));
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleCheckIn = async () => {
    try {
      const userId = user?.id;
      const dayStarted = await AsyncStorage.getItem(userId ? `dayStarted_${userId}` : 'dayStarted');
      if (dayStarted !== 'true') {
        Alert.alert('Day Not Started', 'You must start your work day from the Home screen before checking into a store.', [{ text: 'OK' }]);
        return;
      }
      if (!location) { Alert.alert('GPS Required', 'Please enable GPS to check in'); return; }
      if (!store?.latitude || !store?.longitude) {
        Alert.alert('Store Location Missing', 'This store does not have GPS coordinates set.', [{ text: 'OK' }]);
        return;
      }
      if (distance === null || distance === undefined) {
        Alert.alert('Location Check', 'Still calculating your distance from the store. Please wait a moment.');
        return;
      }
      await visitService.checkIn(visitId);
      setCheckInTime(new Date().toISOString());
      await fetchVisitData();
      Alert.alert('Success', 'Checked in successfully!');
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Error', 'Failed to check in');
    }
  };

  const handleCheckOut = async () => {
    try {
      const checkoutTimestamp = new Date().toISOString();
      setCheckOutTime(checkoutTimestamp);
      try {
        const ruptureData = articles
          .filter((a) => a.isRupture)
          .map((a) => ({ productId: a.id, productName: a.name, status: 'rupture' }));
        if (ruptureData.length > 0) await visitService.patchVisit(visitId, { stock_ruptures: ruptureData });
      } catch (e) { console.error('Failed to save stock_ruptures:', e); }
      await visitService.checkOut(visitId, notes);
      try { await AsyncStorage.removeItem(VISIT_PROGRESS_KEY(visitId)); } catch (_) {}
      Alert.alert('Success', 'Checked out successfully!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('Error', 'Failed to check out');
    }
  };

  const handleSubmitVisit = async () => {
    try {
      if (notes !== visit.notes) await visitService.patchVisit(visitId, { notes });
      Alert.alert('Success', 'Visit data submitted successfully!');
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to submit visit data');
    }
  };

  // Photo handlers
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Denied', 'Camera permission is required'); return; }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const newPhotos = [...photos, result.assets[0]];
        setPhotos(newPhotos);
        saveVisitProgress(visitId, { photos: newPhotos });
      }
    } catch (error) {
      console.error('Photo error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleDeletePhoto = (index) => {
    Alert.alert('Delete Photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const newPhotos = photos.filter((_, i) => i !== index);
          setPhotos(newPhotos);
          saveVisitProgress(visitId, { photos: newPhotos });
        },
      },
    ]);
  };

  const handleOpenPhotoModal = () => { if (!checkInTime) return; setShowPhotoModal(true); };
  const handleOpenStockModal = () => {
    if (!checkInTime) return;
    setSimpleFacingCounts(buildInitialSimpleFacingCounts());
    setShowStockModal(true);
  };
  const handleCompetitorPrices = () => { if (!checkInTime) return; setShowPriceModal(true); };

  // Break handlers
  const isCurrentTimeInBreakWindow = () => {
    if (!breakWindowStart || !breakWindowEnd) return false;
    const now = new Date();
    const [sh, sm] = breakWindowStart.split(':').map(Number);
    const [eh, em] = breakWindowEnd.split(':').map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= sh * 60 + sm && cur <= eh * 60 + em;
  };

  const handleStartBreak = async () => {
    try {
      if (!isCurrentTimeInBreakWindow()) {
        Alert.alert('Break Window Unavailable', `Breaks are only allowed between ${breakWindowStart} and ${breakWindowEnd}`, [{ text: 'OK' }]);
        return;
      }
      const breakStart = new Date().toISOString();
      setBreakStartTime(breakStart);
      setIsOnBreak(true);
      await visitService.patchVisit(visitId, { break_start_time: breakStart });
      Alert.alert('Break Started', `Your break of ${breakDuration} minutes has started`);
    } catch (error) {
      console.error('Break start error:', error);
      Alert.alert('Error', 'Failed to start break');
    }
  };

  const handleEndBreak = async () => {
    try {
      if (!breakStartTime) { Alert.alert('Error', 'Break was not started properly'); return; }
      const breakEnd = new Date().toISOString();
      const actualDurationMinutes = Math.round((new Date(breakEnd) - new Date(breakStartTime)) / (1000 * 60));
      const allowedDurationMinutes = breakDuration || 30;
      const isOvertime = actualDurationMinutes > allowedDurationMinutes;
      setBreakEndTime(breakEnd);
      setIsOnBreak(false);
      await visitService.patchVisit(visitId, { break_end_time: breakEnd, break_took: actualDurationMinutes });
      if (isOvertime) {
        const overtimeMinutes = actualDurationMinutes - allowedDurationMinutes;
        Alert.alert('Break Overtime', `You took ${actualDurationMinutes} minutes, but only ${allowedDurationMinutes} were allowed.\nOvertime: ${overtimeMinutes} minutes`, [{ text: 'OK' }]);
        await notificationService.createNotification({
          user: user?.id,
          title: 'Break Overtime Alert',
          message: `${user?.first_name || user?.username} took an extra ${overtimeMinutes} minutes break at ${store?.name || 'Unknown Store'}`,
          type: 'BREAK_ALERT',
        });
      } else {
        Alert.alert('Break Ended', `Break completed in ${actualDurationMinutes} minutes`);
      }
    } catch (error) {
      console.error('Break end error:', error);
      Alert.alert('Error', 'Failed to end break');
    }
  };

  // Facing handlers
  const handleToggleFacingCellVisibility = (cellIndex) => {
    setFacingGridCells((current) => current.map((cell, index) => (index === cellIndex ? !cell : cell)));
  };

  const handleOpenSlotAssignment = (cellIndex) => {
    const currentDepth = Number(slotAssignments[cellIndex]?.depth || 0);
    setActiveSlotIndex(cellIndex);
    setActiveSlotDepthInput(String(currentDepth > 0 ? currentDepth : MIN_STACK_DEPTH));
    setShowSlotAssignModal(true);
  };

  const handleActiveSlotDepthInput = (value) => {
    setActiveSlotDepthInput(value.replace(/[^\d]/g, ''));
  };

  const getNormalizedDepth = () => {
    const parsed = Number(activeSlotDepthInput || 0);
    if (!Number.isFinite(parsed) || parsed <= 0) return MIN_STACK_DEPTH;
    return Math.max(MIN_STACK_DEPTH, Math.min(MAX_STACK_DEPTH, parsed));
  };

  const handleIncreaseActiveDepth = () => setActiveSlotDepthInput(String(Math.min(MAX_STACK_DEPTH, getNormalizedDepth() + 1)));
  const handleDecreaseActiveDepth = () => setActiveSlotDepthInput(String(Math.max(MIN_STACK_DEPTH, getNormalizedDepth() - 1)));

  const handleAssignProductToSlot = (productId) => {
    if (activeSlotIndex === null) return;
    const depth = getNormalizedDepth();
    setFacingGridCells((current) => current.map((cell, index) => (index === activeSlotIndex ? true : cell)));
    setSlotAssignments((current) => current.map((assigned, index) =>
      index === activeSlotIndex ? { productId, depth } : assigned
    ));
    setShowSlotAssignModal(false);
  };

  const handleClearSlotAssignment = () => {
    if (activeSlotIndex === null) return;
    setFacingGridCells((current) => current.map((cell, index) => (index === activeSlotIndex ? false : cell)));
    setSlotAssignments((current) => current.map((assigned, index) =>
      index === activeSlotIndex ? { productId: null, depth: 0 } : assigned
    ));
    setShowSlotAssignModal(false);
  };

  const getShelfProductForIndex = (index) => {
    if (!facingProducts.length) return null;
    return facingProducts[index % facingProducts.length];
  };

  const getAssignedProductForIndex = (index) => {
    const productId = slotAssignments[index]?.productId;
    if (!productId) return null;
    return articles.find((article) => article.id === productId) || null;
  };

  const getAssignedDepthForIndex = (index) => Number(slotAssignments[index]?.depth || 0);

  const getProductSlotLabel = (productName = '') => {
    const shortName = productName.replace(/^Warda Bidha\s+/i, '').trim().split(' ')[0] || 'Pasta';
    return shortName.slice(0, 3).toUpperCase();
  };

  const getFacingCompliance = () => {
    const expected = facingGridCells.length;
    if (!expected) return 0;
    const matchedSlots = facingGridCells.reduce((count, isVisible, index) => {
      if (!isVisible) return count;
      const expectedProduct = getShelfProductForIndex(index);
      const assignedProductId = slotAssignments[index]?.productId;
      if (!assignedProductId || assignedProductId !== expectedProduct?.id) return count;
      return count + 1;
    }, 0);
    return Math.round((matchedSlots / expected) * 100);
  };

  const getFacingMismatchCount = () => {
    let mismatchCount = 0;
    for (let i = 0; i < facingGridCells.length; i += 1) {
      if (!facingGridCells[i]) continue;
      const expectedProduct = getShelfProductForIndex(i);
      const assignedProductId = slotAssignments[i]?.productId;
      if (!assignedProductId || assignedProductId !== expectedProduct?.id) mismatchCount += 1;
    }
    return mismatchCount;
  };

  const getObservedCountForProduct = (productId) =>
    slotAssignments.reduce((count, assignment, index) => {
      if (!facingGridCells[index]) return count;
      return assignment?.productId === productId ? count + Number(assignment?.depth || 0) : count;
    }, 0);

  const getTotalObservedUnits = () =>
    slotAssignments.reduce((total, assignment, index) => {
      if (!facingGridCells[index]) return total;
      return total + Number(assignment?.depth || 0);
    }, 0);

  const getSimpleObservedCountForProduct = (productId) => Number(simpleFacingCounts[productId] || 0);

  const getSimpleTotalObservedUnits = () =>
    facingProducts.reduce((sum, product) => sum + getSimpleObservedCountForProduct(product.id), 0);

  const getSimpleFacingCompliance = () => {
    const expectedTotal = facingProducts.reduce((sum, product) => sum + Number(expectedTargetsFromGrid[product.id] || 0), 0);
    if (!expectedTotal) return 0;
    const matchedTotal = facingProducts.reduce((sum, product) => {
      const expected = Number(expectedTargetsFromGrid[product.id] || 0);
      const observed = getSimpleObservedCountForProduct(product.id);
      return sum + Math.min(expected, observed);
    }, 0);
    return Math.round((matchedTotal / expectedTotal) * 100);
  };

  const handleSimpleFacingCountChange = (productId, value) => {
    const normalized = value.replace(/[^\d]/g, '');
    setSimpleFacingCounts((current) => ({
      ...current,
      [productId]: normalized === '' ? 0 : Number(normalized),
    }));
  };

  const handleSimpleFacingAdjust = (productId, delta) => {
    setSimpleFacingCounts((current) => {
      const nextValue = Math.max(0, Number(current[productId] || 0) + delta);
      return { ...current, [productId]: nextValue };
    });
  };

  const handleAssignProductFromSummary = (productId) => {
    const expected = Number(expectedTargetsFromGrid[productId] || 0);
    const observed = getObservedCountForProduct(productId);
    let remaining = Math.max(expected - observed, 0);
    if (!remaining) { Alert.alert('Already Complete', 'Observed quantity already meets expected target.'); return; }
    const visibleSlots = facingGridCells.map((isVisible, index) => (isVisible ? index : null)).filter((index) => index !== null);
    if (!visibleSlots.length) { Alert.alert('No Visible Slots', 'Mark at least one slot as visible before assigning products.'); return; }
    const nextAssignments = slotAssignments.map((assignment) => ({
      productId: assignment?.productId || null,
      depth: Number(assignment?.depth || 0),
    }));
    for (let i = 0; i < visibleSlots.length && remaining > 0; i += 1) {
      const slotIndex = visibleSlots[i];
      const slot = nextAssignments[slotIndex];
      if (slot.productId !== productId) continue;
      const canAdd = Math.max(0, MAX_STACK_DEPTH - Number(slot.depth || 0));
      if (!canAdd) continue;
      const toAdd = Math.min(canAdd, remaining);
      slot.depth = Number(slot.depth || 0) + toAdd;
      remaining -= toAdd;
    }
    for (let i = 0; i < visibleSlots.length && remaining > 0; i += 1) {
      const slotIndex = visibleSlots[i];
      const slot = nextAssignments[slotIndex];
      if (slot.productId) continue;
      const toPlace = Math.min(MAX_STACK_DEPTH, remaining);
      nextAssignments[slotIndex] = { productId, depth: toPlace };
      remaining -= toPlace;
    }
    setSlotAssignments(nextAssignments);
    if (remaining > 0) {
      Alert.alert('Partial Assignment', `Assigned what fits. ${remaining} unit(s) still not placed.`);
      return;
    }
    Alert.alert('Assigned', 'Observed grid updated for this product.');
  };

  const handleTakeFacingProofPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Denied', 'Camera permission is required'); return; }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) setFacingProofPhoto(result.assets[0]);
    } catch (error) {
      console.error('Facing proof photo error:', error);
      Alert.alert('Error', 'Failed to capture aisle photo');
    }
  };

  const handleSaveStockUpdates = () => {
    const totalObserved = getSimpleTotalObservedUnits();
    if (totalObserved <= 0) {
      Alert.alert('No Data', 'Add observed facings for at least one product before saving.');
      return;
    }

    Alert.alert('Save Facing Updates', 'Save quick facing counts for this visit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: async () => {
          const facingPayload = {
            mode: 'simple',
            rows: Number(facingGridRows || 0),
            columns: Number(facingGridColumns || 0),
            totalObservedUnits: totalObserved,
            proofPhotoUri: facingProofPhoto?.uri || null,
            productSummary: facingProducts.map((product) => {
              const expected = Number(expectedTargetsFromGrid[product.id] || 0);
              const observed = getSimpleObservedCountForProduct(product.id);
              return { productId: product.id, productName: product.name, expected, observed, gap: observed - expected };
            }),
          };
          try { await visitService.patchVisit(visitId, { facing_data: facingPayload }); } catch (e) { console.error('Failed to save facing_data:', e); }
          setStockUpdateCompleted(true);
          await saveVisitProgress(visitId, { stockUpdateCompleted: true });
          setShowStockModal(false);
          Alert.alert('Success', 'Facing updates saved!');
        },
      },
    ]);
  };

  // Price comparison handlers
  const handleCompetitorPriceChange = (itemId, value) => {
    const normalizedValue = value.replace(',', '.').replace(/[^\d.]/g, '');
    setPriceComparisons((current) =>
      current.map((item) => item.id === itemId ? { ...item, competitorPrice: normalizedValue } : item)
    );
  };

  const handleCompetitorFacingChange = (itemId, value) => {
    const normalizedValue = value.replace(/[^\d]/g, '');
    setPriceComparisons((current) =>
      current.map((item) => item.id === itemId ? { ...item, competitorFacing: normalizedValue } : item)
    );
  };

  const handlePriceComparisonPhoto = async (itemId) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusée', "L'accès à la caméra est requis"); return; }
      Alert.alert('Ajouter une photo', 'Choisissez la source', [
        {
          text: 'Caméra',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
            if (!result.canceled && result.assets[0]) {
              setPriceComparisons((current) => current.map((item) => item.id === itemId ? { ...item, photo: result.assets[0] } : item));
            }
          },
        },
        {
          text: 'Galerie',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
            if (!result.canceled && result.assets[0]) {
              setPriceComparisons((current) => current.map((item) => item.id === itemId ? { ...item, photo: result.assets[0] } : item));
            }
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ]);
    } catch (error) {
      console.error('Photo error:', error);
    }
  };

  const handleSavePriceComparison = async () => {
    const filledComparisons = priceComparisons
      .filter((pc) => pc.competitorPrice && pc.competitorPrice.trim() !== '')
      .map((pc) => ({
        productName: pc.name,
        ourPrice: pc.ourPrice,
        competitorPrice: parseFloat(pc.competitorPrice.replace(',', '.')) || 0,
        competitorFacing: pc.competitorFacing ? parseInt(pc.competitorFacing) : null,
        competitor: competitorName,
        hasPhoto: !!pc.photo,
      }));
    try { await visitService.patchVisit(visitId, { price_comparisons: filledComparisons }); } catch (e) { console.error('Failed to save price_comparisons:', e); }
    setPriceComparisonCompleted(true);
    await saveVisitProgress(visitId, { priceComparisonCompleted: true });
    setShowPriceModal(false);
    Alert.alert('Saved', 'Price comparison has been recorded for this visit.');
  };

  // Alert handlers
  const ALERT_TYPES = [
    { value: 'promotion', label: 'Promotion' },
    { value: 'price_change', label: 'Changement de prix' },
    { value: 'new_product', label: 'Nouveau produit' },
    { value: 'competitor_activity', label: 'Activité concurrent' },
  ];

  const handleOpenAlertModal = () => {
    setAlertBrand(''); setAlertType(''); setAlertDescription(''); setAlertPhoto(null); setShowAlertTypeDropdown(false);
    setShowAlertModal(true);
  };

  const handleAlertTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { Alert.alert('Permission requise', "Autorisez l'accès à la caméra."); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
      if (!result.canceled && result.assets?.[0]) setAlertPhoto(result.assets[0]);
    } catch (err) { console.error('Camera error:', err); }
  };

  const handleSubmitAlert = async () => {
    if (!alertBrand.trim()) { Alert.alert('Requis', 'Entrez la marque concurrente.'); return; }
    if (!alertType) { Alert.alert('Requis', "Sélectionnez un type d'alerte."); return; }
    if (!alertDescription.trim()) { Alert.alert('Requis', 'Décrivez la situation.'); return; }
    if (!alertPhoto) { Alert.alert('Requis', 'Ajoutez une photo comme preuve.'); return; }
    try {
      const formData = new FormData();
      formData.append('alert_type', alertType);
      formData.append('competitor_brand', alertBrand.trim());
      formData.append('store', visit?.store || store?.id || '');
      formData.append('visit', visitId || '');
      formData.append('description', alertDescription.trim());
      formData.append('photo', { uri: alertPhoto.uri, type: 'image/jpeg', name: 'alert_photo.jpg' });
      await api.post('/merchandising/competitor-alerts/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAlertCompleted(true);
      await saveVisitProgress(visitId, { alertCompleted: true });
      setShowAlertModal(false);
      Alert.alert('Succès', 'Alerte concurrent envoyée avec succès.');
    } catch (err) {
      console.error('Alert submit error:', err);
      Alert.alert('Erreur', err.response?.data?.detail || "Échec de l'envoi.");
    }
  };

  // Product handlers
  const PRODUCT_CATEGORIES = [
    { value: 'food', label: 'Alimentaire' },
    { value: 'beauty', label: 'Beauté & Soins' },
    { value: 'home', label: 'Maison & Jardin' },
    { value: 'clothing', label: 'Vêtements' },
    { value: 'electronics', label: 'Électronique' },
    { value: 'sports', label: 'Sports' },
    { value: 'other', label: 'Autre' },
  ];

  const handleAddProduct = () => {
    setProductName(''); setProductBrand(''); setProductCategory(''); setProductPrice('');
    setProductSku(''); setProductDescription(''); setProductPhoto(null);
    setShowProductCategoryDropdown(false); setShowProductModal(true);
  };

  const handleProductTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { Alert.alert('Permission requise', "Autorisez l'accès à la caméra."); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
      if (!result.canceled && result.assets?.[0]) setProductPhoto(result.assets[0]);
    } catch (err) { console.error('Camera error:', err); }
  };

  const handleSubmitProduct = async () => {
    if (!productName.trim()) { Alert.alert('Requis', 'Entrez le nom du produit.'); return; }
    if (!productCategory) { Alert.alert('Requis', 'Sélectionnez une catégorie.'); return; }
    if (!productPrice.trim()) { Alert.alert('Requis', 'Entrez le prix du produit.'); return; }
    try {
      const sku = productSku.trim() || `SKU-${Date.now()}`;
      const data = {
        name: productName.trim(),
        brand: productBrand.trim() || null,
        category: productCategory,
        price: parseFloat(productPrice.replace(',', '.')),
        sku,
        description: productDescription.trim() || null,
        store: visit?.store || store?.id || null,
        is_active: true,
      };
      await productService.createProduct(data);
      setProductCompleted(true);
      await saveVisitProgress(visitId, { productCompleted: true });
      setShowProductModal(false);
      Alert.alert('Succès', 'Produit ajouté avec succès.');
    } catch (err) {
      console.error('Product submit error:', err);
      const detail = err.response?.data;
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || "Échec de l'ajout.");
      Alert.alert('Erreur', msg);
    }
  };

  const handleToggleArticleRupture = (articleId) => {
    setArticles((currentArticles) =>
      currentArticles.map((article) =>
        article.id === articleId ? { ...article, isRupture: !article.isRupture } : article
      )
    );
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  const completionPercentage = calculateCompletionPercentage();
  const gpsStatus = getGPSStatus();
  const isCheckedIn = !!checkInTime;
  const isVisitCompleted = visit?.status === 'completed';
  const canCheckOut = isCheckedIn && !isVisitCompleted;
  const scheduleLabel = visit?.scheduled_date ? formatTime(visit.scheduled_date) : 'Not scheduled';

  const visitStatusConfig = isVisitCompleted
    ? { label: 'VISITE TERMINEE', color: '#16a34a', bg: '#dcfce7' }
    : isCheckedIn
      ? { label: 'VISITE ACTIVE', color: '#ffffff', bg: '#2563eb' }
      : { label: 'VISITE PLANIFIEE', color: '#1d4ed8', bg: '#dbeafe' };

  const quickActions = [
    {
      key: 'anomaly',
      title: 'Anomalie',
      icon: 'alert-octagon-outline',
      accent: '#2563eb', // Red accent
      background: '#dbeafe', // Light red background
      onPress: () => navigation.navigate('ReportAnomaly', { visitId }),
      disabled: !isCheckedIn || isVisitCompleted,
      completed: false,
    },
    {
      key: 'facing',
      title: 'Saisi Facing',
      icon: 'view-grid-plus-outline',
      accent: '#2563eb',
      background: '#dbeafe',
      onPress: handleOpenStockModal,
      disabled: !isCheckedIn || isVisitCompleted,
      completed: stockUpdateCompleted,
    },
    {
      key: 'pricing',
      title: 'Prix Concurrents',
      icon: 'tag-outline',
      accent: '#2563eb',
      background: '#dbeafe',
      onPress: handleCompetitorPrices,
      disabled: !isCheckedIn || isVisitCompleted,
      completed: priceComparisonCompleted,
    },
    {
      key: 'product',
      title: 'Ajout Produit',
      icon: 'plus-circle-outline',
      accent: '#2563eb',
      background: '#dbeafe',
      onPress: handleAddProduct,
      disabled: !isCheckedIn || isVisitCompleted,
      completed: productCompleted,
    },
    {
      key: 'alert',
      title: 'Alerte Concurrent',
      icon: 'bell-alert-outline',
      accent: '#2563eb',
      background: '#dbeafe',
      onPress: handleOpenAlertModal,
      disabled: !isCheckedIn || isVisitCompleted,
      completed: alertCompleted,
    },
  ];

  const recentActivities = [
    isCheckedIn && {
      key: 'checkin',
      title: 'Visite demarree',
      subtitle: `${store?.name || visit?.store_name || 'Magasin'} • ${formatTime(checkInTime)}`,
      icon: 'play-circle-outline',
      iconColor: '#10b981',
      iconBackground: '#e8fbf2',
    },
    stockUpdateCompleted && {
      key: 'facing',
      title: 'Facing valide',
      subtitle: `Grille ${facingGridRows || 0} x ${facingGridColumns || 0} • ${facingGridCells.filter(Boolean).length}/${facingGridCells.length} visibles`,
      icon: 'check-circle-outline',
      iconColor: '#10b981',
      iconBackground: '#e8fbf2',
    },
    notes?.trim() && {
      key: 'notes',
      title: 'Infos magasin',
      subtitle: 'Notes de visite mises a jour',
      icon: 'text-box-outline',
      iconColor: '#f59e0b',
      iconBackground: '#fff8e8',
    },
  ].filter(Boolean);

  const filteredArticles = articles.filter((article) => {
    const haystack = `${article.name} ${article.meta}`.toLowerCase();
    return haystack.includes(articleQuery.trim().toLowerCase());
  });

  // FIX: use areRequiredEventsCompleted in footer disabled logic
  const footerButtonLabel = isVisitCompleted
    ? 'VISITE CLOTUREE'
    : isCheckedIn
      ? 'CLOTURER LA VISITE'
      : 'DEMARRER LA VISITE';

  // Enable button for check-in unless visit is completed
  const footerButtonDisabled = isVisitCompleted;

  const footerButtonHandler = isCheckedIn ? handleCheckOut : handleCheckIn;

  const renderEventsTab = () => (
    <>
      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={[styles.quickActionCard, action.disabled && styles.quickActionCardDisabled]}
            activeOpacity={0.85}
            disabled={action.disabled || !action.onPress}
            onPress={action.onPress || undefined}
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: action.background }]}>
              <MaterialCommunityIcons name={action.icon} size={26} color={action.accent} />
            </View>
            <Text style={[styles.quickActionTitle, action.disabled && styles.quickActionTitleDisabled]}>
              {action.title}
            </Text>
            {action.completed && (
              <View style={styles.quickActionDoneBadge}>
                <MaterialCommunityIcons name="check" size={12} color="#16a34a" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.activitySection}>
        <Text style={styles.sectionEyebrow}>ACTIVITES RECENTES</Text>
        {recentActivities.length === 0 ? (
          <View style={styles.emptyActivityCard}>
            <Text style={styles.emptyActivityText}>Aucune activite enregistree pour le moment.</Text>
          </View>
        ) : (
          recentActivities.map((activity) => (
            <View key={activity.key} style={styles.activityCard}>
              <View style={[styles.activityIconWrap, { backgroundColor: activity.iconBackground }]}>
                <MaterialCommunityIcons name={activity.icon} size={18} color={activity.iconColor} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </>
  );

  const renderArticlesTab = () => (
    <View style={styles.tabPanel}>
      <View style={styles.articleToolbar}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color="#c0c6d4" />
          <TextInput
            style={styles.searchInput}
            value={articleQuery}
            onChangeText={setArticleQuery}
            placeholder="Rechercher un produit..."
            placeholderTextColor="#a0a8b8"
          />
        </View>
        <TouchableOpacity style={styles.filterButton} activeOpacity={0.85}>
          <MaterialCommunityIcons name="tune-variant" size={20} color="#7b8798" />
        </TouchableOpacity>
      </View>

      {filteredArticles.map((article) => {
        const isActive = article.isRupture;
        return (
          <TouchableOpacity key={article.id} style={[styles.articleCard, isActive && styles.articleCardActive]} activeOpacity={0.9}>
            <View style={[styles.articleThumb, { backgroundColor: article.color }]}>
              <MaterialCommunityIcons name={article.icon} size={28} color="#ffffff" />
            </View>
            <View style={styles.articleDetails}>
              <Text style={styles.articleName} numberOfLines={1}>{article.name}</Text>
              <Text style={styles.articleMeta}>{article.meta}</Text>
              <Text style={styles.articlePrice}>{article.price}</Text>
            </View>
            <TouchableOpacity
              style={[styles.ruptureBadge, isActive && styles.ruptureBadgeActive]}
              activeOpacity={0.85}
              onPress={() => handleToggleArticleRupture(article.id)}
            >
              <Text style={[styles.ruptureBadgeText, isActive && styles.ruptureBadgeTextActive]}>
                {isActive ? 'RUPTURE' : 'EN STOCK'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}

      {filteredArticles.length === 0 && (
        <View style={styles.emptyArticleState}>
          <MaterialCommunityIcons name="package-variant-closed" size={40} color="#c8cfdb" />
          <Text style={styles.emptyArticleText}>Aucun article ne correspond a votre recherche.</Text>
        </View>
      )}
    </View>
  );

  const renderStoreInfoTab = () => (
    <View style={styles.tabPanel}>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Heure prevue</Text>
          <Text style={styles.infoValue}>{scheduleLabel}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>GPS</Text>
          <Text style={[styles.infoValue, { color: gpsStatus.color }]}>{gpsStatus.text}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Progression</Text>
          <Text style={styles.infoValue}>{completionPercentage}%</Text>
        </View>
      </View>

      <Text style={styles.sectionEyebrow}>INFOS MAGASIN</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="Ajouter des observations sur le magasin..."
        placeholderTextColor="#9ca3af"
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        editable={!isVisitCompleted}
      />

      <TouchableOpacity
        style={[styles.secondaryButton, isVisitCompleted && styles.secondaryButtonDisabled]}
        onPress={handleSubmitVisit}
        disabled={isVisitCompleted}
      >
        <MaterialCommunityIcons name="content-save-outline" size={18} color={isVisitCompleted ? '#94a3b8' : '#111827'} />
        <Text style={[styles.secondaryButtonText, isVisitCompleted && styles.secondaryButtonTextDisabled]}>
          Enregistrer les notes
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderActiveTab = () => {
    if (activeTab === 'articles') return renderArticlesTab();
    if (activeTab === 'store-info') return renderStoreInfoTab();
    return renderEventsTab();
  };

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Visit Store</Text>
          <TouchableOpacity style={styles.headerButton}>
            <MaterialCommunityIcons name="dots-vertical" size={24} color="#111" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {isVisitCompleted && (
            <View style={styles.completedBanner}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
              <View style={styles.completedBannerContent}>
                <Text style={styles.completedBannerTitle}>Visit Completed</Text>
                <Text style={styles.completedBannerText}>This visit has been completed and is now read-only</Text>
              </View>
            </View>
          )}

          {/* Hero card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTextWrap}>
                <Text style={styles.storeName}>{store?.name || visit?.store_name || 'Unknown Store'}</Text>
                <View style={styles.addressRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={14} color="#6b7280" />
                  <Text style={styles.storeAddress}>{store?.address || store?.location || 'Address not available'}</Text>
                </View>
              </View>
              <View style={[styles.visitStatusChip, { backgroundColor: visitStatusConfig.bg }]}>
                <Text style={[styles.visitStatusChipText, { color: visitStatusConfig.color }]}>
                  {visitStatusConfig.label}
                </Text>
              </View>
            </View>

            <View style={styles.heroMetaRow}>
              <View style={styles.timerBox}>
                <Text style={styles.timerValue}>{isCheckedIn ? elapsedTime : scheduleLabel}</Text>
                <Text style={styles.timerLabel}>{isCheckedIn ? 'Temps sur place' : 'Heure prevue'}</Text>
              </View>
              <View style={styles.progressBox}>
                <Text style={styles.progressValue}>{completionPercentage}%</Text>
                <Text style={styles.progressLabel}>Execution</Text>
              </View>
            </View>
          </View>

          {/* Tab bar */}
          <View style={styles.tabBar}>
            {[
              { key: 'articles', label: 'Articles' },
              { key: 'events', label: 'Evenements' },
              { key: 'store-info', label: 'Infos Magasin' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {renderActiveTab()}

          <View style={styles.syncStatus}>
            <MaterialCommunityIcons name="cloud-sync" size={16} color="#2563eb" />
            <Text style={styles.syncText}>CLOUD SYNC ACTIVE</Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footerCtaWrap}>
          {isCheckedIn && !isVisitCompleted && !areRequiredEventsCompleted() && (
            <Text style={styles.footerHelperText}>
              Complete Photos, Facing & Price Comparison to check out
            </Text>
          )}
          <TouchableOpacity
            style={[styles.footerCtaButton, footerButtonDisabled && styles.footerCtaButtonDisabled]}
            onPress={footerButtonHandler}
            disabled={footerButtonDisabled}
            activeOpacity={0.9}
          >
            <MaterialCommunityIcons name={isCheckedIn ? 'logout-variant' : 'login-variant'} size={20} color="#fff" />
            <Text style={styles.footerCtaText}>{footerButtonLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Photo Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={showPhotoModal} animationType="slide" transparent={false} onRequestClose={() => setShowPhotoModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPhotoModal(false)}>
              <MaterialCommunityIcons name="close" size={28} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Before / After Photos</Text>
            <TouchableOpacity onPress={handleTakePhoto}>
              <MaterialCommunityIcons name="camera-plus" size={28} color="#2563eb" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {photos.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="camera-off" size={64} color="#9ca3af" />
                <Text style={styles.emptyStateText}>No photos yet</Text>
                <Text style={styles.emptyStateSubtext}>Tap the + button to add photos</Text>
              </View>
            ) : (
              <View style={styles.photoGrid}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoCard}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                    <TouchableOpacity style={styles.deletePhotoButton} onPress={() => handleDeletePhoto(index)}>
                      <MaterialCommunityIcons name="delete" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.photoLabel}>Photo {index + 1}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Text style={styles.photoCount}>{photos.length} / 4 photos uploaded</Text>
            <TouchableOpacity
              style={[styles.modalButton, photos.length >= 4 && styles.modalButtonSuccess]}
              onPress={() => setShowPhotoModal(false)}
            >
              <Text style={styles.modalButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Facing Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={showStockModal} animationType="slide" transparent={false} onRequestClose={() => setShowStockModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowStockModal(false)}>
              <MaterialCommunityIcons name="close" size={28} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Saisi Facing</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.facingSummaryBox}>
            <Text style={styles.facingSummaryLabel}>Quick Compliance</Text>
            <Text style={styles.facingSummaryValue}>{getSimpleFacingCompliance()}%</Text>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.unifiedFacingCard}>
              <Text style={styles.comparisonLabel}>SAISI FACING RAPIDE</Text>
              <Text style={styles.unifiedFacingHint}>Count facings per product. Use +/- for quick entry.</Text>

              <View style={styles.facingProofRow}>
                <TouchableOpacity style={styles.facingProofButton} onPress={handleTakeFacingProofPhoto}>
                  <MaterialCommunityIcons name="camera-outline" size={16} color="#1d4ed8" />
                  <Text style={styles.facingProofButtonText}>
                    {facingProofPhoto ? 'Retake Aisle Photo' : 'Add Aisle Photo (optional)'}
                  </Text>
                </TouchableOpacity>
                {facingProofPhoto && (
                  <Image source={{ uri: facingProofPhoto.uri }} style={styles.facingProofThumb} />
                )}
              </View>

              <View style={styles.simpleFacingList}>
                {facingProducts.map((product) => {
                  const expected = Number(expectedTargetsFromGrid[product.id] || 0);
                  const observed = getSimpleObservedCountForProduct(product.id);
                  const gap = observed - expected;
                  return (
                    <View key={`simple-facing-${product.id}`} style={styles.simpleFacingCard}>
                      <View style={styles.simpleFacingTopRow}>
                        <View style={[styles.productQtySwatch, { backgroundColor: product.color }]} />
                        <View style={styles.simpleFacingTextWrap}>
                          <Text style={styles.simpleFacingName} numberOfLines={1}>{product.name}</Text>
                          <Text style={styles.simpleFacingMeta}>Expected: {expected}</Text>
                        </View>
                        <View style={[styles.productQtyGapBadge, gap < 0 ? styles.productQtyGapNegative : styles.productQtyGapPositive]}>
                          <Text style={styles.productQtyGapText}>{gap >= 0 ? `+${gap}` : `${gap}`}</Text>
                        </View>
                      </View>

                      <View style={styles.simpleFacingControls}>
                        <TouchableOpacity style={styles.simpleFacingBtn} onPress={() => handleSimpleFacingAdjust(product.id, -1)}>
                          <MaterialCommunityIcons name="minus" size={16} color="#334155" />
                        </TouchableOpacity>
                        <TextInput
                          style={styles.simpleFacingInput}
                          value={String(observed)}
                          onChangeText={(value) => handleSimpleFacingCountChange(product.id, value)}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor="#94a3b8"
                        />
                        <TouchableOpacity style={styles.simpleFacingBtn} onPress={() => handleSimpleFacingAdjust(product.id, 1)}>
                          <MaterialCommunityIcons name="plus" size={16} color="#334155" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.unifiedFacingStats}>Total observed units: {getSimpleTotalObservedUnits()}</Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveStockUpdates}>
              <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Quick Facing</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.closeButton]} onPress={() => setShowStockModal(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Price Modal ──────────────────────────────────────────────────────── */}
      <Modal visible={showPriceModal} animationType="slide" transparent={false} onRequestClose={() => setShowPriceModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPriceModal(false)}>
              <MaterialCommunityIcons name="close" size={28} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Prix Concurrents</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.comparisonLabel}>NOM DU CONCURRENT</Text>
            <View style={styles.ownerChipWrap}>
              {OWNER_BRANDS.map((brand) => {
                const isActive = competitorName === brand;
                return (
                  <TouchableOpacity
                    key={brand}
                    style={[styles.ownerChip, isActive && styles.ownerChipActive]}
                    onPress={() => setCompetitorName(brand)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.ownerChipText, isActive && styles.ownerChipTextActive]}>{brand}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.comparisonInput}
              value={competitorName}
              onChangeText={setCompetitorName}
              placeholder="Entrer le nom du concurrent (marque)"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.comparisonLabel}>COMPARAISON DES PRIX</Text>
            {priceComparisons.map((item) => {
              const parsedCompetitorPrice = Number(item.competitorPrice);
              const hasCompetitorPrice = item.competitorPrice !== '' && Number.isFinite(parsedCompetitorPrice);
              const diff = hasCompetitorPrice ? parsedCompetitorPrice - item.ourPrice : null;
              const isEqual = hasCompetitorPrice && diff === 0;
              const weAreCheaper = hasCompetitorPrice && diff > 0;
              const competitorCheaper = hasCompetitorPrice && diff < 0;

              return (
                <View key={item.id} style={styles.comparisonCard}>
                  <Text style={styles.comparisonProductName}>{item.name}</Text>
                  <View style={styles.comparisonPriceRow}>
                    <View style={styles.comparisonPriceBox}>
                      <Text style={styles.comparisonPriceLabel}>Notre Prix</Text>
                      <Text style={styles.comparisonPriceValue}>{formatTndPrice(item.ourPrice)}</Text>
                    </View>
                    <View style={styles.comparisonPriceBox}>
                      <Text style={styles.comparisonPriceLabel}>{competitorName || 'Concurrent'}</Text>
                      <TextInput
                        style={styles.comparisonPriceInput}
                        value={item.competitorPrice}
                        onChangeText={(value) => handleCompetitorPriceChange(item.id, value)}
                        placeholder="0.000"
                        placeholderTextColor="#9ca3af"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  {hasCompetitorPrice && (
                    <View style={[
                      styles.comparisonDiffBadge,
                      weAreCheaper ? styles.comparisonDiffPositive : competitorCheaper ? styles.comparisonDiffNegative : styles.comparisonDiffNeutral,
                    ]}>
                      <Text style={[
                        styles.comparisonDiffText,
                        weAreCheaper && { color: '#16a34a' },
                        competitorCheaper && { color: '#dc2626' },
                        isEqual && { color: '#6b7280' },
                      ]}>
                        {weAreCheaper
                          ? `✅ On est moins cher (${formatTndPrice(Math.abs(diff))})`
                          : competitorCheaper
                            ? `❌ Concurrent moins cher (${formatTndPrice(Math.abs(diff))})`
                            : '➡️ Même prix'}
                      </Text>
                    </View>
                  )}

                  {/* FIX: Competitor Facing field restored */}
                  <View style={styles.comparisonFacingRow}>
                    <Text style={styles.comparisonFacingLabel}>Facing Concurrent</Text>
                    <TextInput
                      style={styles.comparisonFacingInput}
                      value={item.competitorFacing}
                      onChangeText={(value) => handleCompetitorFacingChange(item.id, value)}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      keyboardType="number-pad"
                    />
                  </View>

                  {/* FIX: Photo field restored */}
                  {item.photo ? (
                    <View style={styles.comparisonPhotoPreviewWrap}>
                      <Image source={{ uri: item.photo.uri }} style={styles.comparisonPhotoPreview} />
                      <TouchableOpacity style={styles.comparisonPhotoChangeBtn} onPress={() => handlePriceComparisonPhoto(item.id)}>
                        <MaterialCommunityIcons name="camera-retake-outline" size={16} color="#2563eb" />
                        <Text style={styles.comparisonPhotoChangeBtnText}>Changer</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.comparisonPhotoBtn} onPress={() => handlePriceComparisonPhoto(item.id)}>
                      <MaterialCommunityIcons name="camera-plus-outline" size={18} color="#6b7280" />
                      <Text style={styles.comparisonPhotoBtnText}>Prendre une Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={{ backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' }}
              onPress={handleSavePriceComparison}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Soumettre la Comparaison</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Alert Modal ──────────────────────────────────────────────────────── */}
      <Modal visible={showAlertModal} animationType="slide" transparent={false} onRequestClose={() => setShowAlertModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAlertModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Alerte Concurrent</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={styles.alertInfoCard}>
              <View style={styles.alertInfoRow}>
                <MaterialCommunityIcons name="store" size={18} color="#6b7280" />
                <Text style={styles.alertInfoLabel}>Magasin</Text>
                <Text style={styles.alertInfoValue}>{store?.name || visit?.store_name || 'N/A'}</Text>
              </View>
              <View style={styles.alertInfoDivider} />
              <View style={styles.alertInfoRow}>
                <MaterialCommunityIcons name="calendar" size={18} color="#6b7280" />
                <Text style={styles.alertInfoLabel}>Date</Text>
                <Text style={styles.alertInfoValue}>{new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
              </View>
            </View>

            <Text style={styles.alertSectionLabel}>Marque concurrente *</Text>
            <TextInput style={styles.alertInput} placeholder="Ex: Coca-Cola, Danone..." placeholderTextColor="#9ca3af" value={alertBrand} onChangeText={setAlertBrand} />

            <Text style={styles.alertSectionLabel}>Type d'alerte *</Text>
            <TouchableOpacity style={styles.alertDropdown} onPress={() => setShowAlertTypeDropdown(!showAlertTypeDropdown)}>
              <Text style={alertType ? styles.alertDropdownText : styles.alertDropdownPlaceholder}>
                {alertType ? ALERT_TYPES.find((t) => t.value === alertType)?.label : 'Sélectionner le type...'}
              </Text>
              <MaterialCommunityIcons name={showAlertTypeDropdown ? 'chevron-up' : 'chevron-down'} size={22} color="#6b7280" />
            </TouchableOpacity>
            {showAlertTypeDropdown && (
              <View style={styles.alertDropdownList}>
                {ALERT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[styles.alertDropdownItem, alertType === type.value && styles.alertDropdownItemActive]}
                    onPress={() => { setAlertType(type.value); setShowAlertTypeDropdown(false); }}
                  >
                    <Text style={[styles.alertDropdownItemText, alertType === type.value && styles.alertDropdownItemTextActive]}>{type.label}</Text>
                    {alertType === type.value && <MaterialCommunityIcons name="check" size={18} color="#2563eb" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.alertSectionLabel}>Description *</Text>
            <TextInput style={styles.alertTextInput} placeholder="Décrivez la situation observée..." placeholderTextColor="#9ca3af" value={alertDescription} onChangeText={setAlertDescription} multiline numberOfLines={4} textAlignVertical="top" />

            <Text style={styles.alertSectionLabel}>Photo (preuve visuelle) *</Text>
            {alertPhoto ? (
              <View style={styles.alertPhotoContainer}>
                <Image source={{ uri: alertPhoto.uri }} style={styles.alertPhotoPreview} />
                <TouchableOpacity onPress={() => setAlertPhoto(null)} style={styles.alertRemovePhoto}>
                  <MaterialCommunityIcons name="close-circle" size={28} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.alertPhotoBtn} onPress={handleAlertTakePhoto}>
                <MaterialCommunityIcons name="camera" size={24} color="#2563eb" />
                <Text style={styles.alertPhotoBtnText}>Prendre photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.alertSubmitBtn} onPress={handleSubmitAlert}>
              <MaterialCommunityIcons name="send" size={20} color="#fff" />
              <Text style={styles.alertSubmitBtnText}>Envoyer l'alerte</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Product Modal ────────────────────────────────────────────────────── */}
      <Modal visible={showProductModal} animationType="slide" transparent={false} onRequestClose={() => setShowProductModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProductModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Ajout Produit</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.alertSectionLabel}>Nom du produit *</Text>
            <TextInput style={styles.alertInput} placeholder="Ex: Lait Délice 1L..." placeholderTextColor="#9ca3af" value={productName} onChangeText={setProductName} />

            <Text style={styles.alertSectionLabel}>Marque</Text>
            <TextInput style={styles.alertInput} placeholder="Ex: Délice, Vitalait..." placeholderTextColor="#9ca3af" value={productBrand} onChangeText={setProductBrand} />

            <Text style={styles.alertSectionLabel}>Catégorie *</Text>
            <TouchableOpacity style={styles.alertDropdown} onPress={() => setShowProductCategoryDropdown(!showProductCategoryDropdown)}>
              <Text style={productCategory ? styles.alertDropdownText : styles.alertDropdownPlaceholder}>
                {productCategory ? PRODUCT_CATEGORIES.find((c) => c.value === productCategory)?.label : 'Sélectionner...'}
              </Text>
              <MaterialCommunityIcons name={showProductCategoryDropdown ? 'chevron-up' : 'chevron-down'} size={22} color="#6b7280" />
            </TouchableOpacity>
            {showProductCategoryDropdown && (
              <View style={styles.alertDropdownList}>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.alertDropdownItem, productCategory === cat.value && styles.alertDropdownItemActive]}
                    onPress={() => { setProductCategory(cat.value); setShowProductCategoryDropdown(false); }}
                  >
                    <Text style={[styles.alertDropdownItemText, productCategory === cat.value && styles.alertDropdownItemTextActive]}>{cat.label}</Text>
                    {productCategory === cat.value && <MaterialCommunityIcons name="check" size={18} color="#2563eb" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.alertSectionLabel}>Prix (TND) *</Text>
            <TextInput style={styles.alertInput} placeholder="Ex: 2.450" placeholderTextColor="#9ca3af" value={productPrice} onChangeText={setProductPrice} keyboardType="decimal-pad" />

            <Text style={styles.alertSectionLabel}>Code / SKU</Text>
            <TextInput style={styles.alertInput} placeholder="Optionnel - code barre..." placeholderTextColor="#9ca3af" value={productSku} onChangeText={setProductSku} />

            <Text style={styles.alertSectionLabel}>Description</Text>
            <TextInput style={styles.alertTextInput} placeholder="Description du produit..." placeholderTextColor="#9ca3af" value={productDescription} onChangeText={setProductDescription} multiline numberOfLines={3} textAlignVertical="top" />

            <Text style={styles.alertSectionLabel}>Photo du produit</Text>
            {productPhoto ? (
              <View style={styles.alertPhotoContainer}>
                <Image source={{ uri: productPhoto.uri }} style={styles.alertPhotoPreview} />
                <TouchableOpacity onPress={() => setProductPhoto(null)} style={styles.alertRemovePhoto}>
                  <MaterialCommunityIcons name="close-circle" size={28} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.alertPhotoBtn} onPress={handleProductTakePhoto}>
                <MaterialCommunityIcons name="camera" size={24} color="#2563eb" />
                <Text style={styles.alertPhotoBtnText}>Prendre photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.alertSubmitBtn, productSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmitProduct}
              disabled={productSubmitting}
            >
              <MaterialCommunityIcons name="plus-circle" size={20} color="#fff" />
              <Text style={styles.alertSubmitBtnText}>{productSubmitting ? 'Ajout en cours...' : 'Ajouter le produit'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff' },
  headerButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1f2937' },
  content: { flex: 1, paddingHorizontal: 14 },
  contentContainer: { paddingBottom: 120 },
  completedBanner: { backgroundColor: '#d1fae5', borderRadius: 18, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#86efac' },
  completedBannerContent: { flex: 1, marginLeft: 12 },
  completedBannerTitle: { fontSize: 16, fontWeight: '700', color: '#065f46', marginBottom: 4 },
  completedBannerText: { fontSize: 13, color: '#047857', lineHeight: 18 },
  heroCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 4 },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heroTextWrap: { flex: 1 },
  storeName: { fontSize: 27, fontWeight: '800', color: '#1f2937', marginBottom: 6 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  storeAddress: { fontSize: 14, color: '#6b7280', flex: 1 },
  visitStatusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, minWidth: 96, alignItems: 'center' },
  visitStatusChipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  heroMetaRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  timerBox: { flex: 1.15, borderRadius: 18, backgroundColor: '#fff5f5', paddingVertical: 14, paddingHorizontal: 14 },
  progressBox: { flex: 0.85, borderRadius: 18, backgroundColor: '#f4f7fb', paddingVertical: 14, paddingHorizontal: 14 },
  timerValue: { fontSize: 22, fontWeight: '800', color: '#111111', letterSpacing: 1 },
  timerLabel: { fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: '600' },
  progressValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  progressLabel: { fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: '600' },
  tabBar: { flexDirection: 'row', backgroundColor: '#faf5f5', borderRadius: 18, padding: 4, marginBottom: 18 },
  tabButton: { flex: 1, paddingVertical: 11, borderRadius: 14, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  tabButtonText: { fontSize: 13, color: '#94a3b8', fontWeight: '700' },
  tabButtonTextActive: { color: '#2563eb' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  quickActionCard: { width: '48.2%', backgroundColor: '#ffffff', borderRadius: 22, paddingVertical: 26, paddingHorizontal: 14, alignItems: 'center', marginBottom: 14, minHeight: 112, borderWidth: 1, borderColor: '#edf0f5', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2, position: 'relative' },
  quickActionCardDisabled: { opacity: 0.55, borderStyle: 'dashed' },
  quickActionIconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  quickActionTitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#334155' },
  quickActionTitleDisabled: { color: '#94a3b8' },
  quickActionDoneBadge: { position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: 10, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  activitySection: { marginBottom: 10 },
  sectionEyebrow: { fontSize: 12, fontWeight: '700', color: '#b7bfd0', letterSpacing: 1, marginBottom: 12 },
  activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: '#eef2f7' },
  emptyActivityCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#eef2f7' },
  emptyActivityText: { color: '#94a3b8', fontSize: 14 },
  activityIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '800', color: '#334155', marginBottom: 3 },
  activitySubtitle: { fontSize: 12, color: '#94a3b8' },
  tabPanel: { marginBottom: 18 },
  articleToolbar: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  searchBox: { flex: 1, height: 46, borderRadius: 15, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#edf1f6', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#334155', paddingVertical: 0 },
  filterButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#edf1f6', alignItems: 'center', justifyContent: 'center' },
  articleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#eef2f7', paddingHorizontal: 10, paddingVertical: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2 },
  articleCardActive: { borderColor: '#fecaca', backgroundColor: '#fffdfd' },
  articleThumb: { width: 52, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  articleDetails: { flex: 1, paddingRight: 10 },
  articleName: { fontSize: 14, fontWeight: '800', color: '#334155' },
  articleMeta: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
  articlePrice: { fontSize: 22, lineHeight: 24, fontWeight: '800', color: '#2f67ff', marginTop: 6 },
  ruptureBadge: { minWidth: 78, height: 34, borderRadius: 12, borderWidth: 1, borderColor: '#dce4ef', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: '#ffffff' },
  ruptureBadgeActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  ruptureBadgeText: { fontSize: 12, fontWeight: '800', color: '#b2bed1' },
  ruptureBadgeTextActive: { color: '#ffffff' },
  emptyArticleState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 34, backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#eef2f7' },
  emptyArticleText: { fontSize: 14, color: '#94a3b8', marginTop: 10 },
  infoCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#eef2f7', padding: 16, marginBottom: 18 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  infoLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  infoValue: { fontSize: 13, color: '#0f172a', fontWeight: '700', maxWidth: '58%', textAlign: 'right' },
  notesInput: { backgroundColor: '#fff', borderRadius: 18, padding: 16, fontSize: 14, color: '#111', minHeight: 150, borderWidth: 1, borderColor: '#eef2f7', marginBottom: 14 },
  secondaryButton: { borderRadius: 16, backgroundColor: '#f4f7fb', paddingVertical: 14, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  secondaryButtonDisabled: { backgroundColor: '#f8fafc' },
  secondaryButtonText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  secondaryButtonTextDisabled: { color: '#94a3b8' },
  syncStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  syncText: { fontSize: 12, fontWeight: '600', color: '#2563eb', marginLeft: 6, letterSpacing: 0.5 },
  footerCtaWrap: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 18, backgroundColor: '#ffffff' },
  footerHelperText: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  footerCtaButton: { height: 56, borderRadius: 18, backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#2563eb', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
  footerCtaButtonDisabled: { backgroundColor: '#93c5fd', shadowOpacity: 0, elevation: 0 },
  footerCtaText: { fontSize: 16, fontWeight: '800', color: '#ffffff', marginLeft: 8, letterSpacing: 0.5 },
  modalContainer: { flex: 1, backgroundColor: '#f8f9fa' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  modalContent: { flex: 1, padding: 16 },
  modalFooter: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', flexDirection: 'row' },
  modalButton: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalButtonSuccess: { backgroundColor: '#10b981' },
  modalButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyStateText: { fontSize: 18, fontWeight: '600', color: '#6b7280', marginTop: 16 },
  emptyStateSubtext: { fontSize: 14, color: '#9ca3af', marginTop: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoCard: { width: '48%', backgroundColor: '#fff', borderRadius: 12, padding: 8, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  photoImage: { width: '100%', height: 150, borderRadius: 8, backgroundColor: '#e5e7eb' },
  deletePhotoButton: { position: 'absolute', top: 12, right: 12, backgroundColor: '#2563eb', borderRadius: 20, padding: 6 },
  photoLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginTop: 8, textAlign: 'center' },
  photoCount: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 12, textAlign: 'center' },
  facingSummaryBox: { marginHorizontal: 16, marginTop: 12, marginBottom: 2, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  facingSummaryLabel: { fontSize: 13, color: '#1e3a8a', fontWeight: '700' },
  facingSummaryValue: { fontSize: 18, color: '#2563eb', fontWeight: '800' },
  unifiedFacingCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14 },
  unifiedFacingHint: { fontSize: 12, color: '#64748b', marginTop: 10, marginBottom: 8 },
  facingProofRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  facingProofButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  facingProofButtonText: { marginLeft: 6, fontSize: 12, color: '#1d4ed8', fontWeight: '700' },
  facingProofThumb: { width: 42, height: 42, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  unifiedFacingStats: { fontSize: 12, color: '#334155', fontWeight: '700', marginTop: 10 },
  productQtySection: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10 },
  productQtyItem: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8, marginBottom: 4 },
  productQtyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  productQtySwatch: { width: 12, height: 12, borderRadius: 3 },
  productQtyInfo: { flex: 1, minWidth: 0 },
  productQtyName: { fontSize: 12, color: '#0f172a', fontWeight: '700' },
  productQtyMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  productQtyExpectedWrap: { width: 76 },
  productQtyExpectedLabel: { fontSize: 10, color: '#64748b', marginBottom: 3, fontWeight: '700' },
  productQtyExpectedStatic: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center' },
  productQtyExpectedStaticText: { fontSize: 12, color: '#0f172a', fontWeight: '700' },
  productQtyGapBadge: { minWidth: 42, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 8, alignItems: 'center' },
  productQtyGapPositive: { backgroundColor: '#dcfce7' },
  productQtyGapNegative: { backgroundColor: '#fee2e2' },
  productQtyGapText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  productQtyAssignButton: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 2 },
  productQtyAssignText: { marginLeft: 6, fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  simpleFacingList: { marginTop: 12, gap: 10 },
  simpleFacingCard: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 10, backgroundColor: '#f8fafc' },
  simpleFacingTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  simpleFacingTextWrap: { flex: 1, minWidth: 0 },
  simpleFacingName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  simpleFacingMeta: { marginTop: 2, fontSize: 11, color: '#64748b', fontWeight: '600' },
  simpleFacingControls: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  simpleFacingBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  simpleFacingInput: { width: 68, height: 34, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff', textAlign: 'center', fontWeight: '700', color: '#0f172a' },
  comparisonLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.6, marginBottom: 8, marginTop: 6 },
  ownerChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  ownerChip: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  ownerChipActive: { borderColor: '#2563eb', backgroundColor: '#dbeafe' },
  ownerChipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  ownerChipTextActive: { color: '#1d4ed8' },
  comparisonInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0f172a', marginBottom: 12 },
  comparisonCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 12 },
  comparisonProductName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10 },
  comparisonPriceRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  comparisonPriceBox: { flex: 1 },
  comparisonPriceLabel: { fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: '600' },
  comparisonPriceValue: { fontSize: 14, color: '#2563eb', fontWeight: '700', backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10 },
  comparisonPriceInput: { fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  comparisonDiffBadge: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  comparisonDiffPositive: { backgroundColor: '#dcfce7' },
  comparisonDiffNegative: { backgroundColor: '#fee2e2' },
  comparisonDiffNeutral: { backgroundColor: '#f1f5f9' },
  comparisonDiffText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  comparisonFacingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  comparisonFacingLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  comparisonFacingInput: { fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', width: 70, textAlign: 'center' },
  comparisonPhotoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', borderStyle: 'dashed', backgroundColor: '#f9fafb' },
  comparisonPhotoBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  comparisonPhotoPreviewWrap: { marginTop: 10, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  comparisonPhotoPreview: { width: '100%', height: 140, borderRadius: 10, backgroundColor: '#e5e7eb' },
  comparisonPhotoChangeBtn: { position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  comparisonPhotoChangeBtnText: { fontSize: 11, fontWeight: '600', color: '#2563eb' },
  shelfCompareRow: { flexDirection: 'row', gap: 10 },
  shelfCompareScroll: { marginHorizontal: -2 },
  shelfCompareContent: { paddingHorizontal: 2 },
  shelfPanel: { flex: 1, minWidth: 280 },
  shelfPanelTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6 },
  shelfFrame: { flexDirection: 'row', alignItems: 'stretch' },
  shelfRail: { width: 6, borderRadius: 4, backgroundColor: '#94a3b8', marginHorizontal: 4 },
  shelfGridArea: { flex: 1, gap: 10 },
  shelfRowBlock: { gap: 6 },
  shelfLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginLeft: 2 },
  facingGridRowPreview: { flexDirection: 'row', gap: 8 },
  shelfPlank: { height: 5, borderRadius: 3, backgroundColor: '#d1d5db', marginTop: 2 },
  facingGridPreviewWrap: { backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, gap: 10 },
  facingGridCell: { width: 34, height: 44, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  facingCellContent: { alignItems: 'center', justifyContent: 'center' },
  facingProductText: { fontSize: 10, fontWeight: '800', color: '#ffffff' },
  facingDepthText: { fontSize: 9, fontWeight: '800', color: '#ffffff', marginTop: 2 },
  facingGridCellFilled: { backgroundColor: '#34d399', borderColor: '#10b981' },
  facingGridCellMissing: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderStyle: 'dashed' },
  facingGridCellMismatch: { borderColor: '#f59e0b', borderWidth: 2 },
  facingGridCellUnassigned: { borderColor: '#f97316', borderWidth: 2, backgroundColor: '#fde68a' },
  facingLegendRow: { flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap' },
  facingLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  facingLegendDot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  facingLegendText: { fontSize: 12, color: '#475569', fontWeight: '700' },
  slotAssignOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end', zIndex: 50 },
  slotAssignCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, maxHeight: '72%' },
  slotAssignHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  depthControlRow: { marginBottom: 12, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  depthControlLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 8 },
  depthControlActions: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  depthControlButton: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  depthControlInput: { width: 54, marginHorizontal: 8, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#ffffff', textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#0f172a', paddingVertical: 6, paddingHorizontal: 8 },
  slotAssignTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  slotAssignList: { maxHeight: 360 },
  slotAssignItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  slotAssignColor: { width: 16, height: 16, borderRadius: 4, marginRight: 10 },
  slotAssignTextWrap: { flex: 1 },
  slotAssignName: { fontSize: 13, color: '#0f172a', fontWeight: '700' },
  slotAssignMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  slotAssignMissingButton: { marginTop: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  slotAssignMissingText: { marginLeft: 6, color: '#b91c1c', fontSize: 13, fontWeight: '700' },
  saveButton: { backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1, marginRight: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeButton: { backgroundColor: '#f3f4f6', flex: 0.5 },
  closeButtonText: { color: '#374151', fontSize: 16, fontWeight: '600', textAlign: 'center', paddingVertical: 16 },
  alertInfoCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  alertInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertInfoLabel: { fontSize: 13, color: '#6b7280', width: 70 },
  alertInfoValue: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  alertInfoDivider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 10 },
  alertSectionLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 16 },
  alertInput: { backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, fontSize: 14, color: '#111', marginBottom: 4 },
  alertDropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 4 },
  alertDropdownText: { fontSize: 14, color: '#111', fontWeight: '500' },
  alertDropdownPlaceholder: { fontSize: 14, color: '#9ca3af' },
  alertDropdownList: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 4, overflow: 'hidden' },
  alertDropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  alertDropdownItemActive: { backgroundColor: '#eff6ff' },
  alertDropdownItemText: { fontSize: 14, color: '#374151' },
  alertDropdownItemTextActive: { color: '#2563eb', fontWeight: '600' },
  alertTextInput: { backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, fontSize: 14, color: '#111', minHeight: 100, marginBottom: 4 },
  alertPhotoContainer: { alignItems: 'center', marginBottom: 16, position: 'relative' },
  alertPhotoPreview: { width: '100%', height: 220, borderRadius: 12 },
  alertRemovePhoto: { position: 'absolute', top: 8, right: 8 },
  alertPhotoBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 20, borderRadius: 12, backgroundColor: '#f0f5ff', borderWidth: 1.5, borderColor: '#dbeafe', borderStyle: 'dashed' },
  alertPhotoBtnText: { fontSize: 13, fontWeight: '600', color: '#2563eb' },
  alertSubmitBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 30 },
  alertSubmitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});