const express = require('express');
const jwt = require('jsonwebtoken');
const { isSupabaseAvailable, getSupabase } = require('../lib/supabase');
const clientDocumentsService = require('../services/clientDocuments');

const router = express.Router();

// Middleware to authenticate requests
const authenticateToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token provided' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * POST /api/client-documents/upload
 * Upload documents (with optional client assignment)
 */
router.post('/upload', authenticateToken, clientDocumentsService.upload.array('files', 10), async (req, res) => {
  try {
    const advisorId = req.user.id;
    const { clientId, meetingId } = req.body; // Optional client ID and meeting ID
    const files = req.files;

    console.log('📤 Client document upload request:', {
      advisorId,
      clientId,
      meetingId,
      fileCount: files?.length || 0,
      files: files?.map(f => ({ name: f.originalname, size: f.size, type: f.mimetype }))
    });

    if (!files || files.length === 0) {
      console.error('❌ No files in upload request');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    if (!isSupabaseAvailable()) {
      console.error('❌ Supabase not available');
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // If clientId provided, verify it belongs to advisor
    if (clientId) {
      console.log('🔍 Verifying client access:', { clientId, advisorId });
      const { data: client, error: clientError } = await getSupabase()
        .from('clients')
        .select('id, name')
        .eq('id', clientId)
        .eq('advisor_id', advisorId)
        .single();

      if (clientError || !client) {
        console.error('❌ Client not found or access denied:', clientError);
        return res.status(404).json({ error: 'Client not found' });
      }
      console.log('✅ Client verified:', client.name);
    }

    // If meetingId provided, verify it belongs to advisor
    if (meetingId) {
      console.log('🔍 Verifying meeting access:', { meetingId, advisorId });
      const { data: meeting, error: meetingError } = await getSupabase()
        .from('meetings')
        .select('id, title')
        .eq('id', meetingId)
        .eq('userid', advisorId)
        .single();

      if (meetingError || !meeting) {
        console.error('❌ Meeting not found or access denied:', meetingError);
        return res.status(404).json({ error: 'Meeting not found' });
      }
      console.log('✅ Meeting verified:', meeting.title);
    }

    const uploadedFiles = [];
    const errors = [];

    // Process each file
    for (const file of files) {
      try {
        console.log(`📄 Processing file: ${file.originalname}`);

        // Generate unique filename
        const fileName = clientDocumentsService.generateFileName(file.originalname, clientId);
        console.log(`  Generated filename: ${fileName}`);

        // Upload to storage
        console.log(`  Uploading to storage...`);
        const storageResult = await clientDocumentsService.uploadToStorage(file, fileName, advisorId);
        console.log(`  ✅ Storage upload successful:`, storageResult.path);

        // Save metadata to database
        const fileData = {
          client_id: clientId || null,
          meeting_id: meetingId || null,
          advisor_id: advisorId,
          file_name: fileName,
          original_name: file.originalname,
          file_type: file.mimetype,
          file_category: clientDocumentsService.getFileCategory(file.mimetype),
          file_size: file.size,
          storage_path: storageResult.path,
          storage_bucket: 'client-documents',
          uploaded_by: advisorId,
          analysis_status: 'pending'
        };

        console.log(`  Saving metadata to database...`);
        const savedFile = await clientDocumentsService.saveFileMetadata(fileData);
        console.log(`  ✅ Metadata saved, ID: ${savedFile.id}`);

        // Queue for AI analysis
        console.log(`  Queueing for AI analysis...`);
        await clientDocumentsService.queueDocumentForAnalysis(
          savedFile.id,
          'client_document',
          advisorId,
          clientId ? 5 : 3 // Higher priority for unassigned docs (auto-detection)
        );

        // Add download URL
        savedFile.download_url = await clientDocumentsService.getFileDownloadUrl(storageResult.path);

        uploadedFiles.push(savedFile);
        console.log(`  ✅ File processed successfully: ${file.originalname}`);
      } catch (fileError) {
        console.error(`❌ Error uploading file ${file.originalname}:`, fileError);
        console.error(`   Error details:`, {
          message: fileError.message,
          stack: fileError.stack
        });
        errors.push({
          filename: file.originalname,
          error: fileError.message
        });
      }
    }

    console.log(`✅ Upload complete: ${uploadedFiles.length} successful, ${errors.length} failed`);

    res.json({
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Error in file upload:', error);
    console.error('   Error details:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

/**
 * GET /api/client-documents/unassigned/list
 * Get all unassigned documents (for auto-detection review)
 */
router.get('/unassigned/list', authenticateToken, async (req, res) => {
  try {
    const advisorId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const documents = await clientDocumentsService.getUnassignedDocuments(advisorId);

    res.json({
      count: documents.length,
      documents
    });

  } catch (error) {
    console.error('Error fetching unassigned documents:', error);
    res.status(500).json({ error: 'Failed to fetch unassigned documents' });
  }
});

/**
 * PATCH /api/client-documents/:documentId/assign
 * Manually assign a document to a client
 */
router.patch('/:documentId/assign', authenticateToken, async (req, res) => {
  try {
    const advisorId = req.user.id;
    const { documentId } = req.params;
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const updatedDocument = await clientDocumentsService.assignDocumentToClient(
      documentId,
      clientId,
      advisorId
    );

    res.json({
      message: 'Document assigned successfully',
      document: updatedDocument
    });

  } catch (error) {
    console.error('Error assigning document:', error);
    res.status(500).json({ error: error.message || 'Failed to assign document' });
  }
});

/**
 * DELETE /api/client-documents/:documentId
 * Delete a document
 */
router.delete('/:documentId', authenticateToken, async (req, res) => {
  try {
    const advisorId = req.user.id;
    const { documentId } = req.params;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    await clientDocumentsService.deleteFile(documentId, advisorId);

    res.json({
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: error.message || 'Failed to delete document' });
  }
});

/**
 * GET /api/client-documents/:documentId/download
 * Get download URL for a document
 */
router.get('/:documentId/download', authenticateToken, async (req, res) => {
  try {
    const advisorId = req.user.id;
    const { documentId } = req.params;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Get document info
    const { data: document, error } = await getSupabase()
      .from('client_documents')
      .select('*')
      .eq('id', documentId)
      .eq('advisor_id', advisorId)
      .eq('is_deleted', false)
      .single();

    if (error || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const downloadUrl = await clientDocumentsService.getFileDownloadUrl(document.storage_path);

    res.json({
      documentId,
      fileName: document.original_name,
      downloadUrl
    });

  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

/**
 * POST /api/client-documents/:documentId/analyze
 * Trigger AI analysis for a specific document
 */
router.post('/:documentId/analyze', authenticateToken, async (req, res) => {
  try {
    const advisorId = req.user.id;
    const { documentId } = req.params;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify document belongs to advisor
    const { data: document, error } = await getSupabase()
      .from('client_documents')
      .select('id, analysis_status')
      .eq('id', documentId)
      .eq('advisor_id', advisorId)
      .single();

    if (error || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Queue for analysis with high priority
    const queueEntry = await clientDocumentsService.queueDocumentForAnalysis(
      documentId,
      'client_document',
      advisorId,
      1 // High priority
    );

    res.json({
      message: 'Document queued for analysis',
      queueEntry
    });

  } catch (error) {
    console.error('Error queuing document for analysis:', error);
    res.status(500).json({ error: 'Failed to queue document for analysis' });
  }
});

/**
 * GET /api/client-documents/meeting/:meetingId
 * Get all documents for a specific meeting
 */
router.get('/meeting/:meetingId', authenticateToken, async (req, res) => {
  try {
    const advisorId = req.user.id;
    const { meetingId } = req.params;

    console.log('📄 Fetching meeting documents:', { meetingId, advisorId });

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const documents = await clientDocumentsService.getMeetingDocuments(meetingId, advisorId);

    console.log(`✅ Found ${documents.length} documents for meeting ${meetingId}`);

    res.json({
      meetingId,
      count: documents.length,
      documents
    });

  } catch (error) {
    console.error('Error fetching meeting documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * GET /api/client-documents/client/:clientId
 * Get all documents for a specific client
 * NOTE: This route must come LAST to avoid conflicts with specific routes above
 */
router.get('/client/:clientId', authenticateToken, async (req, res) => {
  try {
    const advisorId = req.user.id;
    const { clientId } = req.params;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const documents = await clientDocumentsService.getClientDocuments(clientId, advisorId);

    res.json({
      clientId,
      count: documents.length,
      documents
    });

  } catch (error) {
    console.error('Error fetching client documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

module.exports = router;

