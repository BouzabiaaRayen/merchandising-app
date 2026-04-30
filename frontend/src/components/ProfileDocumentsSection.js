import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { documentService } from '../services/apiService';

const ProfileDocumentsSection = ({ userId }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await documentService.getDocuments({ page_size: 100 });
      const docs = response?.results || response || [];
      
      // Sort by date (newest first)
      const sortedDocs = docs.sort((a, b) => 
        new Date(b.created_at || b.uploaded_at) - new Date(a.created_at || a.uploaded_at)
      );
      
      setDocuments(sortedDocs);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (document) => {
    try {
      if (!document.file_url) {
        Alert.alert('Error', 'File URL not available');
        return;
      }

      setDownloadingId(document.id);

      // Mark as downloaded
      if (documentService.markDownloaded) {
        try {
          await documentService.markDownloaded(document.id);
        } catch (err) {
          console.error('Error marking document as downloaded:', err);
        }
      }

      // Open file URL
      const canOpen = await Linking.canOpenURL(document.file_url);
      if (canOpen) {
        await Linking.openURL(document.file_url);
      } else {
        Alert.alert('Success', 'Document downloaded');
      }
    } catch (err) {
      console.error('Error downloading document:', err);
      Alert.alert('Error', 'Failed to download document');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getTypeIcon = (docType) => {
    const icons = {
      guide: 'book-open-variant',
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
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documents</Text>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (documents.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documents</Text>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="file-document-outline" size={40} color="#cbd5e1" />
          <Text style={styles.emptyText}>No documents available</Text>
        </View>
      </View>
    );
  }

  const renderDocumentItem = ({ item }) => (
    <View style={styles.documentItem}>
      <View style={styles.documentHeader}>
        <View style={styles.documentIconContainer}>
          <MaterialCommunityIcons name={getTypeIcon(item.document_type)} size={24} color="#6366f1" />
        </View>
        <View style={styles.documentInfo}>
          <Text style={styles.documentTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.documentType}>{getTypeLabel(item.document_type)}</Text>
        </View>
      </View>

      <View style={styles.documentMeta}>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="calendar-outline" size={12} color="#94a3b8" />
          <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
        </View>
        {item.uploaded_by && (
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="account-outline" size={12} color="#94a3b8" />
            <Text style={styles.metaText}>{item.uploaded_by.username}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.downloadButton}
        onPress={() => handleDownload(item)}
        disabled={downloadingId === item.id}
      >
        {downloadingId === item.id ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.buttonText}>Downloading...</Text>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name="download" size={16} color="#fff" />
            <Text style={styles.buttonText}>Download</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Documents</Text>
        <Text style={styles.badge}>{documents.length}</Text>
      </View>
      <FlatList
        data={documents}
        renderItem={renderDocumentItem}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },

  badge: {
    backgroundColor: '#eff6ff',
    color: '#1e40af',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
  },

  documentItem: {
    paddingVertical: 12,
  },

  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  documentIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#f0f4ff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  documentInfo: {
    flex: 1,
  },

  documentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },

  documentType: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  documentMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  metaText: {
    fontSize: 11,
    color: '#94a3b8',
  },

  downloadButton: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  separator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 8,
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },

  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#94a3b8',
  },
});

export default ProfileDocumentsSection;
