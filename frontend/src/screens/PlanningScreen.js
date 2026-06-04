import React, { useEffect, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { visitService, storeService } from '../services/apiService';

const MAX_CHECK_IN_DISTANCE_METERS = 60;

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfWeek = (date) => {
  const baseDate = new Date(date);
  const day = baseDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  baseDate.setDate(baseDate.getDate() + diff);
  baseDate.setHours(0, 0, 0, 0);
  return baseDate;
};

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

export default function PlanningScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekDays, setWeekDays] = useState([]);
  const [visits, setVisits] = useState([]);
  const [stores, setStores] = useState({});
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [plannedDateMarkers, setPlannedDateMarkers] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [storeDistances, setStoreDistances] = useState({});

  useEffect(() => {
    generateWeekDays();
    fetchPlanningData();
  }, [selectedDate]);

  // Refresh data and GPS when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchPlanningData();
      fetchUserLocation();
    }, [selectedDate])
  );

  useEffect(() => {
    if (!userLocation || !Object.keys(stores).length) return;
    const distMap = {};
    Object.values(stores).forEach((store) => {
      if (store.latitude && store.longitude) {
        distMap[store.id] = haversineDistance(
          userLocation.latitude, userLocation.longitude,
          Number(store.latitude), Number(store.longitude)
        );
      }
    });
    setStoreDistances(distMap);
  }, [userLocation, stores]);

  const fetchUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation(loc.coords);
    } catch (_) {}
  };

  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const handleCardCheckIn = (visit) => {
    navigation.navigate('VisitExecution', { visitId: visit.id, autoCheckIn: true });
  };

  const handleResumeVisit = async (visit) => {
    try {
      const saved = await AsyncStorage.getItem(`visitProgress_${visit.id}`);
      const progress = saved ? JSON.parse(saved) : {};
      const resumeStep = progress.currentStep || 1;
      navigation.navigate('VisitExecution', { visitId: visit.id, resumeStep });
    } catch (_) {
      navigation.navigate('VisitExecution', { visitId: visit.id });
    }
  };

  const generateWeekDays = () => {
    const days = [];
    const startOfWeek = getStartOfWeek(selectedDate);

    for (let i = 0; i < 7; i++) {
      days.push(addDays(startOfWeek, i));
    }
    setWeekDays(days);
  };

  const fetchPlanningData = async () => {
    try {
      setLoading(true);
      
      const selectedDateStr = toDateKey(selectedDate);
      
      // Fetch all visits
      const visitsResponse = await visitService.getVisits({ page_size: 1000 });
      const allVisits = visitsResponse.results || visitsResponse;
      
      // Filter visits for current user and selected date
      const userVisits = user?.id 
        ? allVisits.filter(v => {
            const match = v.merchandiser === user.id || 
                         v.user === user.id || 
                         v.merchandiser_id === user.id ||
                         v.user_id === user.id;
            return match;
          })
        : allVisits;

      const nextMarkers = {};
      userVisits.forEach((visit) => {
        if (!visit.scheduled_date) return;
        const visitDate = visit.scheduled_date.split('T')[0];
        nextMarkers[visitDate] = {
          marked: true,
          dotColor: visit.status === 'completed' ? '#10b981' : visit.status === 'in_progress' ? '#2563eb' : '#f59e0b',
        };
      });
      setPlannedDateMarkers(nextMarkers);
      
      const dateVisits = userVisits.filter(v => {
        if (!v.scheduled_date) return false;
        const visitDate = v.scheduled_date.split('T')[0];
        return visitDate === selectedDateStr;
      });
      
      // Sort by scheduled time
      dateVisits.sort((a, b) => {
        const timeA = new Date(a.scheduled_date).getTime();
        const timeB = new Date(b.scheduled_date).getTime();
        return timeA - timeB;
      });
      
      setVisits(dateVisits);
      
      // Fetch stores
      const storesResponse = await storeService.getStores({ page_size: 1000 });
      const storesData = storesResponse.results || storesResponse;
      
      const storesMap = {};
      storesData.forEach(store => {
        storesMap[store.id] = store;
      });
      setStores(storesMap);
      
    } catch (error) {
      console.error('Error fetching planning data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPlanningData();
    setRefreshing(false);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleCalendarDaySelect = (day) => {
    const [year, month, date] = day.dateString.split('-').map(Number);
    setSelectedDate(new Date(year, month - 1, date));
    setShowCalendarModal(false);
  };

  const formatTime = (dateTimeString) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    }).toUpperCase();
  };

  // Find the first visit that is not completed — only that one (and completed ones) are tappable
  const firstPendingIndex = visits.findIndex(v => v.status?.toUpperCase() !== 'COMPLETED');

  const getVisitStatusInfo = (visit, index) => {
    const status = visit.status?.toUpperCase() || 'SCHEDULED';
    const isLocked = firstPendingIndex !== -1 && index > firstPendingIndex;
    
    if (status === 'COMPLETED') {
      return {
        label: 'DONE',
        color: '#10b981',
        dotColor: '#10b981',
        showButton: false,
        locked: false
      };
    } else if (status === 'IN_PROGRESS') {
      return {
        label: 'CURRENT',
        color: '#3b82f6',
        dotColor: '#3b82f6',
        showButton: true,
        locked: false
      };
    } else if (isLocked) {
      return {
        label: 'LOCKED',
        color: '#d1d5db',
        dotColor: '#e5e7eb',
        showButton: false,
        locked: true
      };
    } else {
      return {
        label: 'PLANNED',
        color: '#9ca3af',
        dotColor: '#d1d5db',
        showButton: false,
        locked: false
      };
    }
  };

  const handleCheckOut = async (visitId) => {
    try {
      await visitService.checkOut(visitId);
      await fetchPlanningData();
    } catch (error) {
      console.error('Error checking out:', error);
    }
  };

  const completedCount = visits.filter(v => v.status === 'completed').length;
  const totalCount = visits.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const remainingCount = totalCount - completedCount;

  const getDayLabel = (date) => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return days[date.getDay()];
  };

  const formatSelectedDate = (date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

  const formatWeekRange = (days) => {
    if (!days.length) return '';
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    const sameMonth = firstDay.getMonth() === lastDay.getMonth();

    if (sameMonth) {
      return `${firstDay.toLocaleDateString('en-US', { month: 'long' })} ${firstDay.getDate()} - ${lastDay.getDate()}`;
    }

    return `${firstDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${lastDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const isSelectedDate = (date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const calendarMarkedDates = {
    ...plannedDateMarkers,
    [toDateKey(selectedDate)]: {
      ...(plannedDateMarkers[toDateKey(selectedDate)] || {}),
      selected: true,
      selectedColor: '#2563eb',
      selectedTextColor: '#ffffff',
    },
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Schedule</Text>
            <Text style={styles.headerSubtitle}>{formatSelectedDate(selectedDate)}</Text>
          </View>
          <TouchableOpacity style={styles.headerCalendarBtn} onPress={() => setShowCalendarModal(true)}>
            <MaterialCommunityIcons name="calendar-month-outline" size={21} color="#2563eb" />
          </TouchableOpacity>
        </View>

        {/* Week Days Selector */}
        <View style={styles.weekSelector}>
          {weekDays.map((day, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayButton,
                isSelectedDate(day) && styles.dayButtonActive
              ]}
              onPress={() => handleDateSelect(day)}
            >
              <Text style={[
                styles.dayLabel,
                isSelectedDate(day) && styles.dayLabelActive
              ]}>
                {getDayLabel(day)}
              </Text>
              <Text style={[
                styles.dayNumber,
                isSelectedDate(day) && styles.dayNumberActive
              ]}>
                {day.getDate()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Schedule Section */}
          <View style={styles.scheduleSection}>
            <Text style={styles.sectionTitle}>SCHEDULE</Text>
            
            {loading ? (
              <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
            ) : visits.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No visits scheduled for this day</Text>
              </View>
            ) : (
              <View style={styles.timeline}>
                {visits.map((visit, index) => {
                  const store = stores[visit.store];
                  const statusInfo = getVisitStatusInfo(visit, index);
                  const scheduledTime = formatTime(visit.scheduled_date);
                  const endTime = visit.scheduled_end_time 
                    ? formatTime(visit.scheduled_end_time)
                    : formatTime(new Date(new Date(visit.scheduled_date).getTime() + 2 * 60 * 60 * 1000)); // +2 hours default
                  
                  return (
                    <View key={visit.id} style={styles.timelineItem}>
                      {/* Timeline Line & Dot */}
                      <View style={styles.timelineTrack}>
                        {index > 0 && (
                          <View style={[
                            styles.timelineLine,
                            { backgroundColor: visits[index - 1].status === 'completed' ? '#10b981' : '#e5e7eb' }
                          ]} />
                        )}
                        <View style={[styles.timelineDot, { backgroundColor: statusInfo.dotColor }]} />
                        {index < visits.length - 1 && (
                          <View style={[
                            styles.timelineLine,
                            styles.timelineLineBottom,
                            { backgroundColor: visit.status === 'completed' ? '#10b981' : '#e5e7eb' }
                          ]} />
                        )}
                      </View>

                      {/* Visit Card */}
                      {(() => {
                          const dist = store ? storeDistances[store.id] : undefined;
                          const isNearby = dist !== undefined && dist <= MAX_CHECK_IN_DISTANCE_METERS;
                          const isInProgress = visit.status === 'in_progress';
                          const isCompleted = visit.status === 'completed';

                          const handlePress = () => {
                            if (statusInfo.locked) {
                              Alert.alert('Visit Locked', 'Complete the previous visit before starting this one.');
                              return;
                            }
                            if (isCompleted) return;
                            if (isInProgress) { handleResumeVisit(visit); return; }
                            if (isNearby) { handleCardCheckIn(visit); return; }
                            Alert.alert(
                              'Too Far',
                              dist !== undefined
                                ? `You are ${dist}m from the store. Move within ${MAX_CHECK_IN_DISTANCE_METERS}m to check in.`
                                : 'Getting your location...'
                            );
                          };

                          return (
                            <TouchableOpacity
                              style={[
                                styles.visitCard,
                                isInProgress && styles.visitCardActive,
                                statusInfo.locked && styles.visitCardLocked,
                              ]}
                              onPress={handlePress}
                              activeOpacity={isCompleted || statusInfo.locked ? 1 : 0.7}
                            >
                              <View style={styles.visitHeader}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                  <Text style={styles.storeName} numberOfLines={1}>
                                    {store?.name || visit.store_name || 'Unknown Store'}
                                  </Text>
                                  {(store?.address || store?.city) && (
                                    <Text style={styles.storeAddress} numberOfLines={1}>
                                      {store?.address || store?.city}
                                    </Text>
                                  )}
                                </View>

                                {isCompleted ? (
                                  <View style={[styles.statusBadge, { backgroundColor: '#d1fae5' }]}>
                                    <Text style={[styles.statusText, { color: '#059669' }]}>DONE</Text>
                                  </View>
                                ) : statusInfo.locked ? (
                                  <View style={[styles.statusBadge, { backgroundColor: '#f3f4f6' }]}>
                                    <MaterialCommunityIcons name="lock-outline" size={13} color="#9ca3af" />
                                  </View>
                                ) : isInProgress ? (
                                  <TouchableOpacity
                                    style={styles.resumeBtn}
                                    onPress={(e) => { e.stopPropagation(); handleResumeVisit(visit); }}
                                  >
                                    <MaterialCommunityIcons name="play-circle-outline" size={13} color="#fff" />
                                    <Text style={styles.resumeBtnText}>Resume</Text>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity
                                    style={[styles.checkinBtn, !isNearby && styles.checkinBtnFaded]}
                                    disabled={!isNearby}
                                    onPress={(e) => { e.stopPropagation(); if (isNearby) handleCardCheckIn(visit); }}
                                  >
                                    <MaterialCommunityIcons
                                      name={isNearby ? 'login-variant' : 'map-marker-distance'}
                                      size={13}
                                      color={isNearby ? '#fff' : '#9ca3af'}
                                    />
                                    <Text style={[styles.checkinBtnText, !isNearby && styles.checkinBtnTextFaded]}>
                                      {isNearby ? 'Check-in' : dist !== undefined ? `${dist}m` : '...'}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })()}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      <Modal
        visible={showCalendarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalCard}>
            <View style={styles.calendarModalHeader}>
              <View>
                <Text style={styles.calendarModalEyebrow}>Planning Calendar</Text>
                <Text style={styles.calendarModalTitle}>Choose a day</Text>
              </View>
              <TouchableOpacity style={styles.calendarCloseButton} onPress={() => setShowCalendarModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Calendar
              current={toDateKey(selectedDate)}
              markedDates={calendarMarkedDates}
              onDayPress={handleCalendarDaySelect}
              theme={{
                todayTextColor: '#2563eb',
                selectedDayBackgroundColor: '#2563eb',
                arrowColor: '#2563eb',
                monthTextColor: '#111827',
                textDayFontWeight: '600',
                textMonthFontWeight: '700',
                textDayHeaderFontWeight: '700',
              }}
            />

            <Text style={styles.calendarHintText}>
              Tap any day to see what is planned for that date.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 15, color: '#6b7280', fontWeight: '600', marginTop: 3 },
  headerCalendarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  // Week strip
  weekSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dayButton: {
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 40,
  },
  dayButtonActive: { backgroundColor: '#eff6ff' },
  dayLabel: { fontSize: 11, fontWeight: '500', color: '#9ca3af', marginBottom: 3 },
  dayLabelActive: { color: '#2563eb' },
  dayNumber: { fontSize: 15, fontWeight: '600', color: '#374151' },
  dayNumberActive: { color: '#2563eb', fontWeight: '800' },

  // Content
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },

  // Slim Progress Strip
  progressStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  progressStripZero: { borderColor: '#f3f4f6' },
  progressStripLeft: { width: 58 },
  progressStripCount: { fontSize: 13, fontWeight: '700', color: '#111827' },
  progressStripCountZero: { color: '#9ca3af' },
  progressRouteId: { fontSize: 10, color: '#9ca3af', fontWeight: '500', marginTop: 1 },
  progressStripBarWrap: {
    flex: 1,
    height: 5,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  progressStripFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 3 },
  progressStripPct: { fontSize: 13, fontWeight: '700', color: '#2563eb', width: 38, textAlign: 'right' },
  progressStripPctZero: { color: '#d1d5db' },

  // Schedule
  scheduleSection: { marginBottom: 80 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: '#9ca3af', marginTop: 12 },

  // Timeline
  timeline: { position: 'relative' },
  timelineItem: { flexDirection: 'row', marginBottom: 14 },
  timelineTrack: { width: 36, alignItems: 'center', marginRight: 12 },
  timelineLine: { width: 2, flex: 1, position: 'absolute', top: 0, height: 20 },
  timelineLineBottom: { top: 20, height: '100%' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 8, zIndex: 1 },

  // Visit card
  visitCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  visitCardActive: {
    borderColor: '#2563eb',
    borderWidth: 1.5,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  visitCardLocked: { opacity: 0.45, backgroundColor: '#f9fafb' },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  storeName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  storeAddress: { fontSize: 11, color: '#9ca3af' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  checkinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  checkinBtnFaded: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  checkinBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  checkinBtnTextFaded: { color: '#9ca3af' },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7c3aed',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  resumeBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Calendar modal
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  calendarModalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarModalEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  calendarModalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  calendarCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#f8fafc',
  },
  calendarHintText: { marginTop: 12, fontSize: 13, color: '#64748b', textAlign: 'center' },
});
