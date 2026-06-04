import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { visitService } from '../../services/apiService';
import api from '../../services/api';

const ACCENT = '#2563EB';

const STATUS_META = {
  completed: { label: 'Completed', color: '#15803D', bg: '#EDF9F1', icon: 'check-circle-outline' },
  in_progress: { label: 'Working', color: '#1D4ED8', bg: '#EEF6FF', icon: 'progress-clock' },
  planned: { label: 'Planned', color: '#64748B', bg: '#F3F6FA', icon: 'calendar-clock-outline' },
};

const EVENT_TAG_META = {
  stock_out: { label: 'Stock Out', bg: '#FEF2F2', color: '#B91C1C', icon: 'package-variant-remove' },
  facing: { label: 'Facing', bg: '#EFF6FF', color: '#1D4ED8', icon: 'view-grid-outline' },
  anomaly: { label: 'Anomaly', bg: '#FFF7ED', color: '#C2410C', icon: 'alert-circle-outline' },
  competitor: { label: 'Competitor Alert', bg: '#F5F3FF', color: '#6D28D9', icon: 'bullhorn-outline' },
};

function fmt12(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(start, end) {
  if (!start || !end) return null;
  const mins = Math.round((new Date(end) - new Date(start)) / 60000);
  if (mins <= 0) return null;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  }
  return `${mins}m`;
}

function normalizeStatus(s) {
  if (!s) return 'planned';
  const v = String(s).toLowerCase();
  if (v === 'completed' || v === 'done' || v === 'finished') return 'completed';
  if (v === 'in_progress' || v === 'in progress' || v === 'active') return 'in_progress';
  return 'planned';
}

function normalizeImageSource(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  return entry.uri || entry.url || entry.image || entry.photo || entry.file_url || null;
}

function buildEventTags(visit, alerts = []) {
  const tags = [];
  if (Array.isArray(visit.stock_ruptures) && visit.stock_ruptures.length > 0) tags.push('stock_out');
  if (visit.facing_data?.productSummary?.length > 0 || visit.facing_data?.rows || visit.facing_data?.columns) tags.push('facing');
  if (alerts.length > 0) tags.push('competitor');
  const noteText = String(visit.notes || '').toLowerCase();
  if (noteText.includes('anomaly') || noteText.includes('issue') || noteText.includes('alert')) tags.push('anomaly');
  return tags;
}

function buildTimelineEntries(visit, alerts = []) {
  const rows = [];

  if (visit.check_in_time) {
    rows.push({
      key: 'check-in',
      title: 'Check-in',
      description: 'Visit started at the store',
      time: fmt12(visit.check_in_time),
      icon: 'login-variant',
      tone: '#1D4ED8',
      bg: '#EEF6FF',
    });
  }

  if (visit.facing_data?.productSummary?.length > 0) {
    rows.push({
      key: 'facing',
      title: 'Facing captured',
      description: `${visit.facing_data.productSummary.length} product entries recorded`,
      time: '',
      icon: 'view-grid-outline',
      tone: '#1D4ED8',
      bg: '#EFF6FF',
    });
  }

  (visit.stock_ruptures || []).forEach((item, index) => {
    rows.push({
      key: `stock-${index}`,
      title: 'Stock out',
      description: item.productName || item.productId || 'Product flagged as out of stock',
      time: '',
      icon: 'package-variant-remove',
      tone: '#B91C1C',
      bg: '#FEF2F2',
    });
  });

  alerts.forEach((alert, index) => {
    rows.push({
      key: `alert-${index}`,
      title: 'Competitor alert',
      description: [alert.competitor_brand, alert.description].filter(Boolean).join(' - ') || 'New competitor activity reported',
      time: fmt12(alert.created_at),
      icon: 'bullhorn-outline',
      tone: '#6D28D9',
      bg: '#F5F3FF',
    });
  });

  if (visit.notes) {
    rows.push({
      key: 'notes',
      title: 'Notes added',
      description: visit.notes,
      time: '',
      icon: 'note-text-outline',
      tone: '#475569',
      bg: '#F8FAFC',
    });
  }

  if (visit.check_out_time) {
    rows.push({
      key: 'check-out',
      title: 'Check-out',
      description: 'Visit completed',
      time: fmt12(visit.check_out_time),
      icon: 'logout-variant',
      tone: '#15803D',
      bg: '#EDF9F1',
    });
  }

  return rows;
}

