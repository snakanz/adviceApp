import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { AlertCircle, Loader2, Link2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { supabase } from '../lib/supabaseClient';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

export default function LinkClientDialog({ 
  meeting, 
  open, 
  onOpenChange, 
  onClientLinked 
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [mode, setMode] = useState('select'); // 'select' or 'create'
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');

  // Load existing clients when dialog opens
  useEffect(() => {
    if (open) {
      loadClients();
      setError('');
      setSuccess('');
      setMode('select');
      setSelectedClientId('');
      setNewClientName('');
      setNewClientEmail('');
    }
  }, [open]);

  const loadClients = async () => {
    try {
      setLoadingClients(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_URL}/api/clients`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error('Error loading clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleLinkClient = async () => {
    if (mode === 'select' && !selectedClientId) {
      setError('Please select a client');
      return;
    }

    if (mode === 'create' && (!newClientName || !newClientEmail)) {
      setError('Please enter client name and email');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const payload = mode === 'select' 
        ? { clientId: selectedClientId }
        : { clientEmail: newClientEmail, clientName: newClientName };

      const response = await fetch(
        `${API_URL}/api/calendar/meetings/${meeting.id}/link-client`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to link client');
      }

      const data = await response.json();
      setSuccess(`✅ Successfully linked ${data.linkedCount} meeting(s) to client!`);
      
      setTimeout(() => {
        if (onClientLinked) {
          onClientLinked(data);
        }
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      console.error('Error linking client:', err);
      setError(err.message || 'Failed to link client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Link Client to Meeting
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meeting Info */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm font-medium text-foreground">{meeting?.title}</p>
            <p className="text-xs text-muted-foreground">
              {meeting?.starttime ? new Date(meeting.starttime).toLocaleString() : 'No date'}
            </p>
          </div>

          {/* Mode Selection */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'select' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('select')}
              disabled={loading}
              className="flex-1"
            >
              Select Existing
            </Button>
            <Button
              variant={mode === 'create' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('create')}
              disabled={loading}
              className="flex-1"
            >
              Create New
            </Button>
          </div>

          {/* Select Mode */}
          {mode === 'select' && (
            <div className="space-y-2">
              <Label htmlFor="client-select">Select Client</Label>
              {loadingClients ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : clients.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No clients found. Create a new one instead.
                </p>
              ) : (
                <select
                  id="client-select"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  disabled={loading}
                >
                  <option value="">-- Select a client --</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name || client.email} ({client.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Create Mode */}
          {mode === 'create' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="client-name">Client Name</Label>
                <Input
                  id="client-name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Enter client name"
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="client-email">Client Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="Enter client email"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLinkClient}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Link Client
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

