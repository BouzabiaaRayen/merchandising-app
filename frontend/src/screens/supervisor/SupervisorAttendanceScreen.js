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
  ScrollView,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { userService, visitService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { getAvatarUrl } from '../../services/supabaseClient';

const ACCENT = '#2563EB';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'working', label: 'Working' },
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
];

const SUMMARY_META = {
  present: {
    label: 'Present',
    icon: 'account-check-outline',
    tint: '#15803D',
    bg: '#EDF9F1',
  },
  absent: {
    label: 'Absent',
    icon: 'account-remove-outline',
    tint: '#64748B',
    bg: '#F3F6FA',
  },
};

const STATUS_META = {
  working: {
    label: 'Working',
    icon: 'briefcase-clock-outline',
    bg: '#EEF6FF',
    color: '#1D4ED8',
    dot: '#2563EB',
  },
  present: {
    label: 'Present',
    icon: 'check-circle-outline',
    bg: '#EDF9F1',
    color: '#15803D',
    dot: '#22C55E',
  },
  absent: {
    label: 'Absent',
    icon: 'minus-circle-outline',
    bg: '#F3F6FA',
    color: '#64748B',
    dot: '#CBD5E1',
  },
};

function fmt12(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isSameLocalDay(raw, baseDate = new Date()) {
  if (!raw) return false;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === baseDate.getFullYear()
    && d.getMonth() === baseDate.getMonth()
    && d.getDate() === baseDate.getDate()
  );
}

function getMinutesSinceMidnight(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function getLocationLabel(member, attendance) {
  const directLabel = member.location_name
    || member.current_location_name
    || member.last_known_location
    || member.location
    || member.city;

  if (directLabel) {
    return String(directLabel);
  }

  return attendance.working ? 'Live location active' : 'Location unavailable';
}

function getAvatarSource(member) {
  const rawAvatar = member.avatar_url || member.avatar;
  if (!rawAvatar) {
    return null;
  }

  if (String(rawAvatar).startsWith('http')) {
    return { uri: rawAvatar };
  }

  const resolved = getAvatarUrl(rawAvatar);
  return resolved ? { uri: resolved } : null;
}

function getVisitMerchandiserId(visit) {
  return String(
    visit?.merchandiser
    ?? visit?.merchandiser_id
    ?? visit?.user
    ?? visit?.user_id
    ?? visit?.merchandiser_details?.id
    ?? ''
  );
}

function getVisitScheduledDate(visit) {
  return visit?.scheduled_date ?? visit?.planned_date ?? visit?.date ?? null;
}

function isVisitScheduledToday(visit, baseDate = new Date()) {
  return isSameLocalDay(getVisitScheduledDate(visit), baseDate);
}

function getChronologicalBoundary(visits, field, mode = 'min') {
  const timestamps = visits
    .map((visit) => visit?.[field])
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) {
    return null;
  }

  const target = mode === 'max' ? Math.max(...timestamps) : Math.min(...timestamps);
  return new Date(target).toISOString();
}

function getAttendanceState(member) {
  const todaysVisits = Array.isArray(member.attendanceVisits) ? member.attendanceVisits : [];
  const visitCheckInRaw = getChronologicalBoundary(todaysVisits, 'check_in_time', 'min');
  const visitCheckOutRaw = getChronologicalBoundary(todaysVisits, 'check_out_time', 'max');
  const startedToday = !!member.day_started && isSameLocalDay(member.day_start_time);
  const endedToday = !!member.day_end_time && isSameLocalDay(member.day_end_time);
  const checkedIn = Boolean(visitCheckInRaw || startedToday);
  const clockIn = fmt12(visitCheckInRaw || member.day_start_time);
  const clockOut = fmt12(visitCheckOutRaw || member.day_end_time);
  const working = todaysVisits.some((visit) => {
    const status = String(visit?.status || '').toLowerCase();
    return (status === 'in_progress' || status === 'active') || (!!visit?.check_in_time && !visit?.check_out_time && isSameLocalDay(visit.check_in_time));
  }) || (checkedIn && !clockOut && !endedToday);

  let key = 'absent';
  if (working) key = 'working';
  else if (checkedIn) key = 'present';

  return {
    key,
    checkedIn,
    clockIn,
    clockOut,
    working,
    status: STATUS_META[key],
  };
}

