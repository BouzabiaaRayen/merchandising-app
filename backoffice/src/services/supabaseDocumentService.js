import { supabase, REPORTS_BUCKET } from './supabaseClient';

/**
 * Document service using Supabase Storage for backoffice
 * Fetches PDFs from Supabase Storage bucket
 */
export const supabaseDocumentService = {
  /**
   * List all documents from Supabase Storage
   * @returns {Promise<Array>} List of documents with metadata
   */
  listDocuments: async () => {
    try {
      console.log('Listing documents from Supabase bucket:', REPORTS_BUCKET);
      
      const { data, error } = await supabase.storage
        .from(REPORTS_BUCKET)
        .list('', {  // List from root of bucket
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) {
        console.error('Supabase list error:', error);
        throw error;
      }

      console.log('Files found:', data);

      // Filter out .emptyFolderPlaceholder and folders
      const files = data.filter(item => 
        item.name && 
        !item.name.includes('.emptyFolderPlaceholder') &&
        item.name.endsWith('.pdf')
      );

      // Parse metadata from filenames and add public URLs
      const documents = files.map((file) => {
        // Parse filename: timestamp_merchandiser_filename.pdf
        const parts = file.name.split('_');
        const timestamp = parts[0];
        const merchandiserName = parts[1] || 'Unknown';
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from(REPORTS_BUCKET)
          .getPublicUrl(file.name);  // File at root level

        return {
          id: file.id || file.name,
          name: file.name,
          title: `Rapport Journalier - ${new Date(parseInt(timestamp)).toLocaleDateString('fr-FR')}`,
          description: `Rapport de ${merchandiserName}`,
          merchandiser_name: merchandiserName,
          created_at: timestamp || file.created_at,
          uploaded_at: timestamp || file.created_at,
          file_url: urlData.publicUrl,
          file_size: file.metadata?.size || 0,
        };
      });

      return documents;
    } catch (error) {
      console.error('Error listing documents from Supabase:', error);
      throw error;
    }
  },

  /**
   * Delete a document from Supabase Storage
   * @param {string} fileName - File name to delete
   * @returns {Promise<Object>} Delete result
   */
  deleteDocument: async (fileName) => {
    try {
      console.log('Deleting file:', fileName);
      
      const { data, error } = await supabase.storage
        .from(REPORTS_BUCKET)
        .remove([fileName]);  // Delete from root level

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error deleting from Supabase:', error);
      throw error;
    }
  },

  /**
   * Download a document
   * @param {string} fileUrl - Public URL of the file
   */
  downloadDocument: (fileUrl) => {
    window.open(fileUrl, '_blank');
  },
};
