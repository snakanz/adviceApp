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

const pipelineMock = {
  businessExpected: '100K Transfer',
  value: '14000',
  closeMonth: 'April'
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
      <div className="border-b border-border/50 px-6">
        <div className="flex gap-6">
          <button
            className={cn(
              "pb-3 px-1 border-b-2 font-medium text-sm transition-all duration-150",
              activeTab === 'aiSummary'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab('aiSummary')}
          >
            <Sparkles className="w-4 h-4 inline mr-2" />
            AI Summary
          </button>
          <button
            className={cn(
              "pb-3 px-1 border-b-2 font-medium text-sm transition-all duration-150",
              activeTab === 'allMeetings'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab('allMeetings')}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            All Meetings
          </button>
          <button
            className={cn(
              "pb-3 px-1 border-b-2 font-medium text-sm transition-all duration-150",
              activeTab === 'pipeline'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Business Expected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{pipelineMock.businessExpected}</p>
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
                  <p className="text-2xl font-bold text-foreground">${pipelineMock.value}</p>
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
                  <p className="text-2xl font-bold text-foreground">{pipelineMock.closeMonth}</p>
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