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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { visitService, userService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { getAvatarUrl } from '../../services/supabaseClient';

const ACCENT = '#2563EB';

const KPI_META = {
  completed: { label: 'Visits Completed', icon: 'check-decagram-outline', bg: '#EEF6FF', tint: '#2563EB' },
  rate: { label: 'Team Completion', icon: 'chart-arc', bg: '#F6F3FF', tint: '#6D28D9' },
  active: { label: 'Active Merchandisers', icon: 'account-heart-outline', bg: '#EDF9F1', tint: '#15803D' },
};

function isTeamMember(member, currentId) {
  if (!currentId) return true;
  if (member.supervisor == null && member.supervisor_id == null) return true;
  const resolved = typeof member.supervisor === 'object' ? member.supervisor?.id : member.supervisor;
  if (resolved != null && String(resolved) === currentId) return true;
  if (member.supervisor_id != null && String(member.supervisor_id) === currentId) return true;
  return false;
}

function formatTodayLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPerformanceMeta(percentage) {
  if (percentage >= 85) {
    return { label: 'Excellent', bg: '#EDF9F1', color: '#15803D' };
  }
  if (percentage >= 55) {
    return { label: 'Good', bg: '#EEF6FF', color: '#1D4ED8' };
  }
  // Remove 'Needs Attention' label; fallback to 'Good' for anything below 55
  return { label: 'Good', bg: '#EEF6FF', color: '#1D4ED8' };
}

function getAvatarSource(rawAvatar) {
  if (!rawAvatar) {
    return null;
  }

  if (String(rawAvatar).startsWith('http')) {
    return { uri: rawAvatar };
  }

  const resolved = getAvatarUrl(rawAvatar);
  return resolved ? { uri: resolved } : null;
}

export default function SupervisorPerformanceScreen() {
  const navigation = useNavigation();
  const { user: currentUser } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const now = new Date();

  const fetchData = useCallback(async () => {
    try {
      const supervisorId = currentUser?.id;
      if (!supervisorId) {
        setLeaderboard([]);
        return;
      }

      // Get current month range
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const [summaryResp, visitsResp] = await Promise.allSettled([
        userService.getTeamSummary({ supervisor: supervisorId }),
        visitService.getVisits({ page_size: 500 }),
      ]);

      let agents = [];
      if (summaryResp.status === 'fulfilled') {
        agents = Array.isArray(summaryResp.value?.team_members) ? summaryResp.value.team_members : [];
      }

      if (agents.length === 0) {
        const usersResp = await userService.getUsers({
          role: 'merchandiser',
          page_size: 200,
          supervisor: supervisorId,
          supervisor_id: supervisorId,
        }).catch(() => ({ results: [] }));
        const all = Array.isArray(usersResp) ? usersResp : (usersResp.results ?? []);
        const currentId = String(currentUser?.id ?? '');
        agents = all.filter((member) => isTeamMember(member, currentId));
      }

      const statsMap = {};
      agents.forEach((agent) => {
        statsMap[String(agent.id)] = {
          completed: 0,
          planned: 0,
          active: !!agent.day_started,
          avatar: agent.avatar_url || agent.avatar || null,
        };
      });

      if (visitsResp.status === 'fulfilled') {
        const raw = Array.isArray(visitsResp.value) ? visitsResp.value : (visitsResp.value?.results ?? []);
        raw.forEach((visit) => {
          const dateStr = String(visit.scheduled_date ?? visit.planned_date ?? visit.date ?? '');
          if (!dateStr) return;
          const visitDate = new Date(dateStr);
          if (visitDate < startOfMonth || visitDate > endOfMonth) return;

          const uid = String(visit.merchandiser ?? visit.user ?? '');
          if (!(uid in statsMap)) return;

          const status = String(visit.status ?? '').toLowerCase();
          if (status !== 'cancelled') {
            statsMap[uid].planned += 1;
          }
          if (status === 'completed' || status === 'done' || status === 'finished') {
            statsMap[uid].completed += 1;
          }
        });
      }

      const ranked = agents
        .map((agent) => {
          const stats = statsMap[String(agent.id)] || { completed: 0, planned: 0, active: false, avatar: null };
          const completionPct = stats.planned > 0 ? Math.round((stats.completed / stats.planned) * 100) : 0;

          return {
            id: agent.id,
            name: `${agent.first_name} ${agent.last_name}`.trim() || agent.username,
            completed: stats.completed,
            planned: stats.planned,
            active: stats.active,
            completionPct,
            avatarSource: getAvatarSource(stats.avatar),
          };
        })
        .sort((a, b) => {
          if (b.completionPct !== a.completionPct) return b.completionPct - a.completionPct;
          return b.completed - a.completed;
        });

      setLeaderboard(ranked);
    } catch (err) {
      console.warn('Performance fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  const summary = useMemo(() => {
    return leaderboard.reduce(
      (acc, item) => {
        acc.completed += item.completed;
        acc.planned += item.planned;
        if (item.active) acc.active += 1;
        return acc;
      },
      { completed: 0, planned: 0, active: 0 }
    );
  }, [leaderboard]);

  const completionRate = summary.planned > 0 ? Math.round((summary.completed / summary.planned) * 100) : 0;
  const hasAgents = leaderboard.length > 0;

  const renderKpiCard = (type) => {
    const meta = KPI_META[type];
    const value =
      type === 'completed'
        ? summary.completed
        : type === 'rate'
          ? `${completionRate}%`
          : summary.active;

    return (
      <View key={type} style={[styles.kpiCard, { backgroundColor: meta.bg }]}> 
        <View style={styles.kpiIconWrap}>
          <MaterialCommunityIcons name={meta.icon} size={16} color={meta.tint} />
        </View>
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiLabel}>{meta.label}</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeaderWrap}>
      <View style={styles.headerIntroRow}>
        <View>
          <Text style={styles.pageTitle}>Performance</Text>
          <Text style={styles.pageSub}>Team productivity at a glance</Text>
        </View>
        <View style={styles.periodPill}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={15} color={ACCENT} />
          <Text style={styles.periodText}>
            {`Month · ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiRow}>
        {renderKpiCard('completed')}
        {renderKpiCard('rate')}
        {renderKpiCard('active')}
      </ScrollView>

      <Text style={styles.sectionTitle}>Team Ranking</Text>
    </View>
  );

  const renderItem = ({ item, index }) => {
    const performance = getPerformanceMeta(item.completionPct);
    const initials = item.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <View style={[styles.memberCard, index === 0 && styles.firstCard]}> 
        <View style={styles.cardTopRow}>
          <View style={styles.identityWrap}>
            <View style={styles.avatarWrap}>
              {item.avatarSource ? (
                <Image source={item.avatarSource} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{initials}</Text>
                </View>
              )}
            </View>

            <View style={styles.memberTextWrap}>
              <Text style={styles.agentName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.metaText}>{item.completed} of {item.planned} visits completed</Text>
            </View>
          </View>

          <View style={styles.rankWrap}>
            <Text style={styles.rankLabel}>#{index + 1}</Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progressPct}>{item.completionPct}%</Text>
        </View>

        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${item.completionPct}%` }]} />
        </View>
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
      ) : !hasAgents ? (
        <View style={styles.emptyFull}>
          <MaterialCommunityIcons name="chart-bar" size={56} color="#D8E0E8" />
          <Text style={styles.emptyTitle}>No team performance yet</Text>
          <Text style={styles.emptySub}>Your merchandiser performance will appear here once activity starts.</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              tintColor={ACCENT}
            />
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
  listHeaderWrap: { paddingBottom: 14 },
  headerIntroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  pageSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  periodText: { fontSize: 12, fontWeight: '700', color: '#1E3A8A' },
  kpiRow: { gap: 12, paddingRight: 8 },
  kpiCard: {
    width: 132,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  kpiIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFFAA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: { fontSize: 24, fontWeight: '700', color: '#0F172A', marginTop: 18 },
  kpiLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 18, marginBottom: 10 },
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
  firstCard: { marginTop: 2 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  identityWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: '#EAF2FF',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { fontSize: 15, fontWeight: '800', color: ACCENT },
  memberTextWrap: { flex: 1, minWidth: 0 },
  agentName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  metaText: { fontSize: 12, color: '#64748B', marginTop: 4 },
  rankWrap: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    alignSelf: 'flex-start',
  },
  rankLabel: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  progressPct: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  barBg: { height: 6, backgroundColor: '#EAEFF5', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 999, backgroundColor: ACCENT },
  emptyFull: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#64748B', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
});
