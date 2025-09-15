import React, { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  Loader2,
  Users,
  Calendar,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

const DataImport = () => {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [step, setStep] = useState('upload'); // 'upload', 'preview', 'importing', 'complete'
  const [importOptions, setImportOptions] = useState({
    skipDuplicates: true,
    updateExisting: false
  });

  // Handle file selection
  const handleFileSelect = useCallback((selectedFile) => {
    if (!selectedFile) return;

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      alert('Please select an Excel (.xlsx, .xls) or CSV file');
      return;
    }

    // Validate file size (10MB limit)
    if (selectedFile.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setPreview(null);
    setImportResults(null);
    setStep('upload');
  }, []);

  // Handle drag and drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  // Preview import data
  const handlePreview = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/data-import/preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Preview failed');
      }

      const data = await response.json();
      setPreview(data.preview);
      setStep('preview');
    } catch (error) {
      console.error('Error previewing import:', error);
      alert(`Preview failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Execute import
  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setStep('importing');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('skipDuplicates', importOptions.skipDuplicates.toString());
      formData.append('updateExisting', importOptions.updateExisting.toString());

      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/data-import/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const data = await response.json();
      setImportResults(data.results);
      setStep('complete');
    } catch (error) {
      console.error('Error executing import:', error);
      alert(`Import failed: ${error.message}`);
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/data-import/template`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'advicly-import-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading template:', error);
      alert(`Failed to download template: ${error.message}`);
    }
  };

  // Reset to start over
  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setImportResults(null);
    setStep('upload');
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Data Import</h2>
          <p className="text-muted-foreground">Import clients and meetings from Excel or CSV files</p>
        </div>
        <Button
          variant="outline"
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download Template
        </Button>
      </div>

      {/* Upload Section */}
      {step === 'upload' && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border/50",
                "hover:border-primary/50 hover:bg-primary/5"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-muted/20 rounded-full flex items-center justify-center">
                  <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-foreground">
                    {file ? file.name : 'Choose a file or drag it here'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Supports Excel (.xlsx, .xls) and CSV files up to 10MB
                  </p>
                  {file && (
                    <p className="text-sm text-primary">
                      File size: {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>
                <div className="flex gap-2 justify-center">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('file-upload').click()}
                  >
                    Choose File
                  </Button>
                  {file && (
                    <Button
                      onClick={handlePreview}
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Preview Import
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 bg-muted/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">File Format Requirements:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Use the provided template for best results</li>
                    <li>• Clients sheet: email (required), name, business_type, etc.</li>
                    <li>• Meetings sheet: client_email (required), title (required), start_date, start_time, etc.</li>
                    <li>• Client emails in meetings must match those in the clients sheet</li>
                    <li>• Dates should be in YYYY-MM-DD format, times in HH:MM format</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Section */}
      {step === 'preview' && preview && (
        <div className="space-y-6">
          {/* Preview Summary */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Import Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Clients Summary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    <h3 className="font-medium text-foreground">Clients</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total found:</span>
                      <span className="font-medium">{preview.clients.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valid:</span>
                      <span className="font-medium text-green-600">{preview.clients.valid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Errors:</span>
                      <span className="font-medium text-red-600">{preview.clients.errors.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Warnings:</span>
                      <span className="font-medium text-yellow-600">{preview.clients.warnings.length}</span>
                    </div>
                  </div>
                </div>

                {/* Meetings Summary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500" />
                    <h3 className="font-medium text-foreground">Meetings</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total found:</span>
                      <span className="font-medium">{preview.meetings.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valid:</span>
                      <span className="font-medium text-green-600">{preview.meetings.valid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Errors:</span>
                      <span className="font-medium text-red-600">{preview.meetings.errors.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Warnings:</span>
                      <span className="font-medium text-yellow-600">{preview.meetings.warnings.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Import Options */}
              <div className="mt-6 p-4 bg-muted/20 rounded-lg">
                <h4 className="font-medium text-foreground mb-3">Import Options</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={importOptions.skipDuplicates}
                      onChange={(e) => setImportOptions(prev => ({
                        ...prev,
                        skipDuplicates: e.target.checked
                      }))}
                      className="rounded"
                    />
                    <span className="text-sm text-foreground">Skip duplicate records</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={importOptions.updateExisting}
                      onChange={(e) => setImportOptions(prev => ({
                        ...prev,
                        updateExisting: e.target.checked
                      }))}
                      className="rounded"
                    />
                    <span className="text-sm text-foreground">Update existing records</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={handleReset}>
                  Start Over
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={loading || (preview.clients.valid === 0 && preview.meetings.valid === 0)}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Import Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Errors and Warnings */}
          {(preview.clients.errors.length > 0 || preview.meetings.errors.length > 0 ||
            preview.clients.warnings.length > 0 || preview.meetings.warnings.length > 0) && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  Issues Found
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Errors */}
                  {(preview.clients.errors.length > 0 || preview.meetings.errors.length > 0) && (
                    <div>
                      <h4 className="font-medium text-red-600 mb-2 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Errors (must be fixed before import)
                      </h4>
                      <div className="space-y-1">
                        {preview.clients.errors.map((error, index) => (
                          <p key={`client-error-${index}`} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            {error}
                          </p>
                        ))}
                        {preview.meetings.errors.map((error, index) => (
                          <p key={`meeting-error-${index}`} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            {error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {(preview.clients.warnings.length > 0 || preview.meetings.warnings.length > 0) && (
                    <div>
                      <h4 className="font-medium text-yellow-600 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Warnings (will be handled automatically)
                      </h4>
                      <div className="space-y-1">
                        {preview.clients.warnings.map((warning, index) => (
                          <p key={`client-warning-${index}`} className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                            {warning}
                          </p>
                        ))}
                        {preview.meetings.warnings.map((warning, index) => (
                          <p key={`meeting-warning-${index}`} className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                            {warning}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sample Data Preview */}
          {(preview.clients.sample.length > 0 || preview.meetings.sample.length > 0) && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Sample Data Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Sample Clients */}
                  {preview.clients.sample.length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-3">Sample Clients</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Email</th>
                              <th className="text-left p-2">Name</th>
                              <th className="text-left p-2">Business Type</th>
                              <th className="text-left p-2">Pipeline Stage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.clients.sample.map((client, index) => (
                              <tr key={index} className="border-b">
                                <td className="p-2">{client.email}</td>
                                <td className="p-2">{client.name || '-'}</td>
                                <td className="p-2">{client.business_type || '-'}</td>
                                <td className="p-2">{client.pipeline_stage || 'unscheduled'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Sample Meetings */}
                  {preview.meetings.sample.length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-3">Sample Meetings</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Client Email</th>
                              <th className="text-left p-2">Title</th>
                              <th className="text-left p-2">Start Time</th>
                              <th className="text-left p-2">Location</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.meetings.sample.map((meeting, index) => (
                              <tr key={index} className="border-b">
                                <td className="p-2">{meeting.client_email}</td>
                                <td className="p-2">{meeting.title}</td>
                                <td className="p-2">{new Date(meeting.starttime).toLocaleString()}</td>
                                <td className="p-2">{meeting.location_type || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Importing Section */}
      {step === 'importing' && (
        <Card className="border-border/50">
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <h3 className="text-lg font-medium text-foreground">Importing Data...</h3>
              <p className="text-muted-foreground">
                Please wait while we import your clients and meetings. This may take a few moments.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Section */}
      {step === 'complete' && importResults && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Results Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-medium text-foreground flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Clients Results
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Imported:</span>
                      <span className="font-medium text-green-600">{importResults.clients.imported}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Updated:</span>
                      <span className="font-medium text-blue-600">{importResults.clients.updated}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Skipped:</span>
                      <span className="font-medium text-yellow-600">{importResults.clients.skipped}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Errors:</span>
                      <span className="font-medium text-red-600">{importResults.clients.errors.length}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium text-foreground flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500" />
                    Meetings Results
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Imported:</span>
                      <span className="font-medium text-green-600">{importResults.meetings.imported}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Updated:</span>
                      <span className="font-medium text-blue-600">{importResults.meetings.updated}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Skipped:</span>
                      <span className="font-medium text-yellow-600">{importResults.meetings.skipped}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Errors:</span>
                      <span className="font-medium text-red-600">{importResults.meetings.errors.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Summary */}
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">Import Summary</h4>
                <p className="text-green-700">
                  Successfully processed {importResults.summary.totalProcessed} records,
                  imported {importResults.summary.totalImported} items
                  {importResults.summary.totalErrors > 0 &&
                    ` with ${importResults.summary.totalErrors} errors`
                  }.
                </p>
              </div>

              {/* Errors */}
              {(importResults.clients.errors.length > 0 || importResults.meetings.errors.length > 0) && (
                <div>
                  <h4 className="font-medium text-red-600 mb-3 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Import Errors
                  </h4>
                  <div className="space-y-1">
                    {importResults.clients.errors.map((error, index) => (
                      <p key={`client-error-${index}`} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {error}
                      </p>
                    ))}
                    {importResults.meetings.errors.map((error, index) => (
                      <p key={`meeting-error-${index}`} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset}>
                  Import Another File
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Refresh Application
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DataImport;
