import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    generateWeekDays();
    fetchPlanningData();
  }, [selectedDate]);

  // Refresh data when screen comes into focus (e.g., after checkout)
  useFocusEffect(
    React.useCallback(() => {
      fetchPlanningData();
    }, [selectedDate])
  );

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
          <TouchableOpacity style={styles.headerIcon} onPress={() => setShowCalendarModal(true)}>
            <MaterialCommunityIcons name="calendar-blank" size={24} color="#2563eb" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Weekly Planning</Text>
            <Text style={styles.headerSubtitle}>{formatWeekRange(weekDays)}</Text>
          </View>
          <TouchableOpacity style={styles.headerIcon}>
            <MaterialCommunityIcons name="magnify" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.selectedDateBanner}>
          <View>
            <Text style={styles.selectedDateLabel}>Selected day</Text>
            <Text style={styles.selectedDateValue}>{formatSelectedDate(selectedDate)}</Text>
          </View>
          <TouchableOpacity style={styles.changeDateButton} onPress={() => setShowCalendarModal(true)}>
            <Text style={styles.changeDateButtonText}>Open calendar</Text>
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
          {/* Daily Progress Card */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressTitle}>Selected Day Progress</Text>
                <Text style={styles.routeId}>Route ID: #MR-4029</Text>
              </View>
              <Text style={styles.progressPercent}>{progressPercent}%</Text>
            </View>
            
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
            </View>
            
            <View style={styles.progressStats}>
              <Text style={styles.progressStatLeft}>
                {completedCount} OF {totalCount} STORES
              </Text>
              <Text style={styles.progressStatRight}>
                {remainingCount} REMAINING
              </Text>
            </View>
          </View>

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
                      <TouchableOpacity 
                        style={[
                          styles.visitCard,
                          visit.status === 'in_progress' && styles.visitCardActive,
                          statusInfo.locked && styles.visitCardLocked
                        ]}
                        onPress={() => {
                          if (statusInfo.locked) {
                            Alert.alert('Visit verrouillée', 'Vous devez terminer la visite précédente avant de commencer celle-ci.');
                            return;
                          }
                          navigation.navigate('VisitExecution', { visitId: visit.id });
                        }}
                        activeOpacity={statusInfo.locked ? 1 : 0.7}
                      >
                        <View style={styles.visitHeader}>
                          <Text style={styles.storeName}>
                            {store?.name || visit.store_name || 'Unknown Store'}
                          </Text>
                          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                            <Text style={styles.statusText}>{statusInfo.label}</Text>
                          </View>
                        </View>
                        
                        {/* Removed scheduled time display as requested */}

                        {statusInfo.showButton && (
                          <TouchableOpacity
                            style={styles.checkoutButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleCheckOut(visit.id);
                            }}
                          >
                            <Text style={styles.checkoutButtonText}>Check-out</Text>
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
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
  safe: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
  },
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
  headerIcon: {
    padding: 4,
    minWidth: 32,
  },
  headerTitleWrap: {
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  selectedDateBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#eef4ff',
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
  },
  selectedDateLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  selectedDateValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  changeDateButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#2563eb',
  },
  changeDateButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  weekSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dayButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 42,
  },
  dayButtonActive: {
    backgroundColor: '#eff6ff',
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  dayLabelActive: {
    color: '#2563eb',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  dayNumberActive: {
    color: '#2563eb',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  progressCard: {
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
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  routeId: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressPercent: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563eb',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStatLeft: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111',
  },
  progressStatRight: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  scheduleSection: {
    marginBottom: 80,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  timeline: {
    position: 'relative',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineTrack: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    position: 'absolute',
    top: 0,
    height: 20,
  },
  timelineLineBottom: {
    top: 20,
    height: '100%',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 8,
    zIndex: 1,
  },
  visitCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  visitCardActive: {
    borderColor: '#2563eb',
    borderWidth: 2,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  visitCardLocked: {
    opacity: 0.5,
    backgroundColor: '#f3f4f6',
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  visitTime: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  checkoutButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  checkoutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
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
  calendarModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  calendarCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#f8fafc',
  },
  calendarHintText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
});
