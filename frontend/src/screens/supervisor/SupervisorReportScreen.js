import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { visitService, userService, leaveService } from '../../services/apiService';

const REPORT_TYPES = [
  { key: 'attendance', label: 'Attendance', icon: 'calendar-check', color: '#4285f4' },
  { key: 'visits', label: 'Visit Logs', icon: 'clipboard-text', color: '#8b5cf6' },
  { key: 'exceptions', label: 'Exceptions', icon: 'alert-circle', color: '#f97316' },
  { key: 'performance', label: 'Performance', icon: 'chart-bar', color: '#22c55e' },
];

export default function SupervisorReportScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const initialType = route.params?.type ?? 'visits';
  const singleType = route.params?.singleType === true;

  const [activeType, setActiveType] = useState(initialType);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState([]);
  const [users, setUsers] = useState([]);

  const fetchData = useCallback(async (type) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [usersResp] = await Promise.allSettled([
        userService.getUsers({ role: 'merchandiser', page_size: 200 }),
      ]);
      let rawUsers = [];
      if (usersResp.status === 'fulfilled') {
        const raw = usersResp.value;
        rawUsers = Array.isArray(raw) ? raw : (raw.results ?? []);
        setUsers(rawUsers);
      }

      if (type === 'visits' || type === 'exceptions' || type === 'performance') {
        const resp = await visitService.getVisits({ date: today, page_size: 500 });
        const raw = Array.isArray(resp) ? resp : (resp.results ?? []);
        setData(raw);
      } else if (type === 'attendance') {
        // attendance: group by user – show which merchandisers have/haven't started their day
        const resp = await visitService.getVisits({ date: today, page_size: 500 });
        const raw = Array.isArray(resp) ? resp : (resp.results ?? []);
        setData(raw);
      }
    } catch (err) {
      console.warn('SupervisorReport fetchData err:', err);
      setData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData(activeType);
  }, [activeType, fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(activeType); };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {singleType
            ? (REPORT_TYPES.find((r) => r.key === activeType)?.label ?? 'Report')
            : 'Team Reports'}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Type selector — hidden when opened from a specific card */}
      {!singleType && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typeScroll}
          contentContainerStyle={styles.typeScrollContent}
        >
          {REPORT_TYPES.map((rt) => (
            <TouchableOpacity
              key={rt.key}
              style={[
                styles.typeTab,
                activeType === rt.key && { backgroundColor: rt.color, borderColor: rt.color },
              ]}
              onPress={() => setActiveType(rt.key)}
            >
              <MaterialCommunityIcons
                name={rt.icon}
                size={16}
                color={activeType === rt.key ? '#fff' : rt.color}
              />
              <Text style={[styles.typeTabText, activeType === rt.key && { color: '#fff' }]}>
                {rt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4285f4" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4285f4']} />
          }
        >
          {activeType === 'visits' && <VisitLogsReport visits={data} users={users} />}
          {activeType === 'attendance' && <AttendanceReport visits={data} users={users} />}
          {activeType === 'exceptions' && <ExceptionsReport visits={data} users={users} />}
          {activeType === 'performance' && <PerformanceReport visits={data} users={users} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Report sub-views ────────────────────────────────────────────────────────

function VisitLogsReport({ visits, users }) {
  if (visits.length === 0) return <EmptyState message="No visits recorded today" />;

  const userMap = {};
  users.forEach((u) => { userMap[u.id] = u; });

  return (
    <View style={styles.reportSection}>
      <SummaryRow
        items={[
          { label: 'Total', value: visits.length, color: '#4285f4' },
          { label: 'Completed', value: visits.filter(v => v.status === 'completed' || v.status === 'COMPLETED').length, color: '#22c55e' },
          { label: 'Pending', value: visits.filter(v => v.status === 'pending' || v.status === 'PENDING' || v.status === 'planned').length, color: '#f97316' },
          { label: 'Cancelled', value: visits.filter(v => v.status === 'cancelled' || v.status === 'CANCELLED').length, color: '#ef4444' },
        ]}
      />
      {visits.map((v, i) => {
        const uid = v.merchandiser ?? v.user;
        const agent = userMap[uid];
        const agentName = agent
          ? (agent.first_name || '') + (agent.last_name ? ' ' + agent.last_name : '') || agent.username
          : `Agent #${uid ?? '?'}`;
        const store = v.store_detail ?? v.store;
        const storeName = store?.name ?? (typeof store === 'object' ? 'Unknown Store' : `Store #${store}`);
        const status = v.status?.toLowerCase() ?? 'unknown';

        return (
          <View key={v.id ?? i} style={styles.logCard}>
            <View style={[styles.logAccent, { backgroundColor: statusColor(status) }]} />
            <View style={[styles.logAvatarCircle, { backgroundColor: statusColor(status) + '22' }]}>
              <Text style={[styles.logAvatarText, { color: statusColor(status) }]}>
                {agentName[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.logBody}>
              <Text style={styles.logStore}>{storeName}</Text>
              <Text style={styles.logAgent}>{agentName}</Text>
              <View style={styles.logFooter}>
                <StatusBadge status={status} />
                {v.check_in_time && (
                  <View style={styles.timeChip}>
                    <MaterialCommunityIcons name="login" size={10} color="#888" />
                    <Text style={styles.logTime}>
                      {new Date(v.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
                {v.check_out_time && (
                  <View style={styles.timeChip}>
                    <MaterialCommunityIcons name="logout" size={10} color="#888" />
                    <Text style={styles.logTime}>
                      {new Date(v.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function AttendanceReport({ visits, users }) {
  const visitsByUser = {};
  visits.forEach((v) => {
    const uid = v.merchandiser ?? v.user;
    if (!uid) return;
    if (!visitsByUser[uid]) visitsByUser[uid] = [];
    visitsByUser[uid].push(v);
  });

  const activeMembers = users.filter((u) => u.is_active);

  // Count ended-day members (day_started=false but day_start_time set today)
  const today = new Date().toISOString().split('T')[0];
  const startedCount = activeMembers.filter((u) => u.day_started === true).length;
  const endedCount = activeMembers.filter((u) => {
    if (u.day_started === true) return false;
    if (!u.day_start_time) return false;
    return u.day_start_time.slice(0, 10) === today;
  }).length;
  const notStartedCount = activeMembers.length - startedCount - endedCount;

  return (
    <View style={styles.reportSection}>
      <SummaryRow
        items={[
          { label: 'Total Agents', value: activeMembers.length, color: '#4285f4' },
          { label: 'Started', value: startedCount, color: '#22c55e' },
          { label: 'Ended Day', value: endedCount, color: '#8b5cf6' },
          { label: 'Not Started', value: notStartedCount, color: '#f97316' },
        ]}
      />
      {activeMembers.map((u) => {
        const dayStarted = u.day_started === true;
        const endedToday = !dayStarted && u.day_start_time?.slice(0, 10) === today;
        const statusLabel = dayStarted ? 'Working' : endedToday ? 'Ended Day' : 'Not Started';
        const statusColor = dayStarted ? '#22c55e' : endedToday ? '#8b5cf6' : '#f97316';
        const uVisits = visitsByUser[u.id] ?? [];
        const name =
          (u.first_name || '') + (u.last_name ? ' ' + u.last_name : '') || u.username;
        const startTimeLabel = u.day_start_time
          ? new Date(u.day_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : null;
        return (
          <View key={u.id} style={styles.logCard}>
            <View style={[styles.logAccent, { backgroundColor: statusColor }]} />
            <View style={[styles.logAvatarCircle, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.logAvatarText, { color: statusColor }]}>
                {name[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.logBody}>
              <Text style={styles.logStore}>{name}</Text>
              <Text style={styles.logAgent}>@{u.username}</Text>
              <View style={styles.logFooter}>
                <StatusBadge
                  status={statusLabel}
                  customLabel={statusLabel}
                  customColor={statusColor}
                />
                {startTimeLabel && (
                  <View style={styles.timeChip}>
                    <MaterialCommunityIcons name="clock-start" size={10} color="#888" />
                    <Text style={styles.logTime}>Started {startTimeLabel}</Text>
                  </View>
                )}
                <View style={styles.timeChip}>
                  <MaterialCommunityIcons name="store-outline" size={10} color="#888" />
                  <Text style={styles.logTime}>
                    {uVisits.length} visit{uVisits.length !== 1 ? 's' : ''} assigned
                  </Text>
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ExceptionsReport({ visits, users }) {
  const userMap = {};
  users.forEach((u) => { userMap[u.id] = u; });

  const exceptions = visits.filter(
    (v) =>
      v.status === 'cancelled' ||
      v.status === 'CANCELLED' ||
      v.notes?.toLowerCase().includes('exception') ||
      v.cancellation_reason
  );

  if (exceptions.length === 0) return <EmptyState message="No exceptions today" icon="check-circle" color="#22c55e" />;

  return (
    <View style={styles.reportSection}>
      <SummaryRow
        items={[
          { label: 'Exceptions', value: exceptions.length, color: '#f97316' },
          { label: 'Cancelled', value: exceptions.filter(v => v.status?.toLowerCase() === 'cancelled').length, color: '#ef4444' },
        ]}
      />
      {exceptions.map((v, i) => {
        const uid = v.merchandiser ?? v.user;
        const agent = userMap[uid];
        const agentName = agent
          ? (agent.first_name || '') + (agent.last_name ? ' ' + agent.last_name : '') || agent.username
          : `Agent #${uid ?? '?'}`;
        const store = v.store_detail ?? v.store;
        const storeName = store?.name ?? 'Unknown Store';
        const reason = v.cancellation_reason ?? v.notes ?? 'No reason provided';

        return (
          <View key={v.id ?? i} style={styles.logCard}>
            <View style={[styles.logAccent, { backgroundColor: '#f97316' }]} />
            <View style={[styles.logAvatarCircle, { backgroundColor: '#f9731622' }]}>
              <MaterialCommunityIcons name="alert-outline" size={18} color="#f97316" />
            </View>
            <View style={styles.logBody}>
              <Text style={styles.logStore}>{storeName}</Text>
              <Text style={styles.logAgent}>{agentName}</Text>
              <View style={styles.reasonBox}>
                <Text style={styles.exceptionReason}>{reason}</Text>
              </View>
              <StatusBadge status={v.status?.toLowerCase()} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PerformanceReport({ visits, users }) {
  const userMap = {};
  users.forEach((u) => { userMap[u.id] = u; });

  const statsByUser = {};
  visits.forEach((v) => {
    const uid = v.merchandiser ?? v.user;
    if (!uid) return;
    if (!statsByUser[uid]) statsByUser[uid] = { total: 0, completed: 0, cancelled: 0 };
    statsByUser[uid].total++;
    const st = v.status?.toLowerCase();
    if (st === 'completed') statsByUser[uid].completed++;
    if (st === 'cancelled') statsByUser[uid].cancelled++;
  });

  const activeMembers = users.filter((u) => u.is_active);
  const ranked = activeMembers
    .map((u) => ({
      user: u,
      stats: statsByUser[u.id] ?? { total: 0, completed: 0, cancelled: 0 },
    }))
    .sort((a, b) => b.stats.completed - a.stats.completed);

  return (
    <View style={styles.reportSection}>
      <SummaryRow
        items={[
          {
            label: 'Avg Completion',
            value:
              activeMembers.length > 0
                ? Math.round(
                    ranked.reduce((acc, r) => {
                      return acc + (r.stats.total > 0 ? (r.stats.completed / r.stats.total) * 100 : 0);
                    }, 0) / activeMembers.length
                  ) + '%'
                : '—',
            color: '#22c55e',
          },
          { label: 'Agents Ranked', value: ranked.length, color: '#4285f4' },
        ]}
      />
      {ranked.map(({ user, stats }, index) => {
        const name =
          (user.first_name || '') + (user.last_name ? ' ' + user.last_name : '') || user.username;
        const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
        const medalBgColors = ['#f59e0b', '#94a3b8', '#cd7f32'];
        const rankBg = index < 3 ? medalBgColors[index] : '#e8f0fe';
        const rankTextColor = index < 3 ? '#fff' : '#4285f4';
        const medalIcons = ['trophy', 'medal', 'medal-outline'];

        return (
          <View key={user.id} style={styles.perfCard}>
            <View style={[styles.perfRank, { backgroundColor: rankBg }]}>
              {index < 3 ? (
                <MaterialCommunityIcons name={medalIcons[index]} size={17} color={rankTextColor} />
              ) : (
                <Text style={[styles.perfRankText, { color: rankTextColor }]}>#{index + 1}</Text>
              )}
            </View>
            <View style={styles.perfInfo}>
              <View style={styles.perfNameRow}>
                <Text style={styles.perfName} numberOfLines={1}>{name}</Text>
                <Text style={[styles.perfPct, { color: barColor }]}>{pct}%</Text>
              </View>
              <View style={styles.perfBarBg}>
                <View style={[styles.perfBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
              </View>
              <Text style={styles.perfLabel}>
                {stats.completed} completed · {stats.cancelled} cancelled · {stats.total} total
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const ICON_MAP = {
  'Total': 'clipboard-list-outline',
  'Completed': 'check-circle-outline',
  'Pending': 'clock-outline',
  'Cancelled': 'close-circle-outline',
  'Total Agents': 'account-group-outline',
  'Started': 'login',
  'Not Started': 'account-clock-outline',
  'Exceptions': 'alert-circle-outline',
  'Avg Completion': 'chart-line',
  'Agents Ranked': 'trophy-outline',
};

function SummaryRow({ items }) {
  return (
    <View style={styles.summaryRow}>
      {items.map((item) => {
        const iconName = ICON_MAP[item.label] ?? 'information-outline';
        return (
          <View key={item.label} style={styles.summaryCard}>
            <View style={[styles.summaryIconCircle, { backgroundColor: item.color + '18' }]}>
              <MaterialCommunityIcons name={iconName} size={20} color={item.color} />
            </View>
            <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
            <Text style={styles.summaryLabel}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function StatusBadge({ status, customLabel, customColor }) {
  const label = customLabel ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : '—');
  const color = customColor ?? statusColor(status ?? '');
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function EmptyState({ message, icon = 'clipboard-text-outline', color = '#ccc' }) {
  return (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name={icon} size={52} color={color} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

function statusColor(status) {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed') return '#22c55e';
  if (s === 'cancelled') return '#ef4444';
  if (s === 'in_progress' || s === 'in progress') return '#4285f4';
  if (s === 'checked-in') return '#22c55e';
  return '#f97316';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f2f8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  backBtn: { padding: 4 },
  title: { fontSize: 17, fontWeight: '800', color: '#1a1a2e' },

  typeScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8eaed' },
  typeScrollContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  typeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e8eaed',
    backgroundColor: '#fff',
  },
  typeTabText: { fontSize: 13, fontWeight: '600', color: '#333' },

  reportSection: { padding: 14, gap: 10 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 3,
  },
  summaryIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryValue: { fontSize: 22, fontWeight: '900' },
  summaryLabel: { fontSize: 10, color: '#999', textAlign: 'center', marginTop: 1 },

  logCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    alignItems: 'center',
  },
  logAccent: { width: 4, alignSelf: 'stretch', flexShrink: 0 },
  logAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    flexShrink: 0,
  },
  logAvatarText: { fontSize: 15, fontWeight: '800' },
  logBody: { flex: 1, padding: 12 },
  logStore: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  logAgent: { fontSize: 12, color: '#888', marginTop: 2 },
  logFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f5f6fa',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  logTime: { fontSize: 11, color: '#888' },
  reasonBox: {
    backgroundColor: '#fff5f0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 5,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
  },
  exceptionReason: { fontSize: 12, color: '#c2440c', fontStyle: 'italic' },

  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  perfCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  perfRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  perfRankText: { fontSize: 13, fontWeight: '800' },
  perfInfo: { flex: 1 },
  perfNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  perfName: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', flex: 1, marginRight: 8 },
  perfPct: { fontSize: 15, fontWeight: '900' },
  perfBarBg: { height: 7, backgroundColor: '#e8eaed', borderRadius: 4, overflow: 'hidden', marginBottom: 5 },
  perfBarFill: { height: '100%', borderRadius: 4 },
  perfLabel: { fontSize: 11, color: '#999' },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#bbb', marginTop: 12, fontSize: 15 },
});
