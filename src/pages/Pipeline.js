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
  Plus,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import CreateClientForm from '../components/CreateClientForm';
import BusinessTypeManager from '../components/BusinessTypeManager';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';



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

  // Inline editing state
  const [editingField, setEditingField] = useState(null); // { clientId, field }
  const [editingValue, setEditingValue] = useState('');
  const [savingInlineEdit, setSavingInlineEdit] = useState(false);

  const { isAuthenticated} = useAuth();
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

  // Pipeline stages for dropdown
  const pipelineStages = [
    'Client Signed',
    'Waiting to Sign',
    'Waiting on Paraplanning',
    'Have Not Written Advice',
    'Need to Book Meeting',
    "Can't Contact Client"
  ];

  // Inline editing handlers
  const handleStartEdit = (clientId, field, currentValue) => {
    setEditingField({ clientId, field });
    setEditingValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditingValue('');
  };

  const handleSaveInlineEdit = async (clientId, field, value) => {
    setSavingInlineEdit(true);
    try {
      const updateData = {};

      if (field === 'pipeline_stage') {
        updateData.pipeline_stage = value;
      } else if (field === 'iaf_expected') {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
          alert('Please enter a valid positive number for IAF Expected');
          setSavingInlineEdit(false);
          return;
        }
        updateData.iaf_expected = numValue;
      } else if (field === 'likelihood') {
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 0 || numValue > 100) {
          alert('Please enter a number between 0 and 100 for Likelihood');
          setSavingInlineEdit(false);
          return;
        }
        updateData.likelihood = numValue;
      }

      // Update via API
      await api.request(`/pipeline/client/${clientId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      // Update local state
      setClients(prevClients =>
        prevClients.map(client => {
          if (client.id === clientId) {
            const updated = { ...client };
            if (field === 'pipeline_stage') {
              updated.businessStage = value;
            } else if (field === 'iaf_expected') {
              updated.expectedValue = parseFloat(value);
              updated.totalIafExpected = parseFloat(value);
            } else if (field === 'likelihood') {
              updated.likelihood = parseInt(value);
            }
            return updated;
          }
          return client;
        })
      );

      // Clear editing state
      setEditingField(null);
      setEditingValue('');
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Failed to update client. Please try again.');
    } finally {
      setSavingInlineEdit(false);
    }
  };

  const fetchPipelineData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch real client data from API
      const clientsData = await api.request('/clients');

      // Transform client data to pipeline format
      const pipelineData = clientsData.map(client => {
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

        // Calculate expected month from business type expected_close_date (PRIORITY)
        // Fallback to client's likely_close_month if no business type dates
        let expectedMonth = null;
        const businessTypesData = client.business_types_data || [];

        // Get earliest expected close date from business types
        const businessTypeDates = businessTypesData
          .filter(bt => bt.expected_close_date)
          .map(bt => new Date(bt.expected_close_date))
          .sort((a, b) => a - b);

        if (businessTypeDates.length > 0) {
          // Use earliest business type close date
          const earliestDate = businessTypeDates[0];
          expectedMonth = `${earliestDate.getFullYear()}-${String(earliestDate.getMonth() + 1).padStart(2, '0')}`;
        } else if (client.likely_close_month) {
          // Fallback to client's likely_close_month
          // Handle both "YYYY-MM" and "YYYY-MM-DD" formats
          const dateStr = client.likely_close_month.includes('-') && client.likely_close_month.split('-').length === 3
            ? client.likely_close_month // Already has day (YYYY-MM-DD)
            : `${client.likely_close_month}-01`; // Add day (YYYY-MM -> YYYY-MM-01)

          const date = new Date(dateStr);
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
          likelihood: client.likelihood !== null && client.likelihood !== undefined ? client.likelihood : 75, // Use database value or default to 75
          // Use aggregated data from business_types (SINGLE SOURCE OF TRUTH)
          expectedValue: parseFloat(client.iaf_expected || client.likely_value || 0),
          expectedMonth: expectedMonth,
          businessType: client.business_type ? client.business_type.charAt(0).toUpperCase() + client.business_type.slice(1) : 'Not Set',
          businessTypes: client.business_types || [], // Array of business types from client_business_types table
          businessTypesData: client.business_types_data || [], // Full business type objects
          businessTypesDisplay: client.business_types && client.business_types.length > 0
            ? client.business_types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')
            : (client.business_type ? client.business_type.charAt(0).toUpperCase() + client.business_type.slice(1) : 'Not Set'),
          contributionMethods: client.contribution_methods || '',
          // Use aggregated totals from backend
          totalBusinessAmount: parseFloat(client.business_amount || 0),
          totalIafExpected: parseFloat(client.iaf_expected || client.likely_value || 0),
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

  const handleClientClick = async (client) => {
    setSelectedClient(client);
    setShowDetailPanel(true);
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

          {/* Overdue/No Date Section - Moved Below Monthly Tabs */}
          {(() => {
            const overdueClients = getOverdueOrNoDateClients();
            if (overdueClients.length === 0) return null;

            const totalValue = overdueClients.reduce((total, client) => total + (client.expectedValue || 0), 0);

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
                        {getInitials(client.name, client.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-foreground truncate mb-1">
                        {client.name || client.email}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mb-1">
                        {client.email}
                      </div>
                      {/* Business Type Tags - Enhanced */}
                      <div className="flex flex-wrap gap-1 items-center">
                        {client.businessTypes && client.businessTypes.length > 0 ? (
                          <>
                            {client.businessTypes.slice(0, 2).map((type, index) => (
                              <Badge key={index} className={cn("text-xs px-2 py-0.5", getBusinessTypeColor(type))}>
                                {type}
                              </Badge>
                            ))}
                            {client.businessTypes.length > 2 && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-muted">
                                +{client.businessTypes.length - 2}
                              </Badge>
                            )}
                            {/* Show count badge if multiple types */}
                            {client.businessTypes.length > 1 && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 border-primary/30 text-primary">
                                {client.businessTypes.length} types
                              </Badge>
                            )}
                          </>
                        ) : (
                          <Badge className={cn("text-xs px-2 py-0.5", getBusinessTypeColor(client.businessType))}>
                            {client.businessType}
                          </Badge>
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

                  {/* Business Stage - Inline Editable */}
                  <div
                    className="col-span-2 flex items-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!editingField || editingField.clientId !== client.id || editingField.field !== 'pipeline_stage') {
                        handleStartEdit(client.id, 'pipeline_stage', client.businessStage);
                      }
                    }}
                  >
                    {editingField?.clientId === client.id && editingField?.field === 'pipeline_stage' ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={editingValue}
                          onValueChange={(value) => {
                            setEditingValue(value);
                            handleSaveInlineEdit(client.id, 'pipeline_stage', value);
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelineStages.map((stage) => (
                              <SelectItem key={stage} value={stage} className="text-xs">
                                {stage}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Badge className={cn("text-xs px-2 py-1 font-medium cursor-pointer hover:opacity-80", getStageColor(client.businessStage))}>
                        {client.businessStage}
                      </Badge>
                    )}
                  </div>

                  {/* Pipeline Notes */}
                  <div className="col-span-2 flex items-center">
                    <div className="text-xs text-muted-foreground truncate max-w-full">
                      {client.pipelineNotes || 'No notes added'}
                    </div>
                  </div>

                  {/* Likelihood - Inline Editable */}
                  <div
                    className="col-span-1 flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!editingField || editingField.clientId !== client.id || editingField.field !== 'likelihood') {
                        handleStartEdit(client.id, 'likelihood', client.likelihood);
                      }
                    }}
                  >
                    {editingField?.clientId === client.id && editingField?.field === 'likelihood' ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveInlineEdit(client.id, 'likelihood', editingValue);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          className="h-7 w-16 text-xs"
                          autoFocus
                          disabled={savingInlineEdit}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveInlineEdit(client.id, 'likelihood', editingValue);
                          }}
                          disabled={savingInlineEdit}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          disabled={savingInlineEdit}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className={cn(
                        "text-sm font-bold px-2 py-1 rounded-full bg-opacity-20 cursor-pointer hover:opacity-80",
                        getLikelihoodColor(client.likelihood)
                      )}>
                        {client.likelihood}%
                      </div>
                    )}
                  </div>

                  {/* Expected Value - Enhanced with Business Type Breakdown - Inline Editable IAF */}
                  <div
                    className="col-span-2 flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!editingField || editingField.clientId !== client.id || editingField.field !== 'iaf_expected') {
                        handleStartEdit(client.id, 'iaf_expected', client.expectedValue);
                      }
                    }}
                  >
                    <div className="flex-1">
                      {/* FIX ISSUE 2: Show Total Business Amount prominently */}
                      {client.totalBusinessAmount > 0 && (
                        <div className="text-sm font-bold text-foreground mb-0.5">
                          {formatCurrency(client.totalBusinessAmount)}
                          <span className="text-xs text-muted-foreground font-normal ml-1">Business</span>
                        </div>
                      )}
                      {/* Show IAF Expected - Inline Editable */}
                      {editingField?.clientId === client.id && editingField?.field === 'iaf_expected' ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs text-muted-foreground">£</span>
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveInlineEdit(client.id, 'iaf_expected', editingValue);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                            className="h-7 w-24 text-xs"
                            autoFocus
                            disabled={savingInlineEdit}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveInlineEdit(client.id, 'iaf_expected', editingValue);
                            }}
                            disabled={savingInlineEdit}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelEdit();
                            }}
                            disabled={savingInlineEdit}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className={cn(
                          "text-sm font-bold text-foreground cursor-pointer hover:opacity-80",
                          client.totalBusinessAmount > 0 ? "text-xs text-muted-foreground font-normal" : "mb-0.5"
                        )}>
                          {formatCurrency(client.expectedValue)}
                          {client.totalBusinessAmount > 0 && <span className="ml-1">IAF</span>}
                        </div>
                      )}
                      {/* Show breakdown if multiple business types */}
                      {client.businessTypesData && client.businessTypesData.length > 1 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
                            {client.businessTypesData.length} types
                          </Badge>
                        </div>
                      )}
                      {/* Show business type breakdown on hover */}
                      {client.businessTypesData && client.businessTypesData.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          {client.businessTypesData.slice(0, 2).map((bt, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="font-medium">{bt.business_type}:</span>
                              <span>{formatCurrency(parseFloat(bt.business_amount || 0))} / {formatCurrency(parseFloat(bt.iaf_expected || 0))} IAF</span>
                            </div>
                          ))}
                          {client.businessTypesData.length > 2 && (
                            <div className="text-xs text-muted-foreground/70">
                              +{client.businessTypesData.length - 2} more...
                            </div>
                          )}
                        </div>
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

              {/* Pipeline Information - Read Only */}
              <div className="space-y-4">
                {/* Business Stage */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline Stage</label>
                  <div className="mt-2 p-3 bg-muted/30 border border-border rounded-lg">
                    <Badge className={getStageColor(selectedClient.businessStage)}>
                      {selectedClient.businessStage}
                    </Badge>
                  </div>
                </div>

                {/* IAF Expected */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">IAF Expected</label>
                  <div className="mt-2 p-3 bg-muted/30 border border-border rounded-lg">
                    <span className="text-lg font-bold text-foreground">
                      {formatCurrency(selectedClient.expectedValue)}
                    </span>
                  </div>
                </div>

                {/* Likelihood */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Likelihood of Sign-up</label>
                  <div className="mt-2 p-3 bg-muted/30 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={cn("text-lg font-bold", getLikelihoodColor(selectedClient.likelihood))}>
                        {selectedClient.likelihood}%
                      </span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full transition-all", getLikelihoodColor(selectedClient.likelihood).replace('text-', 'bg-'))}
                          style={{ width: `${selectedClient.likelihood}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pipeline Notes */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline Notes</label>
                  <div className="mt-2 p-3 bg-muted/30 border border-border rounded-lg min-h-[80px]">
                    <p className={cn("text-sm whitespace-pre-wrap", selectedClient.pipelineNotes ? "text-foreground" : "text-muted-foreground italic")}>
                      {selectedClient.pipelineNotes || 'No notes added yet'}
                    </p>
                  </div>
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
