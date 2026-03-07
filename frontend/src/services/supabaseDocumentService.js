import { supabase, REPORTS_BUCKET } from './supabaseClient';

/**
 * Document service using Supabase Storage
 * Stores PDFs in Supabase Storage bucket and metadata in file path
 */
export const supabaseDocumentService = {
  /**
   * Upload a PDF document to Supabase Storage
   * @param {Object} file - File object with uri, name, type
   * @param {Object} metadata - Document metadata (title, description, merchandiser, etc)
   * @returns {Promise<Object>} Upload result with path and public URL
   */
  uploadDocument: async (file, metadata = {}) => {
    try {
      console.log('📥 Upload function called');
      console.log('📁 File object:', { uri: file.uri, name: file.name, type: file.type });
      console.log('📋 Metadata:', metadata);
      
      // Read file using fetch (works on all platforms)
      console.log('📖 Reading file using fetch...');
      let blob;
      try {
        const response = await fetch(file.uri);
        console.log('✓ Fetch response status:', response.status);
        blob = await response.blob();
        console.log('✓ File read successfully, size:', blob.size, 'bytes');
      } catch (fetchError) {
        console.error('❌ Error reading file with fetch:', fetchError);
        throw new Error(`Failed to read PDF file: ${fetchError.message}`);
      }

      // Create file path with metadata in filename
      const timestamp = Date.now(); // Use timestamp in milliseconds
      const merchandiserName = metadata.merchandiser_name || 'merchandiser';
      const fileName = `${timestamp}_${merchandiserName}_${file.name}`;

      console.log('📤 Uploading PDF to Supabase:', { fileName, bucket: REPORTS_BUCKET });
      console.log('🌐 Supabase URL being used:', supabase.storageUrl);

      // Upload to Supabase Storage (root level of bucket)
      const { data, error } = await supabase.storage
        .from(REPORTS_BUCKET)
        .upload(fileName, blob, {
          contentType: file.type || 'application/pdf',
          upsert: false,
        });

      if (error) throw error;

      console.log('✅ Upload successful:', data);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(REPORTS_BUCKET)
        .getPublicUrl(fileName);

      return {
        success: true,
        path: data.path,
        publicUrl: urlData.publicUrl,
        metadata: {
          ...metadata,
          uploaded_at: timestamp,
          file_name: fileName,
        },
      };
    } catch (error) {
      console.error('❌ Error uploading to Supabase:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error cause:', error.cause);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      throw error;
    }
  },

  /**
   * List all documents from Supabase Storage
   * @returns {Promise<Array>} List of documents with metadata
   */
  listDocuments: async () => {
    try {
      const { data, error } = await supabase.storage
        .from(REPORTS_BUCKET)
        .list('', {  // List from root
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;

      // Filter PDF files only
      const pdfFiles = data.filter(file => file.name.endsWith('.pdf'));

      // Parse metadata from filenames and add public URLs
      const documents = pdfFiles.map((file) => {
        // Parse filename: timestamp_merchandiser_filename.pdf
        const parts = file.name.split('_');
        const timestamp = parseInt(parts[0]);
        const merchandiserName = parts[1] || 'Unknown';
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from(REPORTS_BUCKET)
          .getPublicUrl(file.name);  // Root level

        return {
          id: file.id || file.name,
          name: file.name,
          title: `Rapport Journalier - ${new Date(timestamp).toLocaleDateString('fr-FR')}`,
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
      const { data, error } = await supabase.storage
        .from(REPORTS_BUCKET)
        .remove([fileName]);  // Root level

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error deleting from Supabase:', error);
      throw error;
    }
  },
};
