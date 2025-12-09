import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  User,
  Search,
  Edit3,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import CreateClientForm from '../components/CreateClientForm';
import BusinessTypeManager from '../components/BusinessTypeManager';

// Stage options for business types - dark theme compatible colors
const STAGE_OPTIONS = [
  { value: 'Not Written', label: 'Not Written', color: 'bg-gray-500/20 text-gray-300' },
  { value: 'In Progress', label: 'In Progress', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'Waiting to Sign', label: 'Waiting to Sign', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'Completed', label: 'Completed', color: 'bg-green-500/20 text-green-400' }
];



export default function Pipeline() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [search, setSearch] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateClientForm, setShowCreateClientForm] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [showOverdueSection, setShowOverdueSection] = useState(false); // Collapsible state for overdue section - DEFAULT COLLAPSED
  const [showEditPipelineModal, setShowEditPipelineModal] = useState(false); // Edit pipeline modal state
  const [clientBusinessTypes, setClientBusinessTypes] = useState([]); // Business types for editing
  const [savingBusinessTypes, setSavingBusinessTypes] = useState(false); // Saving state for business types
  const [generatingPipelineSummary, setGeneratingPipelineSummary] = useState(false); // AI summary generation state
  const [nextStepsSummary, setNextStepsSummary] = useState(null); // AI-generated next steps summary
  const [editingNotes, setEditingNotes] = useState(false); // Notes editing state
  const [pipelineNotes, setPipelineNotes] = useState(''); // Notes text
  const [savingNotes, setSavingNotes] = useState(false); // Saving notes state

  const { isAuthenticated} = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const businessTypeFilter = searchParams.get('businessType') || '';

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
      // Create separate rows for each business type
      const pipelineData = clientsData.flatMap(client => {
        // Get next meeting date (excluding annual review meetings)
        const now = new Date();
        const upcomingMeetings = (client.meetings || [])
          .filter(meeting => {
            // Exclude annual review meetings from pipeline view
            if (meeting.is_annual_review) return false;
            return new Date(meeting.starttime) > now;
          })
          .sort((a, b) => new Date(a.starttime) - new Date(b.starttime));

        const nextMeetingDate = upcomingMeetings.length > 0 ? upcomingMeetings[0].starttime : null;

        const businessTypesData = client.business_types_data || [];

        // Create separate rows for each business type
        if (businessTypesData.length > 0) {
          return businessTypesData.map((bt, btIndex) => {
            let expectedMonth = null;
            if (bt.expected_close_date) {
              const closeDate = new Date(bt.expected_close_date);
              expectedMonth = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(2, '0')}`;
            }

            return {
              id: `${client.id}-bt-${btIndex}`,
              clientId: client.id,
              businessTypeId: bt.id, // ID for updating the stage
              name: client.name || client.email,
              email: client.email,
              businessType: bt.business_type,
              stage: bt.stage || 'Not Written',
              expectedFees: parseFloat(bt.iaf_expected || 0),
              investmentAmount: parseFloat(bt.business_amount || 0),
              expectedCloseDate: bt.expected_close_date,
              expectedMonth: expectedMonth,
              nextMeetingDate: nextMeetingDate,
              pastMeetingCount: client.meeting_count || 0,
              fullClient: client,
              businessTypesData: [bt], // Single business type for this row
              allBusinessTypes: businessTypesData, // All business types for display
              priority_level: client.priority_level || 3,
              last_contact_date: client.last_contact_date,
              next_follow_up_date: client.next_follow_up_date,
              pipeline_next_steps: client.pipeline_next_steps || null,
              pipeline_next_steps_generated_at: client.pipeline_next_steps_generated_at || null,
              pipelineNotes: client.notes || bt.notes || null
            };
          });
        }

        // Fallback for clients with no business types
        return [{
          id: client.id,
          clientId: client.id,
          businessTypeId: null,
          name: client.name || client.email,
          email: client.email,
          businessType: 'Not Set',
          stage: 'Not Written',
          expectedFees: 0,
          investmentAmount: 0,
          expectedCloseDate: null,
          expectedMonth: null,
          nextMeetingDate: nextMeetingDate,
          pastMeetingCount: client.meeting_count || 0,
          fullClient: client,
          businessTypesData: [],
          allBusinessTypes: [],
          priority_level: client.priority_level || 3,
          last_contact_date: client.last_contact_date,
          next_follow_up_date: client.next_follow_up_date,
          pipeline_next_steps: client.pipeline_next_steps || null,
          pipeline_next_steps_generated_at: client.pipeline_next_steps_generated_at || null,
          pipelineNotes: client.notes || null
        }];
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

  // Refresh when page becomes visible (user switches back to tab)
  // Removed 30-second polling - relying on webhooks for real-time updates
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('📱 Page visible - refreshing pipeline...');
        fetchPipelineData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchPipelineData]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No meeting scheduled';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
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

  // Helper function to get initials from name or email
  const getInitials = (name, email) => {
    const displayName = name || email;
    if (!displayName) return '?';
    return displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  const handleClientClick = async (client) => {
    // Normalize client data for the detail panel
    // The client object comes from pipeline row data which already has nextMeetingDate and pastMeetingCount
    const normalizedClient = {
      ...client,
      // Map business_types to businessTypes for consistency
      businessTypes: client.business_types || client.allBusinessTypes || [],
      businessTypesData: client.business_types_data || client.businessTypesData || [],
      totalBusinessAmount: client.business_amount || client.investmentAmount || 0,
      totalIafExpected: client.iaf_expected || client.expectedFees || 0,
      expectedValue: client.iaf_expected || client.expectedFees || client.expectedValue || 0,
      pipelineNotes: client.notes || client.pipelineNotes || null,
      // Preserve meeting stats from pipeline row data
      nextMeetingDate: client.nextMeetingDate || null,
      pastMeetingCount: typeof client.pastMeetingCount === 'number' ? client.pastMeetingCount : (client.meeting_count || 0),
      // Include stage info from the business types - use allBusinessTypes which contains the full list with IDs
      allBusinessTypesWithStage: (client.allBusinessTypes || client.business_types_data || client.businessTypesData || []).map(bt => ({
        ...bt,
        id: bt.id, // Ensure id is explicitly preserved for stage updates
        stage: bt.stage || 'Not Written'
      }))
    };

    setSelectedClient(normalizedClient);
    setShowDetailPanel(true);
    setEditingNotes(false); // Reset notes editing state
    setNextStepsSummary(null); // Reset summary when switching clients

    // Auto-generate pipeline summary if not already generated or if stale (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const summaryDate = client.pipeline_next_steps_generated_at ? new Date(client.pipeline_next_steps_generated_at) : null;

    if (client.pipeline_next_steps && summaryDate && summaryDate > oneHourAgo) {
      // Use cached summary if fresh
      setNextStepsSummary(client.pipeline_next_steps);
    } else {
      // Generate new summary
      await handleGeneratePipelineSummary(client.id);
    }
  };

  const handleGeneratePipelineSummary = async (clientId) => {
    setGeneratingPipelineSummary(true);
    try {
      const response = await api.request(`/clients/${clientId}/generate-pipeline-summary`, {
        method: 'POST'
      });

      if (response.summary) {
        setNextStepsSummary(response.summary);

        // Update the client in the list with the new summary
        setClients(prev => prev.map(c =>
          c.id === clientId ? { ...c, pipeline_next_steps: response.summary, pipeline_next_steps_generated_at: response.generated_at } : c
        ));

        // Update selected client if it's the same one
        if (selectedClient && selectedClient.id === clientId) {
          setSelectedClient(prev => ({ ...prev, pipeline_next_steps: response.summary, pipeline_next_steps_generated_at: response.generated_at }));
        }
      }
    } catch (error) {
      console.error('Error generating pipeline summary:', error);
      setNextStepsSummary('Unable to generate summary at this time.');
    } finally {
      setGeneratingPipelineSummary(false);
    }
  };

  // Save pipeline notes
  const handleSaveNotes = async () => {
    if (!selectedClient) return;

    setSavingNotes(true);
    try {
      await api.request(`/clients/${selectedClient.id}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: pipelineNotes })
      });

      // Update selected client with new notes
      setSelectedClient(prev => ({ ...prev, pipelineNotes: pipelineNotes }));

      // Update clients list
      setClients(prev => prev.map(c =>
        c.id === selectedClient.id ? { ...c, pipelineNotes: pipelineNotes } : c
      ));

      setEditingNotes(false);
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setSavingNotes(false);
    }
  };

  // Start editing notes
  const handleStartEditNotes = () => {
    setPipelineNotes(selectedClient?.pipelineNotes || '');
    setEditingNotes(true);
  };

  // Update business type stage
  const handleStageChange = async (businessTypeId, newStage, e) => {
    if (e) {
      e.stopPropagation(); // Prevent row click
    }
    if (!businessTypeId) return;

    try {
      await api.request(`/clients/business-types/${businessTypeId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: newStage })
      });

      // Update clients list
      setClients(prev => prev.map(c =>
        c.businessTypeId === businessTypeId ? { ...c, stage: newStage } : c
      ));

      // Update selected client if applicable - also update allBusinessTypesWithStage
      if (selectedClient) {
        setSelectedClient(prev => ({
          ...prev,
          stage: prev.businessTypeId === businessTypeId ? newStage : prev.stage,
          allBusinessTypesWithStage: (prev.allBusinessTypesWithStage || []).map(bt =>
            bt.id === businessTypeId ? { ...bt, stage: newStage } : bt
          )
        }));
      }
    } catch (error) {
      console.error('Error updating stage:', error);
    }
  };

  const handleEditPipeline = async () => {
    if (!selectedClient) return;

    try {
      // Fetch business types for the selected client
      const businessTypes = await api.request(`/clients/${selectedClient.id}/business-types`);
      setClientBusinessTypes(businessTypes || []);
      setShowEditPipelineModal(true);
      // FIX ISSUE 3: Hide the detail panel when opening the modal to prevent old "Add Pipeline" screen appearing behind
      setShowDetailPanel(false);
    } catch (error) {
      console.error('Error loading business types:', error);
      // Show modal anyway with empty business types
      setClientBusinessTypes([]);
      setShowEditPipelineModal(true);
      // FIX ISSUE 3: Hide the detail panel even on error
      setShowDetailPanel(false);
    }
  };

  const handleSaveBusinessTypes = async (businessTypes) => {
    if (!selectedClient) return;

    setSavingBusinessTypes(true);
    try {
      // Save business types via API
      await api.request(`/clients/${selectedClient.id}/business-types`, {
        method: 'PUT',
        body: JSON.stringify({ businessTypes })
      });

      // FIX ISSUE 1 & 2: Refresh pipeline data to show updated information with correct month and amounts
      await fetchPipelineData();

      // Close modal
      setShowEditPipelineModal(false);
      setClientBusinessTypes([]);

      // FIX ISSUE 1 & 2: Update selected client with fresh data from the refreshed clients list
      // This ensures the detail panel shows updated business amounts and expected close dates
      const updatedClientData = await api.request(`/clients/${selectedClient.id}`);
      if (updatedClientData) {
        // Transform to match pipeline format
        const businessTypesData = updatedClientData.business_types_data || [];
        const businessTypeDates = businessTypesData
          .filter(bt => bt.expected_close_date)
          .map(bt => new Date(bt.expected_close_date))
          .sort((a, b) => a - b);

        let expectedMonth = null;
        if (businessTypeDates.length > 0) {
          const earliestDate = businessTypeDates[0];
          expectedMonth = `${earliestDate.getFullYear()}-${String(earliestDate.getMonth() + 1).padStart(2, '0')}`;
        } else if (updatedClientData.likely_close_month) {
          const dateStr = updatedClientData.likely_close_month.includes('-') && updatedClientData.likely_close_month.split('-').length === 3
            ? updatedClientData.likely_close_month
            : `${updatedClientData.likely_close_month}-01`;
          const date = new Date(dateStr);
          expectedMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        setSelectedClient({
          ...selectedClient,
          businessTypes: updatedClientData.business_types || [],
          businessTypesData: businessTypesData,
          totalBusinessAmount: parseFloat(updatedClientData.business_amount || 0),
          totalIafExpected: parseFloat(updatedClientData.iaf_expected || updatedClientData.likely_value || 0),
          expectedValue: parseFloat(updatedClientData.iaf_expected || updatedClientData.likely_value || 0),
          expectedMonth: expectedMonth,
          contributionMethods: updatedClientData.contribution_methods || ''
        });
      }

      // Regenerate pipeline summary after update
      if (selectedClient) {
        await handleGeneratePipelineSummary(selectedClient.id);
      }
    } catch (error) {
      console.error('Error saving business types:', error);
      alert('Failed to save business types. Please try again.');
    } finally {
      setSavingBusinessTypes(false);
    }
  };

  const handleCancelBusinessTypes = () => {
    setShowEditPipelineModal(false);
    setClientBusinessTypes([]);
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

  // Get clients with overdue or no expected close date
  const getOverdueOrNoDateClients = () => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return clients.filter(client => {
      // FIX ISSUE 1: Show clients with business types even if no pipeline stage is set
      // Only skip clients that have NO business types AND no pipeline stage
      const hasBusinessTypes = client.businessTypes && client.businessTypes.length > 0;
      if (!hasBusinessTypes && (!client.businessStage || client.businessStage === 'Need to Book Meeting')) {
        return false;
      }

      // No expected month at all
      if (!client.expectedMonth) {
        return true;
      }

      // Expected month is before current month (overdue)
      if (client.expectedMonth < currentMonthKey) {
        return true;
      }

      return false;
    });
  };

  const getCurrentMonthClients = () => {
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Show clients that match the selected month
    return clients.filter(client => {
      // Skip clients with no expected month (they go in overdue section)
      if (!client.expectedMonth) {
        return false;
      }

      // Skip overdue clients (they go in overdue section) - only if before current month
      if (client.expectedMonth < currentMonthKey) {
        return false;
      }

      // Show clients that match the selected month
      return client.expectedMonth === monthKey;
    });
  };

  const getMonthlyTotal = (month) => {
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const monthClients = clients.filter(client => client.expectedMonth === monthKey);
    return monthClients.reduce((total, client) => total + (client.expectedFees || 0), 0);
  };

  const filteredClients = getCurrentMonthClients().filter(client => {
    // First apply search filter
    const matchesSearch =
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      client.email.toLowerCase().includes(search.toLowerCase()) ||
      client.businessType.toLowerCase().includes(search.toLowerCase());

    // Then apply business type filter from URL if present
    const matchesBusinessType = !businessTypeFilter ||
      client.businessType.toLowerCase() === businessTypeFilter.toLowerCase();

    return matchesSearch && matchesBusinessType;
  });

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
                  {formatCurrency(clients.reduce((total, client) => total + (client.expectedFees || 0), 0))}
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

          {/* Overdue/No Date Section - Moved Below Monthly Tabs */}
          {(() => {
            const overdueClients = getOverdueOrNoDateClients();
            if (overdueClients.length === 0) return null;

            const totalValue = overdueClients.reduce((total, client) => total + (client.expectedFees || 0), 0);

            return (
              <div className="mb-6">
                {/* Compact Header Bar */}
                <div
                  className="group bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-l-4 border-amber-500 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setShowOverdueSection(!showOverdueSection)}
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    {/* Left: Icon + Title + Count */}
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-foreground">Needs Attention</h3>
                          <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs px-2 py-0">
                            {overdueClients.length}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Overdue or missing expected close date
                        </p>
                      </div>
                    </div>

                    {/* Right: Value + Expand Icon */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground mb-0.5">Total Value</div>
                        <div className="text-sm font-bold text-amber-700 dark:text-amber-400">
                          {formatCurrency(totalValue)}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {showOverdueSection ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Client List */}
                {showOverdueSection && (
                  <div className="mt-3 space-y-2 max-h-[40vh] lg:max-h-96 overflow-y-auto overflow-x-hidden">
                    {overdueClients.map((client) => (
                      <div
                        key={client.id}
                        onClick={() => handleClientClick(client)}
                        className="group bg-card hover:bg-accent/50 border border-border rounded-lg p-3 cursor-pointer transition-all hover:shadow-sm"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                          {/* Left: Avatar + Client Info */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Avatar className="w-9 h-9 flex-shrink-0 ring-2 ring-background">
                              <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                                {client.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {client.name}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {client.email}
                              </div>
                            </div>
                          </div>

                          {/* Right: Stage + Date + Value */}
                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
                            <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
                              {client.businessStage}
                            </Badge>
                            <div className="text-right min-w-[90px] sm:min-w-[100px]">
                              {client.expectedMonth ? (
                                <>
                                  <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                    Overdue
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(client.expectedMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-muted-foreground italic">
                                  No date set
                                </div>
                              )}
                            </div>
                            <div className="text-sm font-semibold text-foreground min-w-[90px] sm:min-w-[100px] text-right">
                              {/* FIX ISSUE 2: Show Total Business Amount in overdue section */}
                              {client.totalBusinessAmount > 0 && (
                                <div className="text-sm font-bold">
                                  {formatCurrency(client.totalBusinessAmount)}
                                </div>
                              )}
                              <div className={cn(
                                client.totalBusinessAmount > 0 ? "text-xs text-muted-foreground" : "text-sm font-bold"
                              )}>
                                {formatCurrency(client.expectedValue || 0)}
                                {client.totalBusinessAmount > 0 && <span className="ml-1">IAF</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

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
            {/* Business Type Filter Badge */}
            {businessTypeFilter && (
              <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-2 rounded-lg">
                <span className="text-sm font-medium">
                  Filtered by: {businessTypeFilter}
                </span>
                <button
                  onClick={() => setSearchParams({})}
                  className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                  title="Clear filter"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Table */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[1200px]">
            {/* Table Header */}
            <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/50 px-4 lg:px-6 py-4">
              <div className="grid grid-cols-12 gap-3 lg:gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div className="col-span-3">Client & Business Type</div>
                <div className="col-span-2">Stage</div>
                <div className="col-span-2">Next Meeting</div>
                <div className="col-span-1">Expected Fees</div>
                <div className="col-span-2">Investment</div>
                <div className="col-span-2">AI Next Steps</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="px-4 lg:px-6">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => handleClientClick({ ...client.fullClient, ...client, fullClient: client.fullClient })}
                  className="grid grid-cols-12 gap-3 lg:gap-4 py-4 border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-all duration-200 group rounded-lg hover:shadow-sm"
                >
                  {/* Client Information & Business Type */}
                  <div className="col-span-3 flex items-center gap-3">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                        {getInitials(client.name, client.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-foreground truncate mb-1">
                        {client.name || client.email}
                      </div>
                      {/* Business Type Badges - Show all business types */}
                      <div className="flex flex-wrap gap-1">
                        {client.allBusinessTypes && client.allBusinessTypes.length > 0 ? (
                          client.allBusinessTypes.map((bt, index) => (
                            <Badge key={index} className={cn("text-xs px-2 py-0.5", getBusinessTypeColor(bt.business_type))}>
                              {bt.business_type}
                            </Badge>
                          ))
                        ) : (
                          <Badge className={cn("text-xs px-2 py-0.5", getBusinessTypeColor(client.businessType))}>
                            {client.businessType}
                          </Badge>
                        )}
                        {client.expectedCloseDate && (
                          <span className="text-xs text-muted-foreground ml-1">
                            Close: {formatDate(client.expectedCloseDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stage Dropdown */}
                  <div className="col-span-2 flex items-center" onClick={(e) => e.stopPropagation()}>
                    {client.businessTypeId ? (
                      <Select
                        value={client.stage || 'Not Written'}
                        onValueChange={(value) => handleStageChange(client.businessTypeId, value)}
                      >
                        <SelectTrigger className="h-8 text-xs w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className={cn("px-2 py-0.5 rounded text-xs", option.color)}>
                                {option.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
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

                  {/* Expected Fees */}
                  <div className="col-span-1 flex items-center">
                    <div className="text-sm font-semibold text-foreground">
                      {formatCurrency(client.expectedFees)}
                    </div>
                  </div>

                  {/* Investment Amount */}
                  <div className="col-span-2 flex items-center">
                    <div className="text-sm font-semibold text-foreground">
                      {client.investmentAmount > 0 ? formatCurrency(client.investmentAmount) : '-'}
                    </div>
                  </div>

                  {/* AI Next Steps Summary (List View) */}
                  <div className="col-span-2">
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Next Steps to Close
                      </label>
                      <div className="text-[11px] text-foreground/90 bg-muted/40 border border-border/60 rounded-md px-2 py-1.5 max-h-16 overflow-hidden">
                        {client.pipeline_next_steps ? (
                          <span className="line-clamp-3">
                            {client.pipeline_next_steps}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground">No AI summary yet – open this client to generate next steps.</span>
                        )}
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
              <div className="flex items-center justify-between mb-4">
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
              {/* Edit Pipeline Button */}
              <Button
                onClick={handleEditPipeline}
                className="w-full flex items-center justify-center gap-2"
                size="sm"
              >
                <Edit3 className="w-4 h-4" />
                Edit Pipeline
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
              <div className="space-y-6">

                {/* Client Info Header */}
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-14 h-14 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                        {getInitials(selectedClient.name, selectedClient.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3
                        className="font-bold text-lg text-foreground truncate hover:text-primary cursor-pointer transition-colors underline decoration-transparent hover:decoration-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/clients?clientId=${selectedClient.id}`);
                        }}
                        title="View client details"
                      >
                        {selectedClient.name || selectedClient.email}
                      </h3>
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

                {/* AI-Generated Next Steps to Close */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                        Next Steps to Close
                        {generatingPipelineSummary && (
                          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        )}
                      </h4>
                      {generatingPipelineSummary ? (
                        <div className="space-y-2">
                          <div className="h-3 bg-blue-200/50 dark:bg-blue-800/30 rounded animate-pulse" />
                          <div className="h-3 bg-blue-200/50 dark:bg-blue-800/30 rounded animate-pulse w-5/6" />
                          <div className="h-3 bg-blue-200/50 dark:bg-blue-800/30 rounded animate-pulse w-4/6" />
                        </div>
                      ) : nextStepsSummary ? (
                        <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                          {nextStepsSummary}
                        </p>
                      ) : (
                        <p className="text-sm text-blue-700 dark:text-blue-300 italic">
                          Generating next steps...
                        </p>
                      )}
                      {!generatingPipelineSummary && nextStepsSummary && (
                        <button
                          onClick={() => handleGeneratePipelineSummary(selectedClient.id)}
                          className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          Regenerate
                        </button>
                      )}
                    </div>
                  </div>
                </div>

              {/* Pipeline Financials & Notes (Read Only) */}
              <div className="space-y-4">
                {/* Expected Fees (replaces IAF Expected) */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expected Fees</label>
                  <div className="mt-2 p-3 bg-muted/30 border border-border rounded-lg">
                    <span className="text-lg font-bold text-foreground">
                      {formatCurrency(selectedClient.expectedValue)}
                    </span>
                  </div>
                </div>

                {/* Pipeline Notes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline Notes</label>
                    {!editingNotes && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStartEditNotes}
                        className="h-6 px-2 text-xs"
                      >
                        <Edit3 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                  {editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={pipelineNotes}
                        onChange={(e) => setPipelineNotes(e.target.value)}
                        className="w-full p-3 bg-background border border-border rounded-lg min-h-[100px] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Add notes about this pipeline opportunity..."
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingNotes(false)}
                          disabled={savingNotes}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveNotes}
                          disabled={savingNotes}
                        >
                          {savingNotes ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/30 border border-border rounded-lg min-h-[80px]">
                      <p className={cn("text-sm whitespace-pre-wrap", selectedClient.pipelineNotes ? "text-foreground" : "text-muted-foreground italic")}>
                        {selectedClient.pipelineNotes || 'No notes added yet. Click Edit to add notes.'}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Business Types & Stages</label>
                  <div className="mt-1 p-3 bg-background border border-border rounded-md text-sm">
                    {selectedClient.allBusinessTypesWithStage && selectedClient.allBusinessTypesWithStage.length > 0 ? (
                      <div className="space-y-3">
                        {selectedClient.allBusinessTypesWithStage.map((bt, index) => (
                          <div key={bt.id || index} className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded-lg">
                            <Badge className={getBusinessTypeColor(bt.business_type)}>
                              {bt.business_type}
                            </Badge>
                            <Select
                              value={bt.stage || 'Not Written'}
                              onValueChange={(value) => handleStageChange(bt.id, value)}
                            >
                              <SelectTrigger className="h-7 text-xs w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STAGE_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <span className={cn("px-2 py-0.5 rounded text-xs", option.color)}>
                                      {option.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                        {selectedClient.totalBusinessAmount > 0 && (
                          <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                            Total Amount: {formatCurrency(selectedClient.totalBusinessAmount)}
                          </div>
                        )}
                        {selectedClient.totalIafExpected > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Total Expected Fees: {formatCurrency(selectedClient.totalIafExpected)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <Badge className={getBusinessTypeColor(selectedClient.businessType)}>
                          {selectedClient.businessType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">No stage set</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

                {/* Actions */}
                <div className="pt-4 border-t border-border space-y-3">
                  <Button
                    onClick={() => navigate(`/clients?clientId=${selectedClient.id}`)}
                    variant="outline"
                    className="w-full"
                  >
                    View in Clients Page
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

      {/* Edit Pipeline Modal - Business Type Manager */}
      {showEditPipelineModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative z-[100]">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Manage Business Types</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Update business types and pipeline information for {selectedClient.name}
                  </p>
                </div>
                <Button
                  onClick={handleCancelBusinessTypes}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <BusinessTypeManager
                clientId={selectedClient.id}
                initialBusinessTypes={clientBusinessTypes}
                onSave={handleSaveBusinessTypes}
                onCancel={handleCancelBusinessTypes}
                saving={savingBusinessTypes}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
