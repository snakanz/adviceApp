import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Upload, File, Image, Music, Video, Download, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

// File type icons mapping
const getFileIcon = (fileCategory, mimeType) => {
  switch (fileCategory) {
    case 'image':
      return <Image className="w-5 h-5 text-blue-500" />;
    case 'audio':
      return <Music className="w-5 h-5 text-green-500" />;
    case 'video':
      return <Video className="w-5 h-5 text-purple-500" />;
    default:
      return <File className="w-5 h-5 text-gray-500" />;
  }
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format upload date
const formatUploadDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function DocumentsTab({ meetingId, selectedMeeting }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);

  // Fetch files for the meeting
  const fetchFiles = useCallback(async () => {
    if (!meetingId) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/calendar/meetings/${meetingId}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Handle file upload
  // UPDATED: Uses unified client_documents system with upload_source tracking
  const handleFileUpload = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      Array.from(selectedFiles).forEach(file => {
        formData.append('files', file);
      });

      // Note: The backend endpoint /api/calendar/meetings/:meetingId/documents
      // now uses the unified client_documents system and automatically sets
      // upload_source='meetings_page' for AI context tracking
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/calendar/meetings/${meetingId}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();

      // Refresh files list
      await fetchFiles();

      // Show success message
      console.log(`✅ Successfully uploaded ${data.files.length} file(s) to unified document system`);

    } catch (err) {
      console.error('Error uploading files:', err);
      setError(err.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  // Handle file deletion
  const handleDeleteFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/calendar/meetings/${meetingId}/documents/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      // Refresh files list
      await fetchFiles();
      
    } catch (err) {
      console.error('Error deleting file:', err);
      setError('Failed to delete file');
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    handleFileUpload(droppedFiles);
  };

  // Handle file input change
  const handleFileInputChange = (e) => {
    handleFileUpload(e.target.files);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card className={cn(
        "border-2 border-dashed transition-colors",
        dragOver ? "border-primary bg-primary/5" : "border-border/50",
        uploading && "opacity-50 pointer-events-none"
      )}>
        <CardContent className="p-6">
          <div
            className="text-center space-y-4"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="w-12 h-12 mx-auto bg-muted/20 rounded-full flex items-center justify-center">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                {uploading ? 'Uploading files...' : 'Upload Documents'}
              </h3>
              <p className="text-xs text-muted-foreground">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Supports images, documents, audio files (max 50MB each)
              </p>
            </div>
            <div>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.mp3,.wav,.m4a,.aac,.ogg"
                onChange={handleFileInputChange}
                className="hidden"
                id="file-upload"
                disabled={uploading}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('file-upload').click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Choose Files'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Files List */}
      {files.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            Documents ({files.length})
          </h3>
          <div className="space-y-2">
            {files.map((file) => (
              <Card key={file.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(file.file_category, file.file_type)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {file.original_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(file.file_size)} • {formatUploadDate(file.uploaded_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(file.download_url, '_blank')}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFile(file.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 mx-auto bg-muted/20 rounded-full flex items-center justify-center mb-4">
              <File className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">No documents yet</h3>
              <p className="text-xs text-muted-foreground">
                Upload files to attach them to this meeting
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
