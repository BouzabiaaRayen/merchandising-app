import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { documentService } from '../services/apiService';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const toDateKey = (dateStr) => {
  if (!dateStr) return null;
  return new Date(dateStr).toISOString().split('T')[0]; // YYYY-MM-DD
};

export default function ReportsScreen() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null); // YYYY-MM-DD or null = show all
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [markedDates, setMarkedDates] = useState({});
  const [menuDoc, setMenuDoc] = useState(null); // doc whose 3-dot menu is open
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 }); // screen position of the menu

  const loadReports = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await documentService.getDocuments({
        document_type: 'daily_report',
        page_size: 500,
      });

      const docs = (response.results || response || []).filter((doc) =>
        doc.merchandiser === user?.id ||
        doc.uploaded_by === user?.id ||
        doc.user === user?.id ||
        doc.merchandiser_id === user?.id
      );

      docs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Build marked dates map for the calendar (dots on days that have a report)
      const marks = {};
      docs.forEach((d) => {
        const dk = toDateKey(d.created_at);
        if (dk) marks[dk] = { marked: true, dotColor: '#6366f1' };
      });

      setReports(docs);
      setMarkedDates(marks);
    } catch (err) {
      console.error('ReportsScreen loadReports:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadReports(); }, [loadReports]));

  const handleOpen = async (doc) => {
    const url = doc.file || doc.file_url;
    if (!url) { Alert.alert('Unavailable', 'The file is not available yet.'); return; }
    try { await Linking.openURL(url); } catch { Alert.alert('Error', 'Unable to open the file.'); }
  };

  const handleDelete = (doc) => {
    Alert.alert('Delete', `Delete "${doc.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await documentService.deleteDocument(doc.id);
            const remaining = reports.filter((r) => r.id !== doc.id);
            setReports(remaining);
            const marks = {};
            remaining.forEach((d) => {
              const dk = toDateKey(d.created_at);
              if (dk) marks[dk] = { marked: true, dotColor: '#6366f1' };
            });
            setMarkedDates(marks);
          } catch { Alert.alert('Error', 'Unable to delete the report.'); }
        },
      },
    ]);
  };

  const handleDayPress = (day) => {
    const key = day.dateString; // YYYY-MM-DD
    setSelectedDate((prev) => (prev === key ? null : key)); // tap again to clear
    setCalendarVisible(false);
  };

  const clearFilter = () => setSelectedDate(null);

  const getReportFileUrl = (doc) => doc.file || doc.file_url;

  const getReportExtension = (doc) => {
    const fileUrl = getReportFileUrl(doc) || '';
    if (fileUrl.toLowerCase().includes('.pdf')) {
      return 'PDF';
    }

    return 'DOC';
  };

  const filtered = selectedDate
    ? reports.filter((r) => toDateKey(r.created_at) === selectedDate)
    : reports;

  const renderItem = ({ item, index }) => (
    <View style={[styles.row, index === filtered.length - 1 && styles.rowLast]}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="file-document-outline" size={22} color="#6366f1" />
      </View>
      <View style={styles.info}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title || 'Daily Report'}</Text>
          <View style={styles.fileBadge}>
            <MaterialCommunityIcons name="file-pdf-box" size={14} color="#b91c1c" />
            <Text style={styles.fileBadgeText}>{getReportExtension(item)}</Text>
          </View>
        </View>
        <View style={styles.meta}>
          <MaterialCommunityIcons name="calendar-outline" size={12} color="#94a3b8" />
          <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
          {(item.merchandiser_name || item.uploaded_by_name) ? (
            <>
              <MaterialCommunityIcons name="account-outline" size={12} color="#94a3b8" style={{ marginLeft: 6 }} />
              <Text style={styles.metaText}>{item.merchandiser_name || item.uploaded_by_name}</Text>
            </>
          ) : null}
        </View>
        <TouchableOpacity style={styles.primaryActionChip} activeOpacity={0.8} onPress={() => handleOpen(item)}>
          <MaterialCommunityIcons name="open-in-new" size={14} color="#4f46e5" />
          <Text style={styles.primaryActionText}>Open PDF</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.dotsBtn}
        activeOpacity={0.7}
        onPress={(e) => {
          e.target.measure((fx, fy, width, height, px, py) => {
            setMenuPos({ top: py + height + 4, right: 16 });
            setMenuDoc(item);
          });
        }}
      >
        <MaterialCommunityIcons name="dots-vertical" size={20} color="#64748b" />
      </TouchableOpacity>
    </View>
  );

  // ── Action-sheet modal ─────────────────────────────────────────────────────
  const ActionMenu = () => (
    <Modal
      visible={!!menuDoc}
      transparent
      animationType="fade"
      onRequestClose={() => setMenuDoc(null)}
    >
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuDoc(null)}>
        <View style={[styles.menuCard, { position: 'absolute', top: menuPos.top, right: menuPos.right }]}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => { setMenuDoc(null); handleOpen(menuDoc); }}
          >
            <MaterialCommunityIcons name="open-in-new" size={19} color="#6366f1" />
            <Text style={styles.menuItemText}>Open PDF</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => { const doc = menuDoc; setMenuDoc(null); handleDelete(doc); }}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={19} color="#ef4444" />
            <Text style={[styles.menuItemText, styles.menuItemDanger]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Build marked dates with selection highlight
  const calendarMarks = { ...markedDates };
  if (selectedDate) {
    calendarMarks[selectedDate] = {
      ...(calendarMarks[selectedDate] || {}),
      selected: true,
      selectedColor: '#6366f1',
      dotColor: '#fff',
    };
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <SafeAreaView style={styles.container}>
      <ActionMenu />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <View style={styles.headerRight}>
          {selectedDate && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearFilter} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#6366f1" />
              <Text style={styles.clearBtnText}>{selectedDate}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.calIconBtn} onPress={() => setCalendarVisible(true)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="calendar-month-outline" size={24} color="#6366f1" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Calendar Modal */}
      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCalendarVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Sélectionner une date</Text>
              <Text style={styles.calendarTitle}>Select a date</Text>
              <TouchableOpacity onPress={() => setCalendarVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Calendar
              current={selectedDate || todayStr}
              onDayPress={handleDayPress}
              markedDates={calendarMarks}
              maxDate={todayStr}
              theme={{
                selectedDayBackgroundColor: '#6366f1',
                selectedDayTextColor: '#fff',
                todayTextColor: '#6366f1',
                dotColor: '#6366f1',
                arrowColor: '#6366f1',
                textDayFontWeight: '600',
                textMonthFontWeight: '700',
                calendarBackground: '#fff',
                textSectionTitleColor: '#94a3b8',
              }}
            />
            {selectedDate && (
              <TouchableOpacity style={styles.clearAllBtn} onPress={clearFilter}>
                <Text style={styles.clearAllText}>Clear filter</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="file-document-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No reports</Text>
          <Text style={styles.emptySubtitle}>End-of-day generated reports will appear here.</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No reports</Text>
          <Text style={styles.emptySubtitle}>No reports for {selectedDate}.</Text>
          <TouchableOpacity style={styles.clearAllBtn} onPress={clearFilter}>
            <Text style={styles.clearAllText}>View all reports</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={() => loadReports(true)}
          refreshing={refreshing}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <Text style={styles.countLabel}>
              {filtered.length} report{filtered.length > 1 ? 's' : ''}
              {selectedDate ? ` · ${selectedDate}` : ''}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 40 : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: '#6366f1' },
  // Calendar modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  calendarCard: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', width: '100%', maxWidth: 380, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  calendarTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  clearAllBtn: { margin: 12, marginTop: 4, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  clearAllText: { fontSize: 14, fontWeight: '600', color: '#6366f1' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#64748b', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 6, textAlign: 'center', lineHeight: 20 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  countLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 14, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: '#eef2ff' },
  rowLast: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  separator: { height: 10, backgroundColor: 'transparent' },
  iconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info: { flex: 1, marginRight: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  fileBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  fileBadgeText: { fontSize: 10, fontWeight: '800', color: '#b91c1c', letterSpacing: 0.4 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  metaText: { fontSize: 11, color: '#94a3b8' },
  primaryActionChip: { marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eef2ff', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  primaryActionText: { fontSize: 12, fontWeight: '700', color: '#4f46e5' },
  dotsBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  // Action-sheet menu
  menuOverlay: { flex: 1, backgroundColor: 'transparent' },
  menuCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', width: 170, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 15 },
  menuItemText: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  menuItemDanger: { color: '#ef4444' },
  menuDivider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 12 },
});
