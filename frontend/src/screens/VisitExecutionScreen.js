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
  Alert
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
  const [locationChecked, setLocationChecked] = useState(false);

  useEffect(() => {
    fetchVisitData();
    getCurrentLocation();
  }, []);

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
      
      if (visitData.store) {
        const storeData = await storeService.getStore(visitData.store);
        setStore(storeData);
        
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
      setLocation(currentLocation);
      setLocationChecked(true);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationChecked(true);
    }
  };

  const calculateDistance = (storeData) => {
    if (!location || !storeData.latitude || !storeData.longitude) return;
    
    const R = 6371e3; // Earth's radius in meters
    const φ1 = location.coords.latitude * Math.PI / 180;
    const φ2 = storeData.latitude * Math.PI / 180;
    const Δφ = (storeData.latitude - location.coords.latitude) * Math.PI / 180;
    const Δλ = (storeData.longitude - location.coords.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const d = R * c;
    setDistance(Math.round(d));
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

      if (distance && distance > 100) {
        Alert.alert(
          'Too Far',
          `You are ${distance}m away from the store. You must be within 100m to check in.`,
          [{ text: 'OK' }]
        );
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
    let total = 4;

    if (checkInTime) completed++;
    if (photos.length >= 4) completed++;
    // Stock update - would need separate state
    // Check-out - counted separately

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
    if (!distance) {
      return { text: 'GPS: CALCULATING...', color: '#3b82f6' };
    }
    if (distance <= 100) {
      return { text: `GPS VERIFIED: WITHIN RANGE (${distance}M)`, color: '#10b981' };
    }
    return { text: `GPS: OUT OF RANGE (${distance}M)`, color: '#ef4444' };
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
  const canCheckOut = completionPercentage >= 100 && isCheckedIn;

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
                {completionPercentage}% ({Math.round(completionPercentage / 25)}/4 Tasks)
              </Text>
            </View>
          </View>

          {/* Execution Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Execution Actions</Text>

            {/* Check-in */}
            <TouchableOpacity
              style={[styles.actionCard, isCheckedIn && styles.actionCardCompleted]}
              onPress={!isCheckedIn ? handleCheckIn : null}
              disabled={isCheckedIn}
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
              style={styles.actionCard}
              onPress={handleTakePhoto}
              disabled={!isCheckedIn}
            >
              <View style={[styles.actionIcon, !isCheckedIn && styles.actionIconDisabled]}>
                <MaterialCommunityIcons 
                  name="camera" 
                  size={24} 
                  color={!isCheckedIn ? "#9ca3af" : "#2563eb"} 
                />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, !isCheckedIn && styles.actionTitleDisabled]}>
                  Before / After Photos
                </Text>
                <Text style={styles.actionSubtitle}>
                  {photos.length} of 4 photos uploaded
                </Text>
              </View>
            </TouchableOpacity>

            {/* Stock Update */}
            <TouchableOpacity
              style={styles.actionCard}
              disabled={!isCheckedIn}
            >
              <View style={[styles.actionIcon, !isCheckedIn && styles.actionIconDisabled]}>
                <MaterialCommunityIcons 
                  name="package-variant" 
                  size={24} 
                  color={!isCheckedIn ? "#9ca3af" : "#2563eb"} 
                />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, !isCheckedIn && styles.actionTitleDisabled]}>
                  Stock Update
                </Text>
                <Text style={styles.actionSubtitle}>
                  24 SKUs pending
                </Text>
              </View>
            </TouchableOpacity>

            {/* Check-out */}
            <TouchableOpacity
              style={[styles.actionCard, !canCheckOut && styles.actionCardDisabled]}
              onPress={canCheckOut ? handleCheckOut : null}
              disabled={!canCheckOut}
            >
              <View style={[styles.actionIcon, !canCheckOut && styles.actionIconDisabled]}>
                <MaterialCommunityIcons 
                  name="logout" 
                  size={24} 
                  color={!canCheckOut ? "#9ca3af" : "#2563eb"} 
                />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, !canCheckOut && styles.actionTitleDisabled]}>
                  Check-out
                </Text>
                <Text style={styles.actionSubtitle}>
                  {canCheckOut ? 'Tap to check out' : 'Finish all tasks to unlock'}
                </Text>
              </View>
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
});
