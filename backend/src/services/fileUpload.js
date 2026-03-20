const multer = require('multer');
const path = require('path');
const { getSupabase } = require('../lib/supabase');

// File type categories mapping
const FILE_CATEGORIES = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document',
  'text/csv': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/m4a': 'audio',
  'audio/aac': 'audio',
  'audio/ogg': 'audio',
  'video/mp4': 'video',
  'video/avi': 'video',
  'video/mov': 'video',
  'video/wmv': 'video'
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
 * Generate unique file name
 */
function generateFileName(originalName, meetingId) {
  const timestamp = Date.now();
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `meeting_${meetingId}_${timestamp}_${sanitizedBaseName}${extension}`;
}

/**
 * Upload file to Supabase storage
 */
async function uploadToStorage(file, fileName) {
  const supabase = getSupabase();
  const filePath = `meetings/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from('meeting-documents')
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
    .from('meeting_documents')
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
  
  const { data } = supabase.storage
    .from('meeting-documents')
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

/**
 * Delete file from storage and database
 */
async function deleteFile(fileId, userId) {
  const supabase = getSupabase();
  
  // Get file info
  const { data: fileData, error: fetchError } = await supabase
    .from('meeting_documents')
    .select('*')
    .eq('id', fileId)
    .eq('uploaded_by', userId)
    .single();

  if (fetchError || !fileData) {
    throw new Error('File not found or access denied');
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('meeting-documents')
    .remove([fileData.storage_path]);

  if (storageError) {
    console.error('Storage deletion error:', storageError);
    // Continue with database deletion even if storage fails
  }

  // Mark as deleted in database
  const { error: dbError } = await supabase
    .from('meeting_documents')
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
 * Get files for a meeting
 */
async function getMeetingFiles(meetingId, userId) {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('meeting_documents')
    .select('*')
    .eq('meeting_id', meetingId)
    .eq('uploaded_by', userId)
    .eq('is_deleted', false)
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch files: ${error.message}`);
  }

  // Add download URLs
  const filesWithUrls = await Promise.all(
    data.map(async (file) => ({
      ...file,
      download_url: await getFileDownloadUrl(file.storage_path)
    }))
  );

  return filesWithUrls;
}

module.exports = {
  upload,
  getFileCategory,
  generateFileName,
  uploadToStorage,
  saveFileMetadata,
  getFileDownloadUrl,
  deleteFile,
  getMeetingFiles,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE
};
