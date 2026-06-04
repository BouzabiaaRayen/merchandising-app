import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Animated,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { visitService, userService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const ACCENT = '#2563EB';

const STATUS_META = {
  completed: { label: 'Completed', color: '#15803D', bg: '#EDF9F1', icon: 'check-circle-outline' },
  in_progress: { label: 'Working', color: '#1D4ED8', bg: '#EEF6FF', icon: 'progress-clock' },
  planned: { label: 'Planned', color: '#64748B', bg: '#F3F6FA', icon: 'calendar-clock-outline' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'completed', label: 'Completed' },
  { key: 'planned', label: 'Planned' },
];

const EVENT_TAG_META = {
  stock_out: { label: 'Stock Out', bg: '#FEF2F2', color: '#B91C1C', icon: 'package-variant-remove' },
  facing: { label: 'Facing', bg: '#EFF6FF', color: '#1D4ED8', icon: 'view-grid-outline' },
  anomaly: { label: 'Anomaly', bg: '#FFF7ED', color: '#C2410C', icon: 'alert-circle-outline' },
  competitor: { label: 'Competitor Alert', bg: '#F5F3FF', color: '#6D28D9', icon: 'bullhorn-outline' },
};

function fmt12(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function durationMins(start, end) {
  if (!start || !end) return null;
  const diff = Math.round((new Date(end) - new Date(start)) / 60000);
  return diff > 0 ? diff : null;
}

function formatDuration(start, end) {
  const mins = durationMins(start, end);
  if (!mins) return null;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  }
  return `${mins}m`;
}

function formatFeedDate(dateValue) {
  const value = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(value.getTime())) return 'Today';
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function normalizeStatus(s) {
  if (!s) return 'planned';
  const v = s.toLowerCase();
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

  if (Array.isArray(visit.stock_ruptures) && visit.stock_ruptures.length > 0) {
    tags.push('stock_out');
  }

  if (visit.facing_data?.productSummary?.length > 0 || visit.facing_data?.rows || visit.facing_data?.columns) {
    tags.push('facing');
  }

  if (alerts.length > 0) {
    tags.push('competitor');
  }

  const noteText = String(visit.notes || '').toLowerCase();
  if (noteText.includes('anomaly') || noteText.includes('issue') || noteText.includes('alert')) {
    tags.push('anomaly');
  }

  return tags;
}

function isTeamMember(m, currentId) {
  if (!currentId) return true;
  // If backend hasn't populated the supervisor field, trust the ?supervisor= query param filter
  if (m.supervisor == null && m.supervisor_id == null) return true;
  const resolved = typeof m.supervisor === 'object' ? m.supervisor?.id : m.supervisor;
  if (resolved != null && String(resolved) === currentId) return true;
  if (m.supervisor_id != null && String(m.supervisor_id) === currentId) return true;
  return false;
}

function PulseDot() {
  const scale = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [scale]);
  return <Animated.View style={[styles.pulseDot, { transform: [{ scale }] }]} />;
}

