import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { visitService, storeService } from '../services/apiService';

export default function PlanningScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekDays, setWeekDays] = useState([]);
  const [visits, setVisits] = useState([]);
  const [stores, setStores] = useState({});

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
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday

    for (let i = 0; i < 5; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    setWeekDays(days);
  };

  const fetchPlanningData = async () => {
    try {
      setLoading(true);
      
      const selectedDateStr = selectedDate.toISOString().split('T')[0];
      
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

  const formatTime = (dateTimeString) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    }).toUpperCase();
  };

  const getVisitStatusInfo = (visit, index) => {
    const status = visit.status?.toUpperCase() || 'SCHEDULED';
    
    if (status === 'COMPLETED') {
      return {
        label: 'DONE',
        color: '#10b981',
        dotColor: '#10b981',
        showButton: false
      };
    } else if (status === 'IN_PROGRESS') {
      return {
        label: 'CURRENT',
        color: '#3b82f6',
        dotColor: '#3b82f6',
        showButton: true
      };
    } else {
      return {
        label: 'PLANNED',
        color: '#9ca3af',
        dotColor: '#d1d5db',
        showButton: false
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

  const isSelectedDate = (date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIcon}>
            <MaterialCommunityIcons name="calendar-blank" size={24} color="#2563eb" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Planning</Text>
          <TouchableOpacity style={styles.headerIcon}>
            <MaterialCommunityIcons name="magnify" size={24} color="#666" />
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
                <Text style={styles.progressTitle}>Daily Progress</Text>
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
                          visit.status === 'in_progress' && styles.visitCardActive
                        ]}
                        onPress={() => navigation.navigate('VisitExecution', { visitId: visit.id })}
                      >
                        <View style={styles.visitHeader}>
                          <Text style={styles.storeName}>
                            {store?.name || visit.store_name || 'Unknown Store'}
                          </Text>
                          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                            <Text style={styles.statusText}>{statusInfo.label}</Text>
                          </View>
                        </View>
                        
                        <Text style={styles.visitTime}>
                          {scheduledTime} - {endTime}
                        </Text>

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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  weekSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dayButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
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
});
