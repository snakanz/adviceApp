import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  User,
  Search,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Clock,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import CreateClientForm from '../components/CreateClientForm';
import BusinessTypeManager from '../components/BusinessTypeManager';
import ClientDetailSidebar from '../components/ClientDetailSidebar';

// Stage options for business types - dark theme compatible colors
// Note: 'Signed' stage removed from dropdown options (but data with 'Signed' will still display correctly)
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
  const [generatingSummary, setGeneratingSummary] = useState(false); // Client summary generation state
  const [editingNotes, setEditingNotes] = useState(false); // Notes editing state
  const [pipelineNotes, setPipelineNotes] = useState(''); // Notes text
  const [savingNotes, setSavingNotes] = useState(false); // Saving notes state
  const [clientActionItems, setClientActionItems] = useState([]); // Action items for selected client
  const [loadingActionItems, setLoadingActionItems] = useState(false); // Loading state for action items

  const { isAuthenticated} = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const businessTypeFilter = searchParams.get('businessType') || '';
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Get the actual current month (for highlighting and comparison)
  const actualCurrentMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  // Generate months for tabs - includes past months from data + future months
  // Past months scroll left, future months scroll right
  const generateMonths = useCallback(() => {
    const months = [];
    const now = new Date();

    // Find the earliest expected close date from clients to determine how far back to show
    let earliestMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Check client data for historical months
    clients.forEach(client => {
      if (client.expectedMonth) {
        const [year, month] = client.expectedMonth.split('-').map(Number);
        const clientMonth = new Date(year, month - 1, 1);
        if (clientMonth < earliestMonth) {
          earliestMonth = clientMonth;
        }
      }
    });

    // Go back at least 12 months from current month for history access
    const minPastMonths = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    if (minPastMonths < earliestMonth) {
      earliestMonth = minPastMonths;
    }

    // Generate months from earliest to 12 months in the future
    const futureLimit = new Date(now.getFullYear(), now.getMonth() + 12, 1);

    let current = new Date(earliestMonth);
    while (current <= futureLimit) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }, [clients]);

  const months = useMemo(() => generateMonths(), [generateMonths]);

  // Check if viewing a past month
  const isViewingHistoricalData = useMemo(() => {
    return currentMonth < actualCurrentMonth;
  }, [currentMonth, actualCurrentMonth]);


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
              pipelineNotes: client.pipeline_notes || client.notes || bt.notes || null
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
          pipelineNotes: client.pipeline_notes || client.notes || null
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

  // On initial load, scroll to show current month on the LEFT
  useEffect(() => {
    if (!loading && months.length > 0) {
      const container = document.getElementById('month-tabs-container');
      if (container) {
        // Find index of actual current month (today's month)
        const currentMonthIdx = months.findIndex(m =>
          m.getMonth() === actualCurrentMonth.getMonth() &&
          m.getFullYear() === actualCurrentMonth.getFullYear()
        );
        if (currentMonthIdx >= 0) {
          // Scroll to put current month at the left edge
          const buttonWidth = 98; // min-w-[90px] + gap
          const scrollPosition = Math.max(0, currentMonthIdx * buttonWidth);
          container.scrollTo({ left: scrollPosition, behavior: 'auto' });
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, months.length]); // Only run on initial load

  // Close month picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showMonthPicker && !e.target.closest('[data-month-picker]')) {
        setShowMonthPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMonthPicker]);

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
      'Protection': 'bg-red-100 text-red-800 border-red-200',
      'Mortgage': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Other': 'bg-gray-100 text-gray-800 border-gray-200'
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
      pipelineNotes: client.pipeline_notes || client.pipelineNotes || client.notes || null,
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

    // Fetch action items for this client
    const actualClientId = client.clientId || client.id;
    fetchClientActionItems(actualClientId);

    // SMART AUTO-GENERATION: Show cached summary immediately, then check if regeneration needed
    const cachedSummary = client.pipeline_next_steps || client.fullClient?.pipeline_next_steps;

    if (cachedSummary) {
      // Show cached summary instantly
      setNextStepsSummary(cachedSummary);
    } else {
      // No cache - will generate below
      setNextStepsSummary(null);
    }

    // AUTO-GENERATE: Check if we need to generate/regenerate
    // Backend will use smart caching to avoid wasting tokens
    const hasMeetings = client.pastMeetingCount > 0;
    const hasBusinessTypes = client.allBusinessTypes && client.allBusinessTypes.length > 0;

    if (hasMeetings || hasBusinessTypes) {
      // Let backend decide if regeneration is needed based on pipeline_data_updated_at
      await handleGeneratePipelineSummary(client.clientId || client.id);
    } else if (!cachedSummary) {
      setNextStepsSummary('No data available yet. Add meetings or business types to generate insights.');
    }

    // Auto-generate client summary if none exists (backend handles caching)
    const hasClientSummary = normalizedClient.ai_summary;
    if (!hasClientSummary && (hasMeetings || hasBusinessTypes)) {
      handleGenerateSummary(client.clientId || client.id);
    }
  };

  const handleGeneratePipelineSummary = async (clientId) => {
    setGeneratingPipelineSummary(true);
    try {
      const response = await api.request(`/clients/${clientId}/generate-pipeline-summary`, {
        method: 'POST'
      });

      console.log('📊 AI Summary Response:', {
        clientId,
        cached: response.cached,
        reason: response.reason,
        hasSummary: !!response.summary,
        summaryPreview: response.summary?.substring(0, 50)
      });

      if (response.summary) {
        setNextStepsSummary(response.summary);

        // Update the client in the list with the new summary
        setClients(prev => prev.map(c =>
          c.id === clientId || c.clientId === clientId ? { ...c, pipeline_next_steps: response.summary, pipeline_next_steps_generated_at: response.generated_at } : c
        ));

        // Update selected client if it's the same one
        if (selectedClient && (selectedClient.id === clientId || selectedClient.clientId === clientId)) {
          setSelectedClient(prev => ({ ...prev, pipeline_next_steps: response.summary, pipeline_next_steps_generated_at: response.generated_at }));
        }

        // Note: Removed fetchPipelineData() call to prevent page refresh
        // The summary is already updated in state above
      }
    } catch (error) {
      console.error('Error generating pipeline summary:', error);
      setNextStepsSummary('Unable to generate summary at this time.');
    } finally {
      setGeneratingPipelineSummary(false);
    }
  };

  // Generate AI client summary (separate from pipeline "Next Steps to Close")
  const handleGenerateSummary = async (clientId) => {
    setGeneratingSummary(true);
    try {
      const response = await api.request(`/clients/${clientId}/generate-summary`, {
        method: 'POST'
      });

      if (response.summary) {
        // Update selected client with the new summary
        setSelectedClient(prev => prev ? ({ ...prev, ai_summary: response.summary }) : prev);

        // Update in clients list
        setClients(prev => prev.map(c =>
          (c.id === clientId || c.clientId === clientId) ? { ...c, ai_summary: response.summary } : c
        ));
      }
    } catch (error) {
      console.error('Error generating client summary:', error);
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Save pipeline notes
  const handleSaveNotes = async () => {
    if (!selectedClient) return;

    // FIX: Use actual client ID, not composite ID
    const actualClientId = selectedClient.clientId || selectedClient.id;

    setSavingNotes(true);
    try {
      await api.request(`/clients/${actualClientId}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: pipelineNotes })
      });

      // Update selected client with new notes
      setSelectedClient(prev => ({ ...prev, pipelineNotes: pipelineNotes }));

      // Update clients list
      setClients(prev => prev.map(c =>
        (c.id === actualClientId || c.clientId === actualClientId) ? { ...c, pipelineNotes: pipelineNotes } : c
      ));

      setEditingNotes(false);

      // Trigger AI summary regeneration after notes change (notes affect summary)
      await handleGeneratePipelineSummary(actualClientId);
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

  // Fetch action items for selected client
  const fetchClientActionItems = async (clientId) => {
    if (!clientId) return;

    setLoadingActionItems(true);
    try {
      const response = await api.request(`/transcript-action-items/clients/${clientId}/action-items`);

      // Backend returns { meetings: [...] } with grouped action items
      // Flatten into a simple array for display
      const allActionItems = [];
      if (response.meetings) {
        response.meetings.forEach(meeting => {
          meeting.actionItems.forEach(item => {
            allActionItems.push({
              id: item.id,
              action_item_text: item.actionText,
              completed: item.completed,
              completed_at: item.completedAt,
              meeting_title: meeting.meetingTitle,
              meeting_id: meeting.meetingId,
              created_at: item.createdAt
            });
          });
        });
      }

      setClientActionItems(allActionItems);
    } catch (error) {
      console.error('Error fetching action items:', error);
      setClientActionItems([]);
    } finally {
      setLoadingActionItems(false);
    }
  };

  // Toggle action item completion
  const handleToggleActionItem = async (actionItemId, currentStatus) => {
    // Optimistic update - update UI immediately
    setClientActionItems(prev =>
      prev.map(item =>
        item.id === actionItemId ? { ...item, completed: !currentStatus } : item
      )
    );

    try {
      await api.request(`/transcript-action-items/action-items/${actionItemId}/toggle`, {
        method: 'PATCH'
      });
    } catch (error) {
      console.error('Error toggling action item:', error);
      // Revert on error
      setClientActionItems(prev =>
        prev.map(item =>
          item.id === actionItemId ? { ...item, completed: currentStatus } : item
        )
      );
    }
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

    // FIX ISSUE 3.5: Use clientId instead of composite id (which may be like "clientId-bt-0")
    const actualClientId = selectedClient.clientId || selectedClient.id;

    try {
      // Pre-populate with existing data immediately to avoid blank screen
      const existingBusinessTypes = selectedClient.allBusinessTypes || selectedClient.businessTypesData || [];
      setClientBusinessTypes(existingBusinessTypes);
      setShowEditPipelineModal(true);
      setShowDetailPanel(false);

      // Fetch fresh data in background
      const businessTypes = await api.request(`/clients/${actualClientId}/business-types`);
      // Update with fresh data if available
      if (businessTypes && businessTypes.length > 0) {
        setClientBusinessTypes(businessTypes);
      }
    } catch (error) {
      console.error('Error loading business types:', error);
      // Keep pre-populated data even if API fails
      // Modal is already open with cached data, so user can still edit
    }
  };

  const handleSaveBusinessTypes = async (businessTypes) => {
    if (!selectedClient) return;

    // FIX: Use actual client ID, not composite ID
    const actualClientId = selectedClient.clientId || selectedClient.id;

    setSavingBusinessTypes(true);
    try {
      // Save business types via API
      await api.request(`/clients/${actualClientId}/business-types`, {
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
      const updatedClientData = await api.request(`/clients/${actualClientId}`);
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
        await handleGeneratePipelineSummary(actualClientId);
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

    // Show clients that match the selected month (including historical months)
    return clients.filter(client => {
      // Skip clients with no expected month (they go in overdue section only for current/future view)
      if (!client.expectedMonth) {
        return false;
      }

      // Show clients that match the selected month - this works for both past and future months
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
      <div className="bg-background w-full overflow-hidden" style={{ height: 'calc(100vh - 5rem)' }}>
        {/* Main Content Area */}
        <div className="h-full flex flex-col overflow-hidden">
          {/* Fixed Header Section */}
          <div className="flex-shrink-0 border-b border-border/50 p-4 lg:p-6 bg-card/50" style={{ overflow: 'hidden' }}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Client Pipeline</h1>
              <div className="h-4 bg-muted rounded w-64 animate-pulse"></div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
              <div className="h-10 bg-muted rounded w-48 animate-pulse"></div>
            </div>
          </div>

          {/* Loading Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
            <div className="flex items-center gap-2">
              <div className="h-8 bg-muted rounded w-16 animate-pulse"></div>
              <div className="h-8 bg-muted rounded w-28 animate-pulse"></div>
            </div>
          </div>

          {/* Loading Monthly Tabs Carousel */}
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 bg-muted rounded animate-pulse flex-shrink-0"></div>
            <div className="flex-1 overflow-hidden">
              <div className="flex gap-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 h-14 bg-muted rounded w-24 animate-pulse"></div>
                ))}
              </div>
            </div>
            <div className="h-10 w-10 bg-muted rounded animate-pulse flex-shrink-0"></div>
          </div>
        </div>

          {/* Scrollable Body */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <div className="p-4 lg:p-6">
              {/* Loading Search */}
              <div className="h-10 bg-muted rounded animate-pulse mb-4"></div>
            </div>

            {/* Loading Table - No horizontal scroll */}
            <div style={{ overflowX: 'hidden' }}>
              <div>
                {/* Loading Table Header */}
                <div className="bg-card/95 border-b border-border/50 px-4 lg:px-6 py-3">
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-4 h-4 bg-muted rounded animate-pulse"></div>
                    <div className="col-span-2 h-4 bg-muted rounded animate-pulse"></div>
                    <div className="col-span-2 h-4 bg-muted rounded animate-pulse"></div>
                    <div className="col-span-2 h-4 bg-muted rounded animate-pulse"></div>
                    <div className="col-span-2 h-4 bg-muted rounded animate-pulse"></div>
                  </div>
                </div>

                {/* Loading Table Body */}
                <div className="px-4 lg:px-6">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="grid grid-cols-12 gap-4 py-3 border-b border-border/30">
                      <div className="col-span-4 flex items-center gap-2">
                        <div className="w-8 h-8 bg-muted rounded-full animate-pulse flex-shrink-0"></div>
                        <div className="flex-1 space-y-1.5">
                          <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
                          <div className="h-3 bg-muted rounded animate-pulse w-1/2"></div>
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center justify-end">
                        <div className="h-4 bg-muted rounded animate-pulse w-16"></div>
                      </div>
                      <div className="col-span-2 flex items-center justify-center">
                        <div className="h-6 bg-muted rounded animate-pulse w-20"></div>
                      </div>
                      <div className="col-span-2 flex items-center justify-end">
                        <div className="h-4 bg-muted rounded animate-pulse w-14"></div>
                      </div>
                      <div className="col-span-2 flex items-center justify-end">
                        <div className="h-4 bg-muted rounded animate-pulse w-24"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background w-full overflow-hidden" style={{ height: 'calc(100vh - 5rem)' }}>
      {/* Main Content Area */}
      <div className={cn(
        "h-full flex flex-col overflow-hidden",
        showDetailPanel ? "lg:mr-[45%] xl:mr-[40%]" : ""
      )}>
        {/* Fixed Header Section - flex-shrink-0 keeps it pinned at top */}
        <div className="flex-shrink-0 border-b border-border/50 p-4 lg:p-6 bg-card/50" style={{ overflow: 'hidden' }}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Client Pipeline</h1>
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
              <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg whitespace-nowrap">
                Total Pipeline Value: <span className="font-semibold text-foreground">
                  {formatCurrency(clients.reduce((total, client) => total + (client.expectedFees || 0), 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Month Navigation - Independent Carousel */}
          <div className="mb-0">
            {/* Month Selector Header with Jump to Month */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">Select Month</h3>
                {/* Viewing Historical Data Label */}
                {isViewingHistoricalData && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">
                    <Clock className="w-3 h-3" />
                    Viewing historical data
                  </div>
                )}
              </div>
              {/* Jump to Month Control */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentMonth(actualCurrentMonth)}
                  className="h-8 px-3 text-xs"
                  disabled={currentMonth.getMonth() === actualCurrentMonth.getMonth() && currentMonth.getFullYear() === actualCurrentMonth.getFullYear()}
                >
                  Today
                </Button>
                <div className="relative" data-month-picker>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMonthPicker(!showMonthPicker)}
                    className="h-8 px-3 text-xs flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Jump to month
                  </Button>
                  {/* Month Picker Dropdown */}
                  {showMonthPicker && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[280px]" data-month-picker>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">Select Month</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setShowMonthPicker(false)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {months.map((month) => {
                          const isPast = month < actualCurrentMonth;
                          const isCurrent = month.getMonth() === actualCurrentMonth.getMonth() && month.getFullYear() === actualCurrentMonth.getFullYear();
                          const isSelected = month.getMonth() === currentMonth.getMonth() && month.getFullYear() === currentMonth.getFullYear();

                          return (
                            <Button
                              key={month.toISOString()}
                              variant={isSelected ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => {
                                setCurrentMonth(month);
                                setShowMonthPicker(false);
                              }}
                              className={cn(
                                "h-auto py-2 px-2 text-xs justify-center",
                                isPast && !isSelected && "opacity-60",
                                isCurrent && !isSelected && "ring-1 ring-primary"
                              )}
                            >
                              {month.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Compact Month Slider - Local Scroll Only */}
            <div className="w-full relative flex items-center gap-2">
              {/* Left Scroll Button */}
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 h-10 w-10 p-0"
                onClick={() => {
                  const container = document.getElementById('month-tabs-container');
                  if (container) container.scrollBy({ left: -200, behavior: 'smooth' });
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {/* Month Tabs - Local horizontal scroll only */}
              <div
                id="month-tabs-container"
                className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
              >
                <div className="inline-flex flex-nowrap gap-2">
                  {months.map((month) => {
                    const monthTotal = getMonthlyTotal(month);
                    const isActive = month.getMonth() === currentMonth.getMonth() &&
                                    month.getFullYear() === currentMonth.getFullYear();
                    const isPast = month < actualCurrentMonth;
                    const isCurrentMonth = month.getMonth() === actualCurrentMonth.getMonth() &&
                                          month.getFullYear() === actualCurrentMonth.getFullYear();

                    return (
                      <Button
                        key={month.toISOString()}
                        onClick={() => setCurrentMonth(month)}
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          "flex-shrink-0 flex flex-col items-center gap-0.5 h-auto py-2 px-3 min-w-[90px] transition-all whitespace-nowrap",
                          isPast && !isActive && "opacity-50 hover:opacity-75 border-dashed",
                          isCurrentMonth && !isActive && "ring-2 ring-primary/50"
                        )}
                      >
                        <span className="font-medium text-xs whitespace-nowrap">
                          {month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[10px] opacity-75 font-semibold whitespace-nowrap">
                          {formatCurrency(monthTotal)}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Right Scroll Button */}
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 h-10 w-10 p-0"
                onClick={() => {
                  const container = document.getElementById('month-tabs-container');
                  if (container) container.scrollBy({ left: 200, behavior: 'smooth' });
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable Body - Independent vertical scroll zone */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <div className="p-4 lg:p-6">
          {/* Overdue/No Date Section - Below Month Tabs */}
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
                  <div className="mt-3 space-y-2 max-h-64 overflow-y-auto overflow-x-hidden">
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
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
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

          {/* Pipeline Table - No horizontal scroll */}
          <div style={{ overflowX: 'hidden' }}>
            <div>
              {/* Table Header - Strict grid-cols-12 */}
              <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/50 px-4 lg:px-6 py-3 z-10">
                <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <div className="col-span-4 px-2">Client & Business Type</div>
                  <div className="col-span-2 px-2 text-right">Amount</div>
                  <div className="col-span-2 px-2 text-center">Stage</div>
                  <div className="col-span-2 px-2 text-right">Fee</div>
                  <div className="col-span-2 px-2 text-right">Next Meeting</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="px-4 lg:px-6">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => handleClientClick({ ...client.fullClient, ...client, fullClient: client.fullClient })}
                    className="grid grid-cols-12 gap-4 py-3 border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-all duration-200 group"
                  >
                    {/* Client Information & Business Type */}
                    <div className="col-span-4 px-2 flex items-center gap-2">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                          {getInitials(client.name, client.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-foreground truncate">
                          {client.name || client.email}
                        </div>
                        {/* Business Type Badges */}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {client.allBusinessTypes && client.allBusinessTypes.length > 0 ? (
                            client.allBusinessTypes.slice(0, 2).map((bt, index) => (
                              <Badge key={index} className={cn("text-[10px] px-1.5 py-0", getBusinessTypeColor(bt.business_type))}>
                                {bt.business_type}
                              </Badge>
                            ))
                          ) : (
                            <Badge className={cn("text-[10px] px-1.5 py-0", getBusinessTypeColor(client.businessType))}>
                              {client.businessType}
                            </Badge>
                          )}
                          {client.allBusinessTypes && client.allBusinessTypes.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">+{client.allBusinessTypes.length - 2}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount (Investment/Business Amount) */}
                    <div className="col-span-2 px-2 flex items-center justify-end">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground">
                          {client.investmentAmount > 0 ? formatCurrency(client.investmentAmount) : '-'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Amount</div>
                      </div>
                    </div>

                    {/* Stage Dropdown */}
                    <div className="col-span-2 px-2 flex items-center" onClick={(e) => e.stopPropagation()}>
                      {client.businessTypeId ? (
                        <Select
                          value={client.stage || 'Not Written'}
                          onValueChange={(value) => handleStageChange(client.businessTypeId, value)}
                        >
                          <SelectTrigger className="h-7 text-xs w-full max-w-[120px]">
                            <SelectValue>
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px]",
                                client.stage === 'Signed' ? 'bg-yellow-500/20 text-yellow-400' :
                                STAGE_OPTIONS.find(opt => opt.value === client.stage)?.color || 'bg-gray-500/20 text-gray-300'
                              )}>
                                {client.stage || 'Not Written'}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STAGE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <span className={cn("px-1.5 py-0.5 rounded text-[10px]", option.color)}>
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

                    {/* Fee (IAF Expected) */}
                    <div className="col-span-2 px-2 flex items-center justify-end">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground">
                          {client.expectedFees > 0 ? formatCurrency(client.expectedFees) : '-'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Fee</div>
                      </div>
                    </div>

                    {/* Next Meeting */}
                    <div className="col-span-2 px-2 flex items-center justify-end gap-1">
                      <div className={cn(
                        "flex-shrink-0 w-2 h-2 rounded-full",
                        client.nextMeetingDate ? "bg-green-500" : "bg-red-500"
                      )} />
                      <div className="text-right">
                        <div className={cn(
                          "text-xs",
                          client.nextMeetingDate ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}>
                          {client.nextMeetingDate ? formatDate(client.nextMeetingDate) : 'No meeting'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {client.pastMeetingCount} past
                        </div>
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
      </div>

      {/* Client Detail Sidebar */}
      <ClientDetailSidebar
        open={showDetailPanel}
        onClose={() => setShowDetailPanel(false)}
        selectedClient={selectedClient}
        navigate={navigate}
        panelWidth="wide"
        onGenerateSummary={handleGenerateSummary}
        generatingSummary={generatingSummary}
        onEditPipeline={() => handleEditPipeline()}
        onManageBusinessTypes={() => handleEditPipeline()}
        nextStepsSummary={nextStepsSummary}
        generatingNextSteps={generatingPipelineSummary}
        pipelineNotes={pipelineNotes}
        editingNotes={editingNotes}
        onStartEditNotes={handleStartEditNotes}
        onSaveNotes={handleSaveNotes}
        onCancelEditNotes={() => setEditingNotes(false)}
        onNotesChange={setPipelineNotes}
        savingNotes={savingNotes}
        businessTypesWithStage={selectedClient?.allBusinessTypesWithStage}
        onStageChange={handleStageChange}
        formatCurrency={formatCurrency}
        clientActionItems={clientActionItems}
        onToggleActionItem={handleToggleActionItem}
        loadingActionItems={loadingActionItems}
        showSecondarySection={false}
        getUserInitials={getInitials}
        formatDate={formatDate}
      />

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
