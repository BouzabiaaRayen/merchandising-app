import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, Callout } from 'react-native-maps';
import { gpsService, userService, storeService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';

function isTeamMember(m, currentId) {
  if (!currentId) return true;
  if (m.supervisor == null && m.supervisor_id == null) return true;
  const resolved = typeof m.supervisor === 'object' ? m.supervisor?.id : m.supervisor;
  if (resolved != null && String(resolved) === currentId) return true;
  if (m.supervisor_id != null && String(m.supervisor_id) === currentId) return true;
  return false;
}

export default function SupervisorMapScreen() {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stores, setStores] = useState([]);
  const [agentLocations, setAgentLocations] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [region, setRegion] = useState({
    latitude: 34.0,
    longitude: 9.0,
    latitudeDelta: 8,
    longitudeDelta: 8,
  });

  const fetchData = useCallback(async () => {
    try {
      const supervisorId = currentUser?.id;
      if (!supervisorId) {
        setUserMap({});
        setAgentLocations([]);
        return;
      }

      const [storesResp, userResp] = await Promise.allSettled([
        storeService.getStores({ page_size: 500 }),
        userService.getTeamSummary({ supervisor: supervisorId }),
      ]);

      // Stores
      if (storesResp.status === 'fulfilled') {
        const raw = storesResp.value;
        const allStores = Array.isArray(raw) ? raw : (raw.results ?? []);
        const storeList = allStores.filter(
          (s) => s.latitude && s.longitude &&
            !isNaN(parseFloat(s.latitude)) && !isNaN(parseFloat(s.longitude))
        );
        setStores(storeList);

        // Compute region from stores
        if (storeList.length > 0) {
          const lats = storeList.map((s) => parseFloat(s.latitude));
          const lngs = storeList.map((s) => parseFloat(s.longitude));
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          setRegion({
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.05),
            longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.05),
          });
        }
      }

      // Users
      let uMap = {};
      let activeMembers = [];
      if (userResp.status === 'fulfilled') {
        const users = Array.isArray(userResp.value?.team_members) ? userResp.value.team_members : [];
        users.forEach((u) => { uMap[u.id] = u; uMap[String(u.id)] = u; });
        setUserMap(uMap);
        activeMembers = users.filter((u) => u.is_active);
      }

      if (activeMembers.length === 0) {
        const fallback = await userService.getUsers({
          role: 'merchandiser',
          page_size: 200,
          supervisor: supervisorId,
          supervisor_id: supervisorId,
        }).catch(() => ({ results: [] }));
        const allUsers = Array.isArray(fallback) ? fallback : (fallback.results ?? []);
        const users = allUsers.filter((m) => isTeamMember(m, String(supervisorId)));
        users.forEach((u) => { uMap[u.id] = u; uMap[String(u.id)] = u; });
        setUserMap(uMap);
        activeMembers = users.filter((u) => u.is_active);
      }

      // GPS: fetch latest location per merchandiser individually
      const gpsResults = await Promise.all(
        activeMembers.map((m) =>
          gpsService
            .getLocations({ user: m.id, page_size: 1, ordering: '-recorded_at' })
            .then((r) => {
              const locs = Array.isArray(r) ? r : (r.results ?? []);
              return locs[0] ?? null;
            })
            .catch(() => null)
        )
      );
      setAgentLocations(gpsResults.filter(Boolean));
    } catch (err) {
      console.warn('SupervisorMap fetchData err:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4285f4" />
        </View>
      </SafeAreaView>
    );
  }

  const fifteenMinAgo = Date.now() - 15 * 60 * 1000;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Map</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <MaterialCommunityIcons name="refresh" size={20} color="#4285f4" />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <LegendItem color="#4285f4" label={`${stores.length} Stores`} icon="store" />
        <LegendItem color="#22c55e" label={`${agentLocations.filter(l => new Date(l.recorded_at ?? l.timestamp).getTime() >= fifteenMinAgo).length} Active Agents`} icon="account" />
        <LegendItem color="#94a3b8" label="Inactive" icon="account-off" />
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        initialRegion={region}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Store markers */}
        {stores.map((store, idx) => {
          const lat = parseFloat(store.latitude);
          const lng = parseFloat(store.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;
          return (
            <Marker
              key={`store-${store.id ?? idx}`}
              coordinate={{ latitude: lat, longitude: lng }}
              pinColor="#4285f4"
            >
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{store.name}</Text>
                  {store.address && <Text style={styles.calloutSub}>{store.address}</Text>}
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* Agent markers */}
        {agentLocations.map((loc, idx) => {
          const lat = parseFloat(loc.latitude);
          const lng = parseFloat(loc.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;
          const isActive = loc.user_gps_active !== false &&
            new Date(loc.recorded_at ?? loc.timestamp).getTime() >= fifteenMinAgo;
          const uid = loc.user ?? loc.merchandiser ?? loc.user_id ?? loc.merchandiser_id;
          const agent = userMap[uid] ?? userMap[String(uid)];
          // Skip agents who explicitly turned GPS off
          if (agent?.gps_active === false) return null;
          const name =
            agent
              ? (agent.first_name || '') + (agent.last_name ? ' ' + agent.last_name : '') || agent.username
              : `Agent #${uid}`;
          return (
            <Marker
              key={`agent-${uid ?? idx}`}
              coordinate={{ latitude: lat, longitude: lng }}
              pinColor={isActive ? '#22c55e' : '#94a3b8'}
            >
              <View style={[styles.agentMarker, { backgroundColor: isActive ? '#22c55e' : '#94a3b8' }]}>
                <MaterialCommunityIcons name="account" size={14} color="#fff" />
              </View>
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{name}</Text>
                  <Text style={styles.calloutSub}>
                    {isActive ? '● Active' : '● Inactive'} · {formatRelativeTime(new Date(loc.recorded_at ?? loc.timestamp))}
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Pull-to-refresh hint */}
      {refreshing && (
        <View style={styles.refreshOverlay}>
          <ActivityIndicator color="#4285f4" />
        </View>
      )}
    </SafeAreaView>
  );
}

function LegendItem({ color, label, icon }) {
  return (
    <View style={styles.legendItem}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text style={[styles.legendText, { color }]}>{label}</Text>
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
  safe: { flex: 1, backgroundColor: '#f5f6fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  refreshBtn: { padding: 4 },
  legend: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
    gap: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 12, fontWeight: '600' },
  map: { flex: 1 },
  agentMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  callout: { minWidth: 120, padding: 6 },
  calloutTitle: { fontWeight: '700', fontSize: 13, color: '#1a1a2e' },
  calloutSub: { fontSize: 11, color: '#666', marginTop: 2 },
  refreshOverlay: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
});
