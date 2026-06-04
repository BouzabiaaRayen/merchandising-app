import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl,
  Image, Linking, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { visitService } from '../../services/apiService';
import { getAvatarUrl } from '../../services/supabaseClient';

const BLUE   = '#4285f4';
const GREEN  = '#22c55e';
const GRAY   = '#94a3b8';
const RED    = '#ef4444';

function formatPeriodRange(startDate, endDate) {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString([], { month: 'short' })} ${start.getDate()} - ${end.getDate()}`;
  }

  return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

function getVisitDateKey(visit) {
  const raw = visit?.scheduled_date ?? visit?.planned_date ?? visit?.date ?? '';
  return String(raw).split('T')[0];
}

function getScheduleStatus(visit) {
  if (visit?.check_out_time) return 'completed';

  const raw = String(visit?.status ?? '').toLowerCase();
  if (raw === 'completed' || raw === 'done') return 'completed';
  if (raw === 'cancelled' || raw === 'missed') return 'missed';

  const dateKey = getVisitDateKey(visit);
  if (dateKey) {
    const today = new Date();
    const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      .toISOString()
      .split('T')[0];
    if (dateKey < todayKey) return 'missed';
  }

  return 'planned';
}

function formatSectionTitle(dateKey) {
  if (!dateKey) return 'Unknown Date';
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  const weekday = d.toLocaleDateString([], { weekday: 'short' });
  const day = d.toLocaleDateString([], { day: 'numeric' });
  const month = d.toLocaleDateString([], { month: 'short' });
  return `${weekday} ${day} ${month}`;
}

function getMonthKey(visit) {
  const dateKey = getVisitDateKey(visit);
  return dateKey ? dateKey.slice(0, 7) : null;
}

function formatMonthTitle(monthKey) {
  if (!monthKey) return 'Unknown Month';
  const value = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(value.getTime())) return monthKey;
  return value.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function StatusIcon({ status }) {
  if (status === 'completed') {
    return (
      <MaterialCommunityIcons name="check-circle" size={16} color={GREEN} />
    );
  }

  if (status === 'missed') {
    return (
      <MaterialCommunityIcons name="close-circle-outline" size={16} color={RED} />
    );
  }

  return <MaterialCommunityIcons name="checkbox-blank-circle-outline" size={15} color="#94a3b8" />;
}

function VisitRow({ visit, isLast }) {
  const status = getScheduleStatus(visit);
  const store = visit.store_details ?? visit.store_detail ?? visit.store;
  const storeName = visit.store_name ?? store?.name ?? (typeof store === 'string' ? store : `Store #${store}`);
  const address = visit.store_address ?? store?.address ?? store?.location ?? null;

  return (
    <View style={[styles.visitRow, isLast && styles.visitRowLast]}>
      <View style={styles.visitRowText}>
        <Text style={styles.storeName} numberOfLines={1}>{storeName}</Text>
        {!!address && <Text style={styles.storeAddress} numberOfLines={2}>{address}</Text>}
      </View>
      <View style={styles.statusIconWrap}>
        <StatusIcon status={status} />
      </View>
    </View>
  );
}

