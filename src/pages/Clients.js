import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import ClientChat from '../components/ClientChat';
import { cn } from '../lib/utils';
import {
  Search,
  Calendar,
  TrendingUp,
  Sparkles,
  Clock,
  Mail,
  Users,
  Building2
} from 'lucide-react';
import { api } from '../services/api';
import { Drawer } from '../components/ui/drawer';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [selectedClientIndex, setSelectedClientIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);
  const [clientAISummary, setClientAISummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    business_type: '',
    likely_value: '',
    likely_close_month: ''
  });
  const [saving, setSaving] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Helper function to check if meeting is complete (has all three: transcript, quick summary, email summary)
  const isMeetingComplete = (meeting) => {
    return !!(meeting?.transcript &&
              meeting?.quickSummary &&
              meeting?.emailSummary);
  };

  // Helper function to navigate to meetings page with specific meeting selected
  const navigateToMeeting = (meetingId) => {
    navigate(`/meetings?selected=${meetingId}`);
  };

  useEffect(() => {
    async function fetchClients() {
      setLoading(true);
      try {
        const data = await api.request('/clients');
        setClients(data);
        setSelectedClientIndex(0); // Always select the first client by default
      } catch (err) {
        setError(err.message);
        setClients([]);
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  // Handle URL parameters for client selection and tab switching
  useEffect(() => {
    const clientParam = searchParams.get('client');
    const tabParam = searchParams.get('tab');

    if (clientParam && clients.length > 0) {
      const clientIndex = clients.findIndex(c => c.email === clientParam);
      if (clientIndex !== -1) {
        setSelectedClientIndex(clientIndex);
      }
    }

    if (tabParam) {
      const tabIndex = parseInt(tabParam, 10);
      if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 2) {
        setTab(tabIndex);
      }
    }
  }, [searchParams, clients]);

  const filteredClients = clients
    .filter(c => (`${c.name || c.email || ''}`).toLowerCase().includes(search.toLowerCase())); // Show all clients

  const selectedClient = filteredClients[selectedClientIndex] || filteredClients[0];

  useEffect(() => {
    // When selectedClient changes, update summary
    if (selectedClient && selectedClient.ai_summary) {
      setClientAISummary(selectedClient.ai_summary);
    } else {
      setClientAISummary('');
    }
  }, [selectedClient]);

  const getUserInitials = (name) => {
    if (!name) return 'C';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Add this function to handle form changes
  const handleEditChange = (field, value) => {
    setEditForm(f => ({ ...f, [field]: value }));
  };

  // Add/remove email fields
  // Email management functions (currently unused but kept for future multi-email support)
  // const addEmailField = () => setEditForm(f => ({ ...f, emails: [...(f.emails || ['']), ''] }));
  // const removeEmailField = idx => setEditForm(f => ({ ...f, emails: f.emails.filter((_, i) => i !== idx) }));
  // const handleEmailChange = (idx, value) => setEditForm(f => ({ ...f, emails: f.emails.map((e, i) => i === idx ? value : e) }));

  // Save handler
  const handleSaveClient = async () => {
    console.log('Saving client:', editForm); // Debug log
    setSaving(true);
    try {
      const token = localStorage.getItem('jwt');
      const res = await fetch('https://adviceapp-9rgw.onrender.com/api/clients/upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error('Failed to update client');
      // Refresh clients
      const data = await api.request('/clients');
      setClients(data);
      setSaving(false);
    } catch (err) {
      console.error('Error saving client:', err);
      setSaving(false);
    }
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setEditForm({
      name: client.name || '',
      email: client.email || '',
      business_type: client.business_type || '',
      likely_value: client.likely_value || '',
      likely_close_month: client.likely_close_month || ''
    });
  };

  const handleSaveClientName = async () => {
    if (!editingClient || !editForm.name.trim()) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('jwt');
      const res = await fetch('https://adviceapp-9rgw.onrender.com/api/clients/update-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: editingClient.email,
          name: editForm.name.trim(),
          business_type: editForm.business_type,
          likely_value: editForm.likely_value,
          likely_close_month: editForm.likely_close_month
        })
      });
      
      if (!res.ok) throw new Error('Failed to update client');
      
      // Refresh clients
      const data = await api.request('/clients');
      setClients(data);
      setEditingClient(null);
      setSaving(false);
    } catch (err) {
      console.error('Error updating client:', err);
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingClient(null);
    setEditForm({ name: '', email: '', business_type: '', likely_value: '', likely_close_month: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
          <span className="text-muted-foreground">Loading clients...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="p-6 text-center">
            <div className="text-destructive mb-4">
              <Building2 className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Error Loading Clients</h3>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-background">
      {/* Client List Panel */}
      <div className="w-80 border-r border-border/50 overflow-y-auto bg-card/30">
        <div className="p-6">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="space-y-2">
            {filteredClients.map((client, idx) => (
              <Card
                key={client.email}
                className={cn(
                  "cursor-pointer card-hover border-border/50",
                  idx === selectedClientIndex && "ring-2 ring-primary/20 bg-primary/5 border-primary/30"
                )}
                onClick={() => setSelectedClientIndex(idx)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 bg-primary/10 text-primary">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {getUserInitials(client.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground truncate">
                        {client.name || 'Unnamed Client'}
                      </h4>
                      <p className="text-sm text-muted-foreground truncate">
                        {client.email && client.email.includes('@') ? client.email : 'No email address'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Main Details Area */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedClient ? (
          <>
            {/* Client Header */}
            <div className="border-b border-border/50 p-6 bg-card/50">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 bg-primary/10 text-primary">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                    {getUserInitials(selectedClient.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-foreground mb-1">
                    {selectedClient.name || 'Unnamed Client'}
                  </h1>
                                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        <span>{selectedClient.email && selectedClient.email.includes('@') ? selectedClient.email : 'No email address'}</span>
                      </div>
                    {selectedClient.meetings && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{selectedClient.meetings.length} meetings</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setTab(0)} // Focus the Ask Advicly tab
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Ask Advicly
                  </Button>
                  <Button onClick={() => handleEditClient(selectedClient)}>
                    Edit
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-2 pb-0">
              <div className="flex gap-4 justify-between">
                <button
                  className={cn(
                    "tab-btn",
                    tab === 0 && "active"
                  )}
                  onClick={() => setTab(0)}
                >
                  <Sparkles className="w-4 h-4 inline mr-2" />
                  Ask Advicly
                </button>
                <button
                  className={cn(
                    "tab-btn",
                    tab === 1 && "active"
                  )}
                  onClick={() => setTab(1)}
                >
                  <Calendar className="w-4 h-4 inline mr-2" />
                  All Meetings
                </button>
                <button
                  className={cn(
                    "tab-btn",
                    tab === 2 && "active"
                  )}
                  onClick={() => setTab(2)}
                >
                  <TrendingUp className="w-4 h-4 inline mr-2" />
                  Pipeline
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {tab === 0 && (
                <div className="h-full">
                  <ClientChat
                    clientId={selectedClient?.email}
                    clientName={selectedClient?.name || selectedClient?.email}
                    className="h-full"
                  />
                </div>
              )}

              {tab === 1 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-foreground">All Meetings</h2>
                  {selectedClient.meetings && selectedClient.meetings.length > 0 ? (
                    <div className="space-y-4">
                      {selectedClient.meetings.map(mtg => (
                        <Card
                          key={mtg.id}
                          className="border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => navigateToMeeting(mtg.googleeventid || mtg.id)}
                        >
                          <CardContent className="p-6">
                            <div className="flex flex-col lg:flex-row gap-6">
                              {/* Meeting Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {/* Completion indicator - light blue dot */}
                                  {isMeetingComplete(mtg) && (
                                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                  )}
                                  <h4 className="font-semibold text-foreground">{mtg.title}</h4>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>
                                      {new Date(mtg.starttime).toLocaleDateString()} - {new Date(mtg.starttime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to {new Date(mtg.endtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {/* Meeting Summary */}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-foreground whitespace-pre-line">
                                  {mtg.summary || 'No summary available.'}
                                </div>
                                {mtg.quickSummary && (
                                  <div className="text-xs text-muted-foreground mt-2 italic">
                                    Quick Summary: {mtg.quickSummary.substring(0, 100)}...
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="border-border/50">
                      <CardContent className="p-6 text-center">
                        <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">No meetings found</h3>
                        <p className="text-muted-foreground">This client doesn't have any meetings yet.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {tab === 2 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-foreground">Client Pipeline</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <TrendingUp className="w-5 h-5 text-primary" />
                          Business Type
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedClient.business_type ? (
                          <p className="text-2xl font-bold text-foreground">{selectedClient.business_type}</p>
                        ) : (
                          <p className="text-muted-foreground">Not specified</p>
                        )}
                      </CardContent>
                    </Card>
                    
                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Building2 className="w-5 h-5 text-primary" />
                          Value of Business
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedClient.likely_value ? (
                          <p className="text-2xl font-bold text-foreground">£{parseFloat(selectedClient.likely_value).toLocaleString()}</p>
                        ) : (
                          <p className="text-muted-foreground">Not specified</p>
                        )}
                      </CardContent>
                    </Card>
                    
                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Calendar className="w-5 h-5 text-primary" />
                          Expected Close Month
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedClient.likely_close_month ? (
                          <p className="text-2xl font-bold text-foreground">
                            {new Date(selectedClient.likely_close_month + '-01').toLocaleDateString('en-GB', { 
                              month: 'long', 
                              year: 'numeric' 
                            })}
                          </p>
                        ) : (
                          <p className="text-muted-foreground">Not specified</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No client selected</h3>
              <p className="text-muted-foreground">Select a client from the list to view details.</p>
            </div>
          </div>
        )}
      </div>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Edit Client Details">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSaveClient(); }}>
          <div>
            <label className="block text-sm font-medium mb-1">Client Name</label>
            <Input
              value={editForm.name || ''}
              onChange={e => handleEditChange('name', e.target.value)}
              placeholder="Enter client name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <Input
              value={editForm.email || ''}
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Business Type</label>
            <Input
              value={editForm.business_type || ''}
              onChange={e => handleEditChange('business_type', e.target.value)}
              placeholder="Enter business type"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Likely Value</label>
            <Input
              value={editForm.likely_value || ''}
              onChange={e => handleEditChange('likely_value', e.target.value)}
              placeholder="Enter likely value"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Likely Close Month</label>
            <Input
              value={editForm.likely_close_month || ''}
              onChange={e => handleEditChange('likely_close_month', e.target.value)}
              placeholder="Enter likely close month"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)} className="w-full">
              Cancel
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Client Name</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Client Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  placeholder="Enter client name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  disabled
                  className="w-full p-2 border border-border rounded-md bg-muted text-muted-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Business Type</label>
                <select
                  value={editForm.business_type}
                  onChange={(e) => setEditForm({ ...editForm, business_type: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="">Select business type</option>
                  <option value="Pension">Pension</option>
                  <option value="ISA">ISA</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Likely Value (£)</label>
                <input
                  type="number"
                  value={editForm.likely_value}
                  onChange={(e) => setEditForm({ ...editForm, likely_value: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  placeholder="Enter value in pounds"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Likely Close Month</label>
                <input
                  type="month"
                  value={editForm.likely_close_month}
                  onChange={(e) => setEditForm({ ...editForm, likely_close_month: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button onClick={handleSaveClientName} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 