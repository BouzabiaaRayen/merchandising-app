import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function HomeScreen() {
  const [homeData, setHomeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setHomeData({
        userName: "Alex",
        monthlyTargets: 15,
        monthlyTotal: 20,
        todayPercent: 75,
        todayTasks: 3,
        storesVisited: 4,
        storesTotal: 10,
        activeReports: 2
      });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading || !homeData) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007aff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>Welcome back, {homeData.userName}</Text>
            <View style={styles.gpsRow}>
              <View style={styles.gpsDot} />
              <Text style={styles.gpsText}>GPS TRACKING ACTIVE</Text>
            </View>
          </View>
          <View style={styles.headerIcons}>
            <MaterialCommunityIcons name="bell-outline" size={24} color="#222" />
            <MaterialCommunityIcons name="cog-outline" size={24} color="#222" style={{ marginLeft: 12 }} />
          </View>
        </View>

        {/* Monthly Objectives */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Objectives</Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.round((homeData.monthlyTargets / homeData.monthlyTotal) * 100)}%`
                }
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {homeData.monthlyTargets}/{homeData.monthlyTotal} targets
          </Text>
        </View>

        {/* Today's Objective */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>Today's Objective</Text>
              <Text style={styles.objectiveSub}>
                {homeData.todayTasks} tasks remaining
              </Text>
            </View>
            <View style={styles.donutWrap}>
              <View style={styles.donutBgClean}>
                <Text style={styles.donutTextLargeClean}>{homeData.todayPercent}<Text style={styles.donutTextSmallClean}>%</Text></Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>STORES VISITED</Text>
            <Text style={styles.statsValue}>{homeData.storesVisited} <Text style={styles.statsTotal}>/ {homeData.storesTotal}</Text></Text>
            <View style={styles.statsBarBg}>
              <View style={[styles.statsBarFill, { width: `${Math.round((homeData.storesVisited / homeData.storesTotal) * 100)}%` }]} />
            </View>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>ACTIVE REPORTS</Text>
            <Text style={styles.statsValue}>{homeData.activeReports}</Text>
            <Text style={styles.statsSync}>Last synced: 10m ago</Text>
          </View>
        </View>

        {/* Today's Stores Row - moved above map */}
        <View style={styles.storesRow}>
          <Text style={styles.storesTitle}>Today's Stores</Text>
          <Text style={styles.viewMore}>View More</Text>
        </View>
        {/* No store pills, just the row */}

        {/* Map Placeholder */}
        <View style={styles.mapCard}>
          <View style={styles.mapPlaceholder}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={48} color="#bbb" />
          </View>
        </View>

        {/* Start Day Button */}
        <TouchableOpacity style={styles.startBtn}>
          <Text style={styles.startBtnText}>Start Day</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f8fa' },
  container: { padding: 20 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  welcome: { fontSize: 20, fontWeight: 'bold', color: '#222' },
  gpsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7bb661', marginRight: 6 },
  gpsText: { fontSize: 12, color: '#7bb661', fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#222', marginBottom: 4 },
  progressBarBg: { height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, marginVertical: 8 },
  progressBarFill: { height: 8, backgroundColor: '#2563eb', borderRadius: 4 },
  progressLabel: { fontSize: 12, color: '#888' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  objectiveSub: { fontSize: 14, color: '#888' },
  donutWrap: { alignItems: 'center', justifyContent: 'center' },
  donutBgClean: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f6fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTextLargeClean: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
    textAlign: 'center',
    lineHeight: 30,
  },
  donutTextSmallClean: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: 'bold',
    marginLeft: 1,
  },
  storesList: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  storeItem: { backgroundColor: '#f0f4fa', color: '#2563eb', fontWeight: 'bold', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statsCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginRight: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statsLabel: { fontSize: 12, color: '#888', marginBottom: 2, fontWeight: 'bold' },
  statsValue: { fontSize: 18, fontWeight: 'bold', color: '#222', marginBottom: 2 },
  statsTotal: { fontSize: 14, color: '#888', fontWeight: 'normal' },
  statsBarBg: { height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, marginBottom: 2 },
  statsBarFill: { height: 6, backgroundColor: '#2563eb', borderRadius: 3 },
  statsSync: { fontSize: 11, color: '#aaa', marginTop: 2 },
  mapCard: { backgroundColor: '#fff', borderRadius: 12, padding: 0, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  mapPlaceholder: { height: 110, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4fa' },
  storesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  storesTitle: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  viewMore: { fontSize: 14, color: '#2563eb', fontWeight: 'bold' },
  startBtn: { backgroundColor: '#2563eb', borderRadius: 24, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