function DayCard({ group }) {
  return (
    <View style={styles.dayGroupRow}>
      <View style={styles.timelineCol}>
        <View style={styles.timelineDot} />
      </View>
      <View style={styles.dayCard}>
        <Text style={styles.dayCardTitle}>{group.title}</Text>
        {group.visits.map((visit, index) => {
          const isLast = index === group.visits.length - 1;
          return (
            <View key={String(visit.id ?? `${group.key}-${index}`)}>
              <VisitRow visit={visit} isLast={isLast} />
              {!isLast ? <View style={styles.partialDivider} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MonthCard({ month, expanded, onToggle }) {
  return (
    <View style={styles.monthBlock}>
      <TouchableOpacity style={styles.monthAccordion} onPress={onToggle} activeOpacity={0.82}>
        <View>
          <Text style={styles.monthAccordionTitle}>{month.title}</Text>
          <Text style={styles.monthAccordionSummary}>{month.total} visits</Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#64748b"
        />
      </TouchableOpacity>

      {expanded ? month.days.map((day) => <DayCard key={day.key} group={day} />) : null}
    </View>
  );
}

function EmptyRoute() {
  return (
    <View style={{ alignItems: 'center', paddingTop: 60 }}>
      <MaterialCommunityIcons name="map-marker-off-outline" size={64} color="#cbd5e1" />
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#94a3b8', marginTop: 16 }}>No visits assigned</Text>
      <Text style={{ fontSize: 13, color: '#cbd5e1', marginTop: 6, textAlign: 'center' }}>No stores are planned for this period.</Text>
    </View>
  );
}

export default function SupervisorReportScreen() {
  const route      = useRoute();
  const navigation = useNavigation();
  const { memberId, memberName, memberPhone, memberAvatar } = route.params ?? {};

  const [visits,     setVisits]     = useState([]);
  const [member,     setMember]     = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedMonths, setExpandedMonths] = useState({});
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const visitsRes = await (memberId
        ? visitService.getVisits({
          merchandiser: memberId,
          page_size: 5000,
        }).catch(() => ({ results: [] }))
        : Promise.resolve([]));

      const raw = Array.isArray(visitsRes) ? visitsRes : (visitsRes.results ?? []);
      const allVisits = raw
        .filter((v) => Boolean(getVisitDateKey(v)))
        .sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''));

      setVisits(allVisits);

      const visitMember = allVisits.find((visit) => visit?.merchandiser_details)?.merchandiser_details;
      setMember(visitMember ?? null);
    } catch (err) {
      console.warn('SupervisorReportScreen err:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [memberId]);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const displayName = member
    ? ([member.first_name, member.last_name].filter(Boolean).join(' ') || member.username)
    : (memberName ?? 'Merchandiser');
  const phone  = member?.phone_number ?? member?.phone ?? memberPhone;
  const avatarRaw = member?.avatar_url || member?.avatar || member?.profile_picture || memberAvatar;
  const avatar = getAvatarUrl(avatarRaw);
  const initials = displayName.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

  const periodLabel = useMemo(() => {
    const sortedKeys = visits.map(getVisitDateKey).filter(Boolean).sort((a, b) => a.localeCompare(b));
    if (sortedKeys.length === 0) return 'Archive';

    const fallbackRange = formatPeriodRange(sortedKeys[0], sortedKeys[sortedKeys.length - 1]);
    return fallbackRange ? `Archive: ${fallbackRange}` : 'Archive';
  }, [visits]);

  const filteredVisits = useMemo(() => {
    if (activeFilter === 'all') return visits;
    return visits.filter((visit) => {
      const status = getScheduleStatus(visit);
      if (activeFilter === 'completed') return status === 'completed';
      if (activeFilter === 'planned') return status === 'planned';
      return true;
    });
  }, [visits, activeFilter]);

  const filterCounts = useMemo(() => {
    const completed = visits.filter((v) => getScheduleStatus(v) === 'completed').length;
    const planned = visits.filter((v) => getScheduleStatus(v) === 'planned').length;
    return {
      all: visits.length,
      completed,
      planned,
    };
  }, [visits]);

  const monthGroups = useMemo(() => {
    const grouped = {};
    filteredVisits.forEach((visit) => {
      const monthKey = getMonthKey(visit);
      const dateKey = getVisitDateKey(visit);
      if (!monthKey || !dateKey) return;
      if (!grouped[monthKey]) grouped[monthKey] = {};
      if (!grouped[monthKey][dateKey]) grouped[monthKey][dateKey] = [];
      grouped[monthKey][dateKey].push(visit);
    });

    return Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a))
      .map((monthKey) => ({
        key: monthKey,
        title: formatMonthTitle(monthKey),
        total: Object.values(grouped[monthKey]).reduce((sum, items) => sum + items.length, 0),
        days: Object.keys(grouped[monthKey])
          .sort((a, b) => a.localeCompare(b))
          .map((dateKey) => ({
            key: dateKey,
            title: formatSectionTitle(dateKey),
            visits: grouped[monthKey][dateKey],
          })),
      }));
  }, [filteredVisits]);

  useEffect(() => {
    const currentMonthKey = getCurrentMonthKey();
    setExpandedMonths((prev) => {
      const next = {};
      monthGroups.forEach((month, index) => {
        if (Object.prototype.hasOwnProperty.call(prev, month.key)) {
          next[month.key] = prev[month.key];
        } else {
          next[month.key] = month.key === currentMonthKey || (index === 0 && !monthGroups.some((entry) => entry.key === currentMonthKey));
        }
      });
      return next;
    });
  }, [monthGroups]);

  const toggleMonth = useCallback((monthKey) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  }, []);

  const chips = [
    { key: 'all', label: 'All' },
    { key: 'completed', label: 'Completed' },
    { key: 'planned', label: 'Planned' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Text style={styles.headerAvatarInitials}>{initials || '?'}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.headerSub}>{periodLabel}</Text>
          </View>
        </View>
        {phone ? (
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${phone}`)} style={styles.callBtn}>
            <MaterialCommunityIcons name="phone" size={20} color={BLUE} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {!loading && (
        <View style={styles.chipsRow}>
          <View style={styles.segmentedControl}>
            {chips.map((chip) => {
              const active = activeFilter === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => setActiveFilter(chip.key)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.summaryText}>
            {filteredVisits.length} shown · {filterCounts[activeFilter] ?? filteredVisits.length} total
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={BLUE} /></View>
      ) : (
        <View style={styles.timelineListWrap}>
          <View style={styles.timelineRail} />
          <FlatList
            data={monthGroups}
            keyExtractor={(item) => item.key}
            removeClippedSubviews
            initialNumToRender={10}
            windowSize={10}
            contentContainerStyle={monthGroups.length === 0
              ? { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }
              : { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BLUE]} />}
            ListEmptyComponent={<EmptyRoute />}
            renderItem={({ item }) => (
              <MonthCard
                month={item}
                expanded={!!expandedMonths[item.key]}
                onToggle={() => toggleMonth(item.key)}
              />
            )}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff', paddingTop: Platform.OS === 'android' ? 30 : 0 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8eaed',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  headerAvatarFallback: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#e8f0fe', justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  headerAvatarInitials: { fontSize: 15, fontWeight: '700', color: BLUE },
  headerName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  callBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#e8f0fe', justifyContent: 'center', alignItems: 'center',
  },

  chipsRow: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: '#ffffff',
  },
  segmentText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  segmentTextActive: { color: '#1d4ed8' },
  summaryText: {
    marginTop: 6,
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'right',
  },

  timelineListWrap: {
    flex: 1,
    position: 'relative',
  },
  timelineRail: {
    position: 'absolute',
    left: 29,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  monthBlock: {
    marginBottom: 12,
  },
  monthAccordion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    marginLeft: 34,
  },
  monthAccordionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  monthAccordionSummary: {
    marginTop: 2,
    fontSize: 11,
    color: '#6b7280',
  },
  dayGroupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  timelineCol: {
    width: 26,
    alignItems: 'center',
    paddingTop: 14,
    marginRight: 8,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BLUE,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  dayCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dayCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: BLUE,
    marginBottom: 6,
  },

  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
  },
  visitRowLast: { borderBottomWidth: 0 },
  visitRowText: { flex: 1, paddingRight: 10 },
  storeName: { fontSize: 14, fontWeight: '700', color: '#374151' },
  storeAddress: { marginTop: 2, fontSize: 12, color: '#9ca3af' },
  statusIconWrap: { width: 20, alignItems: 'flex-end' },
  partialDivider: {
    height: 1,
    marginLeft: 12,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
});