export default function SupervisorVisitLogDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { visitId, visitPreview } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(visitPreview || null);
  const [timelineEntries, setTimelineEntries] = useState([]);

  const loadDetails = useCallback(async () => {
    if (!visitId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [visitResp, alertsResp] = await Promise.all([
        visitService.getVisit(visitId),
        api.get('/merchandising/competitor-alerts/').catch(() => ({ data: [] })),
      ]);

      const visit = visitResp || visitPreview || {};
      const alertsRaw = alertsResp.data?.results || alertsResp.data || [];
      const relatedAlerts = alertsRaw.filter((alert) => String(alert.visit) === String(visitId) || String(alert.store) === String(visit.store));
      const normalizedStatus = normalizeStatus(visit.status);
      const photos = Array.isArray(visit.photos) ? visit.photos.map(normalizeImageSource).filter(Boolean) : [];
      const beforePhotos = photos.slice(0, Math.ceil(photos.length / 2));
      const afterPhotos = photos.slice(Math.ceil(photos.length / 2));
      const eventTags = buildEventTags(visit, relatedAlerts);

      setDetails({
        ...visitPreview,
        ...visit,
        normalizedStatus,
        statusMeta: STATUS_META[normalizedStatus] || STATUS_META.planned,
        storeName:
          visit.store_name ||
          visit.store_details?.name ||
          visit.store_detail?.name ||
          visitPreview?.storeName ||
          'Unknown Store',
        storeAddress:
          visit.store_address ||
          visit.store_details?.address ||
          visit.store_detail?.address ||
          visitPreview?.storeAddress ||
          '',
        agentName:
          visitPreview?.agentName ||
          visit.merchandiser_details?.full_name ||
          visit.merchandiser_details?.username ||
          'Merchandiser',
        durationLabel: formatDuration(visit.check_in_time, visit.check_out_time) || visitPreview?.durationLabel || 'In progress',
        checkInTime: fmt12(visit.check_in_time) || visitPreview?.checkInTime,
        checkOutTime: fmt12(visit.check_out_time) || visitPreview?.checkOutTime,
        beforePhotos,
        afterPhotos,
        eventTags,
        alerts: relatedAlerts,
      });
      setTimelineEntries(buildTimelineEntries(visit, relatedAlerts));
    } finally {
      setLoading(false);
    }
  }, [visitId, visitPreview]);

  useFocusEffect(
    useCallback(() => {
      loadDetails();
    }, [loadDetails])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={ACCENT} />
          </TouchableOpacity>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  if (!details) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={ACCENT} />
          </TouchableOpacity>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Visit details unavailable</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={ACCENT} />
        </TouchableOpacity>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.storeName}>{details.storeName}</Text>
              <Text style={styles.agentName}>{details.agentName}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: details.statusMeta.bg }]}> 
              <MaterialCommunityIcons name={details.statusMeta.icon} size={13} color={details.statusMeta.color} />
              <Text style={[styles.statusPillText, { color: details.statusMeta.color }]}>{details.statusMeta.label}</Text>
            </View>
          </View>

          {!!details.storeAddress && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={14} color="#94A3B8" />
              <Text style={styles.infoText}>{details.storeAddress}</Text>
            </View>
          )}

          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Check-in</Text>
              <Text style={styles.metricValue}>{details.checkInTime || '—'}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Check-out</Text>
              <Text style={styles.metricValue}>{details.checkOutTime || 'Still working'}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Duration</Text>
              <Text style={styles.metricValue}>{details.durationLabel}</Text>
            </View>
          </View>

          {details.eventTags?.length > 0 && (
            <View style={styles.tagsRow}>
              {details.eventTags.map((tagKey) => {
                const tag = EVENT_TAG_META[tagKey];
                return (
                  <View key={tagKey} style={[styles.eventTag, { backgroundColor: tag.bg }]}> 
                    <MaterialCommunityIcons name={tag.icon} size={11} color={tag.color} />
                    <Text style={[styles.eventTagText, { color: tag.color }]}>{tag.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Before / After Photos</Text>
          <View style={styles.photoColumns}>
            <View style={styles.photoColumn}>
              <Text style={styles.photoColumnTitle}>Before</Text>
              {details.beforePhotos?.length ? details.beforePhotos.map((uri, index) => (
                <Image key={`before-${index}`} source={{ uri }} style={styles.photoCard} />
              )) : <View style={styles.photoEmpty}><Text style={styles.photoEmptyText}>No before photos</Text></View>}
            </View>
            <View style={styles.photoColumn}>
              <Text style={styles.photoColumnTitle}>After</Text>
              {details.afterPhotos?.length ? details.afterPhotos.map((uri, index) => (
                <Image key={`after-${index}`} source={{ uri }} style={styles.photoCard} />
              )) : <View style={styles.photoEmpty}><Text style={styles.photoEmptyText}>No after photos</Text></View>}
            </View>
          </View>
        </View>

        {!!details.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes / Comments</Text>
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>{details.notes}</Text>
            </View>
          </View>
        )}

        {timelineEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visit Timeline</Text>
            {timelineEntries.map((entry, index) => (
              <View key={entry.key} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, { backgroundColor: entry.tone }]} />
                  {index !== timelineEntries.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineCard}>
                  <View style={styles.timelineHeader}>
                    <View style={[styles.timelineIconWrap, { backgroundColor: entry.bg }]}> 
                      <MaterialCommunityIcons name={entry.icon} size={14} color={entry.tone} />
                    </View>
                    <View style={styles.timelineTextWrap}>
                      <Text style={styles.timelineTitle}>{entry.title}</Text>
                      <Text style={styles.timelineDesc}>{entry.description}</Text>
                    </View>
                    {!!entry.time && <Text style={styles.timelineTime}>{entry.time}</Text>}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {details.alerts?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event History</Text>
            {details.alerts.map((alert, index) => (
              <View key={`${alert.id || index}`} style={styles.historyCard}>
                <Text style={styles.historyTitle}>Competitor alert</Text>
                <Text style={styles.historyDesc}>{[alert.competitor_brand, alert.description].filter(Boolean).join(' - ') || 'New competitor activity reported'}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F8FB' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#F6F8FB',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { paddingHorizontal: 16, paddingBottom: 36 },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  heroTitleWrap: { flex: 1, minWidth: 0 },
  storeName: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  agentName: { fontSize: 13, color: '#64748B', marginTop: 4 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  infoText: { flex: 1, fontSize: 12, color: '#94A3B8' },
  metricsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  metricBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12 },
  metricLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  metricValue: { fontSize: 13, fontWeight: '700', color: '#334155' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  eventTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  eventTagText: { fontSize: 11, fontWeight: '700' },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  photoColumns: { flexDirection: 'row', gap: 12 },
  photoColumn: { flex: 1 },
  photoColumnTitle: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 8 },
  photoCard: { width: '100%', height: 132, borderRadius: 16, backgroundColor: '#E2E8F0', marginBottom: 10 },
  photoEmpty: { height: 132, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  photoEmptyText: { fontSize: 12, color: '#94A3B8' },
  noteCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14 },
  noteText: { fontSize: 13, lineHeight: 20, color: '#475569' },
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timelineRail: { width: 18, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  timelineLine: { flex: 1, width: 1.5, backgroundColor: '#E2E8F0', marginTop: 6 },
  timelineCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14 },
  timelineHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  timelineIconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  timelineTextWrap: { flex: 1 },
  timelineTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  timelineDesc: { fontSize: 12, lineHeight: 18, color: '#64748B', marginTop: 2 },
  timelineTime: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10 },
  historyTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  historyDesc: { fontSize: 12, lineHeight: 18, color: '#64748B' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#64748B' },
});