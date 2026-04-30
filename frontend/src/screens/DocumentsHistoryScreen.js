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
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { documentService } from '../services/apiService';

export default function DocumentsHistoryScreen() {
  const navigation = useNavigation();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchDocuments = useCallback(async () => {
    try {
      // Fetch documents from backend
      const response = await documentService.getDocuments();
      const docs = Array.isArray(response) ? response : response.results || [];
      
      // Filter to show only shared documents (not daily reports)
      // Includes: guide, instructions, training
      // Excludes: daily_report and other auto-generated types
      const sharedDocs = docs.filter(doc => {
        const docType = doc.document_type?.toLowerCase();
        return docType && ['guide', 'instructions', 'training'].includes(docType);
      });
      
      setDocuments(sharedDocs);
    } catch (err) {
      console.error('Error fetching documents:', err);
      Alert.alert('Error', 'Failed to load documents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDownload = async (document) => {
    try {
      setDownloadingId(document.id);

      const fileUrl = document.file_url || document.file;
      if (!fileUrl) {
        Alert.alert('Error', 'Document URL not available');
        return;
      }

      // Extract filename from URL or use document title
      const urlParts = fileUrl.split('/');
      const urlFilename = urlParts[urlParts.length - 1]?.split('?')[0] || 'document';
      const safeTitle = (document.title || urlFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
      // Ensure extension
      const ext = urlFilename.includes('.') ? '' : '.pdf';
      const filename = safeTitle.includes('.') ? safeTitle : `${safeTitle}${ext}`;

      // Download file to device cache
      const localUri = FileSystem.cacheDirectory + filename;
      const downloadResult = await FileSystem.downloadAsync(fileUrl, localUri);

      if (downloadResult.status !== 200) {
        Alert.alert('Error', 'Failed to download the file');
        return;
      }

      // Open share sheet so user can save to Files / open in another app
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: downloadResult.headers?.['content-type'] || 'application/octet-stream',
          dialogTitle: `Save ${document.title || 'document'}`,
        });
      } else {
        Alert.alert('Downloaded', 'File saved successfully');
      }

      // Mark as downloaded
      try {
        await documentService.markDownloaded(document.id);
      } catch (err) {
        console.warn('Could not mark as downloaded:', err);
      }
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Error', 'Failed to download document');
    } finally {
      setDownloadingId(null);
    }
  };

  const DocumentCard = ({ item }) => (
    <View style={styles.documentCard}>
      <View style={styles.documentHeader}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="file-document" size={24} color="#2563eb" />
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.type}>{getTypeLabel(item.document_type || item.type)}</Text>
        </View>
      </View>

      {item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      {item.created_at && (
        <View style={styles.dateRow}>
          <MaterialCommunityIcons name="calendar" size={14} color="#999" />
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
      )}

      {item.uploaded_by && (
        <Text style={styles.uploadedBy}>
          by {item.uploaded_by.first_name || item.uploaded_by.username || 'Admin'}
        </Text>
      )}

      <TouchableOpacity
        style={styles.downloadButton}
        onPress={() => handleDownload(item)}
        disabled={downloadingId === item.id}
      >
        {downloadingId === item.id ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
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
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Documents</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{documents.length}</Text>
        </View>
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <DocumentCard item={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchDocuments();
            }}
            colors={['#2563eb']}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="file-document-outline" size={52} color="#ccc" />
            <Text style={styles.emptyText}>No documents yet</Text>
            <Text style={styles.emptySubtext}>
              Documents shared with you will appear here
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function getTypeLabel(type) {
  const typeMap = {
    guide: 'Guide',
    training: 'Training',
    manual: 'Manual',
    memo: 'Memo',
    daily_report: 'Daily Report',
    other: 'Document',
  };
  return typeMap[type?.toLowerCase()] || 'Document';
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
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  badge: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  listContent: {
    padding: 12,
    gap: 12,
  },

  documentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },

  documentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },

  icon: {
    width: 45,
    height: 45,
    borderRadius: 10,
    backgroundColor: '#2563eb20',
    justifyContent: 'center',
    alignItems: 'center',
  },

  info: {
    flex: 1,
  },

  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },

  type: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },

  description: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
    lineHeight: 18,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },

  date: {
    fontSize: 12,
    color: '#999',
  },

  uploadedBy: {
    fontSize: 11,
    color: '#aaa',
    marginBottom: 12,
  },

  downloadButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  downloadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },

  emptySubtext: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 8,
  },
});
