import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

/**
 * NewChatModal
 *
 * Lightweight modal for starting a new Ask Advicly chat.
 * - Choose existing client, new client, or all-clients (general) scope
 * - Optionally create a minimal client record for new clients
 * - Optionally upload documents tied to that client/meeting using existing upload API
 */
export default function NewChatModal({ open, onOpenChange, onThreadCreated }) {
  const [clients, setClients] = useState([]);
  const [mode, setMode] = useState('existing'); // 'existing' | 'new' | 'general'
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    const loadClients = async () => {
      try {
        const data = await api.request('/clients');
        setClients(data || []);
      } catch (err) {
        console.error('Error loading clients for NewChatModal:', err);
      }
    };

    loadClients();
  }, [open]);

  const resetState = () => {
    setMode('existing');
    setSelectedClientId('');
    setNewClientName('');
    setNewClientEmail('');
    setNewClientNotes('');
    setFiles([]);
    setError('');
  };

  const handleClose = () => {
    if (loading) return;
    resetState();
    onOpenChange(false);
  };

  const handleFileChange = (event) => {
    const fileList = Array.from(event.target.files || []);
    setFiles(fileList);
  };

  const createMinimalClient = async () => {
    const response = await api.request('/clients/create-minimal', {
      method: 'POST',
      body: JSON.stringify({
        name: newClientName || undefined,
        email: newClientEmail || undefined,
        notes: newClientNotes || undefined,
      }),
    });
    return response.client;
  };

  const uploadDocuments = async (clientId) => {
    if (!files.length) return;

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('clientId', clientId);

    await api.request('/client-documents/upload', {
      method: 'POST',
      body: formData,
      isFormData: true,
    });
  };

  const createThread = async (clientId, scope) => {
    const contextType = scope === 'general' ? 'general' : 'client';
    const contextData =
      scope === 'general'
        ? { scope: 'all_clients' }
        : { clientId, clientName: clients.find((c) => c.id === clientId)?.name };

    const thread = await api.request('/ask-advicly/threads', {
      method: 'POST',
      body: JSON.stringify({
        clientId: scope === 'general' ? null : clientId,
        title:
          scope === 'general'
            ? 'All clients – general advisory'
            : contextData.clientName
            ? `${contextData.clientName} - Client Discussion`
            : 'Client Discussion',
        contextType,
        contextData,
      }),
    });

    return thread;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    try {
      setLoading(true);
      setError('');

      let clientId = null;
      let scope = mode;

      if (mode === 'existing') {
        if (!selectedClientId) {
          setError('Please select a client');
          setLoading(false);
          return;
        }
        clientId = selectedClientId;
        scope = 'client';
      } else if (mode === 'new') {
        if (!newClientName && !newClientEmail) {
          setError('Please provide at least a name or email for the new client');
          setLoading(false);
          return;
        }
        const client = await createMinimalClient();
        clientId = client.id;
        scope = 'client';
      } else if (mode === 'general') {
        scope = 'general';
      }

      if (clientId) {
        await uploadDocuments(clientId);
      }

      const thread = await createThread(clientId, scope);

      if (onThreadCreated && thread) {
        onThreadCreated(thread);
      }

      handleClose();
    } catch (err) {
      console.error('Error creating new chat:', err);
      setError('Failed to create new chat. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Ask Advicly chat</DialogTitle>
          <DialogDescription>
            Choose whether this conversation is about a specific client or your whole client base.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="flex gap-2 text-xs">
            <Button
              type="button"
              variant={mode === 'existing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('existing')}
            >
              Existing client
            </Button>
            <Button
              type="button"
              variant={mode === 'new' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('new')}
            >
              New client
            </Button>
            <Button
              type="button"
              variant={mode === 'general' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('general')}
              className="text-amber-700 border-amber-300"
            >
              All clients (orange thread)
            </Button>
          </div>

          {mode === 'existing' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Select client</label>
              <select
                className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                <option value="">Choose a client…</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name || client.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'new' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Client name</label>
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. John Smith"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Email (optional)</label>
                <Input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="e.g. john@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
                <Textarea
                  value={newClientNotes}
                  onChange={(e) => setNewClientNotes(e.target.value)}
                  placeholder="Anything that helps Advicly understand this client"
                  rows={3}
                />
              </div>
            </div>
          )}

          {mode !== 'general' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Upload documents for this client (PDFs, statements, fact finds)
              </label>
              <Input type="file" multiple onChange={handleFileChange} className="text-sm" />
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Creating…' : 'Create chat'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

