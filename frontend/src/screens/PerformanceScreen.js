import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, Dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { visitService, storeService } from '../services/apiService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Simple progress ring using bordered views
const ProgressRing = ({ percentage, size = 120, strokeWidth = 10, color = '#2563eb' }) => {
  const radius = (size - strokeWidth) / 2;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: '#e2e8f0',
        position: 'absolute',
      }} />
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: color,
        borderTopColor: percentage > 25 ? color : '#e2e8f0',
        borderRightColor: percentage > 50 ? color : '#e2e8f0',
        borderBottomColor: percentage > 75 ? color : '#e2e8f0',
        borderLeftColor: percentage > 0 ? color : '#e2e8f0',
        position: 'absolute',
        transform: [{ rotate: '-45deg' }],
      }} />
      <Text style={{ fontSize: 28, fontWeight: '800', color: '#1e293b' }}>{percentage}%</Text>
    </View>
  );
};

export default function PerformanceScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [visitsData, storesData] = await Promise.all([
        visitService.getVisits({ merchandiser: user?.id, page_size: 1000 }),
        storeService.getStores({ page_size: 1000 }),
      ]);
      const visits = visitsData?.results || visitsData || [];
      const stores = storesData?.results || storesData || [];
      const storeMap = {};
      stores.forEach(s => { storeMap[s.id] = s; });

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const completed = visits.filter(v => v.status === 'completed');
      const todayVisits = completed.filter(v => (v.scheduled_date || v.check_out_time || '').startsWith(today));
      const thisWeek = completed.filter(v => new Date(v.check_out_time || v.updated_at) >= startOfWeek);
      const thisMonth = completed.filter(v => new Date(v.check_out_time || v.updated_at) >= startOfMonth);
      const lastMonth = completed.filter(v => {
        const d = new Date(v.check_out_time || v.updated_at);
        return d >= startOfLastMonth && d <= endOfLastMonth;
      });

      // Average time per visit
      let totalTimeSeconds = 0;
      let timedVisits = 0;
      let longestVisitMin = 0;
      let shortestVisitMin = Infinity;
      completed.forEach(v => {
        if (v.check_in_time && v.check_out_time) {
          const diff = (new Date(v.check_out_time) - new Date(v.check_in_time)) / 1000;
          if (diff > 0 && diff < 86400) {
            totalTimeSeconds += diff;
            timedVisits++;
            const minutes = Math.round(diff / 60);
            if (minutes > longestVisitMin) longestVisitMin = minutes;
            if (minutes < shortestVisitMin) shortestVisitMin = minutes;
          }
        }
      });
      const avgMinutes = timedVisits > 0 ? Math.round(totalTimeSeconds / timedVisits / 60) : 0;
      if (shortestVisitMin === Infinity) shortestVisitMin = 0;

      // Total hours worked this month
      let monthHoursWorked = 0;
      thisMonth.forEach(v => {
        if (v.check_in_time && v.check_out_time) {
          const diff = (new Date(v.check_out_time) - new Date(v.check_in_time)) / 1000;
          if (diff > 0 && diff < 86400) monthHoursWorked += diff;
        }
      });
      const monthHours = Math.round(monthHoursWorked / 3600 * 10) / 10;

      // Unique stores
      const uniqueStores = new Set(completed.map(v => v.store).filter(Boolean)).size;

      // Top store (most visited)
      const storeVisitCount = {};
      completed.forEach(v => {
        if (v.store) storeVisitCount[v.store] = (storeVisitCount[v.store] || 0) + 1;
      });
      let topStoreId = null;
      let topStoreCount = 0;
      Object.entries(storeVisitCount).forEach(([id, count]) => {
        if (count > topStoreCount) { topStoreId = id; topStoreCount = count; }
      });
      const topStoreName = storeMap[topStoreId]?.name || null;

      // Weekly breakdown (Mon-Sun for current week)
      const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      const weeklyData = weekDays.map((label, i) => {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        const dayStr = day.toISOString().split('T')[0];
        const count = completed.filter(v => (v.scheduled_date || v.check_out_time || '').startsWith(dayStr)).length;
        const isToday = dayStr === today;
        return { label, count, isToday };
      });
      const maxWeekly = Math.max(...weeklyData.map(d => d.count), 1);

      // Streak: consecutive days with completed visits
      let streak = 0;
      const checkDate = new Date(now);
      checkDate.setHours(0, 0, 0, 0);
      for (let i = 0; i < 60; i++) {
        const dayStr = checkDate.toISOString().split('T')[0];
        const hasVisit = completed.some(v => (v.scheduled_date || v.check_out_time || '').startsWith(dayStr));
        if (hasVisit) { streak++; } else if (i > 0) break; // skip today if no visit yet
        checkDate.setDate(checkDate.getDate() - 1);
      }

      // Month over month change
      const monthChange = lastMonth.length > 0
        ? Math.round(((thisMonth.length - lastMonth.length) / lastMonth.length) * 100)
        : null;

      const pending = visits.filter(v => v.status === 'pending' || v.status === 'scheduled').length;
      const completionRate = visits.length > 0 ? Math.round((completed.length / visits.length) * 100) : 0;

      setStats({
        totalVisits: completed.length,
        todayVisits: todayVisits.length,
        thisWeek: thisWeek.length,
        thisMonth: thisMonth.length,
        lastMonth: lastMonth.length,
        monthChange,
        pending,
        avgMinutes,
        longestVisitMin,
        shortestVisitMin,
        monthHours,
        uniqueStores,
        topStoreName,
        topStoreCount,
        completionRate,
        weeklyData,
        maxWeekly,
        streak,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const KPI = ({ icon, label, value, sub, color = '#2563eb', large }) => (
    <View style={[styles.kpi, large && styles.kpiLarge]}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '12' }]}>
        <MaterialCommunityIcons name={icon} size={large ? 26 : 20} color={color} />
      </View>
      <Text style={[styles.kpiValue, large && styles.kpiValueLarge]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Performance</Text>
          <TouchableOpacity onPress={loadStats} style={styles.backBtn}>
            <MaterialCommunityIcons name="refresh" size={22} color="#2563eb" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : !stats ? (
          <View style={styles.loadingWrap}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" />
            <Text style={styles.loadingText}>Erreur de chargement</Text>
          </View>
        ) : (
          <>
            {/* Score Card */}
            <View style={styles.scoreCard}>
              <ProgressRing
                percentage={stats.completionRate}
                color={stats.completionRate >= 80 ? '#16a34a' : stats.completionRate >= 50 ? '#f59e0b' : '#ef4444'}
              />
              <View style={styles.scoreInfo}>
                <Text style={styles.scoreTitle}>Taux de complétion</Text>
                <Text style={styles.scoreDetail}>{stats.totalVisits} complétées / {stats.totalVisits + stats.pending} total</Text>
                {stats.streak > 0 && (
                  <View style={styles.streakBadge}>
                    <MaterialCommunityIcons name="fire" size={16} color="#f59e0b" />
                    <Text style={styles.streakText}>{stats.streak} jours consécutifs</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Today highlight */}
            <View style={styles.todayCard}>
              <View style={styles.todayLeft}>
                <MaterialCommunityIcons name="calendar-today" size={22} color="#2563eb" />
                <View>
                  <Text style={styles.todayLabel}>Aujourd'hui</Text>
                  <Text style={styles.todayValue}>{stats.todayVisits} visite{stats.todayVisits !== 1 ? 's' : ''} complétée{stats.todayVisits !== 1 ? 's' : ''}</Text>
                </View>
              </View>
              <View style={styles.todayRight}>
                <Text style={styles.pendingLabel}>{stats.pending}</Text>
                <Text style={styles.pendingText}>en attente</Text>
              </View>
            </View>

            {/* Weekly chart */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CETTE SEMAINE</Text>
              <View style={styles.chartCard}>
                <View style={styles.chartRow}>
                  {stats.weeklyData.map((d, i) => (
                    <View key={i} style={styles.barCol}>
                      <View style={styles.barWrap}>
                        <View style={[
                          styles.bar,
                          {
                            height: d.count > 0 ? Math.max((d.count / stats.maxWeekly) * 80, 6) : 4,
                            backgroundColor: d.isToday ? '#2563eb' : d.count > 0 ? '#93c5fd' : '#e2e8f0',
                            borderRadius: 4,
                          }
                        ]} />
                        {d.count > 0 && <Text style={styles.barValue}>{d.count}</Text>}
                      </View>
                      <Text style={[styles.barLabel, d.isToday && styles.barLabelToday]}>{d.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.chartSummary}>
                  <Text style={styles.chartSummaryText}>
                    <Text style={{ fontWeight: '800', color: '#2563eb' }}>{stats.thisWeek}</Text> visites cette semaine
                  </Text>
                </View>
              </View>
            </View>

            {/* Monthly KPIs */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>CE MOIS</Text>
                {stats.monthChange !== null && (
                  <View style={[styles.changeBadge, { backgroundColor: stats.monthChange >= 0 ? '#dcfce7' : '#fee2e2' }]}>
                    <MaterialCommunityIcons
                      name={stats.monthChange >= 0 ? 'trending-up' : 'trending-down'}
                      size={14}
                      color={stats.monthChange >= 0 ? '#16a34a' : '#ef4444'}
                    />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: stats.monthChange >= 0 ? '#16a34a' : '#ef4444' }}>
                      {stats.monthChange >= 0 ? '+' : ''}{stats.monthChange}%
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.kpiGrid}>
                <KPI icon="check-decagram" label="Complétées" value={stats.thisMonth} color="#2563eb" large />
                <KPI icon="clock-fast" label="Heures" value={`${stats.monthHours}h`} color="#8b5cf6" large />
              </View>
            </View>

            {/* Time stats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TEMPS PAR VISITE</Text>
              <View style={styles.timeCard}>
                <View style={styles.timeRow}>
                  <View style={styles.timeItem}>
                    <MaterialCommunityIcons name="speedometer-medium" size={22} color="#10b981" />
                    <Text style={styles.timeValue}>{stats.avgMinutes} min</Text>
                    <Text style={styles.timeLabel}>Moyenne</Text>
                  </View>
                  <View style={[styles.timeDivider]} />
                  <View style={styles.timeItem}>
                    <MaterialCommunityIcons name="speedometer-slow" size={22} color="#f59e0b" />
                    <Text style={styles.timeValue}>{stats.longestVisitMin} min</Text>
                    <Text style={styles.timeLabel}>Plus longue</Text>
                  </View>
                  <View style={[styles.timeDivider]} />
                  <View style={styles.timeItem}>
                    <MaterialCommunityIcons name="speedometer" size={22} color="#2563eb" />
                    <Text style={styles.timeValue}>{stats.shortestVisitMin} min</Text>
                    <Text style={styles.timeLabel}>Plus courte</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Coverage */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>COUVERTURE</Text>
              <View style={styles.coverageCard}>
                <View style={styles.coverageRow}>
                  <View style={[styles.coverageIcon, { backgroundColor: '#dbeafe' }]}>
                    <MaterialCommunityIcons name="store-check" size={24} color="#2563eb" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coverageValue}>{stats.uniqueStores} magasins visités</Text>
                    <Text style={styles.coverageSub}>{stats.totalVisits} visites au total</Text>
                  </View>
                </View>
                {stats.topStoreName && (
                  <View style={styles.topStore}>
                    <MaterialCommunityIcons name="trophy" size={16} color="#f59e0b" />
                    <Text style={styles.topStoreText}>
                      Plus visité : <Text style={{ fontWeight: '700' }}>{stats.topStoreName}</Text> ({stats.topStoreCount}x)
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ height: 30 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  loadingWrap: { alignItems: 'center', paddingTop: 80 },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },

  // Score card
  scoreCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  scoreInfo: { flex: 1, marginLeft: 20 },
  scoreTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  scoreDetail: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 4, alignSelf: 'flex-start' },
  streakText: { fontSize: 12, fontWeight: '700', color: '#b45309' },

  // Today
  todayCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#bfdbfe' },
  todayLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  todayLabel: { fontSize: 11, fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5 },
  todayValue: { fontSize: 14, fontWeight: '600', color: '#1e40af' },
  todayRight: { alignItems: 'center' },
  pendingLabel: { fontSize: 22, fontWeight: '800', color: '#f59e0b' },
  pendingText: { fontSize: 10, color: '#6b7280', fontWeight: '600' },

  // Sections
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#94a3b8', letterSpacing: 1.2, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  changeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 3 },

  // Chart
  chartCard: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 110 },
  barCol: { alignItems: 'center', flex: 1 },
  barWrap: { alignItems: 'center', justifyContent: 'flex-end', height: 90 },
  bar: { width: 22, minHeight: 4 },
  barValue: { fontSize: 11, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  barLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', marginTop: 6 },
  barLabelToday: { color: '#2563eb', fontWeight: '800' },
  chartSummary: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', alignItems: 'center' },
  chartSummaryText: { fontSize: 14, color: '#475569' },

  // KPI grid
  kpiGrid: { flexDirection: 'row', gap: 12 },
  kpi: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  kpiLarge: { paddingVertical: 20 },
  kpiIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  kpiValue: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  kpiValueLarge: { fontSize: 30 },
  kpiLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  kpiSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  // Time card
  timeCard: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  timeItem: { alignItems: 'center' },
  timeValue: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginTop: 6, marginBottom: 2 },
  timeLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  timeDivider: { width: 1, height: 50, backgroundColor: '#e2e8f0' },

  // Coverage
  coverageCard: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  coverageRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  coverageIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  coverageValue: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  coverageSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  topStore: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  topStoreText: { fontSize: 13, color: '#475569' },
});
