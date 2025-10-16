const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { getSupabase } = require('../lib/supabase');

// File categories mapping
const FILE_CATEGORIES = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'text/plain': 'document',
  'text/csv': 'document',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/mp4': 'audio',
  'audio/aac': 'audio',
  'audio/ogg': 'audio',
  'video/mp4': 'video',
  'video/mpeg': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video'
};

// Allowed file types
const ALLOWED_MIME_TYPES = Object.keys(FILE_CATEGORIES);

// Maximum file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10 // Maximum 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  }
});

/**
 * Get file category from MIME type
 */
function getFileCategory(mimeType) {
  return FILE_CATEGORIES[mimeType] || 'other';
}

/**
 * Generate unique filename
 */
function generateFileName(originalName, clientId = null) {
  const timestamp = Date.now();
  const randomString = uuidv4().split('-')[0];
  const extension = originalName.split('.').pop();
  const prefix = clientId ? `client-${clientId}` : 'unassigned';
  return `${prefix}-${timestamp}-${randomString}.${extension}`;
}

/**
 * Upload file to Supabase storage
 */
async function uploadToStorage(file, fileName, advisorId) {
  const supabase = getSupabase();
  const filePath = `${advisorId}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from('client-documents')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return {
    path: filePath,
    fullPath: data.path
  };
}

/**
 * Save file metadata to database
 */
async function saveFileMetadata(fileData) {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('client_documents')
    .insert(fileData)
    .select()
    .single();

  if (error) {
    throw new Error(`Database save failed: ${error.message}`);
  }

  return data;
}

/**
 * Get file download URL
 */
async function getFileDownloadUrl(storagePath) {
  const supabase = getSupabase();
  
  const { data, error } = await supabase.storage
    .from('client-documents')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error) {
    throw new Error(`Failed to generate download URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Delete file from storage and database
 */
async function deleteFile(fileId, advisorId) {
  const supabase = getSupabase();
  
  // Get file info
  const { data: fileData, error: fetchError } = await supabase
    .from('client_documents')
    .select('*')
    .eq('id', fileId)
    .eq('advisor_id', advisorId)
    .single();

  if (fetchError || !fileData) {
    throw new Error('File not found or access denied');
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('client-documents')
    .remove([fileData.storage_path]);

  if (storageError) {
    console.error('Storage deletion error:', storageError);
    // Continue with database deletion even if storage fails
  }

  // Mark as deleted in database
  const { error: dbError } = await supabase
    .from('client_documents')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString()
    })
    .eq('id', fileId);

  if (dbError) {
    throw new Error(`Database deletion failed: ${dbError.message}`);
  }

  return true;
}

/**
 * Get all documents for a client
 */
async function getClientDocuments(clientId, advisorId) {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('client_documents')
    .select('*')
    .eq('client_id', clientId)
    .eq('advisor_id', advisorId)
    .eq('is_deleted', false)
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  // Add download URLs
  const documentsWithUrls = await Promise.all(
    data.map(async (doc) => {
      try {
        const downloadUrl = await getFileDownloadUrl(doc.storage_path);
        return { ...doc, download_url: downloadUrl };
      } catch (err) {
        console.error(`Error generating URL for document ${doc.id}:`, err);
        return { ...doc, download_url: null };
      }
    })
  );

  return documentsWithUrls;
}

/**
 * Get unassigned documents (for auto-detection review)
 */
async function getUnassignedDocuments(advisorId) {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('client_documents')
    .select('*')
    .eq('advisor_id', advisorId)
    .is('client_id', null)
    .eq('is_deleted', false)
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch unassigned documents: ${error.message}`);
  }

  // Add download URLs
  const documentsWithUrls = await Promise.all(
    data.map(async (doc) => {
      try {
        const downloadUrl = await getFileDownloadUrl(doc.storage_path);
        return { ...doc, download_url: downloadUrl };
      } catch (err) {
        console.error(`Error generating URL for document ${doc.id}:`, err);
        return { ...doc, download_url: null };
      }
    })
  );

  return documentsWithUrls;
}

/**
 * Manually assign document to client
 */
async function assignDocumentToClient(documentId, clientId, advisorId) {
  const supabase = getSupabase();
  
  // Verify document belongs to advisor
  const { data: doc, error: docError } = await supabase
    .from('client_documents')
    .select('id')
    .eq('id', documentId)
    .eq('advisor_id', advisorId)
    .single();

  if (docError || !doc) {
    throw new Error('Document not found or access denied');
  }

  // Verify client belongs to advisor
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('advisor_id', advisorId)
    .single();

  if (clientError || !client) {
    throw new Error('Client not found or access denied');
  }

  // Update document
  const { data, error } = await supabase
    .from('client_documents')
    .update({
      client_id: clientId,
      manually_assigned: true
    })
    .eq('id', documentId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to assign document: ${error.message}`);
  }

  return data;
}

/**
 * Queue document for AI analysis
 */
async function queueDocumentForAnalysis(documentId, documentType, advisorId, priority = 5) {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('ai_document_analysis_queue')
    .insert({
      document_id: documentId,
      document_type: documentType,
      advisor_id: advisorId,
      priority: priority,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to queue document for analysis: ${error.message}`);
  }

  return data;
}

module.exports = {
  upload,
  getFileCategory,
  generateFileName,
  uploadToStorage,
  saveFileMetadata,
  getFileDownloadUrl,
  deleteFile,
  getClientDocuments,
  getUnassignedDocuments,
  assignDocumentToClient,
  queueDocumentForAnalysis,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE
};

