import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import {
  Upload,
  FileText,
  Image,
  Music,
  Video,
  File,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar,
  FolderOpen,
  Files
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

// File category icons
const getCategoryIcon = (category) => {
  switch (category) {
    case 'image':
      return <Image className="w-4 h-4" />;
    case 'audio':
      return <Music className="w-4 h-4" />;
    case 'video':
      return <Video className="w-4 h-4" />;
    case 'document':
      return <FileText className="w-4 h-4" />;
    default:
      return <File className="w-4 h-4" />;
  }
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// Format date
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export default function ClientDocumentsSection({ clientId, clientName, meetings = [] }) {
  const [clientDocuments, setClientDocuments] = useState([]);
  const [meetingDocuments, setMeetingDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'client', 'meetings'

  // Fetch client-level documents
  const fetchClientDocuments = useCallback(async () => {
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/client-documents/client/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch client documents');
      }

      const data = await response.json();
      setClientDocuments(data.documents || []);
    } catch (err) {
      console.error('Error fetching client documents:', err);
    }
  }, [clientId]);

  // Fetch meeting-level documents for all meetings
  const fetchMeetingDocuments = useCallback(async () => {
    try {
      const token = localStorage.getItem('jwt');
      const allMeetingDocs = [];

      // Only fetch documents for Google Calendar meetings (not Calendly)
      // Calendly meetings have IDs starting with 'calendly_'
      const googleMeetings = meetings.filter(meeting =>
        meeting.id && !meeting.id.toString().startsWith('calendly_')
      );

      // Fetch documents for each Google Calendar meeting
      for (const meeting of googleMeetings) {
        try {
          const response = await fetch(`${API_URL}/api/calendar/meetings/${meeting.id}/documents`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.files && data.files.length > 0) {
              // Add meeting info to each document
              const docsWithMeeting = data.files.map(doc => ({
                ...doc,
                meetingId: meeting.id,
                meetingTitle: meeting.title,
                meetingDate: meeting.starttime
              }));
              allMeetingDocs.push(...docsWithMeeting);
            }
          } else if (response.status !== 404) {
            // Only log non-404 errors (404 just means no documents)
            console.warn(`Failed to fetch documents for meeting ${meeting.id}: ${response.status}`);
          }
        } catch (err) {
          console.error(`Error fetching documents for meeting ${meeting.id}:`, err);
        }
      }

      setMeetingDocuments(allMeetingDocs);
    } catch (err) {
      console.error('Error fetching meeting documents:', err);
    }
  }, [meetings]);

  // Fetch all documents on mount
  useEffect(() => {
    const fetchAllDocuments = async () => {
      setLoading(true);
      setError(null);
      await Promise.all([
        fetchClientDocuments(),
        fetchMeetingDocuments()
      ]);
      setLoading(false);
    };

    if (clientId) {
      fetchAllDocuments();
    }
  }, [clientId, fetchClientDocuments, fetchMeetingDocuments]);

  const handleFileUpload = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      Array.from(selectedFiles).forEach(file => {
        formData.append('files', file);
      });
      formData.append('clientId', clientId);

      const token = localStorage.getItem('jwt');
      console.log('Uploading to:', `${API_URL}/api/client-documents/upload`);
      console.log('Client ID:', clientId);
      console.log('Files:', Array.from(selectedFiles).map(f => f.name));

      const response = await fetch(`${API_URL}/api/client-documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      console.log('Upload response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Upload failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Upload successful:', result);

      // Refresh client documents list
      await fetchClientDocuments();

    } catch (err) {
      console.error('Error uploading files:', err);
      setError(err.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClientDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/client-documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      await fetchClientDocuments();
      
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document');
    }
  };

  const handleDeleteMeetingDocument = async (meetingId, documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/calendar/meetings/${meetingId}/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      await fetchMeetingDocuments();
      
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document');
    }
  };

  const handleDownloadClientDocument = async (documentId, fileName) => {
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/client-documents/${documentId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await response.json();
      window.open(data.downloadUrl, '_blank');
      
    } catch (err) {
      console.error('Error downloading document:', err);
      setError('Failed to download document');
    }
  };

  const handleDownloadMeetingDocument = (doc) => {
    // Meeting documents already have download_url from the API response
    if (doc.download_url) {
      window.open(doc.download_url, '_blank');
    } else {
      setError('Download URL not available');
    }
  };

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

  const handleFileInputChange = (e) => {
    handleFileUpload(e.target.files);
  };

  // Group meeting documents by meeting
  const meetingDocsByMeeting = meetingDocuments.reduce((acc, doc) => {
    if (!acc[doc.meetingId]) {
      acc[doc.meetingId] = {
        meetingTitle: doc.meetingTitle,
        meetingDate: doc.meetingDate,
        documents: []
      };
    }
    acc[doc.meetingId].documents.push(doc);
    return acc;
  }, {});

  const totalDocuments = clientDocuments.length + meetingDocuments.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading documents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Documents</h3>
        <Badge variant="outline" className="bg-muted/30">
          {totalDocuments} {totalDocuments === 1 ? 'document' : 'documents'}
        </Badge>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 border-b border-border/50">
        <button
          onClick={() => setViewMode('all')}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
            viewMode === 'all'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Files className="w-4 h-4 inline mr-1" />
          All Documents
        </button>
        <button
          onClick={() => setViewMode('client')}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
            viewMode === 'client'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <FolderOpen className="w-4 h-4 inline mr-1" />
          Client Files ({clientDocuments.length})
        </button>
        <button
          onClick={() => setViewMode('meetings')}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
            viewMode === 'meetings'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Calendar className="w-4 h-4 inline mr-1" />
          Meeting Files ({meetingDocuments.length})
        </button>
      </div>

      {/* Upload Area - Only show in 'all' or 'client' view */}
      {(viewMode === 'all' || viewMode === 'client') && (
        <Card className={cn(
          "border-2 border-dashed transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border/50",
          uploading && "opacity-50 pointer-events-none"
        )}>
          <CardContent className="p-4">
            <div
              className="text-center space-y-3"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="w-10 h-10 mx-auto bg-muted/20 rounded-full flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">
                  {uploading ? 'Uploading...' : 'Upload Client Documents'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Drag files here or click to browse
                </p>
              </div>
              <div>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.mp3,.wav,.m4a,.aac,.ogg"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="client-file-upload"
                  disabled={uploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('client-file-upload').click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Choose Files'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Display */}
      {totalDocuments === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h4 className="text-sm font-medium text-foreground mb-1">No documents yet</h4>
          <p className="text-xs text-muted-foreground">
            Upload documents to keep all client files organized
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Client Documents */}
          {(viewMode === 'all' || viewMode === 'client') && clientDocuments.length > 0 && (
            <div className="space-y-2">
              {viewMode === 'all' && (
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Client Files
                </h4>
              )}
              <div className="space-y-2">
                {clientDocuments.map((doc) => (
                  <Card key={doc.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="text-muted-foreground flex-shrink-0">
                            {getCategoryIcon(doc.file_category)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="text-sm font-medium text-foreground truncate" title={doc.original_name}>
                              {doc.original_name}
                            </h5>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadClientDocument(doc.id, doc.original_name)}
                            className="h-8 w-8 p-0"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClientDocument(doc.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Meeting Documents */}
          {(viewMode === 'all' || viewMode === 'meetings') && meetingDocuments.length > 0 && (
            <div className="space-y-3">
              {viewMode === 'all' && (
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2 mt-4">
                  <Calendar className="w-4 h-4" />
                  Meeting Files
                </h4>
              )}
              {Object.entries(meetingDocsByMeeting).map(([meetingId, meetingData]) => (
                <div key={meetingId} className="space-y-2">
                  <div className="flex items-center gap-2 px-2">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {meetingData.meetingTitle} • {formatDate(meetingData.meetingDate)}
                    </span>
                  </div>
                  <div className="space-y-2 pl-5">
                    {meetingData.documents.map((doc) => (
                      <Card key={doc.id} className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="text-muted-foreground flex-shrink-0">
                                {getCategoryIcon(doc.file_category)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h5 className="text-sm font-medium text-foreground truncate" title={doc.original_name}>
                                  {doc.original_name}
                                </h5>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadMeetingDocument(doc)}
                                className="h-8 w-8 p-0"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteMeetingDocument(doc.meetingId, doc.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

