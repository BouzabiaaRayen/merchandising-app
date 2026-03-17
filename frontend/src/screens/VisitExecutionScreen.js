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
  FlatList
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { visitService, storeService, notificationService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

const FAKE_ARTICLES = [
  {
    id: 'art-1',
    name: 'Warda Bidha Spaghetti N°3',
    meta: '500g • Semoule dure',
    price: '2.450 TND',
    status: 'rupture',
    color: '#f4d48e',
    icon: 'pasta',
  },
  {
    id: 'art-2',
    name: 'Warda Bidha Spaghetti N°5',
    meta: '500g • Cuisson rapide',
    price: '2.600 TND',
    status: 'rupture-active',
    color: '#efbc71',
    icon: 'pasta',
  },
  {
    id: 'art-3',
    name: 'Warda Bidha Penne Rigate',
    meta: '400g • Format familial',
    price: '2.950 TND',
    status: 'rupture',
    color: '#e2c68c',
    icon: 'pasta',
  },
  {
    id: 'art-4',
    name: 'Warda Bidha Coquillettes',
    meta: '500g • Pates fines',
    price: '2.300 TND',
    status: 'rupture',
    color: '#f6e3bb',
    icon: 'pasta',
  },
  {
    id: 'art-5',
    name: 'Warda Bidha Farfalle',
    meta: '400g • Qualite premium',
    price: '3.100 TND',
    status: 'rupture',
    color: '#f2d69a',
    icon: 'pasta',
  },
  {
    id: 'art-6',
    name: 'Warda Bidha Linguine',
    meta: '500g • Long format',
    price: '2.850 TND',
    status: 'rupture',
    color: '#f0cc84',
    icon: 'pasta',
  },
  {
    id: 'art-7',
    name: 'Warda Bidha Macaroni',
    meta: '500g • Tube court',
    price: '2.700 TND',
    status: 'rupture',
    color: '#ebc47a',
    icon: 'pasta',
  },
  {
    id: 'art-8',
    name: 'Warda Bidha Vermicelle',
    meta: '250g • Soupe et dessert',
    price: '1.950 TND',
    status: 'rupture-active',
    color: '#f7dfad',
    icon: 'pasta',
  },
  {
    id: 'art-9',
    name: 'Warda Bidha Nouilles Fines',
    meta: '500g • Texture legere',
    price: '2.550 TND',
    status: 'rupture',
    color: '#f3d8a2',
    icon: 'pasta',
  },
  {
    id: 'art-10',
    name: 'Warda Bidha Tagliatelle',
    meta: '400g • Rubans larges',
    price: '3.450 TND',
    status: 'rupture',
    color: '#e7c27f',
    icon: 'pasta',
  },
  {
    id: 'art-11',
    name: 'Warda Bidha Fusilli',
    meta: '500g • Helicoidal',
    price: '2.990 TND',
    status: 'rupture',
    color: '#f0ce8e',
    icon: 'pasta',
  },
  {
    id: 'art-12',
    name: 'Warda Bidha Lasagnes',
    meta: '500g • Feuilles pretes',
    price: '4.200 TND',
    status: 'rupture',
    color: '#dcb476',
    icon: 'pasta',
  },
  {
    id: 'art-13',
    name: 'Warda Bidha Cannelloni',
    meta: '250g • Pates a farcir',
    price: '3.850 TND',
    status: 'rupture',
    color: '#e9c988',
    icon: 'pasta',
  },
  {
    id: 'art-14',
    name: 'Warda Bidha Cheveux d\'Ange',
    meta: '250g • Coupe extra fine',
    price: '2.100 TND',
    status: 'rupture-active',
    color: '#f5ddac',
    icon: 'pasta',
  },
  {
    id: 'art-15',
    name: 'Warda Bidha Mini Penne',
    meta: '400g • Format enfant',
    price: '2.650 TND',
    status: 'rupture',
    color: '#efd095',
    icon: 'pasta',
  },
];

const parseTndPrice = (priceText) => {
  const parsed = Number(String(priceText).replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatTndPrice = (value) => `${Number(value || 0).toFixed(3)} TND`;
const DEFAULT_FACING_ROWS = 4;
const DEFAULT_FACING_COLUMNS = 6;
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

export default function VisitExecutionScreen({ route, navigation }) {
  const { visitId } = route.params;
  const { user } = useAuth();
  const [visit, setVisit] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [checkInTime, setCheckInTime] = useState(null);
  const [checkOutTime, setCheckOutTime] = useState(null);
  const [locationChecked, setLocationChecked] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showSlotAssignModal, setShowSlotAssignModal] = useState(false);
  const [stockUpdateCompleted, setStockUpdateCompleted] = useState(false);
  const [priceComparisonCompleted, setPriceComparisonCompleted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [activeTab, setActiveTab] = useState('events');
  const [articleQuery, setArticleQuery] = useState('');
  const [competitorName, setCompetitorName] = useState('Concurrent A');
  const [articles, setArticles] = useState(() =>
    FAKE_ARTICLES.map((article) => ({
      ...article,
      isRupture: article.status === 'rupture-active',
    }))
  );
  const [priceComparisons, setPriceComparisons] = useState(() =>
    FAKE_ARTICLES.slice(0, 8).map((article) => ({
      id: article.id,
      name: article.name,
      ourPrice: parseTndPrice(article.price),
      competitorPrice: '',
    }))
  );
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
  const facingProducts = articles.slice(0, 8);
  const expectedTargetsFromGrid = getExpectedTargetsFromGrid(facingProducts, facingGridCells.length);

  useEffect(() => {
    fetchVisitData();
    getCurrentLocation();
  }, []);

  // Timer for tracking time spent in store
  useEffect(() => {
    let interval;
    if (checkInTime && !checkOutTime) {
      interval = setInterval(() => {
        const now = new Date();
        const checkIn = new Date(checkInTime);
        const diff = Math.floor((now - checkIn) / 1000); // difference in seconds
        
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        
        setElapsedTime(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      }, 1000);
    } else if (checkInTime && checkOutTime) {
      // Calculate final time when checked out
      const checkIn = new Date(checkInTime);
      const checkOut = new Date(checkOutTime);
      const diff = Math.floor((checkOut - checkIn) / 1000);
      
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      
      setElapsedTime(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [checkInTime, checkOutTime]);

  // Monitor location services status
  useEffect(() => {
    let locationCheckInterval;
    
    if (location) {
      // Check location availability every 3 seconds
      locationCheckInterval = setInterval(async () => {
        try {
          const isEnabled = await Location.hasServicesEnabledAsync();
          if (!isEnabled) {
            console.log('Location services disabled by user');
            setLocation(null);
            setDistance(null);
            setLocationChecked(true);
            
            // Send GPS alert to backoffice
            try {
              const storeName = store?.name || visit?.store_name || 'Unknown Store';
              await notificationService.createNotification({
                user: user?.id,
                title: 'GPS Alert - During Visit',
                message: `${user?.first_name || user?.username || 'Merchandiser'} disabled GPS during visit at ${storeName}`,
                type: 'GPS_ALERT',
                is_urgent: true
              });
              console.log('GPS alert sent to backoffice');
            } catch (notifError) {
              console.error('Failed to send GPS alert:', notifError.response?.data || notifError.message);
            }
            
            Alert.alert(
              'GPS Disabled',
              'Location services have been turned off. GPS verification unavailable.',
              [{ text: 'OK' }]
            );
          }
        } catch (error) {
          console.error('Error checking location services:', error);
        }
      }, 3000);
    }
    
    return () => {
      if (locationCheckInterval) {
        clearInterval(locationCheckInterval);
      }
    };
  }, [location]);

  const fetchVisitData = async () => {
    try {
      const visitData = await visitService.getVisit(visitId);
      setVisit(visitData);
      setNotes(visitData.notes || '');
      setCheckInTime(visitData.check_in_time || visitData.checked_in_at);
      
      // If visit is completed, set checkout time to stop timer
      if (visitData.status === 'completed' && visitData.check_out_time) {
        setCheckOutTime(visitData.check_out_time);
      }
      
      if (visitData.store) {
        const storeData = await storeService.getStore(visitData.store);
        setStore(storeData);
        
        console.log('Store data:', {
          name: storeData.name,
          latitude: storeData.latitude,
          longitude: storeData.longitude,
          lat_type: typeof storeData.latitude,
          lng_type: typeof storeData.longitude
        });
        
        // Calculate distance if we have location
        if (location && storeData.latitude && storeData.longitude) {
          calculateDistance(storeData);
        }
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

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      console.log('Current location:', {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });
      
      setLocation(currentLocation);
      setLocationChecked(true);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationChecked(true);
    }
  };

  const calculateDistance = (storeData) => {
    if (!location || !storeData.latitude || !storeData.longitude) {
      console.log('Cannot calculate distance - missing data:', {
        hasLocation: !!location,
        storeLat: storeData.latitude,
        storeLng: storeData.longitude
      });
      return;
    }
    
    // Ensure coordinates are numbers
    const storeLat = parseFloat(storeData.latitude);
    const storeLng = parseFloat(storeData.longitude);
    const userLat = parseFloat(location.coords.latitude);
    const userLng = parseFloat(location.coords.longitude);
    
    // Validate coordinates are valid numbers
    if (isNaN(storeLat) || isNaN(storeLng) || isNaN(userLat) || isNaN(userLng)) {
      console.error('Invalid coordinates:', { storeLat, storeLng, userLat, userLng });
      setDistance(null);
      return;
    }
    
    // Validate latitude and longitude ranges
    if (storeLat < -90 || storeLat > 90 || storeLng < -180 || storeLng > 180 ||
        userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
      console.error('Coordinates out of range:', { storeLat, storeLng, userLat, userLng });
      setDistance(null);
      return;
    }
    
    console.log('Calculating distance:', {
      userLat,
      userLng,
      storeLat,
      storeLng
    });
    
    const R = 6371e3; // Earth's radius in meters
    const φ1 = userLat * Math.PI / 180;
    const φ2 = storeLat * Math.PI / 180;
    const Δφ = (storeLat - userLat) * Math.PI / 180;
    const Δλ = (storeLng - userLng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const d = R * c;
    const roundedDistance = Math.round(d);
    
    console.log('Distance calculated:', roundedDistance, 'meters');
    setDistance(roundedDistance);
  };

  useEffect(() => {
    if (location && store) {
      calculateDistance(store);
    }
  }, [location, store]);

  const handleCheckIn = async () => {
    try {
      if (!location) {
        Alert.alert('GPS Required', 'Please enable GPS to check in');
        return;
      }

      if (!store?.latitude || !store?.longitude) {
        Alert.alert(
          'Store Location Missing',
          'This store does not have GPS coordinates set. Please contact your administrator to add the store location.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (distance === null || distance === undefined) {
        Alert.alert('Location Check', 'Still calculating your distance from the store. Please wait a moment.');
        return;
      }

      // Distance check temporarily disabled for testing
      // if (distance > 100) {
      //   Alert.alert(
      //     'Too Far',
      //     `You are ${distance}m away from the store. You must be within 100m to check in.\n\nStore: ${store.name}\nStore coordinates: ${store.latitude}, ${store.longitude}`,
      //     [{ text: 'OK' }]
      //   );
      //   return;
      // }

      await visitService.checkIn(visitId);
      setCheckInTime(new Date().toISOString());
      await fetchVisitData();
      Alert.alert('Success', 'Checked in successfully!');
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Error', 'Failed to check in');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotos([...photos, result.assets[0]]);
      }
    } catch (error) {
      console.error('Photo error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleOpenPhotoModal = () => {
    if (!checkInTime) return;
    setShowPhotoModal(true);
  };

  const handleDeletePhoto = (index) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newPhotos = photos.filter((_, i) => i !== index);
            setPhotos(newPhotos);
          }
        }
      ]
    );
  };

  const handleOpenStockModal = () => {
    if (!checkInTime) return;
    setShowStockModal(true);
  };

  const handleFacingDimensionChange = (field, value) => {
    const normalized = value.replace(/[^\d]/g, '');
    const nextRows = Number(field === 'rows' ? normalized || 0 : facingGridRows || 0);
    const nextColumns = Number(field === 'columns' ? normalized || 0 : facingGridColumns || 0);

    if (field === 'rows') setFacingGridRows(normalized);
    if (field === 'columns') setFacingGridColumns(normalized);

    if (nextRows <= 0 || nextColumns <= 0) {
      setFacingGridCells([]);
      setSlotAssignments([]);
      return;
    }

    const nextCells = createGridCells(nextRows, nextColumns, true);
    setFacingGridCells(nextCells);
    setSlotAssignments(createSlotAssignments(nextRows, nextColumns));
  };

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
    const normalized = value.replace(/[^\d]/g, '');
    setActiveSlotDepthInput(normalized);
  };

  const getNormalizedDepth = () => {
    const parsed = Number(activeSlotDepthInput || 0);
    if (!Number.isFinite(parsed) || parsed <= 0) return MIN_STACK_DEPTH;
    return Math.max(MIN_STACK_DEPTH, Math.min(MAX_STACK_DEPTH, parsed));
  };

  const handleIncreaseActiveDepth = () => {
    const next = Math.min(MAX_STACK_DEPTH, getNormalizedDepth() + 1);
    setActiveSlotDepthInput(String(next));
  };

  const handleDecreaseActiveDepth = () => {
    const next = Math.max(MIN_STACK_DEPTH, getNormalizedDepth() - 1);
    setActiveSlotDepthInput(String(next));
  };

  const handleAssignProductToSlot = (productId) => {
    if (activeSlotIndex === null) return;
    const depth = getNormalizedDepth();

    setFacingGridCells((current) => current.map((cell, index) => (index === activeSlotIndex ? true : cell)));
    setSlotAssignments((current) => current.map((assigned, index) => (
      index === activeSlotIndex
        ? { productId, depth }
        : assigned
    )));
    setShowSlotAssignModal(false);
  };

  const handleClearSlotAssignment = () => {
    if (activeSlotIndex === null) return;

    setFacingGridCells((current) => current.map((cell, index) => (index === activeSlotIndex ? false : cell)));
    setSlotAssignments((current) => current.map((assigned, index) => (
      index === activeSlotIndex
        ? { productId: null, depth: 0 }
        : assigned
    )));
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

  const handleAssignProductFromSummary = (productId) => {
    const expected = Number(expectedTargetsFromGrid[productId] || 0);
    const observed = getObservedCountForProduct(productId);
    let remaining = Math.max(expected - observed, 0);

    if (!remaining) {
      Alert.alert('Already Complete', 'Observed quantity already meets expected target for this product.');
      return;
    }

    const visibleSlots = facingGridCells
      .map((isVisible, index) => (isVisible ? index : null))
      .filter((index) => index !== null);

    if (!visibleSlots.length) {
      Alert.alert('No Visible Slots', 'Mark at least one slot as visible before assigning products.');
      return;
    }

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
      Alert.alert('Partial Assignment', `Assigned what fits in visible slots. ${remaining} unit(s) still not placed.`);
      return;
    }

    Alert.alert('Assigned', 'Observed grid updated for this product.');
  };

  const handleTakeFacingProofPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setFacingProofPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error('Facing proof photo error:', error);
      Alert.alert('Error', 'Failed to capture expected aisle photo');
    }
  };

  const handleSaveStockUpdates = () => {
    const hasMissingCells = facingGridCells.some((cell) => !cell);
    const changedDimensions = Number(facingGridRows || 0) !== DEFAULT_FACING_ROWS
      || Number(facingGridColumns || 0) !== DEFAULT_FACING_COLUMNS;
    const hasUpdates = hasMissingCells || changedDimensions;
    const visibleSlots = facingGridCells
      .map((isVisible, index) => (isVisible ? index : null))
      .filter((index) => index !== null);
    const unassignedVisibleCount = visibleSlots.filter((index) => !slotAssignments[index]?.productId).length;
    
    if (!hasUpdates) {
      Alert.alert('No Changes', 'No facing updates to save');
      return;
    }

    if (unassignedVisibleCount > 0) {
      Alert.alert('Missing Assignments', `Assign products to all visible slots (${unassignedVisibleCount} remaining).`);
      return;
    }

    if (!facingProofPhoto) {
      Alert.alert('Proof Photo Required', 'Capture one photo of the entire expected aisle before saving facing.');
      return;
    }

    Alert.alert(
      'Save Facing Updates',
      `Save facing grid update (${facingGridRows || 0} x ${facingGridColumns || 0})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => {
            console.log('Facing grid saved:', {
              rows: Number(facingGridRows || 0),
              columns: Number(facingGridColumns || 0),
              cells: facingGridCells,
              slotAssignments,
              totalObservedUnits: getTotalObservedUnits(),
              proofPhotoUri: facingProofPhoto?.uri || null,
              productSummary: articles.slice(0, 8).map((product) => {
                const expected = Number(expectedTargetsFromGrid[product.id] || 0);
                const observed = getObservedCountForProduct(product.id);
                return {
                  productId: product.id,
                  productName: product.name,
                  expected,
                  observed,
                  gap: observed - expected,
                };
              }),
            });
            setStockUpdateCompleted(true);
            setShowStockModal(false);
            Alert.alert('Success', 'Facing updates saved!');
          }
        }
      ]
    );
  };

  const handleCheckOut = async () => {
    try {
      const completionPercentage = calculateCompletionPercentage();
      
      if (completionPercentage < 100) {
        Alert.alert(
          'Incomplete Tasks',
          'Please complete all tasks before checking out.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Set checkout time to stop the timer
      const checkoutTimestamp = new Date().toISOString();
      setCheckOutTime(checkoutTimestamp);

      await visitService.checkOut(visitId, notes);
      Alert.alert('Success', 'Checked out successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('Error', 'Failed to check out');
    }
  };

  const handleSubmitVisit = async () => {
    try {
      // Update notes
      if (notes !== visit.notes) {
        await visitService.patchVisit(visitId, { notes });
      }

      Alert.alert('Success', 'Visit data submitted successfully!');
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to submit visit data');
    }
  };

  const calculateCompletionPercentage = () => {
    let completed = 0;
    let total = 3; // Check-in, Photos, Facing Update (Notes are optional)

    if (checkInTime) completed++;
    if (photos.length >= 4) completed++;
    if (stockUpdateCompleted) completed++;

    return Math.round((completed / total) * 100);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    }).toUpperCase();
  };

  const getGPSStatus = () => {
    if (!locationChecked) {
      return { text: 'GPS: CHECKING...', color: '#f59e0b' };
    }
    if (!location) {
      return { text: 'GPS: DISABLED', color: '#ef4444' };
    }
    if (!store?.latitude || !store?.longitude) {
      return { text: 'GPS: STORE LOCATION NOT SET', color: '#ef4444' };
    }
    if (distance === null || distance === undefined) {
      return { text: 'GPS: CALCULATING...', color: '#3b82f6' };
    }
    // Distance check disabled for testing - show distance info only
    return { text: `GPS ACTIVE: ${distance}M FROM STORE`, color: '#3b82f6' };
  };

  const handleCompetitorPrices = () => {
    if (!checkInTime) return;
    setShowPriceModal(true);
  };

  const handleCompetitorPriceChange = (itemId, value) => {
    const normalizedValue = value.replace(',', '.').replace(/[^\d.]/g, '');
    setPriceComparisons((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, competitorPrice: normalizedValue }
          : item
      )
    );
  };

  const handleSavePriceComparison = () => {
    setPriceComparisonCompleted(true);
    setShowPriceModal(false);
    Alert.alert('Saved', 'Price comparison has been recorded for this visit.');
  };

  const handleAddProduct = () => {
    Alert.alert('Add Product', 'Product addition is not connected yet. Facing entry remains available from Saisi Facing.');
  };

  const handleToggleArticleRupture = (articleId) => {
    setArticles((currentArticles) =>
      currentArticles.map((article) =>
        article.id === articleId
          ? { ...article, isRupture: !article.isRupture }
          : article
      )
    );
  };

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
  const canCheckOut = completionPercentage >= 100 && isCheckedIn && !isVisitCompleted;
  const scheduleLabel = visit?.scheduled_date ? formatTime(visit.scheduled_date) : 'Not scheduled';
  const visitStatusConfig = isVisitCompleted
    ? { label: 'VISITE TERMINEE', color: '#16a34a', bg: '#dcfce7' }
    : isCheckedIn
      ? { label: 'VISITE ACTIVE', color: '#ffffff', bg: '#ff1f1f' }
      : { label: 'VISITE PLANIFIEE', color: '#1d4ed8', bg: '#dbeafe' };
  const quickActions = [
    {
      key: 'photo',
      title: 'Anomalie Photo',
      icon: 'camera-outline',
      accent: '#ff3b30',
      background: '#fff1f1',
      onPress: handleOpenPhotoModal,
      disabled: !isCheckedIn || isVisitCompleted,
      completed: photos.length > 0,
    },
    {
      key: 'facing',
      title: 'Saisi Facing',
      icon: 'view-grid-plus-outline',
      accent: '#ff3b30',
      background: '#fff1f1',
      onPress: handleOpenStockModal,
      disabled: !isCheckedIn || isVisitCompleted,
      completed: stockUpdateCompleted,
    },
    {
      key: 'pricing',
      title: 'Prix Concurrents',
      icon: 'tag-outline',
      accent: '#ff3b30',
      background: '#fff6ef',
      onPress: handleCompetitorPrices,
      disabled: !isCheckedIn || isVisitCompleted,
      completed: priceComparisonCompleted,
    },
    {
      key: 'product',
      title: 'Ajout Produit',
      icon: 'plus-circle-outline',
      accent: '#ff3b30',
      background: '#fff1f1',
      onPress: handleAddProduct,
      disabled: !isCheckedIn || isVisitCompleted,
    },
    {
      key: 'alert',
      title: 'Alerte Concurrent',
      icon: 'bell-alert-outline',
      accent: '#ff3b30',
      background: '#fff1f1',
      onPress: () => navigation.navigate('Complaint'),
      disabled: !isCheckedIn || isVisitCompleted,
    },
    {
      key: 'other',
      title: 'Autre',
      icon: 'dots-horizontal',
      accent: '#cbd5e1',
      background: '#f8fafc',
      onPress: null,
      disabled: true,
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
    photos.length > 0 && {
      key: 'photos',
      title: 'Anomalie Photo',
      subtitle: `${store?.name || visit?.store_name || 'Magasin'} • ${photos.length} photo${photos.length > 1 ? 's' : ''}`,
      icon: 'camera-outline',
      iconColor: '#ff5a52',
      iconBackground: '#fff1f1',
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

  const renderEventsTab = () => (
    <>
      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={[
              styles.quickActionCard,
              action.disabled && styles.quickActionCardDisabled,
            ]}
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
          <TouchableOpacity
            key={article.id}
            style={[styles.articleCard, isActive && styles.articleCardActive]}
            activeOpacity={0.9}
          >
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
        <Text style={[styles.secondaryButtonText, isVisitCompleted && styles.secondaryButtonTextDisabled]}>Enregistrer les notes</Text>
      </TouchableOpacity>
    </View>
  );

  const renderActiveTab = () => {
    if (activeTab === 'articles') return renderArticlesTab();
    if (activeTab === 'store-info') return renderStoreInfoTab();
    return renderEventsTab();
  };

  const footerButtonLabel = isVisitCompleted
    ? 'VISITE CLOTUREE'
    : isCheckedIn
      ? 'CLOTURER LA VISITE'
      : 'DEMARRER LA VISITE';
  const footerButtonDisabled = isVisitCompleted || (isCheckedIn && !canCheckOut);
  const footerButtonHandler = isCheckedIn ? handleCheckOut : handleCheckIn;
  const filteredArticles = articles.filter((article) => {
    const haystack = `${article.name} ${article.meta}`.toLowerCase();
    return haystack.includes(articleQuery.trim().toLowerCase());
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
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
                <Text style={styles.completedBannerText}>
                  This visit has been completed and is now read-only
                </Text>
              </View>
            </View>
          )}

          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTextWrap}>
                <Text style={styles.storeName}>
                  {store?.name || visit?.store_name || 'Unknown Store'}
                </Text>
                <View style={styles.addressRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={14} color="#6b7280" />
                  <Text style={styles.storeAddress}>
                    {store?.address || store?.location || 'Address not available'}
                  </Text>
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

        <View style={styles.footerCtaWrap}>
          <TouchableOpacity
            style={[styles.footerCtaButton, footerButtonDisabled && styles.footerCtaButtonDisabled]}
            onPress={footerButtonHandler}
            disabled={footerButtonDisabled}
            activeOpacity={0.9}
          >
            <MaterialCommunityIcons
              name={isCheckedIn ? 'logout-variant' : 'login-variant'}
              size={20}
              color="#fff"
            />
            <Text style={styles.footerCtaText}>{footerButtonLabel}</Text>
          </TouchableOpacity>
          {isCheckedIn && !canCheckOut && !isVisitCompleted && (
            <Text style={styles.footerHelperText}>Complete photo capture and facing update before checkout.</Text>
          )}
        </View>
      </View>

      {/* Photo Modal */}
      <Modal
        visible={showPhotoModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPhotoModal(false)}
      >
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
                    <TouchableOpacity
                      style={styles.deletePhotoButton}
                      onPress={() => handleDeletePhoto(index)}
                    >
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

      {/* Facing Update Modal */}
      <Modal
        visible={showStockModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowStockModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowStockModal(false)}>
              <MaterialCommunityIcons name="close" size={28} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Saisi Facing</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.facingSummaryBox}>
            <Text style={styles.facingSummaryLabel}>Facing Compliance</Text>
            <Text style={styles.facingSummaryValue}>
              {getFacingCompliance()}
              %
            </Text>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.unifiedFacingCard}>
              <Text style={styles.comparisonLabel}>EXPECTED GRID</Text>

              <Text style={styles.unifiedFacingHint}>Tap slot to assign product. Long press slot to toggle missing/visible.</Text>

              <View style={styles.facingProofRow}>
                <TouchableOpacity style={styles.facingProofButton} onPress={handleTakeFacingProofPhoto}>
                  <MaterialCommunityIcons name="camera-outline" size={16} color="#1d4ed8" />
                  <Text style={styles.facingProofButtonText}>
                    {facingProofPhoto ? 'Retake Expected Aisle Photo' : 'Capture Expected Aisle Photo'}
                  </Text>
                </TouchableOpacity>
                {facingProofPhoto && (
                  <Image source={{ uri: facingProofPhoto.uri }} style={styles.facingProofThumb} />
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.shelfCompareScroll}
                contentContainerStyle={styles.shelfCompareContent}
              >
                <View style={styles.shelfCompareRow}>
                  <View style={styles.shelfPanel}>
                    <Text style={styles.shelfPanelTitle}>Expected</Text>
                    <View style={styles.facingGridPreviewWrap}>
                      <View style={styles.shelfFrame}>
                        <View style={styles.shelfRail} />
                        <View style={styles.shelfGridArea}>
                          {Array.from({ length: Number(facingGridRows || 0) }).map((_, rowIndex) => (
                            <View key={`expected-row-${rowIndex}`} style={styles.shelfRowBlock}>
                              <Text style={styles.shelfLabel}>Shelf {rowIndex + 1}</Text>
                              <View style={styles.facingGridRowPreview}>
                                {Array.from({ length: Number(facingGridColumns || 0) }).map((__, colIndex) => {
                                  const cellIndex = rowIndex * Number(facingGridColumns || 0) + colIndex;
                                  const product = getShelfProductForIndex(cellIndex);

                                  return (
                                    <View
                                      key={`expected-cell-${rowIndex}-${colIndex}`}
                                      style={[
                                        styles.facingGridCell,
                                        styles.facingGridCellFilled,
                                        { backgroundColor: product?.color || '#34d399' },
                                      ]}
                                    >
                                      <Text style={styles.facingProductText}>
                                        {getProductSlotLabel(product?.name)}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                              <View style={styles.shelfPlank} />
                            </View>
                          ))}
                        </View>
                        <View style={styles.shelfRail} />
                      </View>
                    </View>
                  </View>

                  <View style={styles.shelfPanel}>
                    <Text style={styles.shelfPanelTitle}>Observed</Text>
                    <View style={styles.facingGridPreviewWrap}>
                      <View style={styles.shelfFrame}>
                        <View style={styles.shelfRail} />
                        <View style={styles.shelfGridArea}>
                          {Array.from({ length: Number(facingGridRows || 0) }).map((_, rowIndex) => (
                            <View key={`observed-row-${rowIndex}`} style={styles.shelfRowBlock}>
                              <Text style={styles.shelfLabel}>Shelf {rowIndex + 1}</Text>
                              <View style={styles.facingGridRowPreview}>
                                {Array.from({ length: Number(facingGridColumns || 0) }).map((__, colIndex) => {
                                  const cellIndex = rowIndex * Number(facingGridColumns || 0) + colIndex;
                                  const visible = Boolean(facingGridCells[cellIndex]);
                                  const expectedProduct = getShelfProductForIndex(cellIndex);
                                  const assignedProduct = getAssignedProductForIndex(cellIndex);
                                  const assignedDepth = getAssignedDepthForIndex(cellIndex);
                                  const isMismatch = visible && assignedProduct && assignedProduct.id !== expectedProduct?.id;
                                  const isUnassigned = visible && !assignedProduct;
                                  const displayProduct = assignedProduct || expectedProduct;

                                  return (
                                    <TouchableOpacity
                                      key={`observed-cell-${rowIndex}-${colIndex}`}
                                      activeOpacity={0.8}
                                      onPress={() => handleOpenSlotAssignment(cellIndex)}
                                      onLongPress={() => handleToggleFacingCellVisibility(cellIndex)}
                                      style={[
                                        styles.facingGridCell,
                                        visible ? styles.facingGridCellFilled : styles.facingGridCellMissing,
                                        visible && { backgroundColor: displayProduct?.color || '#34d399' },
                                        isMismatch && styles.facingGridCellMismatch,
                                        isUnassigned && styles.facingGridCellUnassigned,
                                      ]}
                                    >
                                      {visible && (
                                        <View style={styles.facingCellContent}>
                                          <Text style={styles.facingProductText}>
                                            {isUnassigned ? '???' : getProductSlotLabel(displayProduct?.name)}
                                          </Text>
                                          {!isUnassigned && assignedDepth > 1 && (
                                            <Text style={styles.facingDepthText}>x{assignedDepth}</Text>
                                          )}
                                        </View>
                                      )}
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                              <View style={styles.shelfPlank} />
                            </View>
                          ))}
                        </View>
                        <View style={styles.shelfRail} />
                      </View>
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.facingLegendRow}>
                <View style={styles.facingLegendItem}>
                  <View style={[styles.facingLegendDot, styles.facingGridCellFilled]} />
                  <Text style={styles.facingLegendText}>Visible</Text>
                </View>
                <View style={styles.facingLegendItem}>
                  <View style={[styles.facingLegendDot, styles.facingGridCellMissing]} />
                  <Text style={styles.facingLegendText}>Missing</Text>
                </View>
                <View style={styles.facingLegendItem}>
                  <View style={[styles.facingLegendDot, styles.facingGridCellMismatch]} />
                  <Text style={styles.facingLegendText}>Mismatch</Text>
                </View>
              </View>

              <Text style={styles.unifiedFacingStats}>
                Visible: {facingGridCells.filter(Boolean).length} / {facingGridCells.length} • Missing: {facingGridCells.filter((cell) => !cell).length} • Mismatch: {getFacingMismatchCount()}
              </Text>
              <Text style={styles.unifiedFacingStats}>
                Units observed (stacked): {getTotalObservedUnits()}
              </Text>

              <View style={styles.productQtySection}>
                <Text style={styles.comparisonLabel}>EXPECTED VS OBSERVED BY PRODUCT</Text>
                {facingProducts.map((product) => {
                  const expected = Number(expectedTargetsFromGrid[product.id] || 0);
                  const observed = getObservedCountForProduct(product.id);
                  const gap = observed - expected;

                  return (
                    <View key={`qty-${product.id}`} style={styles.productQtyItem}>
                      <View style={styles.productQtyRow}>
                        <View style={[styles.productQtySwatch, { backgroundColor: product.color }]} />
                        <View style={styles.productQtyInfo}>
                          <Text style={styles.productQtyName} numberOfLines={1}>{product.name}</Text>
                          <Text style={styles.productQtyMeta}>Observed: {observed}</Text>
                        </View>

                        <View style={styles.productQtyExpectedWrap}>
                          <Text style={styles.productQtyExpectedLabel}>Expected</Text>
                          <View style={styles.productQtyExpectedStatic}>
                            <Text style={styles.productQtyExpectedStaticText}>{expected}</Text>
                          </View>
                        </View>

                        <View style={[
                          styles.productQtyGapBadge,
                          gap < 0 ? styles.productQtyGapNegative : styles.productQtyGapPositive,
                        ]}>
                          <Text style={styles.productQtyGapText}>{gap >= 0 ? `+${gap}` : `${gap}`}</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.productQtyAssignButton}
                        onPress={() => handleAssignProductFromSummary(product.id)}
                        activeOpacity={0.85}
                      >
                        <MaterialCommunityIcons name="playlist-plus" size={14} color="#1d4ed8" />
                        <Text style={styles.productQtyAssignText}>Assign</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleSaveStockUpdates}
            >
              <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>
                Save Facing Grid
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.closeButton]}
              onPress={() => setShowStockModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          {showSlotAssignModal && (
            <View style={styles.slotAssignOverlay}>
              <View style={styles.slotAssignCard}>
                <View style={styles.slotAssignHeader}>
                  <Text style={styles.slotAssignTitle}>Assign Product to Slot</Text>
                  <TouchableOpacity onPress={() => setShowSlotAssignModal(false)}>
                    <MaterialCommunityIcons name="close" size={22} color="#334155" />
                  </TouchableOpacity>
                </View>

                <View style={styles.depthControlRow}>
                  <Text style={styles.depthControlLabel}>Units stacked in this slot</Text>
                  <View style={styles.depthControlActions}>
                    <TouchableOpacity style={styles.depthControlButton} onPress={handleDecreaseActiveDepth}>
                      <MaterialCommunityIcons name="minus" size={16} color="#334155" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.depthControlInput}
                      value={activeSlotDepthInput}
                      onChangeText={handleActiveSlotDepthInput}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor="#94a3b8"
                    />
                    <TouchableOpacity style={styles.depthControlButton} onPress={handleIncreaseActiveDepth}>
                      <MaterialCommunityIcons name="plus" size={16} color="#334155" />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView style={styles.slotAssignList}>
                  {articles.slice(0, 12).map((product) => (
                    <TouchableOpacity
                      key={product.id}
                      style={styles.slotAssignItem}
                      onPress={() => handleAssignProductToSlot(product.id)}
                    >
                      <View style={[styles.slotAssignColor, { backgroundColor: product.color }]} />
                      <View style={styles.slotAssignTextWrap}>
                        <Text style={styles.slotAssignName}>{product.name}</Text>
                        <Text style={styles.slotAssignMeta}>{product.meta}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity style={styles.slotAssignMissingButton} onPress={handleClearSlotAssignment}>
                  <MaterialCommunityIcons name="delete-outline" size={18} color="#b91c1c" />
                  <Text style={styles.slotAssignMissingText}>Mark Slot as Missing</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showPriceModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPriceModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPriceModal(false)}>
              <MaterialCommunityIcons name="close" size={28} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Price Comparison</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.comparisonLabel}>COMPETITOR NAME</Text>
            <TextInput
              style={styles.comparisonInput}
              value={competitorName}
              onChangeText={setCompetitorName}
              placeholder="Enter competitor store"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.comparisonLabel}>PASTA PRICE MATRIX</Text>
            {priceComparisons.map((item) => {
              const parsedCompetitorPrice = Number(item.competitorPrice);
              const hasCompetitorPrice = item.competitorPrice !== '' && Number.isFinite(parsedCompetitorPrice);
              const diff = hasCompetitorPrice ? parsedCompetitorPrice - item.ourPrice : null;
              const isPositiveDiff = hasCompetitorPrice && diff >= 0;

              return (
                <View key={item.id} style={styles.comparisonCard}>
                  <Text style={styles.comparisonProductName}>{item.name}</Text>

                  <View style={styles.comparisonPriceRow}>
                    <View style={styles.comparisonPriceBox}>
                      <Text style={styles.comparisonPriceLabel}>Our Price</Text>
                      <Text style={styles.comparisonPriceValue}>{formatTndPrice(item.ourPrice)}</Text>
                    </View>

                    <View style={styles.comparisonPriceBox}>
                      <Text style={styles.comparisonPriceLabel}>{competitorName || 'Competitor'}</Text>
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

                  <View style={[
                    styles.comparisonDiffBadge,
                    hasCompetitorPrice
                      ? (isPositiveDiff ? styles.comparisonDiffPositive : styles.comparisonDiffNegative)
                      : styles.comparisonDiffNeutral,
                  ]}>
                    <Text style={styles.comparisonDiffText}>
                      {!hasCompetitorPrice
                        ? 'Enter competitor price'
                        : isPositiveDiff
                          ? `Our price lower by ${formatTndPrice(Math.abs(diff))}`
                          : `Competitor lower by ${formatTndPrice(Math.abs(diff))}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton, { marginRight: 0 }]}
              onPress={handleSavePriceComparison}
            >
              <MaterialCommunityIcons name="scale-balance" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Comparison</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
  },
  contentContainer: {
    paddingBottom: 120,
  },
  completedBanner: {
    backgroundColor: '#d1fae5',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  completedBannerContent: {
    flex: 1,
    marginLeft: 12,
  },
  completedBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 4,
  },
  completedBannerText: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTextWrap: {
    flex: 1,
  },
  storeName: {
    fontSize: 27,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storeAddress: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  visitStatusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 96,
    alignItems: 'center',
  },
  visitStatusChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  timerBox: {
    flex: 1.15,
    borderRadius: 18,
    backgroundColor: '#fff5f5',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  progressBox: {
    flex: 0.85,
    borderRadius: 18,
    backgroundColor: '#f4f7fb',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  timerValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ef1b1b',
    letterSpacing: 1,
  },
  timerLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  progressLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#faf5f5',
    borderRadius: 18,
    padding: 4,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#ff1f1f',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickActionCard: {
    width: '48.2%',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingVertical: 26,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 14,
    minHeight: 112,
    borderWidth: 1,
    borderColor: '#edf0f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    position: 'relative',
  },
  quickActionCardDisabled: {
    opacity: 0.55,
    borderStyle: 'dashed',
  },
  quickActionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  quickActionTitle: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  quickActionTitleDisabled: {
    color: '#94a3b8',
  },
  quickActionDoneBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activitySection: {
    marginBottom: 10,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b7bfd0',
    letterSpacing: 1,
    marginBottom: 12,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  emptyActivityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  emptyActivityText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  activityIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 3,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  tabPanel: {
    marginBottom: 18,
  },
  articleToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#edf1f6',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#334155',
    paddingVertical: 0,
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#edf1f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eef2f7',
    paddingHorizontal: 10,
    paddingVertical: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  articleCardActive: {
    borderColor: '#fecaca',
    backgroundColor: '#fffdfd',
  },
  articleThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  articleDetails: {
    flex: 1,
    paddingRight: 10,
  },
  articleName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  articleMeta: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 3,
  },
  articlePrice: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
    color: '#2f67ff',
    marginTop: 6,
  },
  ruptureBadge: {
    minWidth: 78,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce4ef',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
  },
  ruptureBadgeActive: {
    backgroundColor: '#ff3b30',
    borderColor: '#ff3b30',
  },
  ruptureBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b2bed1',
  },
  ruptureBadgeTextActive: {
    color: '#ffffff',
  },
  emptyArticleState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 34,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  emptyArticleText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 10,
  },
  comparisonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 6,
  },
  comparisonInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 12,
  },
  comparisonCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 12,
  },
  comparisonProductName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  comparisonPriceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  comparisonPriceBox: {
    flex: 1,
  },
  comparisonPriceLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
    fontWeight: '600',
  },
  comparisonPriceValue: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '700',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  comparisonPriceInput: {
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  comparisonDiffBadge: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  comparisonDiffPositive: {
    backgroundColor: '#dcfce7',
  },
  comparisonDiffNegative: {
    backgroundColor: '#fee2e2',
  },
  comparisonDiffNeutral: {
    backgroundColor: '#f1f5f9',
  },
  comparisonDiffText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eef2f7',
    padding: 16,
    marginBottom: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
    maxWidth: '58%',
    textAlign: 'right',
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    fontSize: 14,
    color: '#111',
    minHeight: 150,
    borderWidth: 1,
    borderColor: '#eef2f7',
    marginBottom: 14,
  },
  secondaryButton: {
    borderRadius: 16,
    backgroundColor: '#f4f7fb',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonDisabled: {
    backgroundColor: '#f8fafc',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  secondaryButtonTextDisabled: {
    color: '#94a3b8',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  footerCtaWrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 18,
    backgroundColor: '#ffffff',
  },
  footerCtaButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#ff1717',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff1717',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  footerCtaButtonDisabled: {
    backgroundColor: '#fca5a5',
    shadowOpacity: 0,
    elevation: 0,
  },
  footerCtaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  footerHelperText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalFooter: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalButtonSuccess: {
    backgroundColor: '#10b981',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // Photo Modal Styles
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  photoImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  deletePhotoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#ef4444',
    borderRadius: 20,
    padding: 6,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  photoCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  // Stock Modal Styles
  stockList: {
    padding: 16,
  },
  facingSummaryBox: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  facingSummaryLabel: {
    fontSize: 13,
    color: '#1e3a8a',
    fontWeight: '700',
  },
  facingSummaryValue: {
    fontSize: 18,
    color: '#2563eb',
    fontWeight: '800',
  },
  unifiedFacingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
  },
  unifiedFacingExpectedText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: 12,
  },
  unifiedFacingHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 10,
    marginBottom: 8,
  },
  facingProofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  facingProofButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  facingProofButtonText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  facingProofThumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  unifiedFacingStats: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
    marginTop: 10,
  },
  productQtySection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  productQtyItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
    marginBottom: 4,
  },
  productQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  productQtySwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  productQtyInfo: {
    flex: 1,
    minWidth: 0,
  },
  productQtyName: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
  productQtyMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  productQtyExpectedWrap: {
    width: 76,
  },
  productQtyExpectedLabel: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 3,
    fontWeight: '700',
  },
  productQtyExpectedInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0f172a',
    textAlign: 'center',
  },
  productQtyExpectedStatic: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  productQtyExpectedStaticText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
  productQtyGapBadge: {
    minWidth: 42,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  productQtyGapPositive: {
    backgroundColor: '#dcfce7',
  },
  productQtyGapNegative: {
    backgroundColor: '#fee2e2',
  },
  productQtyGapText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  productQtyAssignButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 2,
  },
  productQtyAssignText: {
    marginLeft: 6,
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  stockItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stockItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stockItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  stockSku: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  stockName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  facingExpectedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  facingExpectedText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
  },
  stockStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  stockItemBody: {
    gap: 12,
  },
  facingMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  facingGridInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  facingGridInputBlock: {
    flex: 1,
  },
  facingSmallInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
    marginTop: 6,
  },
  facingGridPreviewWrap: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  shelfCompareRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shelfCompareScroll: {
    marginHorizontal: -2,
  },
  shelfCompareContent: {
    paddingHorizontal: 2,
  },
  shelfPanel: {
    flex: 1,
    minWidth: 280,
  },
  shelfPanelTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
  },
  shelfFrame: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  shelfRail: {
    width: 6,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
    marginHorizontal: 4,
  },
  shelfGridArea: {
    flex: 1,
    gap: 10,
  },
  shelfRowBlock: {
    gap: 6,
  },
  shelfLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginLeft: 2,
  },
  facingGridRowPreview: {
    flexDirection: 'row',
    gap: 8,
  },
  shelfPlank: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
    marginTop: 2,
  },
  facingGridCell: {
    width: 34,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facingCellContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  facingProductText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  facingDepthText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  facingGridCellFilled: {
    backgroundColor: '#34d399',
    borderColor: '#10b981',
  },
  facingGridCellMissing: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
  },
  facingGridCellMismatch: {
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  facingGridCellUnassigned: {
    borderColor: '#f97316',
    borderWidth: 2,
    backgroundColor: '#fde68a',
  },
  facingLegendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  facingLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  facingLegendDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
  },
  facingLegendText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  slotAssignOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  slotAssignCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    maxHeight: '72%',
  },
  slotAssignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  depthControlRow: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  depthControlLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  depthControlActions: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  depthControlButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  depthControlInput: {
    width: 54,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  slotAssignTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  slotAssignList: {
    maxHeight: 360,
  },
  slotAssignItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  slotAssignColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 10,
  },
  slotAssignTextWrap: {
    flex: 1,
  },
  slotAssignName: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
  },
  slotAssignMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  slotAssignMissingButton: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  slotAssignMissingText: {
    marginLeft: 6,
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  stockCurrentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  stockLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  stockValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
  },
  stockInputContainer: {
    gap: 8,
  },
  stockInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  toggleStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  toggleStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  facingToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  facingToggleChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facingToggleChipActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#f87171',
  },
  facingToggleText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  facingToggleTextActive: {
    color: '#b91c1c',
  },
  emptyStock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStockText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#f3f4f6',
    flex: 0.5,
  },
  closeButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});