export default function SupervisorVisitLogsScreen() {
  const navigation = useNavigation();
  const { user: currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const supervisorId = currentUser?.id;
      if (!supervisorId) {
        setLogs([]);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const [summaryResp, visitsResp, alertsResp] = await Promise.allSettled([
        userService.getTeamSummary({ supervisor: supervisorId }),
        visitService.getVisits({ page_size: 500 }),
        api.get('/merchandising/competitor-alerts/'),
      ]);

      // Build agent map: id → full name
      let agentMap = {};
      let teamMembers = [];
      if (summaryResp.status === 'fulfilled') {
        teamMembers = Array.isArray(summaryResp.value?.team_members) ? summaryResp.value.team_members : [];
      }

      if (teamMembers.length === 0) {
        const usersResp = await userService.getUsers({
          role: 'merchandiser',
          page_size: 200,
          supervisor: supervisorId,
          supervisor_id: supervisorId,
        }).catch(() => ({ results: [] }));
        const all = Array.isArray(usersResp) ? usersResp : (usersResp.results ?? []);
        const currentId = String(currentUser?.id ?? '');
        teamMembers = all.filter((m) => isTeamMember(m, currentId));
      }

      teamMembers.forEach((m) => {
        agentMap[String(m.id)] = `${m.first_name} ${m.last_name}`.trim() || m.username;
      });

      let visits = [];
      const alertsRaw = alertsResp.status === 'fulfilled'
        ? (alertsResp.value?.data?.results || alertsResp.value?.data || [])
        : [];
      const alertsToday = alertsRaw.filter((alert) => String(alert.created_at || '').startsWith(today));

      if (visitsResp.status === 'fulfilled') {
        const raw = Array.isArray(visitsResp.value) ? visitsResp.value : (visitsResp.value?.results ?? []);
        visits = raw.filter((v) => {
          const dateStr = (v.scheduled_date ?? v.planned_date ?? v.date ?? '');
          const dateOk = dateStr.split('T')[0] === today;
          const uid = String(v.merchandiser ?? v.user ?? '');
          // Only include team members (if agentMap is populated)
          const inTeam = Object.keys(agentMap).length === 0 || uid in agentMap;
          return dateOk && inTeam;
        });
      }

      // Sort most-recent-activity first
      visits.sort((a, b) => {
        const ta = new Date(a.check_in_time ?? a.scheduled_date ?? 0).getTime();
        const tb = new Date(b.check_in_time ?? b.scheduled_date ?? 0).getTime();
        return tb - ta; // descending: newest first
      });

      const enriched = visits.map((v) => {
        const uid = String(v.merchandiser ?? v.user ?? '');
        const status = normalizeStatus(v.status);
        const storeName =
          v.store_name ??
          v.store_details?.name ??
          v.store_detail?.name ??
          v.store_details?.store_name ??
          (typeof v.store === 'object' ? v.store?.name : null) ??
          'Unknown Store';
        const storeAddress =
          v.store_address ??
          v.store_details?.address ??
          v.store_detail?.address ??
          (typeof v.store === 'object' ? v.store?.address : null) ??
          '';
        const checkInTime = fmt12(v.check_in_time);
        const checkOutTime = fmt12(v.check_out_time);
        const visitAlerts = alertsToday.filter((alert) => String(alert.visit) === String(v.id) || String(alert.store) === String(v.store));
        const photos = Array.isArray(v.photos) ? v.photos.map(normalizeImageSource).filter(Boolean) : [];
        const eventTags = buildEventTags(v, visitAlerts);
        return {
          ...v,
          agentName: agentMap[uid] || `Agent #${uid}`,
          storeName,
          storeAddress,
          normalizedStatus: status,
          checkInTime,
          checkOutTime,
          visitTimeLabel: checkInTime || fmt12(v.scheduled_date) || 'Scheduled',
          durationValue: formatDuration(v.check_in_time, v.check_out_time),
          durationLabel: formatDuration(v.check_in_time, v.check_out_time) || 'In progress',
          statusMeta: STATUS_META[status] || STATUS_META.planned,
          alerts: visitAlerts,
          photos,
          eventTags,
        };
      });

      setLogs(enriched);
    } catch (err) {
      console.warn('Visit logs fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();

      const refreshTimer = setInterval(() => {
        fetchData();
      }, 30000);

      return () => clearInterval(refreshTimer);
    }, [fetchData])
  );

  const visibleLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return logs.filter((item) => {
      const filterOk =
        selectedFilter === 'all'
          ? true
          : selectedFilter === 'live'
            ? item.normalizedStatus === 'in_progress'
            : item.normalizedStatus === selectedFilter;

      if (!filterOk) return false;

      if (!query) return true;

      return [item.storeName, item.agentName, item.storeAddress, item.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [logs, searchQuery, selectedFilter]);

  const renderFilterChip = (filter) => {
    const active = selectedFilter === filter.key;
    return (
      <TouchableOpacity
        key={filter.key}
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={() => setSelectedFilter(filter.key)}
        activeOpacity={0.8}
      >
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{filter.label}</Text>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.feedHeader}>
      <View style={styles.headerTopRow}>
        <View>
          <Text style={styles.pageTitle}>Visit Logs</Text>
          <Text style={styles.pageSub}>Today&apos;s field activity feed</Text>
        </View>
        <View style={styles.dateSelector}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={15} color={ACCENT} />
          <Text style={styles.dateSelectorText}>{formatFeedDate()}</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search store or merchandiser"
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map(renderFilterChip)}
      </ScrollView>
    </View>
  );

  const renderItem = ({ item, index }) => {
    const isActive = item.normalizedStatus === 'in_progress';
    const timelineLineStyle = index === visibleLogs.length - 1 ? styles.vertLineHidden : styles.vertLine;

    return (
      <View style={styles.feedRow}>
        <View style={styles.iconCol}>
          {isActive ? (
            <PulseDot />
          ) : item.normalizedStatus === 'completed' ? (
            <MaterialCommunityIcons name="check-circle" size={20} color="#22C55E" />
          ) : (
            <MaterialCommunityIcons name="clock-outline" size={20} color="#CBD5E1" />
          )}
          <View style={timelineLineStyle} />
        </View>

        <TouchableOpacity
          style={styles.logCard}
          activeOpacity={0.86}
          onPress={() => navigation.navigate('SupervisorVisitLogDetails', { visitId: item.id, visitPreview: item })}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.storeName} numberOfLines={1}>{item.storeName}</Text>
              <Text style={styles.agentName} numberOfLines={1}>{item.agentName}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: item.statusMeta.bg }]}> 
              <MaterialCommunityIcons name={item.statusMeta.icon} size={13} color={item.statusMeta.color} />
              <Text style={[styles.statusPillText, { color: item.statusMeta.color }]}>{item.statusMeta.label}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="clock-time-four-outline" size={14} color="#94A3B8" />
              <Text style={styles.metaText}>{item.visitTimeLabel}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="timer-outline" size={14} color="#94A3B8" />
              <Text style={styles.metaText}>{item.durationLabel}</Text>
            </View>
          </View>

          {!!item.storeAddress && (
            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={14} color="#94A3B8" />
              <Text style={styles.locationText} numberOfLines={1}>{item.storeAddress}</Text>
            </View>
          )}

          {item.eventTags.length > 0 && (
            <View style={styles.tagsRow}>
              {item.eventTags.map((tagKey) => {
                const tag = EVENT_TAG_META[tagKey];
                return (
                  <View key={`${item.id}-${tagKey}`} style={[styles.eventTag, { backgroundColor: tag.bg }]}> 
                    <MaterialCommunityIcons name={tag.icon} size={11} color={tag.color} />
                    <Text style={[styles.eventTagText, { color: tag.color }]}>{tag.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.cardFooter}>
            <View style={styles.previewStrip}>
              {item.photos.slice(0, 2).map((uri, idx) => (
                <Image key={`${item.id}-photo-${idx}`} source={{ uri }} style={styles.previewThumb} />
              ))}
            </View>
            <View style={styles.detailsCta}>
              <Text style={styles.detailsCtaText}>View Details</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={ACCENT} />
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={ACCENT} />
        </TouchableOpacity>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={visibleLogs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              tintColor={ACCENT}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="timeline-clock-outline" size={52} color="#D7DFE8" />
              <Text style={styles.emptyTitle}>No visit activity found</Text>
              <Text style={styles.emptySub}>Try another filter or wait for new field activity.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F8FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  feedHeader: { paddingBottom: 16 },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  pageSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  dateSelectorText: { fontSize: 12, fontWeight: '700', color: '#1E3A8A' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  filterRow: { gap: 8, paddingRight: 8 },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: '#EAF2FF',
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  filterChipTextActive: { color: '#1D4ED8' },
  feedRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  iconCol: { alignItems: 'center', width: 22 },
  pulseDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: ACCENT },
  vertLine: { flex: 1, width: 1.5, backgroundColor: '#E2E8F0', marginTop: 6, minHeight: 76 },
  vertLineHidden: { flex: 1, width: 1.5, backgroundColor: 'transparent', marginTop: 6, minHeight: 76 },
  logCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitleWrap: { flex: 1, minWidth: 0 },
  storeName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  agentName: { fontSize: 12, color: '#64748B', marginTop: 3 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locationText: { flex: 1, fontSize: 12, color: '#94A3B8' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  eventTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  eventTagText: { fontSize: 11, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  previewStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
  },
  previewThumb: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  detailsCta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailsCtaText: { fontSize: 12, fontWeight: '700', color: ACCENT },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#64748B', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
});


