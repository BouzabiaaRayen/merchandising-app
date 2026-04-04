import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Switch, Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';

const PREFS_KEY = (userId) => `notifPrefs_${userId}`;

const DEFAULT_PREFS = {
  visitReminders: true,
  scheduleChanges: true,
  leaveUpdates: true,
  adminMessages: true,
  gpsAlerts: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

export default function NotificationSettingsScreen({ navigation }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    try {
      const saved = await AsyncStorage.getItem(PREFS_KEY(user?.id));
      if (saved) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(saved) });
    } catch (e) {
      console.error('Error loading notification prefs:', e);
    }
  };

  const togglePref = async (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    try {
      await AsyncStorage.setItem(PREFS_KEY(user?.id), JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving notification prefs:', e);
    }
  };

  const ToggleRow = ({ icon, title, subtitle, prefKey, iconColor = '#2563eb' }) => (
    <View style={styles.toggleRow}>
      <View style={[styles.toggleIcon, { backgroundColor: iconColor + '15' }]}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.toggleContent}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {subtitle && <Text style={styles.toggleSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={prefs[prefKey]}
        onValueChange={() => togglePref(prefKey)}
        trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
        thumbColor={prefs[prefKey] ? '#2563eb' : '#94a3b8'}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Notification Types */}
        <Text style={styles.sectionTitle}>TYPES DE NOTIFICATION</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="calendar-edit"
            title="Changements de planning"
            subtitle="Modifications du planning de travail"
            prefKey="scheduleChanges"
            iconColor="#8b5cf6"
          />
          <ToggleRow
            icon="calendar-check"
            title="Mises à jour congés"
            subtitle="Statut de vos demandes de congé"
            prefKey="leaveUpdates"
            iconColor="#10b981"
          />
          <ToggleRow
            icon="message-text-outline"
            title="Messages admin"
            subtitle="Messages de l'administration"
            prefKey="adminMessages"
            iconColor="#f59e0b"
          />
        </View>

        {/* General */}
        <Text style={styles.sectionTitle}>GÉNÉRAL</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="volume-high"
            title="Son"
            subtitle="Activer le son des notifications"
            prefKey="soundEnabled"
            iconColor="#6b7280"
          />
          <ToggleRow
            icon="cellphone-vibrate"
            title="Vibration"
            subtitle="Activer la vibration"
            prefKey="vibrationEnabled"
            iconColor="#6b7280"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280', letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  card: { backgroundColor: '#f8f9fc', borderRadius: 14, borderWidth: 1, borderColor: '#e8eaed', marginBottom: 20, overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  toggleIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  toggleContent: { flex: 1 },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  toggleSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
