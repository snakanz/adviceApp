import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { cn } from '../lib/utils';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight, 
  TrendingUp, 
  DollarSign,
  Repeat,
  Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Pipeline() {
  const navigate = useNavigate();
  const [pipelineData, setPipelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  useEffect(() => {
    async function fetchPipelineData() {
      setLoading(true);
      try {
        const response = await fetch('/api/pipeline');
        if (!response.ok) {
          throw new Error('Failed to fetch pipeline data');
        }
        const data = await response.json();
        setPipelineData(data);
      } catch (err) {
        setError(err.message);
        setPipelineData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchPipelineData();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
          <span className="text-muted-foreground">Loading pipeline data...</span>
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
              <TrendingUp className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Error Loading Pipeline</h3>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!pipelineData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md border-border/50">
          <CardContent className="p-6 text-center">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Pipeline Data</h3>
            <p className="text-muted-foreground">No pipeline data available at the moment.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentMonth = pipelineData.months[currentMonthIndex];
  const currentKpis = pipelineData.kpis[currentMonthIndex];
  const currentClients = pipelineData.clients.filter(client => 
    client.monthIndex === currentMonthIndex
  );

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/50 p-6 bg-card/50">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonthIndex(Math.max(0, currentMonthIndex - 1))}
              disabled={currentMonthIndex === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-xl font-semibold text-foreground min-w-32 text-center">
              {currentMonth}
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonthIndex(Math.min(pipelineData.months.length - 1, currentMonthIndex + 1))}
              disabled={currentMonthIndex === pipelineData.months.length - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">Expected FUM</h3>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(currentKpis.expectedFUM)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">Expected IAF</h3>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(currentKpis.expectedIAF)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Repeat className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">Expected Recurring Revenue</h3>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(currentKpis.expectedRecurringRevenue)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Clients Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Pipeline Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {currentClients.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No clients in pipeline</h3>
                <p className="text-muted-foreground">No clients in pipeline for {currentMonth}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-4 font-semibold text-foreground">Client</th>
                      <th className="text-left p-4 font-semibold text-foreground">Stage</th>
                      <th className="text-left p-4 font-semibold text-foreground">Expected FUM</th>
                      <th className="text-left p-4 font-semibold text-foreground">IAF</th>
                      <th className="text-left p-4 font-semibold text-foreground">Waiting On</th>
                      <th className="text-left p-4 font-semibold text-foreground">Notes</th>
                      <th className="text-left p-4 font-semibold text-foreground">Next Meeting</th>
                      <th className="text-left p-4 font-semibold text-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentClients.map((client) => (
                      <tr 
                        key={client.id} 
                        className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                      >
                        <td className="p-4">
                          <p className="font-semibold text-foreground">{client.name}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-3 h-3 rounded-full",
                              client.stage === 'Prospect' && "bg-yellow-500",
                              client.stage === 'Qualified' && "bg-blue-500",
                              client.stage === 'Proposal' && "bg-purple-500",
                              client.stage === 'Negotiation' && "bg-orange-500",
                              client.stage === 'Closed' && "bg-green-500"
                            )} />
                            <span className="text-sm text-muted-foreground">{client.stage}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-foreground">
                            {formatCurrency(client.expectedFUM)}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-muted-foreground">
                            {formatCurrency(client.iaf)}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-muted-foreground">
                            {client.waitingOn}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-muted-foreground">
                            {client.notes}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-muted-foreground">
                            {client.nextMeeting}
                          </p>
                        </td>
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/clients/${client.id}`)}
                            className="text-primary hover:text-primary/80"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 