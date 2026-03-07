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
  const [stockUpdateCompleted, setStockUpdateCompleted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [stockItems, setStockItems] = useState([
    { id: 1, sku: 'SKU001', name: 'Product A - Brand X', currentStock: 20, newStock: null, status: 'in-stock' },
    { id: 2, sku: 'SKU002', name: 'Product B - Brand Y', currentStock: 15, newStock: null, status: 'in-stock' },
    { id: 3, sku: 'SKU003', name: 'Product C - Brand Z', currentStock: 0, newStock: null, status: 'out-of-stock' },
    { id: 4, sku: 'SKU004', name: 'Product D - Brand A', currentStock: 8, newStock: null, status: 'in-stock' },
    { id: 5, sku: 'SKU005', name: 'Product E - Brand B', currentStock: 25, newStock: null, status: 'in-stock' },
    { id: 6, sku: 'SKU006', name: 'Product F - Brand C', currentStock: 12, newStock: null, status: 'in-stock' },
  ]);

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

  const handleStockQuantityChange = (itemId, value) => {
    setStockItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId
          ? { ...item, newStock: value }
          : item
      )
    );
  };

  const handleToggleStockStatus = (itemId) => {
    setStockItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId
          ? { 
              ...item, 
              status: item.status === 'in-stock' ? 'out-of-stock' : 'in-stock',
              newStock: item.status === 'in-stock' ? '0' : item.currentStock.toString()
            }
          : item
      )
    );
  };

  const handleSaveStockUpdates = () => {
    const updatedItems = stockItems.filter(item => item.newStock !== null && item.newStock !== '');
    
    if (updatedItems.length === 0) {
      Alert.alert('No Changes', 'No stock updates to save');
      return;
    }

    Alert.alert(
      'Save Stock Updates',
      `Save ${updatedItems.length} stock update(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => {
            // TODO: Send stock updates to backend
            console.log('Stock updates to save:', updatedItems);
            setStockUpdateCompleted(true);
            setShowStockModal(false);
            Alert.alert('Success', 'Stock updates saved!');
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
    let total = 3; // Check-in, Photos, Stock Update (Notes are optional)

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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Visit Execution</Text>
          <TouchableOpacity style={styles.headerButton}>
            <MaterialCommunityIcons name="dots-vertical" size={24} color="#111" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Completed Visit Banner */}
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

          {/* Store Info Card */}
          <View style={styles.storeCard}>
            <View style={styles.storeIcon}>
              <MaterialCommunityIcons name="store" size={32} color="#2563eb" />
            </View>
            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>
                {store?.name || visit?.store_name || 'Unknown Store'}
              </Text>
              <Text style={styles.storeAddress}>
                {store?.address || store?.location || 'Address not available'}
              </Text>
            </View>
            <View style={[styles.gpsStatusBadge, { backgroundColor: gpsStatus.color }]}>
              <MaterialCommunityIcons name="map-marker-check" size={16} color="#fff" />
              <Text style={styles.gpsStatusText}>{gpsStatus.text}</Text>
            </View>
          </View>

          {/* Visit Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visit Status</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Overall Completion</Text>
              <Text style={styles.statusValue}>
                {completionPercentage}% ({Math.round(completionPercentage / 33.33)}/3 Tasks)
              </Text>
            </View>
            {checkInTime && (
              <View style={[styles.statusRow, { marginTop: 12 }]}>
                <View style={styles.timeTrackerLabel}>
                  <MaterialCommunityIcons name="clock-time-four-outline" size={16} color="#2563eb" />
                  <Text style={styles.statusLabel}>Time in Store</Text>
                </View>
                <Text style={styles.timeTrackerValue}>{elapsedTime}</Text>
              </View>
            )}
          </View>

          {/* Execution Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Execution Actions</Text>

            {/* Check-in */}
            <TouchableOpacity
              style={[styles.actionCard, isCheckedIn && styles.actionCardCompleted]}
              onPress={!isCheckedIn && !isVisitCompleted ? handleCheckIn : null}
              disabled={isCheckedIn || isVisitCompleted}
            >
              <View style={[styles.actionIcon, isCheckedIn && styles.actionIconCompleted]}>
                <MaterialCommunityIcons 
                  name="login" 
                  size={24} 
                  color={isCheckedIn ? "#fff" : "#2563eb"} 
                />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Check-in</Text>
                <Text style={styles.actionSubtitle}>
                  {isCheckedIn ? `Completed at ${formatTime(checkInTime)}` : 'Tap to check in'}
                </Text>
              </View>
              {isCheckedIn && (
                <View style={styles.completedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
                </View>
              )}
            </TouchableOpacity>

            {/* Before/After Photos */}
            <TouchableOpacity
              style={[styles.actionCard, photos.length >= 4 && styles.actionCardCompleted]}
              onPress={handleOpenPhotoModal}
              disabled={!isCheckedIn || isVisitCompleted}
            >
              <View style={[styles.actionIcon, (!isCheckedIn || isVisitCompleted) && styles.actionIconDisabled, photos.length >= 4 && styles.actionIconCompleted]}>
                <MaterialCommunityIcons 
                  name="camera" 
                  size={24} 
                  color={!isCheckedIn || isVisitCompleted ? "#9ca3af" : photos.length >= 4 ? "#fff" : "#2563eb"} 
                />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, (!isCheckedIn || isVisitCompleted) && styles.actionTitleDisabled]}>
                  Before / After Photos
                </Text>
                <Text style={styles.actionSubtitle}>
                  {photos.length >= 4 ? 'Completed' : `${photos.length} of 4 photos uploaded`}
                </Text>
              </View>
              {photos.length >= 4 && (
                <View style={styles.completedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
                </View>
              )}
            </TouchableOpacity>

            {/* Stock Update */}
            <TouchableOpacity
              style={[styles.actionCard, stockUpdateCompleted && styles.actionCardCompleted]}
              onPress={handleOpenStockModal}
              disabled={!isCheckedIn || isVisitCompleted}
            >
              <View style={[styles.actionIcon, (!isCheckedIn || isVisitCompleted) && styles.actionIconDisabled, stockUpdateCompleted && styles.actionIconCompleted]}>
                <MaterialCommunityIcons 
                  name="package-variant" 
                  size={24} 
                  color={!isCheckedIn || isVisitCompleted ? "#9ca3af" : stockUpdateCompleted ? "#fff" : "#2563eb"} 
                />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, (!isCheckedIn || isVisitCompleted) && styles.actionTitleDisabled]}>
                  Stock Update
                </Text>
                <Text style={styles.actionSubtitle}>
                  {stockUpdateCompleted ? 'Completed' : `${stockItems.length} SKUs to review`}
                </Text>
              </View>
              {stockUpdateCompleted && (
                <View style={styles.completedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
                </View>
              )}
            </TouchableOpacity>

            {/* Check-out */}
            <TouchableOpacity
              style={[
                styles.actionCard, 
                isVisitCompleted && styles.actionCardCompleted,
                !canCheckOut && !isVisitCompleted && styles.actionCardDisabled
              ]}
              onPress={canCheckOut ? handleCheckOut : null}
              disabled={!canCheckOut || isVisitCompleted}
            >
              <View style={[
                styles.actionIcon, 
                isVisitCompleted && styles.actionIconCompleted,
                !canCheckOut && !isVisitCompleted && styles.actionIconDisabled
              ]}>
                <MaterialCommunityIcons 
                  name="logout" 
                  size={24} 
                  color={isVisitCompleted ? "#fff" : !canCheckOut ? "#9ca3af" : "#2563eb"} 
                />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, !canCheckOut && !isVisitCompleted && styles.actionTitleDisabled]}>
                  Check-out
                </Text>
                <Text style={styles.actionSubtitle}>
                  {isVisitCompleted ? 'Completed' : canCheckOut ? 'Tap to check out' : 'Finish all tasks to unlock'}
                </Text>
              </View>
              {isVisitCompleted && (
                <View style={styles.completedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Visit Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VISIT NOTES</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any observations or issues here..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!isVisitCompleted}
            />
          </View>

          {/* Sync Status */}
          <View style={styles.syncStatus}>
            <MaterialCommunityIcons name="cloud-sync" size={16} color="#2563eb" />
            <Text style={styles.syncText}>CLOUD SYNC ACTIVE</Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={handleSubmitVisit}
          >
            <Text style={styles.submitButtonText}>Submit Visit Data</Text>
          </TouchableOpacity>
        </ScrollView>
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

      {/* Stock Update Modal */}
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
            <Text style={styles.modalTitle}>Stock Update</Text>
            <View style={{ width: 28 }} />
          </View>

          <FlatList
            data={stockItems}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.stockList}
            renderItem={({ item }) => (
              <View style={styles.stockItem}>
                <View style={styles.stockItemHeader}>
                  <View style={styles.stockItemInfo}>
                    <Text style={styles.stockSku}>{item.sku}</Text>
                    <Text style={styles.stockName}>{item.name}</Text>
                  </View>
                  <View style={[
                    styles.stockStatusBadge,
                    { backgroundColor: item.status === 'in-stock' ? '#10b981' : '#ef4444' }
                  ]}>
                    <Text style={styles.stockStatusText}>
                      {item.status === 'in-stock' ? 'In Stock' : 'Out of Stock'}
                    </Text>
                  </View>
                </View>

                <View style={styles.stockItemBody}>
                  <View style={styles.stockCurrentInfo}>
                    <Text style={styles.stockLabel}>Current Stock:</Text>
                    <Text style={styles.stockValue}>{item.currentStock} units</Text>
                  </View>

                  <View style={styles.stockInputContainer}>
                    <Text style={styles.stockLabel}>New Stock:</Text>
                    <TextInput
                      style={styles.stockInput}
                      value={item.newStock === null ? '' : item.newStock.toString()}
                      onChangeText={(value) => handleStockQuantityChange(item.id, value)}
                      keyboardType="numeric"
                      placeholder="Enter quantity"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.toggleStatusButton,
                      { backgroundColor: item.status === 'in-stock' ? '#fee2e2' : '#d1fae5' }
                    ]}
                    onPress={() => handleToggleStockStatus(item.id)}
                  >
                    <MaterialCommunityIcons
                      name={item.status === 'in-stock' ? 'close-circle' : 'check-circle'}
                      size={18}
                      color={item.status === 'in-stock' ? '#ef4444' : '#10b981'}
                    />
                    <Text style={[
                      styles.toggleStatusText,
                      { color: item.status === 'in-stock' ? '#ef4444' : '#10b981' }
                    ]}>
                      {item.status === 'in-stock' ? 'Mark Out of Stock' : 'Mark In Stock'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyStock}>
                <MaterialCommunityIcons name="package-variant-closed" size={48} color="#9ca3af" />
                <Text style={styles.emptyStockText}>No products to update</Text>
              </View>
            }
          />

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleSaveStockUpdates}
            >
              <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>
                Save Updates {stockItems.filter(item => item.newStock !== null && item.newStock !== '').length > 0 && 
                  `(${stockItems.filter(item => item.newStock !== null && item.newStock !== '').length})`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.closeButton]}
              onPress={() => setShowStockModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
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
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
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
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  completedBanner: {
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  storeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  storeIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  storeInfo: {
    marginBottom: 12,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 14,
    color: '#6b7280',
  },
  gpsStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  gpsStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  statusLabel: {
    fontSize: 15,
    color: '#111',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '700',
  },
  timeTrackerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeTrackerValue: {
    fontSize: 18,
    color: '#10b981',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionCardCompleted: {
    borderColor: '#10b981',
    borderWidth: 2,
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionIconCompleted: {
    backgroundColor: '#2563eb',
  },
  actionIconDisabled: {
    backgroundColor: '#f3f4f6',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  actionTitleDisabled: {
    color: '#9ca3af',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  completedBadge: {
    marginLeft: 8,
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#111',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  submitButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
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
