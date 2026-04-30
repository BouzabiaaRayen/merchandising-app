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
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { notificationService } from '../services/apiService';

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const resp = await notificationService.getNotifications({ page_size: 100 });
      const raw = Array.isArray(resp) ? resp : (resp.results ?? []);
      setNotifications(raw);
    } catch (err) {
      console.warn('Notifications fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      Alert.alert('Error', 'Could not mark notifications as read');
    }
  };

  const markOne = async (id) => {
    try {
      await notificationService.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (_) {}
  };

  const unread = notifications.filter((n) => !n.is_read).length;

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unread > 0 && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badge}>{unread}</Text>
          </View>
        )}
      </View>

      {unread > 0 && (
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <MaterialCommunityIcons name="check-all" size={16} color="#4285f4" />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.notifCard, !item.is_read && styles.notifUnread]}
            onPress={() => markOne(item.id)}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.notifIcon,
                { backgroundColor: typeColor(item.type) + '22' },
              ]}
            >
              <MaterialCommunityIcons
                name={typeIcon(item.type)}
                size={20}
                color={typeColor(item.type)}
              />
            </View>
            <View style={styles.notifBody}>
              <Text style={styles.notifTitle}>{item.title}</Text>
              <Text style={styles.notifMsg} numberOfLines={2}>
                {item.message}
              </Text>
              <Text style={styles.notifTime}>
                {item.created_at
                  ? formatRelativeTime(new Date(item.created_at))
                  : ''}
              </Text>
            </View>
            {!item.is_read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            colors={['#4285f4']}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="bell-outline"
              size={52}
              color="#ccc"
            />
            <Text style={styles.emptyText}>No notifications</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function typeIcon(type) {
  const t = (type ?? '').toUpperCase();
  if (t.includes('DOCUMENT')) return 'file-document';
  if (t.includes('GPS')) return 'map-marker-off';
  if (t.includes('VISIT')) return 'store-check';
  if (t.includes('LEAVE') || t.includes('CONGE'))
    return 'calendar-remove';
  if (t.includes('ALERT')) return 'alert-circle';
  return 'bell';
}

function typeColor(type) {
  const t = (type ?? '').toUpperCase();
  if (t.includes('DOCUMENT')) return '#f3730b';
  if (t.includes('GPS')) return '#f97316';
  if (t.includes('ALERT')) return '#ef4444';
  if (t.includes('LEAVE') || t.includes('CONGE')) return '#8b5cf6';
  if (t.includes('VISIT')) return '#4285f4';
  return '#64748b';
}

function formatRelativeTime(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f6fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  badgeContainer: {
    backgroundColor: '#4285f4',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badge: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
    backgroundColor: '#fafbfc',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  markAllText: {
    fontSize: 13,
    color: '#4285f4',
    fontWeight: '600',
  },
  listContent: { padding: 12, gap: 8 },
  notifCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  notifUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#4285f4',
    backgroundColor: '#f0f7ff',
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  notifBody: { flex: 1 },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  notifMsg: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    lineHeight: 17,
  },
  notifTime: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 5,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285f4',
    marginTop: 6,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});
