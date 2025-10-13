import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { cn } from '../lib/utils';
import { 
  ArrowLeft, 
  Calendar, 
  TrendingUp, 
  Sparkles, 
  Clock,
  Mail,
  Users,
  Building2
} from 'lucide-react';
import { api } from '../services/api';

const formatDateTime = (dateTimeStr) => {
  const date = new Date(dateTimeStr);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ViewClient = () => {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [clientData, setClientData] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('aiSummary');

  useEffect(() => {
    async function fetchClientAndMeetings() {
      setLoading(true);
      try {
        // Fetch client details
        const client = await api.request(`/clients/${clientId}`);
        setClientData(client);
        // Fetch meetings for this client
        const meetingsData = await api.request(`/clients/${clientId}/meetings`);
        setMeetings(meetingsData);
      } catch (e) {
        setClientData(null);
        setMeetings([]);
      } finally {
        setLoading(false);
      }
    }
    fetchClientAndMeetings();
  }, [clientId]);

  const getUserInitials = (name) => {
    if (!name) return 'C';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
          <span className="text-muted-foreground">Loading client details...</span>
        </div>
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="p-6 text-center">
            <div className="text-destructive mb-4">
              <Users className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Client Not Found</h3>
            <p className="text-muted-foreground">The requested client could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleBack = () => {
    navigate('/clients');
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/50 p-6 bg-card/50">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Clients
          </Button>
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12 bg-primary/10 text-primary">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {getUserInitials(clientData.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {clientData.name || 'Unnamed Client'}
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  <span>{clientData.email}</span>
                </div>
                {meetings.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{meetings.length} meetings</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-2 pb-0">
        <div className="flex gap-4 justify-between">
          <button
            className={cn(
              "tab-btn",
              activeTab === 'aiSummary' && "active"
            )}
            onClick={() => setActiveTab('aiSummary')}
          >
            <Sparkles className="w-4 h-4 inline mr-2" />
            AI Summary
          </button>
          <button
            className={cn(
              "tab-btn",
              activeTab === 'allMeetings' && "active"
            )}
            onClick={() => setActiveTab('allMeetings')}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            All Meetings
          </button>
          <button
            className={cn(
              "tab-btn",
              activeTab === 'pipeline' && "active"
            )}
            onClick={() => setActiveTab('pipeline')}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Client Pipeline
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'aiSummary' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">AI Summary</h2>
            <Card className="border-border/50">
              <CardContent className="p-6">
                {clientData.aiSummary ? (
                  <div className="prose prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                      {clientData.aiSummary}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No AI summary available</h3>
                    <p className="text-muted-foreground">AI summary will appear here when generated.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'allMeetings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">All Meetings</h2>
            {meetings.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="p-6 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No meetings found</h3>
                  <p className="text-muted-foreground">This client doesn't have any meetings yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {meetings.map(meeting => (
                  <Card key={meeting.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">
                            {meeting.title || meeting.summary || 'Untitled Meeting'}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>{formatDateTime(meeting.starttime)}</span>
                          </div>
                        </div>
                        {meeting.summary && (
                          <div className="text-sm text-foreground whitespace-pre-line">
                            {meeting.summary}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Client Pipeline</h2>

            {/* Business Types */}
            {clientData.business_types_data && clientData.business_types_data.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground">Business Types</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clientData.business_types_data.map((bt, index) => (
                    <Card key={index} className="border-border/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Building2 className="w-4 h-4 text-primary" />
                          {bt.business_type}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {bt.business_amount && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Business Amount:</span>
                            <span className="font-semibold">£{parseFloat(bt.business_amount).toLocaleString()}</span>
                          </div>
                        )}
                        {bt.iaf_expected && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">IAF Expected:</span>
                            <span className="font-semibold">£{parseFloat(bt.iaf_expected).toLocaleString()}</span>
                          </div>
                        )}
                        {bt.contribution_method && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Method:</span>
                            <span className="font-medium">{bt.contribution_method}</span>
                          </div>
                        )}
                        {bt.regular_contribution_amount && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Regular Amount:</span>
                            <span className="font-medium">{bt.regular_contribution_amount}</span>
                          </div>
                        )}
                        {bt.notes && (
                          <div className="text-sm pt-2 border-t border-border/50">
                            <span className="text-muted-foreground">Notes:</span>
                            <p className="text-foreground mt-1">{bt.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card className="border-border/50">
                <CardContent className="p-6 text-center">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Business Types Set</h3>
                  <p className="text-muted-foreground">Add business types to track pipeline opportunities.</p>
                </CardContent>
              </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Total IAF Expected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">
                    £{clientData.iaf_expected ? parseFloat(clientData.iaf_expected).toLocaleString() : '0'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5 text-primary" />
                    Total Business Amount
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">
                    £{clientData.business_amount ? parseFloat(clientData.business_amount).toLocaleString() : '0'}
                  </p>
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
                  <p className="text-2xl font-bold text-foreground">
                    {clientData.likely_close_month
                      ? new Date(clientData.likely_close_month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      : 'Not Set'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewClient; 