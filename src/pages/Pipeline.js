import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import {
  User,
  Search,
  Edit3,
  X,
  Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import CreateClientForm from '../components/CreateClientForm';



export default function Pipeline() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [search, setSearch] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showCreateClientForm, setShowCreateClientForm] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Generate months for tabs (current month + next 11 months)
  const generateMonths = () => {
    const months = [];
    const current = new Date();
    for (let i = 0; i < 12; i++) {
      const month = new Date(current.getFullYear(), current.getMonth() + i, 1);
      months.push(month);
    }
    return months;
  };

  const months = generateMonths();



  const fetchPipelineData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch real client data from API
      const clientsData = await api.request('/clients');

      // Transform client data to pipeline format
      const pipelineData = clientsData.map(client => {
        // Get next meeting date
        const now = new Date();
        const upcomingMeetings = (client.meetings || [])
          .filter(meeting => new Date(meeting.starttime) > now)
          .sort((a, b) => new Date(a.starttime) - new Date(b.starttime));

        const nextMeetingDate = upcomingMeetings.length > 0 ? upcomingMeetings[0].starttime : null;

        // Calculate expected month from likely_close_month
        let expectedMonth = null;
        if (client.likely_close_month) {
          const date = new Date(client.likely_close_month + '-01');
          expectedMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        return {
          id: client.id,
          name: client.name || client.email,
          email: client.email,
          nextMeetingDate: nextMeetingDate,
          pastMeetingCount: client.meeting_count || 0,
          businessStage: client.pipeline_stage || 'Need to Book Meeting',
          pipelineNotes: client.notes || '',
          likelihood: 75, // Default likelihood - could be added to client schema later
          expectedValue: parseFloat(client.total_iaf_expected || client.iaf_expected || client.likely_value || 0),
          expectedMonth: expectedMonth,
          businessType: client.business_type ? client.business_type.charAt(0).toUpperCase() + client.business_type.slice(1) : 'Not Set',
          businessTypes: client.business_types || [], // Array of business types from new table
          businessTypesDisplay: client.business_types && client.business_types.length > 0
            ? client.business_types.join(', ')
            : (client.business_type ? client.business_type.charAt(0).toUpperCase() + client.business_type.slice(1) : 'Not Set'),
          contributionMethods: client.contribution_methods || '',
          totalBusinessAmount: client.total_business_amount || client.business_amount || 0,
          totalIafExpected: client.total_iaf_expected || client.iaf_expected || client.likely_value || 0,
          // Additional fields for pipeline management
          business_amount: client.business_amount,
          regular_contribution_type: client.regular_contribution_type,
          regular_contribution_amount: client.regular_contribution_amount,
          priority_level: client.priority_level || 3,
          last_contact_date: client.last_contact_date,
          next_follow_up_date: client.next_follow_up_date
        };
      });

      setClients(pipelineData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPipelineData();
    }
  }, [isAuthenticated, fetchPipelineData]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No meeting scheduled';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getBusinessTypeColor = (type) => {
    const colors = {
      'Pension': 'bg-blue-100 text-blue-800 border-blue-200',
      'ISA': 'bg-green-100 text-green-800 border-green-200',
      'Bond': 'bg-purple-100 text-purple-800 border-purple-200',
      'Investment': 'bg-orange-100 text-orange-800 border-orange-200',
      'Insurance': 'bg-red-100 text-red-800 border-red-200',
      'Mortgage': 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getLikelihoodColor = (likelihood) => {
    if (likelihood >= 80) return 'text-green-600';
    if (likelihood >= 60) return 'text-yellow-600';
    if (likelihood >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getStageColor = (stage) => {
    const colors = {
      'Client Signed': 'bg-emerald-100 text-emerald-800',
      'Waiting to Sign': 'bg-green-100 text-green-800',
      'Waiting on Paraplanning': 'bg-yellow-100 text-yellow-800',
      'Have Not Written Advice': 'bg-orange-100 text-orange-800',
      'Need to Book Meeting': 'bg-blue-100 text-blue-800',
      "Can't Contact Client": 'bg-red-100 text-red-800',
      // Legacy stages for backward compatibility
      'Initial Consultation': 'bg-blue-100 text-blue-800',
      'Proposal Sent': 'bg-yellow-100 text-yellow-800',
      'Follow-up Required': 'bg-red-100 text-red-800',
      'Ready to Sign': 'bg-green-100 text-green-800',
      'Signed': 'bg-purple-100 text-purple-800'
    };
    return colors[stage] || 'bg-gray-100 text-gray-800';
  };

  // Calculate pipeline summary by stage (memoized to prevent flickering)
  // Currently unused but kept for future analytics features
  // eslint-disable-next-line no-unused-vars
  const pipelineSummary = useMemo(() => {
    const summary = {};
    const stages = [
      'Client Signed',
      'Waiting to Sign',
      'Waiting on Paraplanning',
      'Have Not Written Advice',
      'Need to Book Meeting',
      "Can't Contact Client"
    ];

    // Initialize all stages with 0
    stages.forEach(stage => {
      summary[stage] = { count: 0, total: 0 };
    });

    // Only calculate if we have clients data and it's not loading
    if (clients && clients.length > 0 && !loading) {
      clients.forEach(client => {
        const stage = client.businessStage;
        const value = parseFloat(client.expectedValue) || 0;

        if (summary[stage]) {
          summary[stage].count += 1;
          summary[stage].total += value;
        }
      });
    }

    return summary;
  }, [clients, loading]); // Only recalculate when clients or loading state changes

  const handleClientClick = (client) => {
    setSelectedClient(client);
    setShowDetailPanel(true);
  };

  const handleEditField = (field, value) => {
    setEditingField(field);
    setEditValue(value || '');
  };

  const handleSaveField = () => {
    if (selectedClient && editingField) {
      // Update the client data
      setClients(clients.map(client =>
        client.id === selectedClient.id
          ? { ...client, [editingField]: editValue }
          : client
      ));

      // Update selected client
      setSelectedClient({ ...selectedClient, [editingField]: editValue });
    }
    setEditingField(null);
    setEditValue('');
  };

  const handleCreateClient = async (clientData) => {
    setCreatingClient(true);
    try {
      const response = await api.request('/clients/create', {
        method: 'POST',
        body: JSON.stringify(clientData)
      });

      if (response) {
        // Refresh pipeline data
        await fetchPipelineData();
        setShowCreateClientForm(false);

        // Optionally select the newly created client
        if (response.client) {
          const newClient = clients.find(c => c.id === response.client.id);
          if (newClient) {
            setSelectedClient(newClient);
            setShowDetailPanel(true);
          }
        }
      }
    } catch (error) {
      console.error('Error creating client:', error);
      throw error; // Re-throw to let the form handle the error
    } finally {
      setCreatingClient(false);
    }
  };

  const getCurrentMonthClients = () => {
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    // Show clients that match the selected month OR clients with pipeline data but no expected month
    return clients.filter(client => {
      // If client has an expected month, only show if it matches current month
      if (client.expectedMonth) {
        return client.expectedMonth === monthKey;
      }
      // If client has pipeline stage set (meaning they're in the pipeline), show them in the current month
      if (client.businessStage && client.businessStage !== 'Need to Book Meeting') {
        return true;
      }
      // Otherwise, don't show
      return false;
    });
  };

  const getMonthlyTotal = (month) => {
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const monthClients = clients.filter(client => client.expectedMonth === monthKey);
    return monthClients.reduce((total, client) => total + (client.expectedValue || 0), 0);
  };

  const filteredClients = getCurrentMonthClients().filter(client =>
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.email.toLowerCase().includes(search.toLowerCase()) ||
    client.businessStage.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b border-border/50 p-4 lg:p-6 bg-card/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Client Pipeline</h1>
              <div className="h-4 bg-muted rounded w-64 animate-pulse"></div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
              <div className="h-10 bg-muted rounded w-48 animate-pulse"></div>
            </div>
          </div>

          {/* Loading Monthly Tabs */}
          <div className="mb-6">
            <div className="flex gap-1 overflow-x-auto pb-2">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="flex-shrink-0 h-16 bg-muted rounded min-w-[120px] animate-pulse"></div>
              ))}
            </div>
          </div>

          {/* Loading Search */}
          <div className="h-10 bg-muted rounded animate-pulse"></div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="min-w-[1200px]">
            {/* Loading Table Header */}
            <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/50 px-4 lg:px-6 py-4">
              <div className="grid grid-cols-12 gap-3 lg:gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-4 bg-muted rounded animate-pulse col-span-2"></div>
                ))}
              </div>
            </div>

            {/* Loading Table Body */}
            <div className="px-4 lg:px-6 space-y-4 py-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-3 lg:gap-4 py-4">
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-full animate-pulse flex-shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse"></div>
                      <div className="h-3 bg-muted rounded w-3/4 animate-pulse"></div>
                      <div className="flex gap-1">
                        <div className="h-5 bg-muted rounded w-16 animate-pulse"></div>
                        <div className="h-5 bg-muted rounded w-12 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="col-span-2 flex items-center">
                      <div className="h-4 bg-muted rounded animate-pulse w-full"></div>
                    </div>
                  ))}
                  <div className="col-span-1 flex items-center justify-center">
                    <div className="h-6 w-12 bg-muted rounded-full animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300 min-w-0",
        showDetailPanel ? "mr-0 lg:mr-96" : ""
      )}>
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border/50 p-4 lg:p-6 bg-card/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Client Pipeline</h1>
              <p className="text-sm text-muted-foreground">
                Manage your client pipeline and track business opportunities
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Button
                onClick={() => setShowCreateClientForm(true)}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                Create Client
              </Button>
              <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                Total Pipeline Value: <span className="font-semibold text-foreground">
                  {formatCurrency(clients.reduce((total, client) => total + (client.expectedValue || 0), 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Tabs */}
          <div className="mb-6">
            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
              {months.map((month) => {
                const monthTotal = getMonthlyTotal(month);
                const isActive = month.getMonth() === currentMonth.getMonth() &&
                                month.getFullYear() === currentMonth.getFullYear();

                return (
                  <Button
                    key={month.toISOString()}
                    onClick={() => setCurrentMonth(month)}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    className="flex-shrink-0 flex flex-col items-center gap-1 h-auto py-3 px-4 min-w-[120px]"
                  >
                    <span className="font-medium text-xs">
                      {month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-xs opacity-75 font-semibold">
                      {formatCurrency(monthTotal)}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search clients by name, email, or stage..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Pipeline Table */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[1200px]">
            {/* Table Header */}
            <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/50 px-4 lg:px-6 py-4">
              <div className="grid grid-cols-12 gap-3 lg:gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div className="col-span-3">Client Information</div>
                <div className="col-span-2">Next Meeting</div>
                <div className="col-span-2">Business Stage</div>
                <div className="col-span-2">Pipeline Notes</div>
                <div className="col-span-1">Likelihood</div>
                <div className="col-span-2">IAF Expected</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="px-4 lg:px-6">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => handleClientClick(client)}
                  className="grid grid-cols-12 gap-3 lg:gap-4 py-4 border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-all duration-200 group rounded-lg hover:shadow-sm"
                >
                  {/* Client Information - Enhanced */}
                  <div className="col-span-3 flex items-center gap-3">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                        {client.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-foreground truncate mb-1">
                        {client.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mb-1">
                        {client.email}
                      </div>
                      {/* Business Type Tags */}
                      <div className="flex flex-wrap gap-1">
                        {client.businessTypes && client.businessTypes.length > 0 ? (
                          client.businessTypes.slice(0, 2).map((type, index) => (
                            <Badge key={index} className={cn("text-xs px-2 py-0.5", getBusinessTypeColor(type))}>
                              {type}
                            </Badge>
                          ))
                        ) : (
                          <Badge className={cn("text-xs px-2 py-0.5", getBusinessTypeColor(client.businessType))}>
                            {client.businessType}
                          </Badge>
                        )}
                        {client.businessTypes && client.businessTypes.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{client.businessTypes.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Next Meeting */}
                  <div className="col-span-2 flex items-center gap-2">
                    {/* Meeting Status Indicator */}
                    <div className={cn(
                      "flex-shrink-0 w-2 h-2 rounded-full",
                      client.nextMeetingDate ? "bg-green-500" : "bg-red-500"
                    )}
                    title={client.nextMeetingDate ? "Has upcoming meeting" : "No upcoming meeting"}
                    />
                    <div className="text-sm flex-1">
                      <div className={cn(
                        "font-medium text-xs mb-1 flex items-center gap-1",
                        client.nextMeetingDate ? "text-green-700" : "text-red-700"
                      )}>
                        {client.nextMeetingDate ? (
                          <>
                            <span className="font-semibold">✓</span>
                            {formatDate(client.nextMeetingDate)}
                          </>
                        ) : (
                          <>
                            <span className="font-semibold">✗</span>
                            No meeting scheduled
                          </>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {client.pastMeetingCount} past meeting{client.pastMeetingCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Business Stage */}
                  <div className="col-span-2 flex items-center">
                    <Badge className={cn("text-xs px-2 py-1 font-medium", getStageColor(client.businessStage))}>
                      {client.businessStage}
                    </Badge>
                  </div>

                  {/* Pipeline Notes */}
                  <div className="col-span-2 flex items-center">
                    <div className="text-xs text-muted-foreground truncate max-w-full">
                      {client.pipelineNotes || 'No notes added'}
                    </div>
                  </div>

                  {/* Likelihood */}
                  <div className="col-span-1 flex items-center justify-center">
                    <div className={cn(
                      "text-sm font-bold px-2 py-1 rounded-full bg-opacity-20",
                      getLikelihoodColor(client.likelihood)
                    )}>
                      {client.likelihood}%
                    </div>
                  </div>

                  {/* Expected Value */}
                  <div className="col-span-2 flex items-center">
                    <div className="text-sm font-bold text-foreground">
                      {formatCurrency(client.expectedValue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {filteredClients.length === 0 && (
              <div className="text-center py-16 px-6">
                <div className="bg-muted/30 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                  <User className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  No clients found
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {search
                    ? `No clients match your search "${search}" for ${currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`
                    : `No clients are expected to close in ${currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`
                  }
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {search && (
                    <Button
                      onClick={() => setSearch('')}
                      variant="outline"
                    >
                      Clear Search
                    </Button>
                  )}
                  <Button
                    onClick={() => setShowCreateClientForm(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Client
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Panel - Responsive Sidebar */}
      {showDetailPanel && selectedClient && (
        <>
          {/* Mobile Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setShowDetailPanel(false)}
          />

          {/* Detail Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md lg:w-96 bg-card border-l border-border shadow-xl z-50 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 p-4 lg:p-6 border-b border-border bg-card/95 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Pipeline Details</h2>
                  <p className="text-sm text-muted-foreground">Client information and pipeline status</p>
                </div>
                <Button
                  onClick={() => setShowDetailPanel(false)}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
              <div className="space-y-6">

                {/* Client Info Header */}
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-14 h-14 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                        {selectedClient.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-lg text-foreground truncate">{selectedClient.name}</h3>
                      <p className="text-sm text-muted-foreground truncate mb-2">{selectedClient.email}</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedClient.businessTypes && selectedClient.businessTypes.length > 0 ? (
                          selectedClient.businessTypes.slice(0, 3).map((type, index) => (
                            <Badge key={index} className={cn("text-xs", getBusinessTypeColor(type))}>
                              {type}
                            </Badge>
                          ))
                        ) : (
                          <Badge className={cn("text-xs", getBusinessTypeColor(selectedClient.businessType))}>
                            {selectedClient.businessType}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background border border-border rounded-lg p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Next Meeting</div>
                    <div className="text-sm font-semibold text-foreground">
                      {selectedClient.nextMeetingDate ? formatDate(selectedClient.nextMeetingDate) : 'Not scheduled'}
                    </div>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Past Meetings</div>
                    <div className="text-sm font-semibold text-foreground">
                      {selectedClient.pastMeetingCount} meeting{selectedClient.pastMeetingCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

              {/* Editable Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Business Stage</label>
                  {editingField === 'businessStage' ? (
                    <div className="mt-1 flex gap-2">
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 p-2 border border-border rounded-md text-sm"
                      >
                        <option value="Client Signed">Client Signed</option>
                        <option value="Waiting to Sign">Waiting to Sign</option>
                        <option value="Waiting on Paraplanning">Waiting on Paraplanning</option>
                        <option value="Have Not Written Advice">Have Not Written Advice</option>
                        <option value="Need to Book Meeting">Need to Book Meeting</option>
                        <option value="Can't Contact Client">Can't Contact Client</option>
                        <option value="Signed">Signed</option>
                      </select>
                      <Button onClick={handleSaveField} size="sm">Save</Button>
                      <Button onClick={() => setEditingField(null)} variant="outline" size="sm">Cancel</Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleEditField('businessStage', selectedClient.businessStage)}
                      className="mt-1 p-3 bg-background border border-border rounded-md text-sm cursor-pointer hover:bg-muted/50 flex items-center justify-between group"
                    >
                      <Badge className={getStageColor(selectedClient.businessStage)}>
                        {selectedClient.businessStage}
                      </Badge>
                      <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Pipeline Notes</label>
                  {editingField === 'pipelineNotes' ? (
                    <div className="mt-1 space-y-2">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full p-2 border border-border rounded-md text-sm min-h-[80px]"
                        placeholder="Add pipeline notes..."
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleSaveField} size="sm">Save</Button>
                        <Button onClick={() => setEditingField(null)} variant="outline" size="sm">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleEditField('pipelineNotes', selectedClient.pipelineNotes)}
                      className="mt-1 p-3 bg-background border border-border rounded-md text-sm cursor-pointer hover:bg-muted/50 min-h-[80px] flex items-start justify-between group"
                    >
                      <span className={selectedClient.pipelineNotes ? "text-foreground" : "text-muted-foreground"}>
                        {selectedClient.pipelineNotes || 'Click to add notes...'}
                      </span>
                      <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Likelihood of Sign-up</label>
                  {editingField === 'likelihood' ? (
                    <div className="mt-1 flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1"
                        placeholder="0-100%"
                      />
                      <Button onClick={handleSaveField} size="sm">Save</Button>
                      <Button onClick={() => setEditingField(null)} variant="outline" size="sm">Cancel</Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleEditField('likelihood', selectedClient.likelihood)}
                      className="mt-1 p-3 bg-background border border-border rounded-md text-sm cursor-pointer hover:bg-muted/50 flex items-center justify-between group"
                    >
                      <span className={cn("font-medium", getLikelihoodColor(selectedClient.likelihood))}>
                        {selectedClient.likelihood}%
                      </span>
                      <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">IAF Expected</label>
                  {editingField === 'expectedValue' ? (
                    <div className="mt-1 flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1"
                        placeholder="Enter amount"
                      />
                      <Button onClick={handleSaveField} size="sm">Save</Button>
                      <Button onClick={() => setEditingField(null)} variant="outline" size="sm">Cancel</Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleEditField('expectedValue', selectedClient.expectedValue)}
                      className="mt-1 p-3 bg-background border border-border rounded-md text-sm cursor-pointer hover:bg-muted/50 flex items-center justify-between group"
                    >
                      <span className="font-medium text-foreground">
                        {formatCurrency(selectedClient.expectedValue)}
                      </span>
                      <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Business Types</label>
                  <div className="mt-1 p-3 bg-background border border-border rounded-md text-sm">
                    {selectedClient.businessTypes && selectedClient.businessTypes.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {selectedClient.businessTypes.map((type, index) => (
                            <Badge key={index} className={getBusinessTypeColor(type)}>
                              {type}
                            </Badge>
                          ))}
                        </div>
                        {selectedClient.contributionMethods && (
                          <div className="text-xs text-muted-foreground">
                            Methods: {selectedClient.contributionMethods}
                          </div>
                        )}
                        {selectedClient.totalBusinessAmount > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Total Business Amount: {formatCurrency(selectedClient.totalBusinessAmount)}
                          </div>
                        )}
                        {selectedClient.totalIafExpected > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Total IAF Expected: {formatCurrency(selectedClient.totalIafExpected)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <Badge className={getBusinessTypeColor(selectedClient.businessType)}>
                          {selectedClient.businessType}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>

                {/* Actions */}
                <div className="pt-4 border-t border-border space-y-3">
                  <Button
                    onClick={() => navigate(`/clients/${selectedClient.id}`)}
                    variant="outline"
                    className="w-full"
                  >
                    View Full Client Profile
                  </Button>
                  <Button
                    onClick={() => setShowDetailPanel(false)}
                    variant="ghost"
                    className="w-full lg:hidden"
                  >
                    Close Details
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create Client Form Modal */}
      {showCreateClientForm && (
        <CreateClientForm
          onClose={() => setShowCreateClientForm(false)}
          onSuccess={handleCreateClient}
          isSubmitting={creatingClient}
        />
      )}
    </div>
  );
}
