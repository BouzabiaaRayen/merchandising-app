import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, RefreshControl
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { visitService, storeService } from '../services/apiService';

const STATUS_CONFIG = {
  completed: { label: 'Complétée', color: '#16a34a', bg: '#dcfce7', icon: 'check-circle' },
  pending: { label: 'En attente', color: '#f59e0b', bg: '#fef3c7', icon: 'clock-outline' },
  scheduled: { label: 'Planifiée', color: '#2563eb', bg: '#dbeafe', icon: 'calendar-clock' },
  cancelled: { label: 'Annulée', color: '#ef4444', bg: '#fee2e2', icon: 'close-circle' },
  in_progress: { label: 'En cours', color: '#8b5cf6', bg: '#ede9fe', icon: 'progress-clock' },
};

export default function VisitHistoryScreen({ navigation }) {
  const { user } = useAuth();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storeCache, setStoreCache] = useState({});

  useEffect(() => {
    loadVisits();
  }, []);

  const loadVisits = async () => {
    try {
      const data = await visitService.getVisits({ merchandiser: user?.id });
      const list = data?.results || data || [];
      // Sort by date descending
      list.sort((a, b) => new Date(b.scheduled_date || b.created_at) - new Date(a.scheduled_date || a.created_at));
      setVisits(list);

      // Load store names
      const storeIds = [...new Set(list.map(v => v.store).filter(Boolean))];
      const cache = { ...storeCache };
      await Promise.all(
        storeIds.filter(id => !cache[id]).map(async (id) => {
          try {
            const s = await storeService.getStore(id);
            cache[id] = s.name;
          } catch { cache[id] = 'Magasin inconnu'; }
        })
      );
      setStoreCache(cache);
    } catch (err) {
      console.error('Error loading visits:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadVisits();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getDuration = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return null;
    const diff = Math.floor((new Date(checkOut) - new Date(checkIn)) / 1000);
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  const renderVisit = ({ item }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const storeName = item.store_name || storeCache[item.store] || 'Magasin';
    const duration = getDuration(item.check_in_time, item.check_out_time);

    return (
      <View style={styles.visitCard}>
        <View style={styles.visitHeader}>
          <View style={styles.visitStoreRow}>
            <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
            <Text style={styles.storeName} numberOfLines={1}>{storeName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <MaterialCommunityIcons name={cfg.icon} size={14} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.visitDetails}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="calendar" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{formatDate(item.scheduled_date || item.created_at)}</Text>
          </View>
          {item.check_in_time && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="login" size={16} color="#6b7280" />
              <Text style={styles.detailText}>Check-in: {formatTime(item.check_in_time)}</Text>
            </View>
          )}
          {item.check_out_time && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="logout" size={16} color="#6b7280" />
              <Text style={styles.detailText}>Check-out: {formatTime(item.check_out_time)}</Text>
            </View>
          )}
          {duration && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="timer-outline" size={16} color="#6b7280" />
              <Text style={styles.detailText}>Durée: {duration}</Text>
            </View>
          )}
        </View>

        {item.notes ? (
          <View style={styles.notesRow}>
            <MaterialCommunityIcons name="note-text-outline" size={14} color="#9ca3af" />
            <Text style={styles.notesText} numberOfLines={2}>{item.notes}</Text>
          </View>
        ) : null}
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
        <Text style={styles.headerTitle}>Historique des visites</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : visits.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="store-off-outline" size={56} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Aucune visite</Text>
          <Text style={styles.emptySubtitle}>Vos visites apparaîtront ici</Text>
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderVisit}
          contentContainerStyle={styles.list}
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
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#475569', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  visitCard: { backgroundColor: '#f8f9fc', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e8eaed' },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  visitStoreRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  storeName: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  visitDetails: { gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 13, color: '#475569' },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e8eaed' },
  notesText: { fontSize: 12, color: '#6b7280', flex: 1 },
});
