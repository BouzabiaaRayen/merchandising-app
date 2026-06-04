import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { leaveService } from '../services/apiService';

const FALLBACK_LEAVE_TYPES = [
  { value: 'Congés payés', label: 'Paid Leave' },
  { value: 'RTT', label: 'RTT' },
  { value: 'Exceptionnel', label: 'Special Leave' },
  { value: 'Maladie', label: 'Sick Leave' },
];

const LEAVE_TYPE_LABELS = {
  'conges payes': 'Paid Leave',
  'congés payés': 'Paid Leave',
  paid_leave: 'Paid Leave',
  'paid leave': 'Paid Leave',
  rtt: 'RTT',
  exceptionnel: 'Special Leave',
  'special leave': 'Special Leave',
  special_leave: 'Special Leave',
  maladie: 'Sick Leave',
  'sick leave': 'Sick Leave',
  sick_leave: 'Sick Leave',
  vacation: 'Paid Leave',
  annual_leave: 'Paid Leave',
  annual: 'Paid Leave',
};

const normalizeLookupKey = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getLeaveTypeLabel = (value) => {
  const normalized = normalizeLookupKey(value);
  return LEAVE_TYPE_LABELS[normalized] || String(value || 'Leave');
};

const formatDate = (date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]}. ${date.getFullYear()}`;
};

export default function CongeScreen({ navigation }) {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d;
  });
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(true);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState(FALLBACK_LEAVE_TYPES);
  const [leaveType, setLeaveType] = useState(FALLBACK_LEAVE_TYPES[0].value);
  const [showLeaveTypes, setShowLeaveTypes] = useState(false);
  const [activeDateField, setActiveDateField] = useState(null);
  const [reason, setReason] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);

  React.useEffect(() => {
    fetchHistory();
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      setLoadingLeaveTypes(true);
      const options = await leaveService.getLeaveTypes();
      const nextOptions = options.length > 0
        ? options.map((option) => ({
            value: option.value,
            label: getLeaveTypeLabel(option.label || option.value),
          }))
        : FALLBACK_LEAVE_TYPES;

      setLeaveTypeOptions(nextOptions);
      setLeaveType((current) => {
        if (nextOptions.some((option) => option.value === current)) {
          return current;
        }
        return nextOptions[0]?.value || '';
      });
    } catch (error) {
      console.error('Failed to fetch leave types:', error);
      setLeaveTypeOptions(FALLBACK_LEAVE_TYPES);
      setLeaveType((current) => current || FALLBACK_LEAVE_TYPES[0].value);
    } finally {
      setLoadingLeaveTypes(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await leaveService.getLeaves({ page_size: 50 });
      setHistory(data?.results || data || []);
    } catch (error) {
      console.error('Failed to fetch leave history:', error);
      Alert.alert('Error', 'Unable to load leave history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const toApiDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const statusLabel = (status) => {
    if (status === 'approved') return 'APPROVED';
    if (status === 'rejected') return 'REJECTED';
    return 'PENDING';
  };

  const statusBadgeStyle = (status) => {
    if (status === 'approved') return { bg: '#E6F7EE', color: '#1F9D57', icon: 'calendar-check' };
    if (status === 'rejected') return { bg: '#FDEBEC', color: '#E02424', icon: 'calendar-remove' };
    return { bg: '#FFF4DB', color: '#D08700', icon: 'clock-outline' };
  };

  const openDatePicker = (type) => {
    setShowLeaveTypes(false);
    setActiveDateField(type);
  };

  const handleDateChange = (event, selectedValue) => {
    if (event?.type === 'dismissed') {
      setActiveDateField(null);
      return;
    }

    const nextDate = selectedValue || (activeDateField === 'start' ? startDate : endDate);

    if (activeDateField === 'start') {
      setStartDate(nextDate);
      if (endDate < nextDate) {
        setEndDate(nextDate);
      }
    } else if (activeDateField === 'end') {
      if (nextDate < startDate) {
        setEndDate(startDate);
      } else {
        setEndDate(nextDate);
      }
    }

    if (Platform.OS === 'android') {
      setActiveDateField(null);
    }
  };

  const submitRequest = async () => {
    if (endDate < startDate) {
      Alert.alert('Error', 'The end date must be after the start date.');
      return;
    }

    if (!leaveType) {
      Alert.alert('Error', 'Please select a leave type.');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('start_date', toApiDate(startDate));
      formData.append('end_date', toApiDate(endDate));
      formData.append('leave_type', leaveType);
      if (reason.trim()) formData.append('reason', reason.trim());

      if (selectedDocument?.uri) {
        let docName = selectedDocument.name || `leave-doc-${Date.now()}`;
        // Truncate filename to fit Django's 100 char limit (keep extension)
        if (docName.length > 80) {
          const ext = docName.substring(docName.lastIndexOf('.'));
          docName = docName.substring(0, 80 - ext.length) + ext;
        }
        formData.append('supporting_document', {
          uri: selectedDocument.uri,
          type: selectedDocument.mimeType || 'application/octet-stream',
          name: docName,
        });
      }

      await leaveService.createLeave(formData);

  Alert.alert('Request Sent', 'Your leave request has been submitted.');
      setReason('');
      setSelectedDocument(null);
      await fetchHistory();
    } catch (error) {
      console.error('Failed to submit leave request:', error);
      console.error('Response status:', error.response?.status);
      console.error('Response data:', JSON.stringify(error.response?.data));
      const detail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      Alert.alert('Error', `Unable to submit the request: ${detail}`);
    } finally {
      setSubmitting(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setSelectedDocument(result.assets[0]);
      }
    } catch (error) {
      console.error('Failed to pick document:', error);
      Alert.alert('Error', 'Unable to select the document.');
    }
  };

  const openLeaveTypePicker = () => {
    if (loadingLeaveTypes) {
      return;
    }

    setActiveDateField(null);
    setShowLeaveTypes((current) => !current);
  };

  const selectedLeaveTypeLabel = leaveTypeOptions.find((option) => option.value === leaveType)?.label
    || getLeaveTypeLabel(leaveType)
    || 'Select leave type';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#2563EB" />
          <Text style={styles.backText}>Back</Text>
          <Text style={styles.pageTitle}>Leave Request</Text>
        </TouchableOpacity>

        <View style={styles.requestCard}>
          <Text style={styles.fieldLabel}>Leave Type</Text>
          <TouchableOpacity
            style={styles.selectField}
            onPress={openLeaveTypePicker}
            disabled={loadingLeaveTypes}
            activeOpacity={0.8}
          >
            <View style={styles.dateLeft}>
              <MaterialCommunityIcons name="format-list-bulleted" size={20} color="#2563EB" />
              <Text style={styles.selectFieldText}>
                {loadingLeaveTypes ? 'Loading leave types...' : selectedLeaveTypeLabel}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {showLeaveTypes && (
            <View style={styles.dropdown}>
              {leaveTypeOptions.map((option) => {
                const isActive = option.value === leaveType;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                    onPress={() => {
                      setLeaveType(option.value);
                      setShowLeaveTypes(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownText, isActive && styles.dropdownTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.fieldLabel}>From (Start Date)</Text>
          <TouchableOpacity style={styles.dateField} onPress={() => openDatePicker('start')} activeOpacity={0.8}>
            <View style={styles.dateLeft}>
              <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#2563EB" />
              <Text style={styles.dateText}>{formatDate(startDate)}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {activeDateField === 'start' && (
            <View style={styles.datePickerCard}>
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.datePickerDoneButton} onPress={() => setActiveDateField(null)}>
                  <Text style={styles.datePickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Reason</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Example: family leave, medical appointment..."
            placeholderTextColor="#94A3B8"
            value={reason}
            onChangeText={setReason}
            multiline
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Supporting Document (PDF/Image)</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
            <View style={styles.dateLeft}>
              <MaterialCommunityIcons name="paperclip" size={18} color="#2563EB" />
              <Text style={styles.uploadButtonText}>
                {selectedDocument?.name ? selectedDocument.name : 'Add a document'}
              </Text>
            </View>
            <MaterialCommunityIcons name="upload" size={18} color="#2563EB" />
          </TouchableOpacity>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>To (End Date)</Text>
          <TouchableOpacity style={styles.dateField} onPress={() => openDatePicker('end')} activeOpacity={0.8}>
            <View style={styles.dateLeft}>
              <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#2563EB" />
              <Text style={styles.dateText}>{formatDate(endDate)}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {activeDateField === 'end' && (
            <View style={styles.datePickerCard}>
              <DateTimePicker
                value={endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                minimumDate={startDate}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.datePickerDoneButton} onPress={() => setActiveDateField(null)}>
                  <Text style={styles.datePickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={submitRequest} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Submit Request</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>History</Text>
        </View>

        {loadingHistory ? (
          <View style={styles.emptyHistoryCard}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.emptyHistoryText}>Loading...</Text>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyHistoryCard}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={26} color="#94A3B8" />
            <Text style={styles.emptyHistoryTitle}>No leave requests yet</Text>
            <Text style={styles.emptyHistoryText}>Your leave requests will appear here.</Text>
          </View>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.historyItem}>
              {(() => {
                const st = statusBadgeStyle(item.status);
                return (
                  <View style={[styles.historyIconWrap, { backgroundColor: st.bg }]}> 
                    <MaterialCommunityIcons name={st.icon} size={18} color={st.color} />
                  </View>
                );
              })()}
              <View style={styles.historyContent}>
                <Text style={styles.historyPeriod}>{formatDate(new Date(item.start_date))} - {formatDate(new Date(item.end_date))}</Text>
                <Text style={styles.historyMeta}>{getLeaveTypeLabel(item.leave_type) || 'Leave'}{item.reason ? ` • ${item.reason}` : ''}</Text>
                {item.supporting_document_url ? (
                  <Text style={styles.docTag}>Attached document</Text>
                ) : null}
              </View>
              <View style={[styles.statusPill, { backgroundColor: statusBadgeStyle(item.status).bg }]}> 
                <Text style={[styles.statusText, { color: statusBadgeStyle(item.status).color }]}>{statusLabel(item.status)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { color: '#2563EB', fontSize: 18, fontWeight: '600', marginRight: 8 },
  pageTitle: { color: '#334155', fontSize: 16, fontWeight: '600' },

  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 22,
  },
  fieldLabel: { color: '#64748B', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  selectField: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectFieldText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: -4,
    marginBottom: 14,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF5',
  },
  dropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  dateField: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateText: { color: '#334155', fontSize: 14, fontWeight: '500' },
  datePickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
    marginTop: 8,
  },
  datePickerDoneButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
    marginRight: 8,
  },
  datePickerDoneText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reasonInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    color: '#334155',
    fontSize: 14,
  },
  uploadButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uploadButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 210,
  },
  submitButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyTitle: { color: '#0F172A', fontSize: 24, fontWeight: '700' },

  emptyHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyHistoryTitle: { color: '#334155', fontSize: 16, fontWeight: '700' },
  emptyHistoryText: { color: '#94A3B8', fontSize: 13, textAlign: 'center' },

  historyItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyContent: { flex: 1 },
  historyPeriod: { color: '#1E293B', fontSize: 15, fontWeight: '700' },
  historyMeta: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  docTag: { color: '#2563EB', fontSize: 12, fontWeight: '600', marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F1F5F9' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
});
