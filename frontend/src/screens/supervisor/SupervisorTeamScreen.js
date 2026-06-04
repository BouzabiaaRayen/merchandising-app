import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl,
  Image, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { userService, visitService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';

const BLUE = '#4285f4';

function isTeamMember(member, supervisorId) {
  if (!supervisorId) return true;
  const resolved = typeof member.supervisor === 'object' ? member.supervisor?.id : member.supervisor;
  return String(resolved ?? member.supervisor_id ?? '') === String(supervisorId);
}

function getMemberName(member) {
  return [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username;
}

function getVisitDateKey(visit) {
  const raw = visit?.scheduled_date ?? visit?.planned_date ?? visit?.date ?? '';
  return String(raw).split('T')[0];
}

export default function SupervisorTeamScreen() {
  const navigation = useNavigation();
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState([]);
  const [visitMap, setVisitMap] = useState({});
  const [planningPeriod, setPlanningPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const supervisorId = currentUser?.id;
      if (!supervisorId) {
        setMembers([]);
        setVisitMap({});
        setPlanningPeriod(null);
        return;
      }

      const [summaryResp, periodResp] = await Promise.allSettled([
        userService.getTeamSummary({ supervisor: supervisorId }),
        visitService.getCurrentPlanningPeriod(),
      ]);

      let teamMembers = [];
      if (summaryResp.status === 'fulfilled') {
        const summary = summaryResp.value ?? {};
        teamMembers = Array.isArray(summary.team_members) ? summary.team_members : [];
      }

      if (teamMembers.length === 0) {
        const usersResp = await userService.getUsers({
          role: 'merchandiser',
          page_size: 500,
          supervisor: supervisorId,
          supervisor_id: supervisorId,
        }).catch(() => ({ results: [] }));

        const all = Array.isArray(usersResp) ? usersResp : (usersResp.results ?? []);
        teamMembers = all.filter((m) => isTeamMember(m, supervisorId));
      }

      const period = periodResp.status === 'fulfilled' ? periodResp.value : null;
      let resolvedPeriod = period;
      let startDate = period?.start_date;
      let endDate = period?.end_date;

      let visits = [];
      if (startDate && endDate) {
        const visitsResp = await visitService.getVisits({
          start_date: startDate,
          end_date: endDate,
          page_size: 5000,
        }).catch(() => ({ results: [] }));
        visits = Array.isArray(visitsResp) ? visitsResp : (visitsResp.results ?? []);
      } else {
        const visitsResp = await visitService.getVisits({
          page_size: 5000,
        }).catch(() => ({ results: [] }));
        visits = Array.isArray(visitsResp) ? visitsResp : (visitsResp.results ?? []);

        const visitDates = visits
          .map(getVisitDateKey)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));

        if (visitDates.length > 0) {
          startDate = visitDates[0];
          endDate = visitDates[visitDates.length - 1];
          resolvedPeriod = {
            name: 'Current Planning Period',
            start_date: startDate,
            end_date: endDate,
            derived: true,
          };
        }
      }

      const teamIds = new Set(teamMembers.map((m) => String(m.id)));
      const nextVisitMap = {};
      teamMembers.forEach((member) => {
        nextVisitMap[String(member.id)] = { total: 0 };
      });

      visits.forEach((visit) => {
        const uid = String(visit.merchandiser ?? visit.user ?? '');
        if (!uid || !teamIds.has(uid)) return;
        if ((visit.status ?? '').toLowerCase() === 'cancelled') return;
        nextVisitMap[uid].total += 1;
      });

      setMembers(teamMembers.filter((m) => m.is_active));
      setVisitMap(nextVisitMap);
      setPlanningPeriod(resolvedPeriod);
    } catch (err) {
      console.warn('SupervisorTeam fetchData:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}><ActivityIndicator size="large" color={BLUE} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Team</Text>
        <Text style={styles.subtitle}>{members.length} field agents</Text>
        {planningPeriod?.start_date && planningPeriod?.end_date ? (
          <Text style={styles.periodLine}>Current Planning Period: {planningPeriod.start_date} to {planningPeriod.end_date}</Text>
        ) : null}
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <MemberRow
            member={item}
            totalVisits={visitMap[String(item.id)]?.total ?? 0}
            isLast={index === members.length - 1}
            onPress={() => navigation.navigate('SupervisorReport', {
              memberId: item.id,
              memberName: item.first_name ?? item.username,
            })}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            colors={[BLUE]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-off-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No agents found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function MemberRow({ member, totalVisits, isLast, onPress }) {
  const fullName = getMemberName(member);
  const initials = ((member.first_name?.[0] || '') + (member.last_name?.[0] || '') || member.username?.[0] || '?').toUpperCase();

  return (
    <TouchableOpacity style={[styles.row, isLast && styles.rowLast]} onPress={onPress} activeOpacity={0.65}>
      <View style={styles.avatarWrap}>
        {member.avatar_url ? (
          <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
        <Text style={styles.periodVisits}>{totalVisits} Total Visits</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 40 : 0 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: '#1e293b' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  periodLine: { marginTop: 6, fontSize: 11, color: '#64748b' },

  listContent: { paddingHorizontal: 16, paddingBottom: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },

  avatarWrap: { marginRight: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 14, fontWeight: '800', color: BLUE },

  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 3 },
  periodVisits: { fontSize: 12, color: '#64748b' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: '#cbd5e1', marginTop: 12 },
});
