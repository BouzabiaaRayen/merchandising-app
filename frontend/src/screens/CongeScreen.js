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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';
import { leaveService } from '../services/apiService';

const formatDate = (date) => {
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
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
  const [leaveType, setLeaveType] = useState('Congés payés');
  const [reason, setReason] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);

  React.useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await leaveService.getLeaves({ page_size: 50 });
      setHistory(data?.results || data || []);
    } catch (error) {
      console.error('Failed to fetch leave history:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'historique des congés.');
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
    if (status === 'approved') return 'VALIDÉ';
    if (status === 'rejected') return 'REFUSÉ';
    return 'EN ATTENTE';
  };

  const statusBadgeStyle = (status) => {
    if (status === 'approved') return { bg: '#E6F7EE', color: '#1F9D57', icon: 'calendar-check' };
    if (status === 'rejected') return { bg: '#FDEBEC', color: '#E02424', icon: 'calendar-remove' };
    return { bg: '#FFF4DB', color: '#D08700', icon: 'clock-outline' };
  };

  const changeDate = (type) => {
    const current = type === 'start' ? startDate : endDate;

    Alert.alert('Choisir la date', 'Ajuster la date', [
      {
        text: '-1 jour',
        onPress: () => {
          const next = new Date(current);
          next.setDate(next.getDate() - 1);
          if (type === 'start') setStartDate(next);
          else setEndDate(next);
        },
      },
      {
        text: '+1 jour',
        onPress: () => {
          const next = new Date(current);
          next.setDate(next.getDate() + 1);
          if (type === 'start') setStartDate(next);
          else setEndDate(next);
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const submitRequest = async () => {
    if (endDate < startDate) {
      Alert.alert('Erreur', 'La date de fin doit être après la date de début.');
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
        formData.append('supporting_document', {
          uri: selectedDocument.uri,
          type: selectedDocument.mimeType || 'application/octet-stream',
          name: selectedDocument.name || `leave-doc-${Date.now()}`,
        });
      }

      await leaveService.createLeave(formData);

      Alert.alert('Demande envoyée', 'Votre demande de congé a été enregistrée.');
      setReason('');
      setSelectedDocument(null);
      await fetchHistory();
    } catch (error) {
      console.error('Failed to submit leave request:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer la demande de congé.');
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
      Alert.alert('Erreur', 'Impossible de sélectionner le document.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#2563EB" />
          <Text style={styles.backText}>Retour</Text>
          <Text style={styles.pageTitle}>Demande de Congés</Text>
        </TouchableOpacity>

        <View style={styles.requestCard}>
          <Text style={styles.fieldLabel}>Type de congé</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={leaveType}
              onValueChange={(value) => setLeaveType(value)}
              style={styles.picker}
            >
              <Picker.Item label="Congés payés" value="Congés payés" />
              <Picker.Item label="RTT" value="RTT" />
              <Picker.Item label="Exceptionnel" value="Exceptionnel" />
              <Picker.Item label="Maladie" value="Maladie" />
            </Picker>
          </View>

          <Text style={styles.fieldLabel}>Du (Date de début)</Text>
          <TouchableOpacity style={styles.dateField} onPress={() => changeDate('start')}>
            <View style={styles.dateLeft}>
              <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#2563EB" />
              <Text style={styles.dateText}>{formatDate(startDate)}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Raison du congé</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Ex: congé familial, rendez-vous médical..."
            placeholderTextColor="#94A3B8"
            value={reason}
            onChangeText={setReason}
            multiline
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Documentation (PDF/Image)</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
            <View style={styles.dateLeft}>
              <MaterialCommunityIcons name="paperclip" size={18} color="#2563EB" />
              <Text style={styles.uploadButtonText}>
                {selectedDocument?.name ? selectedDocument.name : 'Ajouter un document'}
              </Text>
            </View>
            <MaterialCommunityIcons name="upload" size={18} color="#2563EB" />
          </TouchableOpacity>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Au (Date de fin)</Text>
          <TouchableOpacity style={styles.dateField} onPress={() => changeDate('end')}>
            <View style={styles.dateLeft}>
              <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#2563EB" />
              <Text style={styles.dateText}>{formatDate(endDate)}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={submitRequest} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Envoyer la demande</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Historique</Text>
        </View>

        {loadingHistory ? (
          <View style={styles.emptyHistoryCard}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.emptyHistoryText}>Chargement...</Text>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyHistoryCard}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={26} color="#94A3B8" />
            <Text style={styles.emptyHistoryTitle}>Aucun congé enregistré</Text>
            <Text style={styles.emptyHistoryText}>Vos demandes de congé apparaîtront ici.</Text>
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
                <Text style={styles.historyMeta}>{item.leave_type || 'Congé'}{item.reason ? ` • ${item.reason}` : ''}</Text>
                {item.supporting_document_url ? (
                  <Text style={styles.docTag}>📎 Document joint</Text>
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
  pickerContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    marginBottom: 14,
    overflow: 'hidden',
  },
  picker: {
    color: '#334155',
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
