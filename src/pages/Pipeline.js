import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import {
  User,
  Search,
  Edit3,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';



export default function Pipeline() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [search, setSearch] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
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
      // Mock pipeline data - will be replaced with API calls
      const mockPipelineData = [
        {
          id: 1,
          name: 'John Smith',
          email: 'john.smith@email.com',
          nextMeetingDate: '2025-09-25',
          pastMeetingCount: 3,
          businessStage: 'Waiting on Paraplanning',
          pipelineNotes: 'Waiting on pension transfer paperwork',
          likelihood: 85,
          expectedValue: 15000,
          expectedMonth: '2025-09',
          businessType: 'Pension'
        },
        {
          id: 2,
          name: 'Sarah Johnson',
          email: 'sarah.johnson@email.com',
          nextMeetingDate: '2025-10-05',
          pastMeetingCount: 2,
          businessStage: 'Need to Book Meeting',
          pipelineNotes: 'Interested in ISA and pension advice',
          likelihood: 60,
          expectedValue: 8000,
          expectedMonth: '2025-10',
          businessType: 'ISA'
        },
        {
          id: 3,
          name: 'Mike Wilson',
          email: 'mike.wilson@email.com',
          nextMeetingDate: null,
          pastMeetingCount: 1,
          businessStage: 'Can\'t Contact Client',
          pipelineNotes: 'Need to chase for second meeting',
          likelihood: 40,
          expectedValue: 12000,
          expectedMonth: '2025-11',
          businessType: 'Investment'
        }
      ];

      // For now, use mock data
      // In production, this would fetch from API
      setClients(mockPipelineData);
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

  const getCurrentMonthClients = () => {
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    return clients.filter(client => client.expectedMonth === monthKey);
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
      <div className="h-full bg-background p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-4">Client Pipeline</h1>

          {/* Pipeline Summary Dashboard */}
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Pipeline Summary - Total IAF Expected by Stage</h2>
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="text-center animate-pulse">
                    <div className="h-6 bg-muted rounded-full mb-2 mx-auto w-24"></div>
                    <div className="h-6 bg-muted rounded mb-1"></div>
                    <div className="h-4 bg-muted rounded w-16 mx-auto"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(pipelineSummary).map(([stage, data]) => (
                  <div key={stage} className="text-center">
                    <div className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-2", getStageColor(stage))}>
                      {stage}
                    </div>
                    <div className="text-lg font-bold text-foreground">
                      £{data.total.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {data.count} client{data.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex">
      {/* Main Content */}
      <div className={cn("flex-1 transition-all duration-300", showDetailPanel ? "mr-96" : "")}>
        {/* Header */}
        <div className="border-b border-border/50 p-6 bg-card/50">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-foreground">Client Pipeline</h1>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Total Pipeline Value: <span className="font-semibold text-foreground">
                  {formatCurrency(clients.reduce((total, client) => total + (client.expectedValue || 0), 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Tabs */}
          <div className="flex gap-1 mb-6 overflow-x-auto">
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
                  className="flex-shrink-0 flex flex-col items-center gap-1 h-auto py-3 px-4"
                >
                  <span className="font-medium">
                    {month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-xs opacity-75">
                    {formatCurrency(monthTotal)}
                  </span>
                </Button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Pipeline Table */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-full">
            {/* Table Header */}
            <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/50 px-6 py-3">
              <div className="grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div className="col-span-2">Client</div>
                <div className="col-span-2">Next Meeting</div>
                <div className="col-span-2">Business Stage</div>
                <div className="col-span-2">Pipeline Notes</div>
                <div className="col-span-1">Likelihood</div>
                <div className="col-span-2">IAF Expected</div>
                <div className="col-span-1">Type</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="px-6">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => handleClientClick(client)}
                  className="grid grid-cols-12 gap-4 py-4 border-b border-border/30 hover:bg-muted/50 cursor-pointer transition-colors group"
                >
                  {/* Client Name */}
                  <div className="col-span-2 flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {client.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {client.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {client.email}
                      </div>
                    </div>
                  </div>

                  {/* Next Meeting */}
                  <div className="col-span-2 flex items-center">
                    <div className="text-sm">
                      <div className={cn(
                        "font-medium",
                        client.nextMeetingDate ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {formatDate(client.nextMeetingDate)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {client.pastMeetingCount} past meetings
                      </div>
                    </div>
                  </div>

                  {/* Business Stage */}
                  <div className="col-span-2 flex items-center">
                    <Badge className={cn("text-xs", getStageColor(client.businessStage))}>
                      {client.businessStage}
                    </Badge>
                  </div>

                  {/* Pipeline Notes */}
                  <div className="col-span-2 flex items-center">
                    <div className="text-sm text-muted-foreground truncate">
                      {client.pipelineNotes || 'No notes'}
                    </div>
                  </div>

                  {/* Likelihood */}
                  <div className="col-span-1 flex items-center">
                    <div className={cn("text-sm font-medium", getLikelihoodColor(client.likelihood))}>
                      {client.likelihood}%
                    </div>
                  </div>

                  {/* Expected Value */}
                  <div className="col-span-2 flex items-center">
                    <div className="text-sm font-medium text-foreground">
                      {formatCurrency(client.expectedValue)}
                    </div>
                  </div>

                  {/* Business Type */}
                  <div className="col-span-1 flex items-center">
                    <Badge className={cn("text-xs", getBusinessTypeColor(client.businessType))}>
                      {client.businessType}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {filteredClients.length === 0 && (
              <div className="text-center py-12">
                <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No clients in pipeline for {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-muted-foreground">
                  {search ? 'Try adjusting your search terms.' : 'No clients are expected to sign up this month.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {showDetailPanel && selectedClient && (
        <div className="fixed right-0 top-0 h-full w-96 bg-card border-l border-border shadow-xl z-50 overflow-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Pipeline Details</h2>
              <Button
                onClick={() => setShowDetailPanel(false)}
                variant="ghost"
                size="sm"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Client Info */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedClient.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-foreground">{selectedClient.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
                </div>
              </div>

              {/* Read-only Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Next Meeting Date</label>
                  <div className="mt-1 p-3 bg-muted/50 rounded-md text-sm">
                    {formatDate(selectedClient.nextMeetingDate)}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Past Meetings</label>
                  <div className="mt-1 p-3 bg-muted/50 rounded-md text-sm">
                    {selectedClient.pastMeetingCount} meetings
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
                  <label className="text-sm font-medium text-muted-foreground">Business Type</label>
                  {editingField === 'businessType' ? (
                    <div className="mt-1 flex gap-2">
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 p-2 border border-border rounded-md text-sm"
                      >
                        <option value="Pension">Pension</option>
                        <option value="ISA">ISA</option>
                        <option value="Bond">Bond</option>
                        <option value="Investment">Investment</option>
                        <option value="Insurance">Insurance</option>
                        <option value="Mortgage">Mortgage</option>
                      </select>
                      <Button onClick={handleSaveField} size="sm">Save</Button>
                      <Button onClick={() => setEditingField(null)} variant="outline" size="sm">Cancel</Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleEditField('businessType', selectedClient.businessType)}
                      className="mt-1 p-3 bg-background border border-border rounded-md text-sm cursor-pointer hover:bg-muted/50 flex items-center justify-between group"
                    >
                      <Badge className={getBusinessTypeColor(selectedClient.businessType)}>
                        {selectedClient.businessType}
                      </Badge>
                      <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-border">
                <Button
                  onClick={() => navigate(`/clients/${selectedClient.id}`)}
                  variant="outline"
                  className="w-full"
                >
                  View Full Client Profile
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
