import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SectionList,
  SafeAreaView, ActivityIndicator, RefreshControl
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { visitService, storeService } from '../services/apiService';

const STATUS_CONFIG = {
  completed:   { label: 'Complétée',  color: '#16a34a', bg: '#dcfce7', icon: 'check-circle' },
  pending:     { label: 'En attente', color: '#f59e0b', bg: '#fef3c7', icon: 'clock-outline' },
  scheduled:   { label: 'Planifiée',  color: '#2563eb', bg: '#dbeafe', icon: 'calendar-clock' },
  cancelled:   { label: 'Annulée',    color: '#ef4444', bg: '#fee2e2', icon: 'close-circle' },
  in_progress: { label: 'En cours',   color: '#8b5cf6', bg: '#ede9fe', icon: 'progress-clock' },
};

export default function RoutesScreen({ navigation }) {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storeMap, setStoreMap] = useState({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [visitsData, storesData] = await Promise.all([
        visitService.getVisits({ page_size: 1000 }),
        storeService.getStores({ page_size: 1000 }),
      ]);

      const visits = (visitsData?.results || visitsData || [])
        .filter(v => String(v.merchandiser) === String(user?.id));

      // Store lookup
      const stores = storesData?.results || storesData || [];
      const map = {};
      stores.forEach(s => { map[s.id] = s; });
      setStoreMap(map);

      // Group by scheduled_date
      const grouped = {};
      visits.forEach(v => {
        const date = v.scheduled_date?.split('T')[0] || 'Sans date';
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(v);
      });

      // Sort dates ascending, build sections
      const today = new Date().toISOString().split('T')[0];
      const sortedDates = Object.keys(grouped).sort();
      // Show today and future first, then past
      const futureDates = sortedDates.filter(d => d >= today);
      const pastDates = sortedDates.filter(d => d < today).reverse();
      const orderedDates = [...futureDates, ...pastDates];

      const secs = orderedDates.map(date => {
        const dayVisits = grouped[date].sort((a, b) => {
          const tA = a.scheduled_date || '';
          const tB = b.scheduled_date || '';
          return tA.localeCompare(tB);
        });
        const completedCount = dayVisits.filter(v => v.status === 'completed').length;
        return {
          date,
          isToday: date === today,
          isPast: date < today,
          completedCount,
          totalCount: dayVisits.length,
          data: dayVisits,
        };
      });

      setSections(secs);
    } catch (err) {
      console.error('Error loading routes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  const formatDateLabel = (dateStr, isToday) => {
    if (dateStr === 'Sans date') return dateStr;
    const d = new Date(dateStr + 'T00:00:00');
    const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return isToday ? `Aujourd'hui — ${label}` : label.charAt(0).toUpperCase() + label.slice(1);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderSectionHeader = ({ section }) => {
    const { date, isToday, isPast, completedCount, totalCount } = section;
    return (
      <View style={[styles.sectionHeader, isToday && styles.sectionHeaderToday]}>
        <View style={styles.sectionLeft}>
          <MaterialCommunityIcons
            name={isToday ? 'map-marker-radius' : isPast ? 'check-all' : 'calendar-arrow-right'}
            size={18}
            color={isToday ? '#2563eb' : isPast ? '#16a34a' : '#6b7280'}
          />
          <Text style={[styles.sectionTitle, isToday && styles.sectionTitleToday]}>
            {formatDateLabel(date, isToday)}
          </Text>
        </View>
        <View style={[styles.progressBadge, { backgroundColor: completedCount === totalCount && totalCount > 0 ? '#dcfce7' : '#f1f5f9' }]}>
          <Text style={[styles.progressText, { color: completedCount === totalCount && totalCount > 0 ? '#16a34a' : '#6b7280' }]}>
            {completedCount}/{totalCount}
          </Text>
        </View>
      </View>
    );
  };

  const renderVisit = ({ item, index, section }) => {
    const store = storeMap[item.store];
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const scheduledTime = formatTime(item.scheduled_date);

    return (
      <View style={styles.visitRow}>
        {/* Timeline connector */}
        <View style={styles.timeline}>
          <View style={[styles.timelineDot, { backgroundColor: cfg.color }]} />
          {index < section.data.length - 1 && <View style={styles.timelineLine} />}
        </View>

        {/* Visit card */}
        <View style={[styles.visitCard, section.isToday && styles.visitCardToday]}>
          <View style={styles.visitTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.storeName} numberOfLines={1}>
                {store?.name || item.store_name || 'Magasin'}
              </Text>
              {store?.address ? (
                <Text style={styles.storeAddress} numberOfLines={1}>{store.address}</Text>
              ) : null}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <MaterialCommunityIcons name={cfg.icon} size={13} color={cfg.color} />
              <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          <View style={styles.visitMeta}>
            {scheduledTime && (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="clock-outline" size={14} color="#6b7280" />
                <Text style={styles.metaText}>{scheduledTime}</Text>
              </View>
            )}
            {item.check_in_time && (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="login" size={14} color="#6b7280" />
                <Text style={styles.metaText}>{formatTime(item.check_in_time)}</Text>
              </View>
            )}
            {item.check_out_time && (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="logout" size={14} color="#6b7280" />
                <Text style={styles.metaText}>{formatTime(item.check_out_time)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Routes</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Chargement des routes...</Text>
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={56} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Aucune route assignée</Text>
          <Text style={styles.emptySubtitle}>Vos routes apparaîtront ici une fois planifiées</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderVisit}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#475569', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },

  // Section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  sectionHeaderToday: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#475569' },
  sectionTitleToday: { color: '#2563eb' },
  progressBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  progressText: { fontSize: 12, fontWeight: '700' },

  // Visit row with timeline
  visitRow: { flexDirection: 'row' },
  timeline: { width: 28, alignItems: 'center', paddingTop: 18 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#e2e8f0', marginTop: 4 },

  // Visit card
  visitCard: { flex: 1, backgroundColor: '#f8f9fc', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e8eaed' },
  visitCardToday: { borderColor: '#93c5fd', backgroundColor: '#f0f7ff' },
  visitTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  storeName: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 8 },
  storeAddress: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4 },
  statusLabel: { fontSize: 11, fontWeight: '600' },
  visitMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#6b7280' },
});
