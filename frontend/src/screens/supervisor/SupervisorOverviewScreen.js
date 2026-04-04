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
import MapView, { Marker } from 'react-native-maps';
import { useAuth } from '../../contexts/AuthContext';
import { visitService, userService, gpsService, notificationService } from '../../services/apiService';

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

  // Map data
  const [agentLocations, setAgentLocations] = useState([]);

  // Team members raw
  const [teamMembers, setTeamMembers] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [usersResp, visitsResp, notifResp] = await Promise.allSettled([
        userService.getUsers({ role: 'merchandiser', page_size: 200 }),
        visitService.getVisits({ date: today, page_size: 500 }),
        notificationService.getUnreadCount(),
      ]);

      // --- Team status ---
      let members = [];
      if (usersResp.status === 'fulfilled') {
        const raw = usersResp.value;
        members = Array.isArray(raw) ? raw : (raw.results ?? []);
        setTeamMembers(members);
      }

      // GPS: fetch latest location per merchandiser individually
      // (bulk endpoint is user-scoped and returns 0 for supervisor accounts)
      const activeMembers = members.filter((m) => m.is_active);
      const gpsResults = await Promise.all(
        activeMembers.map((m) =>
          gpsService
            .getLocations({ user: m.id, page_size: 1, ordering: '-recorded_at' })
            .then((r) => {
              const locs = Array.isArray(r) ? r : (r.results ?? []);
              return locs[0] ? { memberId: String(m.id), loc: locs[0] } : null;
            })
            .catch((err) => {
              console.warn(`GPS fetch failed for user ${m.id}:`, err.response?.status, err.message);
              return null;
            })
        )
      );

      let gpsMap = {};
      gpsResults.forEach((entry) => {
        if (entry) gpsMap[entry.memberId] = entry.loc;
      });
      console.log('GPS map keys:', Object.keys(gpsMap), 'out of', activeMembers.length, 'members');

      // Store agent locations for the map snapshot
      const locList = activeMembers
        .map((m) => {
          const loc = gpsMap[String(m.id)];
          if (!loc) return null;
          return {
            id: m.id,
            name: m.first_name ? `${m.first_name} ${m.last_name ?? ''}`.trim() : m.username,
            latitude: parseFloat(loc.latitude),
            longitude: parseFloat(loc.longitude),
            recorded_at: loc.recorded_at ?? loc.timestamp,
          };
        })
        .filter(Boolean);
      setAgentLocations(locList);

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
      let active = 0;
      let inactive = 0;
      let gpsOff = 0;

      members.forEach((m) => {
        if (!m.is_active) return;
        // If the user explicitly turned GPS off, show GPS Off immediately
        if (m.gps_active === false) {
          gpsOff++;
          return;
        }
        const loc = gpsMap[String(m.id)];
        if (!loc) {
          gpsOff++;
        } else {
          const locTime = new Date(loc.recorded_at ?? loc.timestamp).getTime();
          if (locTime >= fifteenMinAgo) {
            active++;
          } else if (locTime >= oneHourAgo) {
            inactive++;
          } else {
            gpsOff++;
          }
        }
      });

      setActiveCount(active);
      setInactiveCount(inactive);
      setGpsOffCount(gpsOff);

      // --- Visits ---
      if (visitsResp.status === 'fulfilled') {
        const raw = visitsResp.value;
        const visits = Array.isArray(raw) ? raw : (raw.results ?? []);
        const total = visits.length;
        const completed = visits.filter(
          (v) => v.status === 'completed' || v.status === 'COMPLETED'
        ).length;
        setTotalVisits(total);
        setCompletedVisits(completed);
        setVisitProgress(total > 0 ? Math.round((completed / total) * 100) : 0);

      }

      // --- Stores for map --- (no longer needed in overview)

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
  }, []);

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
          <View>
            <Text style={styles.welcomeSmall}>Welcome back,</Text>
            <Text style={styles.welcomeName}>{displayName}</Text>
          </View>
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
        {/* ---- Real-time Team Status ---- */}
        <Text style={styles.sectionTitle}>Real-time Team Status</Text>
        <Text style={styles.sectionSubtitle}>
          Live monitoring of {teamMembers.filter((m) => m.is_active).length} field agents
        </Text>
        <View style={styles.statsRow}>
          <StatCard
            label="ACTIVE"
            value={activeCount}
            dotColor="#22c55e"
            trend="+2%"
            trendIcon="trending-up"
            trendColor="#22c55e"
          />
          <StatCard
            label="INACTIVE"
            value={inactiveCount}
            dotColor="#94a3b8"
            subLabel="Stable"
          />
          <StatCard
            label="GPS OFF"
            value={gpsOffCount}
            dotColor="#f97316"
            subLabel={gpsOffCount > 0 ? 'Action needed' : 'All good'}
            subLabelColor={gpsOffCount > 0 ? '#ef4444' : '#22c55e'}
            subLabelIcon={gpsOffCount > 0 ? 'alert' : null}
          />
        </View>

        {/* ---- Today's Planning ---- */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
          Today's Planning
        </Text>
        <View style={styles.planningCard}>
          <View style={styles.planningHeader}>
            <Text style={styles.planningTitle}>Visit Progress</Text>
            <Text style={styles.planningPct}>{visitProgress}%</Text>
          </View>
          <Text style={styles.planningCount}>
            {completedVisits} / {totalVisits} Visits Completed
          </Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${visitProgress}%` }]} />
          </View>
          <View style={styles.planningFooter}>
            <View style={styles.planningEta}>
              <MaterialCommunityIcons name="clock-outline" size={14} color="#666" />
              <Text style={styles.planningEtaText}>On track for 6:00 PM finish</Text>
            </View>
            <TouchableOpacity
              style={styles.viewScheduleBtn}
              onPress={() => navigation.navigate('SupervisorTeam')}
            >
              <Text style={styles.viewScheduleText}>View Schedule</Text>
            </TouchableOpacity>
          </View>
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
            onPress={() => navigation.navigate('SupervisorReport', { type: 'attendance', singleType: true })}
          />
          <ReportCard
            icon="clipboard-text-outline"
            iconColor="#8b5cf6"
            accentColor="#8b5cf6"
            label="Visit Logs"
            sub="Review store visits"
            onPress={() => navigation.navigate('SupervisorReport', { type: 'visits', singleType: true })}
          />
          <ReportCard
            icon="alert-circle-outline"
            iconColor="#f97316"
            accentColor="#f97316"
            label="Exceptions"
            sub="Issues & anomalies"
            onPress={() => navigation.navigate('SupervisorReport', { type: 'exceptions', singleType: true })}
          />
          <ReportCard
            icon="chart-line"
            iconColor="#22c55e"
            accentColor="#22c55e"
            label="Performance"
            sub="Team KPIs & stats"
            onPress={() => navigation.navigate('SupervisorReport', { type: 'performance', singleType: true })}
          />
        </View>

        {/* ---- Live Map Snapshot ---- */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Live Map Snapshot</Text>
        <View style={styles.mapCard}>
          {agentLocations.length > 0 ? (
            <MapView
              style={{ width: '100%', height: 180 }}
              initialRegion={{
                latitude: agentLocations[0].latitude,
                longitude: agentLocations[0].longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              {agentLocations.map((agent) => (
                <Marker
                  key={`agent-${agent.id}`}
                  coordinate={{ latitude: agent.latitude, longitude: agent.longitude }}
                  title={agent.name}
                >
                  <View style={styles.agentMarker}>
                    <Text style={styles.agentMarkerText}>
                      {agent.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                </Marker>
              ))}
            </MapView>
          ) : (
            <View style={styles.mapEmpty}>
              <MaterialCommunityIcons name="map-marker-off-outline" size={32} color="#bbb" />
              <Text style={styles.mapEmptyText}>No agents with active GPS</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.expandMapBtn}
            onPress={() => navigation.navigate('SupervisorMap')}
          >
            <MaterialCommunityIcons name="fullscreen" size={14} color="#333" />
            <Text style={styles.expandMapText}>Expand Map</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, dotColor, trend, trendIcon, trendColor, subLabel, subLabelColor, subLabelIcon }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.statDot, { backgroundColor: dotColor }]} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {trend ? (
        <View style={styles.statTrend}>
          {trendIcon && (
            <MaterialCommunityIcons name={trendIcon} size={12} color={trendColor} />
          )}
          <Text style={[styles.statTrendText, { color: trendColor }]}>{trend}</Text>
        </View>
      ) : subLabel ? (
        <View style={styles.statTrend}>
          {subLabelIcon && (
            <MaterialCommunityIcons name={subLabelIcon} size={11} color={subLabelColor || '#666'} />
          )}
          <Text style={[styles.statSubLabel, subLabelColor ? { color: subLabelColor } : {}]}>
            {subLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

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
  welcomeSmall: { fontSize: 13, color: '#666' },
  welcomeName: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginTop: 1 },
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginTop: 20,
    marginBottom: 4,
  },
  sectionSubtitle: { fontSize: 12, color: '#888', marginBottom: 10 },

  // Stat cards
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#888', letterSpacing: 0.5 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#1a1a2e', lineHeight: 32 },
  statTrend: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 2 },
  statTrendText: { fontSize: 11, fontWeight: '600' },
  statSubLabel: { fontSize: 11, color: '#666' },

  // Planning card
  planningCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginTop: 8,
  },
  planningHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planningTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  planningPct: { fontSize: 14, fontWeight: '700', color: '#4285f4' },
  planningCount: { fontSize: 12, color: '#666', marginTop: 2, marginBottom: 10 },
  progressBarBg: { height: 8, backgroundColor: '#e8eaed', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#4285f4', borderRadius: 6 },
  planningFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  planningEta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  planningEtaText: { fontSize: 12, color: '#666' },
  viewScheduleBtn: {
    backgroundColor: '#4285f4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  viewScheduleText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Reports grid
  reportsGrid: {
    gap: 10,
    marginTop: 8,
  },
  reportCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  reportAccentBar: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  reportCardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 14,
  },
  reportIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportTextWrap: { flex: 1 },
  reportLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  reportSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  // Map
  mapCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  expandMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  expandMapText: { fontSize: 12, fontWeight: '600', color: '#333' },
  agentMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4285f4',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  agentMarkerText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  mapEmpty: {
    width: '100%',
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4fa',
    gap: 8,
  },
  mapEmptyText: { fontSize: 13, color: '#aaa' },
});