function formatHeaderDate() {
  const today = new Date();
  return today.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
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

export default function SupervisorAttendanceScreen() {
  const navigation = useNavigation();
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const supervisorId = currentUser?.id;
      if (!supervisorId) {
        setMembers([]);
        return;
      }

      const today = new Date();
      const summary = await userService.getTeamSummary({ supervisor: supervisorId }).catch(() => null);
      let filtered = Array.isArray(summary?.team_members) ? summary.team_members : [];

      if (filtered.length === 0) {
        const data = await userService.getUsers({
          role: 'merchandiser',
          page_size: 200,
          supervisor: supervisorId,
          supervisor_id: supervisorId,
        });
        const all = Array.isArray(data) ? data : (data.results ?? []);
        const currentId = String(currentUser?.id ?? '');
        filtered = all.filter((m) => isTeamMember(m, currentId));
      }

      const visitsResp = await visitService.getVisits({ page_size: 1000 }).catch(() => ({ results: [] }));
      const allVisits = Array.isArray(visitsResp) ? visitsResp : (visitsResp.results ?? []);
      const teamMemberIds = new Set(filtered.map((member) => String(member.id)));
      const todaysVisitsByMember = allVisits.reduce((acc, visit) => {
        const merchandiserId = getVisitMerchandiserId(visit);
        if (!merchandiserId || !teamMemberIds.has(merchandiserId) || !isVisitScheduledToday(visit, today)) {
          return acc;
        }

        if (!acc[merchandiserId]) {
          acc[merchandiserId] = [];
        }

        acc[merchandiserId].push(visit);
        return acc;
      }, {});

      filtered = filtered.map((member) => ({
        ...member,
        attendanceVisits: todaysVisitsByMember[String(member.id)] || [],
      })).filter((member) => member.attendanceVisits.length > 0);

      filtered.sort((a, b) => {
        const attendanceA = getAttendanceState(a);
        const attendanceB = getAttendanceState(b);
        const rankA = attendanceA.working ? 0 : attendanceA.checkedIn ? 1 : 2;
        const rankB = attendanceB.working ? 0 : attendanceB.checkedIn ? 1 : 2;
        if (rankA !== rankB) return rankA - rankB;
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      });
      setMembers(filtered);
    } catch (err) {
      console.warn('Attendance fetch error:', err);
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

  const summary = useMemo(() => {
    return members.reduce((acc, member) => {
      const attendance = getAttendanceState(member);
      if (attendance.checkedIn) acc.present += 1;
      if (!attendance.checkedIn) acc.absent += 1;
      if (attendance.working) acc.working += 1;
      return acc;
    }, { present: 0, absent: 0, working: 0 });
  }, [members]);

  const visibleMembers = useMemo(() => {
    if (selectedFilter === 'all') {
      return members;
    }

    return members.filter((member) => {
      const attendance = getAttendanceState(member);
      if (selectedFilter === 'present') return attendance.checkedIn;
      if (selectedFilter === 'absent') return !attendance.checkedIn;
      if (selectedFilter === 'working') return attendance.working;
      return true;
    });
  }, [members, selectedFilter]);

  const renderSummaryCard = (key) => {
    const item = SUMMARY_META[key];
    return (
      <View key={key} style={[styles.summaryCard, { backgroundColor: item.bg }]}> 
        <View style={[styles.summaryIconWrap, { backgroundColor: '#FFFFFFAA' }]}>
          <MaterialCommunityIcons name={item.icon} size={16} color={item.tint} />
        </View>
        <Text style={styles.summaryValue}>{summary[key]}</Text>
        <Text style={styles.summaryLabel}>{item.label}</Text>
      </View>
    );
  };

  const renderFilterChip = (filter) => {
    const isActive = selectedFilter === filter.key;
    return (
      <TouchableOpacity
        key={filter.key}
        style={[styles.filterChip, isActive && styles.filterChipActive]}
        onPress={() => setSelectedFilter(filter.key)}
        activeOpacity={0.8}
      >
        <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{filter.label}</Text>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => (
    <View style={styles.listHeaderWrap}>
      <View style={styles.headerRowTop}>
        <View>
          <Text style={styles.screenTitle}>Attendance</Text>
          <Text style={styles.screenSub}>Team status at a glance</Text>
        </View>
        <View style={styles.datePill}>
          <MaterialCommunityIcons name="calendar-blank" size={15} color={ACCENT} />
          <Text style={styles.datePillText}>{formatHeaderDate()}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.summaryRow}
      >
        {['present', 'absent'].map(renderSummaryCard)}
      </ScrollView>

      <View style={styles.workingStrip}>
        <View style={styles.workingStripLeft}>
          <View style={styles.workingDot} />
          <Text style={styles.workingStripText}>{summary.working} currently working</Text>
        </View>
        <Text style={styles.workingStripMeta}>{visibleMembers.length} shown</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map(renderFilterChip)}
      </ScrollView>
    </View>
  );

  const renderItem = ({ item, index }) => {
    const attendance = getAttendanceState(item);
    const avatarSource = getAvatarSource(item);
    const locationLabel = getLocationLabel(item, attendance);
    const initials = ((item.first_name?.[0] ?? '') + (item.last_name?.[0] ?? '')).toUpperCase() || '?';

    return (
      <View style={[styles.memberCard, index === 0 && styles.firstMemberCard]}>
        <View style={styles.memberTopRow}>
          <View style={styles.memberIdentity}>
            <View style={styles.avatarShell}>
              {avatarSource ? (
                <Image source={avatarSource} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: attendance.status.bg }]}>
                  <Text style={[styles.avatarFallbackText, { color: attendance.status.color }]}>{initials}</Text>
                </View>
              )}
              <View style={[styles.activityDot, { backgroundColor: attendance.status.dot }]} />
            </View>

            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{item.first_name} {item.last_name}</Text>
              <View style={styles.memberMetaRow}>
                <MaterialCommunityIcons name="map-marker-radius-outline" size={13} color="#94A3B8" />
                <Text style={styles.memberMetaText} numberOfLines={1}>{locationLabel}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: attendance.status.bg }]}> 
            <MaterialCommunityIcons name={attendance.status.icon} size={13} color={attendance.status.color} />
            <Text style={[styles.statusBadgeText, { color: attendance.status.color }]}>{attendance.status.label}</Text>
          </View>
        </View>

        <View style={styles.timeRow}>
          <View style={styles.timeItem}>
            <MaterialCommunityIcons name="login-variant" size={14} color="#94A3B8" />
            <View>
              <Text style={styles.timeLabel}>Check-in</Text>
              <Text style={styles.timeValue}>{attendance.clockIn || 'No visit check-in yet'}</Text>
            </View>
          </View>

          <View style={styles.timeDivider} />

          <View style={styles.timeItem}>
            <MaterialCommunityIcons name="logout-variant" size={14} color="#94A3B8" />
            <View>
              <Text style={styles.timeLabel}>Check-out</Text>
              <Text style={styles.timeValue}>{attendance.clockOut || (attendance.working ? 'Still working' : 'No visit check-out yet')}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
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
          data={visibleMembers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={renderListHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              tintColor={ACCENT}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="account-search-outline" size={52} color="#D6DFEA" />
              <Text style={styles.emptyTitle}>No matching team members</Text>
              <Text style={styles.emptySub}>Try another filter or refresh the attendance list.</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
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
  listHeaderWrap: { paddingBottom: 18 },
  headerRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  screenTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  screenSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  datePillText: { fontSize: 12, fontWeight: '700', color: '#1E3A8A' },
  summaryRow: { gap: 12, paddingRight: 8 },
  summaryCard: {
    width: 112,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  summaryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryValue: { fontSize: 24, fontWeight: '700', color: '#0F172A', marginTop: 18 },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 2 },
  workingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 14,
  },
  workingStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  workingStripText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  workingStripMeta: {
    fontSize: 12,
    color: '#94A3B8',
  },
  filterRow: { gap: 8, paddingRight: 8 },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: '#EAF2FF',
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  filterChipTextActive: { color: '#1D4ED8' },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  firstMemberCard: { marginTop: 4 },
  memberTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  memberIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    minWidth: 0,
  },
  avatarShell: {
    width: 48,
    height: 48,
    position: 'relative',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 15,
    fontWeight: '800',
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  memberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  memberMetaText: {
    flex: 1,
    fontSize: 12,
    color: '#94A3B8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  timeItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  timeLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  noteText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
  },
  empty: { alignItems: 'center', marginTop: 72, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#64748B', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
});
