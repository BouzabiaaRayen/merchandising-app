import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Alert,
  Modal
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { visitService, storeService, documentService } from '../services/apiService';

const ReportsScreen = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [todayData, setTodayData] = useState(null);
  // Removed PDF generation state and logic
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchTodayData();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchTodayData();
    }, [])
  );

  const fetchTodayData = async () => {
    try {
      setLoading(true);
      
      // Get work day start time from AsyncStorage
      const dayStartTime = await AsyncStorage.getItem('dayStartTime');
      const dayStarted = await AsyncStorage.getItem('dayStarted');
      const isDayInProgress = dayStarted === 'true' && !!dayStartTime;
      
      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch all visits
      const visitsResponse = await visitService.getVisits({ page_size: 1000 });
      const allVisits = visitsResponse.results || visitsResponse;
      
      // Filter today's visits for current user
      const todayVisits = allVisits.filter(v => {
        const matchUser = v.merchandiser === user?.id || v.user === user?.id || 
                          v.merchandiser_id === user?.id || v.user_id === user?.id;
        const visitDate = v.scheduled_date?.split('T')[0];
        return matchUser && visitDate === today;
      });
      
      // Get completed visits
      const completedVisits = todayVisits.filter(v => v.status === 'completed');
      
      // Fetch store details for completed visits
      const storesData = [];
      for (const visit of completedVisits) {
        if (visit.store) {
          try {
            const store = await storeService.getStore(visit.store);
            
            // Calculate time spent in store
            let timeSpent = 'N/A';
            if (visit.check_in_time && visit.check_out_time) {
              const checkIn = new Date(visit.check_in_time);
              const checkOut = new Date(visit.check_out_time);
              const diff = Math.floor((checkOut - checkIn) / 1000);
              const hours = Math.floor(diff / 3600);
              const minutes = Math.floor((diff % 3600) / 60);
              timeSpent = `${hours}h ${minutes}m`;
            }
            
            // Extract break information
            const breakData = {
              breakStartTime: visit.break_start_time ? new Date(visit.break_start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null,
              breakEndTime: visit.break_end_time ? new Date(visit.break_end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null,
              allowedDuration: visit.break_duration || 30,
              actualDuration: visit.break_took || null,
              overtime: visit.break_took && visit.break_duration && visit.break_took > visit.break_duration ? visit.break_took - visit.break_duration : 0,
              missed: !visit.break_start_time && visit.break_duration ? true : false,
            };
            
            storesData.push({
              name: store.name,
              address: store.address,
              checkInTime: visit.check_in_time || visit.checked_in_at,
              checkOutTime: visit.check_out_time,
              timeSpent,
              notes: visit.notes || 'Aucune note',
              // Note: photos and stock data would come from visit object if available
              // For now using placeholder values
              photosCount: 4, // Assumed completed visits have 4 photos
              stockUpdated: true,
              break: breakData,
            });
          } catch (error) {
            console.error('Error fetching store:', error);
          }
        }
      }
      
      // Calculate hours worked
      let hoursWorked = '0h 0m';
      if (dayStarted === 'true' && dayStartTime) {
        const startTime = parseInt(dayStartTime);
        const now = Date.now();
        const elapsed = now - startTime;
        const hours = Math.floor(elapsed / (1000 * 60 * 60));
        const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
        hoursWorked = `${hours}h ${minutes}m`;
      }
      
      setTodayData({
        date: new Date().toLocaleDateString('fr-FR', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        storesVisited: completedVisits.length,
        hoursWorked,
        stores: storesData,
        dayStartTime: dayStartTime ? new Date(parseInt(dayStartTime)).toLocaleTimeString('fr-FR') : null,
        reportStatus: isDayInProgress ? 'En cours' : 'Closed',
        reportStatusIcon: isDayInProgress ? 'clock-outline' : 'check-circle',
        reportStatusTextColor: isDayInProgress ? '#f59e0b' : '#10b981',
        reportStatusBgColor: isDayInProgress ? '#fef3c7' : '#d1fae5',
      });
      
    } catch (error) {
      console.error('Error fetching today data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  // Removed generatePDF logic. Only end-of-day report is kept.

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <MaterialCommunityIcons name="clipboard-text" size={28} color="#6366f1" />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.sectionTitle}>AUJOURD'HUI</Text>
          
          {todayData ? (
            <TouchableOpacity 
              style={styles.reportCard}
              activeOpacity={0.7}
              onPress={() => setShowDetailsModal(true)}
            >
              <View style={styles.reportHeader}>
                <Text style={styles.dateText}>{todayData.date}</Text>
                <View style={[styles.statusBadge, { backgroundColor: todayData.reportStatusBgColor || '#d1fae5' }]}>
                  <MaterialCommunityIcons
                    name={todayData.reportStatusIcon || 'check-circle'}
                    size={14}
                    color={todayData.reportStatusTextColor || '#10b981'}
                  />
                  <Text style={[styles.statusText, { color: todayData.reportStatusTextColor || '#10b981' }]}> 
                    {todayData.reportStatus || 'Closed'}
                  </Text>
                </View>
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="store" size={24} color="#6366f1" />
                  <Text style={styles.statNumber}>{todayData.storesVisited}</Text>
                  <Text style={styles.statLabel}>MAGASINS VISITÉS</Text>
                </View>

                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="clock-outline" size={24} color="#f59e0b" />
                  <Text style={styles.statNumber}>{todayData.hoursWorked}</Text>
                  <Text style={styles.statLabel}>HEURES TRAVAILLÉES</Text>
                </View>
              </View>
              
              {/* PDF generation button removed. Only end-of-day report is available. */}
              
              <View style={styles.viewDetailsHint}>
                <MaterialCommunityIcons name="gesture-tap" size={16} color="#6366f1" />
                <Text style={styles.viewDetailsText}>Appuyez pour voir les détails</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="file-document-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>Aucune donnée disponible</Text>
            </View>
          )}
        </ScrollView>
      )}
      
      {/* Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
              <MaterialCommunityIcons name="close" size={28} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Détails du Rapport</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {todayData && (
              <>
                {/* Summary Section */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Résumé de la Journée</Text>
                  <View style={styles.modalSummaryCard}>
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>Date:</Text>
                      <Text style={styles.modalSummaryValue}>{todayData.date}</Text>
                    </View>
                    {todayData.dayStartTime && (
                      <View style={styles.modalSummaryRow}>
                        <Text style={styles.modalSummaryLabel}>Début de journée:</Text>
                        <Text style={styles.modalSummaryValue}>{todayData.dayStartTime}</Text>
                      </View>
                    )}
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>Statut:</Text>
                      <Text style={[styles.modalSummaryValue, { color: todayData.reportStatusTextColor || '#10b981' }]}>
                        {todayData.reportStatus || 'Closed'}
                      </Text>
                    </View>
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>Heures travaillées:</Text>
                      <Text style={[styles.modalSummaryValue, { color: '#f59e0b' }]}>{todayData.hoursWorked}</Text>
                    </View>
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>Magasins visités:</Text>
                      <Text style={[styles.modalSummaryValue, { color: '#6366f1' }]}>{todayData.storesVisited}</Text>
                    </View>
                  </View>
                </View>

                {/* Stores Details Section */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Détails des Visites</Text>
                  {todayData.stores.length > 0 ? (
                    todayData.stores.map((store, index) => (
                      <View key={index} style={styles.detailStoreCard}>
                        <View style={styles.detailStoreHeader}>
                          <View style={styles.detailStoreNumber}>
                            <Text style={styles.detailStoreNumberText}>{index + 1}</Text>
                          </View>
                          <View style={styles.detailStoreHeaderContent}>
                            <Text style={styles.detailStoreName}>{store.name}</Text>
                            <Text style={styles.detailStoreAddress}>{store.address}</Text>
                          </View>
                        </View>

                        <View style={styles.detailStoreInfo}>
                          <View style={styles.detailInfoRow}>
                            <MaterialCommunityIcons name="login" size={16} color="#10b981" />
                            <Text style={styles.detailInfoLabel}>Arrivée:</Text>
                            <Text style={styles.detailInfoValue}>
                              {store.checkInTime ? new Date(store.checkInTime).toLocaleTimeString('fr-FR') : 'N/A'}
                            </Text>
                          </View>
                          
                          <View style={styles.detailInfoRow}>
                            <MaterialCommunityIcons name="logout" size={16} color="#ef4444" />
                            <Text style={styles.detailInfoLabel}>Départ:</Text>
                            <Text style={styles.detailInfoValue}>
                              {store.checkOutTime ? new Date(store.checkOutTime).toLocaleTimeString('fr-FR') : 'N/A'}
                            </Text>
                          </View>
                          
                          <View style={styles.detailInfoRow}>
                            <MaterialCommunityIcons name="clock-outline" size={16} color="#f59e0b" />
                            <Text style={styles.detailInfoLabel}>Temps passé:</Text>
                            <Text style={[styles.detailInfoValue, { fontWeight: '700', color: '#f59e0b' }]}>
                              {store.timeSpent}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.detailStoreActions}>
                          <View style={styles.detailActionChip}>
                            <MaterialCommunityIcons name="camera" size={14} color="#10b981" />
                            <Text style={styles.detailActionText}>{store.photosCount} Photos</Text>
                          </View>
                          
                          <View style={styles.detailActionChip}>
                            <MaterialCommunityIcons name="package-variant" size={14} color="#6366f1" />
                            <Text style={styles.detailActionText}>
                              {store.stockUpdated ? 'Stock Mis à Jour' : 'Stock Non Mis à Jour'}
                            </Text>
                          </View>
                        </View>

                        {store.notes && (
                          <View style={styles.detailStoreNotes}>
                            <Text style={styles.detailNotesLabel}>Notes:</Text>
                            <Text style={styles.detailNotesText}>{store.notes}</Text>
                          </View>
                        )}
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>Aucune visite complétée</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? 40 : 0
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
    marginTop: 10
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b'
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  dateText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14
  },
  statusText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '700'
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingVertical: 8
  },
  statItem: {
    alignItems: 'center',
    flex: 1
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 8,
    marginBottom: 4
  },
  statLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: 0.3
  },
  downloadButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 10
  },
  downloadButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  downloadButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  viewDetailsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  viewDetailsText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  modalSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalSummaryLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  modalSummaryValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '700',
  },
  detailStoreCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  detailStoreHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailStoreNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailStoreNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  detailStoreHeaderContent: {
    flex: 1,
  },
  detailStoreName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  detailStoreAddress: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  detailStoreInfo: {
    marginBottom: 12,
  },
  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  detailInfoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  detailInfoValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  detailStoreActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  detailActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  detailActionText: {
    fontSize: 11,
    color: '#1e293b',
    fontWeight: '600',
  },
  detailStoreNotes: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  detailNotesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  detailNotesText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 18,
  },
});

export default ReportsScreen;
