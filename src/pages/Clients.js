import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
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
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

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

  // Add this function to open the drawer and populate the form
  const openEditDrawer = () => {
    if (!selectedClient) return;
    setEditForm({
      name: selectedClient.name || '',
      email: selectedClient.email || '',
    });
    setDrawerOpen(true);
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
      const res = await fetch(`/clients/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error('Failed to update client');
      setDrawerOpen(false);
      // Refresh clients
      const data = await api.request('/clients');
      setClients(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
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
                        {client.email}
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
                      <span>{selectedClient.email}</span>
                    </div>
                    {selectedClient.meetings && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{selectedClient.meetings.length} meetings</span>
                      </div>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={openEditDrawer}>
                  Edit
                </Button>
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
                  AI Summary
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
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-foreground">AI Summary</h2>
                    <Button
                      onClick={async () => {
                        setLoadingSummary(true);
                        setSummaryError(null);
                        try {
                          const token = localStorage.getItem('token');
                          const res = await fetch(
                            `/api/clients/${encodeURIComponent(selectedClient.email)}/ai-summary`,
                            {
                              method: 'POST',
                              headers: {
                                Authorization: `Bearer ${token}`
                              }
                            }
                          );
                          if (!res.ok) throw new Error('Failed to generate summary');
                          const data = await res.json();
                          setClientAISummary(data.ai_summary);
                        } catch (err) {
                          setSummaryError(err.message);
                        } finally {
                          setLoadingSummary(false);
                        }
                      }}
                      disabled={loadingSummary}
                      className="flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      {loadingSummary ? 'Generating...' : 'Generate AI Summary'}
                    </Button>
                  </div>
                  
                  {summaryError && (
                    <Card className="border-destructive/50">
                      <CardContent className="p-4">
                        <p className="text-destructive">{summaryError}</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  <Card className="border-border/50">
                    <CardContent className="p-6">
                      {clientAISummary ? (
                        <div className="prose prose-invert max-w-none">
                          <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                            {clientAISummary}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-foreground mb-2">No summary yet</h3>
                          <p className="text-muted-foreground">Click "Generate AI Summary" to create one.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {tab === 1 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-foreground">All Meetings</h2>
                  {selectedClient.meetings && selectedClient.meetings.length > 0 ? (
                    <div className="space-y-4">
                      {selectedClient.meetings.map(mtg => (
                        <Card key={mtg.id} className="border-border/50">
                          <CardContent className="p-6">
                            <div className="flex flex-col lg:flex-row gap-6">
                              {/* Meeting Info */}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-foreground mb-2">{mtg.title}</h4>
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
                          Business Expected
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">Coming soon...</p>
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
                        <p className="text-muted-foreground">Coming soon...</p>
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
                        <p className="text-muted-foreground">Coming soon...</p>
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
    </div>
  );
} 