import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const PROBLEM_CATEGORIES = [
  { value: 'technical', label: 'Technical Issue' },
  { value: 'logistics', label: 'Logistics Issue' },
  { value: 'hr', label: 'HR Issue' },
  { value: 'store', label: 'Store Issue' },
  { value: 'product', label: 'Product Issue' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#D08700', bg: '#FFF4DB', icon: 'clock-outline' },
  in_progress: { label: 'In Progress', color: '#2563EB', bg: '#DBEAFE', icon: 'progress-wrench' },
  resolved: { label: 'Resolved', color: '#16a34a', bg: '#E6F7EE', icon: 'check-circle-outline' },
  rejected: { label: 'Rejected', color: '#dc2626', bg: '#FDEBEC', icon: 'close-circle-outline' },
};

export default function ComplaintScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('history');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  // History state
  const [complaints, setComplaints] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const selectedCategory = PROBLEM_CATEGORIES.find(c => c.value === category);

  const fetchComplaints = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoadingHistory(true);
      const res = await api.get('/merchandising/complaints/');
      setComplaints(res.data?.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
    } finally {
      setLoadingHistory(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchComplaints();
    }, [])
  );

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Error', 'Image must be less than 5 MB');
          return;
        }
        setPhoto(asset);
      }
    } catch (err) {
      console.error('Image picker error:', err);
    }
  };

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert('Required', 'Please select a problem type.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the problem.');
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('category', category);
      formData.append('description', description.trim());

      if (photo) {
        formData.append('photo', {
          uri: photo.uri,
          type: photo.mimeType || 'image/jpeg',
          name: photo.fileName || `complaint_${Date.now()}.jpg`,
        });
      }

      await api.post('/merchandising/complaints/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Success', 'Your complaint has been submitted to the administrator.', [
        {
          text: 'OK',
          onPress: () => {
            setCategory('');
            setDescription('');
            setPhoto(null);
            setActiveTab('history');
            fetchComplaints();
          },
        },
      ]);
    } catch (err) {
      console.error('Complaint submit error:', err);
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to submit complaint.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryLabel = (val) => PROBLEM_CATEGORIES.find(c => c.value === val)?.label || val;

  const renderHistoryTab = () => {
    if (loadingHistory) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      );
    }

    if (complaints.length === 0) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>No complaints yet</Text>
          <TouchableOpacity style={styles.newBtn} onPress={() => setActiveTab('new')}>
            <Text style={styles.newBtnText}>Submit a Complaint</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.historyList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchComplaints(true)} colors={['#3b82f6']} />}
      >
        {complaints.map((c) => {
          const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
          const isExpanded = expandedId === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={styles.complaintCard}
              activeOpacity={0.7}
              onPress={() => setExpandedId(isExpanded ? null : c.id)}
            >
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardCategory}>{getCategoryLabel(c.category)}</Text>
                  <Text style={styles.cardDate}>
                    {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                  <MaterialCommunityIcons name={st.icon} size={14} color={st.color} />
                  <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>

              {/* Description preview */}
              <Text style={styles.cardDesc} numberOfLines={isExpanded ? undefined : 2}>
                {c.description}
              </Text>

              {/* Expanded Details */}
              {isExpanded && (
                <View style={styles.expandedSection}>
                  {c.photo && (
                    <Image source={{ uri: c.photo }} style={styles.cardPhoto} />
                  )}

                  {/* Admin Response */}
                  {c.admin_response ? (
                    <View style={styles.responseBox}>
                      <View style={styles.responseHeader}>
                        <MaterialCommunityIcons name="message-reply-text" size={16} color="#6366f1" />
                        <Text style={styles.responseTitle}>Admin Response</Text>
                      </View>
                      <Text style={styles.responseText}>{c.admin_response}</Text>
                    </View>
                  ) : c.status === 'pending' ? (
                    <View style={styles.waitingBox}>
                      <MaterialCommunityIcons name="clock-outline" size={16} color="#D08700" />
                      <Text style={styles.waitingText}>Waiting for admin response...</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Expand hint */}
              <View style={styles.expandHint}>
                <MaterialCommunityIcons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#94a3b8"
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderFormTab = () => (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <MaterialCommunityIcons name="information" size={20} color="#3b82f6" />
        <Text style={styles.infoText}>
          Use this form to report any technical, logistics, or HR issue encountered in the field.
        </Text>
      </View>

      {/* Problem Type */}
      <Text style={styles.label}>PROBLEM TYPE</Text>
      <TouchableOpacity
        style={styles.selectBox}
        onPress={() => setShowCategories(!showCategories)}
        activeOpacity={0.7}
      >
        <Text style={[styles.selectText, !selectedCategory && styles.placeholder]}>
          {selectedCategory ? selectedCategory.label : 'Select a category'}
        </Text>
        <MaterialCommunityIcons
          name={showCategories ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#94a3b8"
        />
      </TouchableOpacity>

      {showCategories && (
        <View style={styles.dropdown}>
          {PROBLEM_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[styles.dropdownItem, category === cat.value && styles.dropdownItemActive]}
              onPress={() => {
                setCategory(cat.value);
                setShowCategories(false);
              }}
            >
              <Text style={[styles.dropdownText, category === cat.value && styles.dropdownTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Description */}
      <Text style={styles.label}>DESCRIPTION</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Please describe the problem in detail"
        placeholderTextColor="#94a3b8"
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        value={description}
        onChangeText={setDescription}
      />

      {/* Photo */}
      <Text style={styles.label}>VISUAL PROOF</Text>
      <TouchableOpacity style={styles.photoBox} onPress={pickImage} activeOpacity={0.7}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <View style={styles.cameraCircle}>
              <MaterialCommunityIcons name="camera" size={24} color="#3b82f6" />
            </View>
            <Text style={styles.photoLabel}>Attach a photo (optional)</Text>
            <Text style={styles.photoHint}>JPG, PNG up to 5 MB</Text>
          </View>
        )}
      </TouchableOpacity>

      {photo && (
        <TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)}>
          <MaterialCommunityIcons name="close-circle" size={16} color="#ef4444" />
          <Text style={styles.removePhotoText}>Remove photo</Text>
        </TouchableOpacity>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <MaterialCommunityIcons name="send" size={18} color="#fff" />
            <Text style={styles.submitText}>Send to Administrator</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complaints</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <MaterialCommunityIcons
            name="clipboard-list"
            size={18}
            color={activeTab === 'history' ? '#3b82f6' : '#94a3b8'}
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            My Complaints
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'new' && styles.tabActive]}
          onPress={() => setActiveTab('new')}
        >
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={18}
            color={activeTab === 'new' ? '#3b82f6' : '#94a3b8'}
          />
          <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>
            New Complaint
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'history' ? renderHistoryTab() : renderFormTab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#3b82f6' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#3b82f6' },

  // History
  historyList: { padding: 16, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: '#94a3b8', marginTop: 12, marginBottom: 20 },
  newBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  newBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Complaint card
  complaintCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardCategory: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  cardDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDesc: { fontSize: 13, color: '#475569', lineHeight: 19 },

  expandedSection: { marginTop: 12 },
  cardPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },

  // Admin response
  responseBox: {
    backgroundColor: '#f0f0ff',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  responseTitle: { fontSize: 13, fontWeight: '700', color: '#6366f1' },
  responseText: { fontSize: 13, color: '#334155', lineHeight: 19 },

  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4DB',
    borderRadius: 8,
    padding: 12,
  },
  waitingText: { fontSize: 13, color: '#D08700', fontStyle: 'italic' },

  expandHint: { alignItems: 'center', marginTop: 6 },

  // Form
  content: { padding: 16, paddingBottom: 40 },

  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 13, color: '#1e40af', lineHeight: 18 },

  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },

  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  selectText: { fontSize: 14, color: '#1a1a2e' },
  placeholder: { color: '#94a3b8' },

  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemActive: { backgroundColor: '#eff6ff' },
  dropdownText: { fontSize: 14, color: '#334155' },
  dropdownTextActive: { color: '#3b82f6', fontWeight: '600' },

  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a2e',
    minHeight: 120,
  },

  photoBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  photoPlaceholder: { alignItems: 'center', paddingVertical: 24 },
  cameraCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  photoLabel: { fontSize: 14, color: '#334155', fontWeight: '500' },
  photoHint: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  photoPreview: { width: '100%', height: 200, borderRadius: 10 },

  removePhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  removePhotoText: { fontSize: 13, color: '#ef4444' },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
    marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
