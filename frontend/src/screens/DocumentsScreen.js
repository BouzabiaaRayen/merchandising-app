import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../contexts/AuthContext';
import { documentService } from '../services/apiService';

const DocumentsScreen = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchDocuments();
    }, [])
  );

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get documents for current user
      const response = await documentService.getDocuments({ page_size: 100 });
      const docs = response?.results || response || [];
      
      // Filter to only documents sent to current user's role
      const userRole = user?.role || 'merchandiser';
      let filteredDocs = docs;
      
      if (userRole === 'merchandiser') {
        filteredDocs = docs.filter(d => d.sent_to_merchandisers);
      } else if (userRole === 'supervisor') {
        filteredDocs = docs.filter(d => d.sent_to_supervisors);
      }
      
      // Sort by date (newest first)
      filteredDocs.sort((a, b) => 
        new Date(b.created_at || b.uploaded_at) - new Date(a.created_at || a.uploaded_at)
      );
      
      setDocuments(filteredDocs);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDownload = async (document) => {
    try {
      if (!document.file_url) {
        Alert.alert('Error', 'File URL not available');
        return;
      }

      setDownloadingId(document.id);

      // Extract filename from URL or use title
      let filename = document.title.replace(/\s+/g, '_') + '.pdf';
      const localPath = `${FileSystem.documentDirectory}${filename}`;

      // Download the file
      const download = FileSystem.createDownloadResumable(
        document.file_url,
        localPath,
        {},
        (downloadProgress) => {
          const progressPercent = Math.round(
            (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
          );
          console.log(`Download progress: ${progressPercent}%`);
        }
      );

      const result = await download.downloadAsync();

      if (result.uri) {
        // Mark document as downloaded
        if (documentService.markDownloaded) {
          try {
            await documentService.markDownloaded(document.id);
          } catch (err) {
            console.error('Error marking document as downloaded:', err);
          }
        }

        // Share/Open the file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(result.uri);
        } else {
          Alert.alert('Success', 'File saved to Documents');
        }
      }
    } catch (err) {
      console.error('Error downloading document:', err);
      Alert.alert('Error', 'Failed to download document');
    } finally {
      setDownloadingId(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocuments();
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getDocumentIcon = (docType) => {
    const icons = {
      guide: 'book-open-page-variant',
      training: 'school',
      manual: 'file-document',
      memo: 'note-text',
      other: 'file'
    };
    return icons[docType] || 'file-document';
  };

  const getTypeLabel = (docType) => {
    const labels = {
      guide: 'Guide',
      training: 'Training',
      manual: 'Manual',
      memo: 'Memo',
      other: 'Other'
    };
    return labels[docType] || docType;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Documents</Text>
          <Text style={styles.headerSubtitle}>
            {documents.length} documento{documents.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <MaterialCommunityIcons name="file-document-multiple" size={32} color="#2563eb" />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {documents.length === 0 ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          style={{ flex: 1 }}
        >
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={48}
              color="#cbd5e1"
            />
            <Text style={styles.emptyTitle}>No documents</Text>
            <Text style={styles.emptyText}>
              Shared documents will appear here
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {documents.map((document) => (
            <View key={document.id} style={styles.documentCard}>
              {/* Card Icon and Header */}
              <View style={styles.cardHeader}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons
                    name={getDocumentIcon(document.document_type)}
                    size={28}
                    color="#2563eb"
                  />
                </View>
                <View style={styles.headerInfo}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {document.title || 'Sem título'}
                  </Text>
                  <Text style={styles.cardType}>
                    {getTypeLabel(document.document_type)}
                  </Text>
                </View>
              </View>

              {/* Card Description */}
              {document.description && (
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {document.description}
                </Text>
              )}

              {/* Card Metadata */}
              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="calendar-outline" size={14} color="#94a3b8" />
                  <Text style={styles.metaText}>
                    {formatDate(document.created_at || document.uploaded_at)}
                  </Text>
                </View>

                {document.uploaded_by && (
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="account-outline" size={14} color="#94a3b8" />
                    <Text style={styles.metaText}>
                      {document.uploaded_by.username || 'Admin'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Card Actions */}
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => handleDownload(document)}
                disabled={downloadingId === document.id}
              >
                {downloadingId === document.id ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.downloadButtonText}>Downloading...</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="download" size={18} color="#fff" />
                    <Text style={styles.downloadButtonText}>Download</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ))}

          {/* Footer spacing */}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4
  },

  headerSubtitle: {
    fontSize: 14,
    color: '#64748b'
  },

  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444'
  },

  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },

  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b'
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8
  },

  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center'
  },

  // Document Card
  documentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },

  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },

  headerInfo: {
    flex: 1,
    justifyContent: 'center'
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2
  },

  cardType: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },

  cardDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 12
  },

  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },

  metaText: {
    fontSize: 12,
    color: '#94a3b8'
  },

  // Download Button
  downloadButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8
  },

  downloadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8
  }
});

export default DocumentsScreen;
