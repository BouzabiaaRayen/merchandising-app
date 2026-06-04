import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { visitService, userService, notificationService } from '../../services/apiService';

export default function SupervisorOverviewScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Team status
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [gpsOffCount, setGpsOffCount] = useState(0);
  const [activeTrend, setActiveTrend] = useState(null); // e.g. +2%

  // Visit planning
  const [completedVisits, setCompletedVisits] = useState(0);
  const [totalVisits, setTotalVisits] = useState(0);
  const [visitProgress, setVisitProgress] = useState(0);

  // Team members raw
  const [teamMembers, setTeamMembers] = useState([]);

  // Returns true only if m is supervised by the logged-in supervisor.
  // Handles supervisor field as null | int | nested object.
  const isTeamMember = useCallback((m) => {
    const currentId = String(user?.id ?? '');
    if (!currentId) return true;
    // If backend hasn't populated the supervisor field, trust the ?supervisor= query param filter
    if (m.supervisor == null && m.supervisor_id == null) return true;
    const resolved = typeof m.supervisor === 'object' ? m.supervisor?.id : m.supervisor;
    if (resolved != null && String(resolved) === currentId) return true;
    if (m.supervisor_id != null && String(m.supervisor_id) === currentId) return true;
    return false;
  }, [user?.id]);

  const fetchData = useCallback(async () => {
    try {
      const supervisorId = user?.id;
      if (!supervisorId) {
        setTeamMembers([]);
        setActiveCount(0);
        setInactiveCount(0);
        setGpsOffCount(0);
        setTotalVisits(0);
        setCompletedVisits(0);
        setVisitProgress(0);
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      const [summaryResp, usersResp, visitsResp, notifResp] = await Promise.allSettled([
        userService.getTeamSummary({ supervisor: supervisorId }),
        userService.getUsers({
          role: 'merchandiser',
          page_size: 200,
          supervisor: supervisorId,
          supervisor_id: supervisorId,
        }),
        visitService.getVisits({ date: today, page_size: 5000 }),
        notificationService.getUnreadCount(),
      ]);

      const summary = summaryResp.status === 'fulfilled' ? (summaryResp.value ?? {}) : {};
      const summaryMembers = Array.isArray(summary.team_members) ? summary.team_members : [];

      let members = summaryMembers;
      if (members.length === 0 && usersResp.status === 'fulfilled') {
        const raw = usersResp.value;
        const all = Array.isArray(raw) ? raw : (raw.results ?? []);
        const currentId = String(user?.id ?? '');
        members = all.filter((m) => isTeamMember(m, currentId));
      }

      setTeamMembers(members);

      const visits = visitsResp.status === 'fulfilled'
        ? (Array.isArray(visitsResp.value) ? visitsResp.value : (visitsResp.value?.results ?? []))
        : [];

      const teamIds = new Set(members.map((m) => String(m.id)));
      const teamVisits = visits.filter((v) => {
        const inTeam = teamIds.has(String(v.merchandiser ?? v.user ?? ''));
        const isCancelled = (v.status ?? '').toLowerCase() === 'cancelled';
        return inTeam && !isCancelled;
      });
      const completed = teamVisits.filter((v) => !!v.check_out_time).length;

      setTotalVisits(teamVisits.length);
      setCompletedVisits(completed);
      setVisitProgress(teamVisits.length > 0 ? Math.round((completed / teamVisits.length) * 100) : 0);

      if (summaryResp.status === 'fulfilled' && summaryMembers.length > 0) {
        setActiveCount(summary.active_tracking ?? 0);
        setInactiveCount(0);
        setGpsOffCount(Math.max((summary.team_size ?? members.length) - (summary.active_tracking ?? 0), 0));
      } else {
        setActiveCount(0);
        setInactiveCount(0);
        setGpsOffCount(0);
      }

      // --- Notifications ---
      if (notifResp.status === 'fulfilled') {
        setUnreadCount(notifResp.value?.count ?? 0);
      }
    } catch (err) {
      console.warn('SupervisorOverview fetchData error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, isTeamMember]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds so GPS status changes are picked up promptly
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const displayName =
    user?.first_name
      ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
      : user?.username ?? 'Supervisor';

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
      {/* ---- Header ---- */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Text style={styles.headerAvatarText}>
                {(user?.first_name?.[0] || user?.username?.[0] || 'S').toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.welcomeName}>{displayName}</Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('SupervisorNotifications')}
        >
          <MaterialCommunityIcons name="bell-outline" size={24} color="#333" />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4285f4']} />
        }
      >
        {/* ---- Metric Grid ---- */}
        <View style={[styles.metricGrid, { marginTop: 20 }]}>
          <View style={styles.metricCard}>
            <View style={styles.metricIconWrap}>
              <MaterialCommunityIcons name="account-group-outline" size={22} color="#4285f4" />
            </View>
            <Text style={styles.metricValue}>{teamMembers.filter((m) => m.is_active).length}</Text>
            <Text style={styles.metricLabel}>Team Size</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#dcfce7' }]}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color="#22c55e" />
            </View>
            <Text style={styles.metricValue}>{activeCount}</Text>
            <Text style={styles.metricLabel}>Active Tracking</Text>
          </View>
        </View>

        {/* ---- Today's Visits ---- */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Today's Visits</Text>
        <View style={styles.planningCard}>
          <View style={styles.visitsRow}>
            <View style={styles.visitsStat}>
              <Text style={styles.visitsNumber}>{totalVisits}</Text>
              <Text style={styles.visitsSubLabel}>Planned</Text>
            </View>
            <View style={styles.visitsDivider} />
            <View style={styles.visitsStat}>
              <Text style={[styles.visitsNumber, { color: '#22c55e' }]}>{completedVisits}</Text>
              <Text style={styles.visitsSubLabel}>Completed</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${visitProgress}%` }]} />
          </View>
          <Text style={styles.progressPct}>{visitProgress}% completion rate</Text>
        </View>

        {/* ---- Team Reports ---- */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Team Reports</Text>
        <View style={styles.reportsGrid}>
          <ReportCard
            icon="calendar-check"
            iconColor="#4285f4"
            accentColor="#4285f4"
            label="Attendance"
            sub="Track daily check-ins"
            onPress={() => navigation.navigate('SupervisorAttendance')}
          />
          <ReportCard
            icon="clipboard-text-outline"
            iconColor="#8b5cf6"
            accentColor="#8b5cf6"
            label="Visit Logs"
            sub="Review store visits"
            onPress={() => navigation.navigate('SupervisorVisitLogs')}
          />
          <ReportCard
            icon="chart-line"
            iconColor="#22c55e"
            accentColor="#22c55e"
            label="Performance"
            sub="Team KPIs & stats"
            onPress={() => navigation.navigate('SupervisorPerformance')}
          />
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReportCard({ icon, iconColor, accentColor, label, sub, onPress }) {
  return (
    <TouchableOpacity style={styles.reportCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.reportAccentBar, { backgroundColor: accentColor }]} />
      <View style={styles.reportCardInner}>
        <View style={[styles.reportIconWrap, { backgroundColor: accentColor + '18' }]}>
          <MaterialCommunityIcons name={icon} size={24} color={iconColor} />
        </View>
        <View style={styles.reportTextWrap}>
          <Text style={styles.reportLabel}>{label}</Text>
          <Text style={styles.reportSub}>{sub}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color="#c0c4cc" />
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f6fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e2e8f0' },
  headerAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  welcomeName: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  notifBtn: { position: 'relative', padding: 4 },
  notifBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // Sections
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginTop: 20, marginBottom: 8 },

  // Metric grid
  metricGrid: { flexDirection: 'row', gap: 10 },
  metricCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  metricIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#dbeafe',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  metricValue: { fontSize: 24, fontWeight: '800', color: '#1a1a2e' },
  metricLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 2, textAlign: 'center' },

  // Planning card
  planningCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  visitsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  visitsStat: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  visitsNumber: { fontSize: 28, fontWeight: '800', color: '#1a1a2e' },
  visitsSubLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
  visitsDivider: { width: 1, height: 40, backgroundColor: '#e8eaed' },
  progressBarBg: { height: 7, backgroundColor: '#e8eaed', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#4285f4', borderRadius: 6 },
  progressPct: { fontSize: 11, color: '#94a3b8', marginTop: 6, textAlign: 'center' },

  // Reports grid
  reportsGrid: { gap: 8, marginTop: 8 },
  reportCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 12,
    overflow: 'hidden', flexDirection: 'row',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
  },
  reportAccentBar: { width: 3, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  reportCardInner: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12, gap: 12,
  },
  reportIconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  reportTextWrap: { flex: 1 },
  reportLabel: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  reportSub: { fontSize: 11, color: '#9ca3af', marginTop: 1 },


});
