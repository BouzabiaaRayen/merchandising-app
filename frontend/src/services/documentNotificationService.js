/**
 * Document Notifications Integration
 * Handles creating and displaying notifications for shared documents
 */

import { notificationService } from './apiService';

/**
 * Create a notification for a newly shared document
 * This would be called from the backend when a document is uploaded
 * @param {Object} document - The document object
 * @param {Array} recipients - List of recipient users
 */
export const createDocumentNotification = async (document, recipients) => {
  try {
    const notifications = recipients.map(recipient => ({
      user: recipient.id,
      title: `New document: ${document.title}`,
      message: document.description?.substring(0, 100) + '...' || 'A new document has been shared with you',
      type: 'document_shared',
      is_read: false,
      metadata: {
        document_id: document.id,
        document_type: document.document_type,
        file_url: document.file_url,
      }
    }));

    // Create notification for each recipient
    for (const notification of notifications) {
      try {
        await notificationService.createNotification(notification);
      } catch (err) {
        console.error('Error creating notification for recipient:', err);
      }
    }

    return notifications;
  } catch (error) {
    console.error('Error creating document notifications:', error);
    throw error;
  }
};

/**
 * Get document-related notifications
 * Filters notifications to show only document sharing events
 */
export const getDocumentNotifications = async () => {
  try {
    const response = await notificationService.getNotifications({
      type: 'document_shared',
      ordering: '-created_at',
    });

    return response?.results || response || [];
  } catch (error) {
    console.error('Error fetching document notifications:', error);
    return [];
  }
};

/**
 * Format notification for display
 * @param {Object} notification - The notification object
 */
export const formatDocumentNotification = (notification) => {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    isRead: notification.is_read,
    createdAt: notification.created_at,
    documentId: notification.metadata?.document_id,
    documentType: notification.metadata?.document_type,
    fileUrl: notification.metadata?.file_url,
  };
};

/**
 * Create a notification when a user downloads a document
 * @param {Object} document - The document object
 * @param {Object} user - The user who downloaded it (optional)
 */
export const createDownloadNotification = async (document, user) => {
  try {
    // Optionally notify admin that user downloaded document
    if (document.uploaded_by) {
      const notification = {
        user: document.uploaded_by.id,
        title: `Document downloaded: ${document.title}`,
        message: `${user?.username || 'A user'} downloaded ${document.title}`,
        type: 'document_downloaded',
        is_read: false,
        metadata: {
          document_id: document.id,
          downloaded_by: user?.id,
        }
      };

      await notificationService.createNotification(notification);
    }
  } catch (error) {
    console.error('Error creating download notification:', error);
    // Don't throw - this is optional functionality
  }
};
