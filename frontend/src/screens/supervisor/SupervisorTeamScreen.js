import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { userService, visitService, gpsService } from '../../services/apiService';

const STATUS_COLORS = {
  active: '#22c55e',
  inactive: '#94a3b8',
  gps_off: '#f97316',
};

export default function SupervisorTeamScreen() {
  const [members, setMembers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // visit counts & gps per member
  const [visitMap, setVisitMap] = useState({});
  const [gpsMap, setGpsMap] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [usersResp, visitsResp] = await Promise.allSettled([
        userService.getUsers({ role: 'merchandiser', page_size: 200 }),
        visitService.getVisits({ date: today, page_size: 500 }),
      ]);

      let rawMembers = [];
      if (usersResp.status === 'fulfilled') {
        const raw = usersResp.value;
        rawMembers = Array.isArray(raw) ? raw : (raw.results ?? []);
        setMembers(rawMembers);
      }

      // Build visit count map
      let vMap = {};
      if (visitsResp.status === 'fulfilled') {
        const raw = visitsResp.value;
        const visits = Array.isArray(raw) ? raw : (raw.results ?? []);
        visits.forEach((v) => {
          const uid = v.merchandiser ?? v.user;
          if (!uid) return;
          if (!vMap[uid]) vMap[uid] = { total: 0, completed: 0 };
          vMap[uid].total++;
          if (v.status === 'completed' || v.status === 'COMPLETED') vMap[uid].completed++;
        });
        setVisitMap(vMap);
      }

      // GPS: fetch latest location per merchandiser individually
      const activeMembers = rawMembers.filter((m) => m.is_active);
      const gpsResults = await Promise.all(
        activeMembers.map((m) =>
          gpsService
            .getLocations({ user: m.id, page_size: 1, ordering: '-recorded_at' })
            .then((r) => {
              const locs = Array.isArray(r) ? r : (r.results ?? []);
              return locs[0] ? { memberId: String(m.id), loc: locs[0] } : null;
            })
            .catch(() => null)
        )
      );

      let gMap = {};
      gpsResults.forEach((entry) => {
        if (entry) gMap[entry.memberId] = entry.loc;
      });
      setGpsMap(gMap);
    } catch (err) {
      console.warn('SupervisorTeam fetchData error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // filter + search
  useEffect(() => {
    const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let result = members.filter((m) => m.is_active);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          (m.first_name + ' ' + m.last_name).toLowerCase().includes(q) ||
          (m.username ?? '').toLowerCase().includes(q)
      );
    }

    if (selectedStatus !== 'all') {
      result = result.filter((m) => getMemberStatus(m, gpsMap, fifteenMinAgo, oneHourAgo) === selectedStatus);
    }

    setFiltered(result);
  }, [members, search, selectedStatus, gpsMap]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4285f4" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Team</Text>
          <Text style={styles.subtitle}>{members.filter((m) => m.is_active).length} field agents</Text>
        </View>
        <View style={styles.headerStats}>
          {[
            { key: 'active', label: 'Active', color: '#22c55e' },
            { key: 'gps_off', label: 'GPS Off', color: '#f97316' },
          ].map(({ key, label, color }) => {
            const fma = Date.now() - 15 * 60 * 1000;
            const oha = Date.now() - 60 * 60 * 1000;
            const count = members.filter(m => m.is_active && getMemberStatus(m, gpsMap, fma, oha) === key).length;
            return (
              <View key={key} style={[styles.headerStatChip, { borderColor: color + '50' }]}>
                <View style={[styles.headerStatDot, { backgroundColor: color }]} />
                <Text style={[styles.headerStatText, { color }]}>{count} {label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={18} color="#999" style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search agents..."
          placeholderTextColor="#aaa"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons name="close-circle" size={16} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter tabs */}
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: 'All', color: '#4285f4' },
          { key: 'active', label: 'Active', color: '#22c55e' },
          { key: 'inactive', label: 'Inactive', color: '#94a3b8' },
          { key: 'gps_off', label: 'GPS Off', color: '#f97316' },
        ].map(({ key: s, label, color }) => {
          const fma = Date.now() - 15 * 60 * 1000;
          const oha = Date.now() - 60 * 60 * 1000;
          const count = s === 'all'
            ? members.filter(m => m.is_active).length
            : members.filter(m => m.is_active && getMemberStatus(m, gpsMap, fma, oha) === s).length;
          const isActive = selectedStatus === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.filterTab, isActive && { backgroundColor: color, borderColor: color }]}
              onPress={() => setSelectedStatus(s)}
            >
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>{label}</Text>
              <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <MemberCard
            member={item}
            visits={visitMap[item.id]}
            gps={gpsMap[item.id]}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4285f4']} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-group-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No agents found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function getMemberStatus(member, gpsMap, fifteenMinAgo, oneHourAgo) {
  // If user explicitly turned GPS off, reflect it immediately
  if (member.gps_active === false) return 'gps_off';
  const loc = gpsMap[String(member.id)];
  if (!loc) return 'gps_off';
  const t = new Date(loc.recorded_at ?? loc.timestamp).getTime();
  if (t >= fifteenMinAgo) return 'active';
  if (oneHourAgo != null && t >= oneHourAgo) return 'inactive';
  return 'gps_off';
}

function MemberCard({ member, visits, gps }) {
  const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const status = getMemberStatus(member, gps ? { [String(member.id)]: gps } : {}, fifteenMinAgo, oneHourAgo);

  const statusLabel = status === 'active' ? 'Active' : status === 'inactive' ? 'Inactive' : 'GPS Off';
  const sColor = STATUS_COLORS[status] ?? '#94a3b8';

  const fullName =
    (member.first_name || '') + (member.last_name ? ' ' + member.last_name : '') ||
    member.username;

  const completed = visits?.completed ?? 0;
  const total = visits?.total ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';

  const lastSeen = (gps?.recorded_at ?? gps?.timestamp)
    ? formatRelativeTime(new Date(gps.recorded_at ?? gps.timestamp))
    : 'Never';

  const initials = (
    ((member.first_name?.[0] ?? '') + (member.last_name?.[0] ?? '')) || (member.username?.[0] ?? '?')
  ).toUpperCase();

  return (
    <View style={styles.memberCard}>
      <View style={[styles.memberAccent, { backgroundColor: sColor }]} />
      <View style={[styles.memberAvatar, { backgroundColor: sColor + '20', borderColor: sColor + '50' }]}>
        <Text style={[styles.memberAvatarText, { color: sColor }]}>{initials}</Text>
      </View>
      <View style={styles.memberInfo}>
        <View style={styles.memberRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.memberName} numberOfLines={1}>{fullName}</Text>
            <Text style={styles.memberUsername}>@{member.username}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: sColor + '18', borderColor: sColor + '50' }]}>
            <View style={[styles.statusDot, { backgroundColor: sColor }]} />
            <Text style={[styles.statusText, { color: sColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.memberMetaRow}>
          <View style={styles.memberMetaChip}>
            <MaterialCommunityIcons name="store-outline" size={11} color="#999" />
            <Text style={styles.memberMetaText}>
              {total > 0 ? `${completed}/${total} visits` : 'No visits today'}
            </Text>
          </View>
          <View style={styles.memberMetaChip}>
            <MaterialCommunityIcons name="clock-outline" size={11} color="#999" />
            <Text style={styles.memberMetaText}>{lastSeen}</Text>
          </View>
        </View>

        {total > 0 && (
          <View style={styles.visitProgressRow}>
            <View style={styles.visitBarBg}>
              <View style={[styles.visitBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={styles.visitPct}>{pct}%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function formatRelativeTime(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f2f8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },

  headerStats: { flexDirection: 'row', gap: 6 },
  headerStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fafafa',
  },
  headerStatDot: { width: 7, height: 7, borderRadius: 3.5 },
  headerStatText: { fontSize: 11, fontWeight: '700' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eaecf0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    gap: 5,
  },
  filterTabText: { fontSize: 12, color: '#555', fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e8eaed',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#555' },
  filterBadgeTextActive: { color: '#fff' },

  listContent: { padding: 12, gap: 10, paddingBottom: 24 },

  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  memberAccent: { width: 4, flexShrink: 0 },
  memberAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    alignSelf: 'center',
    marginLeft: 12,
  },
  memberAvatarText: { fontWeight: '800', fontSize: 17 },
  memberInfo: { flex: 1, padding: 12 },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  memberName: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  memberUsername: { fontSize: 12, color: '#aaa', marginTop: 1 },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
    flexShrink: 0,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  memberMetaRow: { flexDirection: 'row', gap: 12, marginTop: 7 },
  memberMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberMetaText: { fontSize: 11, color: '#999' },

  visitProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  visitBarBg: {
    flex: 1,
    height: 5,
    backgroundColor: '#e8eaed',
    borderRadius: 3,
    overflow: 'hidden',
  },
  visitBarFill: { height: '100%', borderRadius: 3 },
  visitPct: { fontSize: 11, color: '#888', fontWeight: '700', minWidth: 30, textAlign: 'right' },

  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#bbb', marginTop: 12, fontSize: 15 },
});
