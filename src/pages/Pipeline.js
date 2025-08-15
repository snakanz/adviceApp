import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight, 
  TrendingUp, 
  DollarSign,
  Users,
  Calendar
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
        const token = localStorage.getItem('jwt');
        const response = await fetch('https://adviceapp-9rgw.onrender.com/api/pipeline', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch pipeline data');
        }
        const data = await response.json();
        setPipelineData(data);
        
        // Set current month to the most recent month with data
        if (data.months && data.months.length > 0) {
          setCurrentMonthIndex(data.months.length - 1);
        }
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

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    try {
      // Handle both YYYY-MM and full date formats
      const date = dateString.includes('-01') ? 
        new Date(dateString) : 
        new Date(dateString + '-01');
      
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      return date.toLocaleDateString('en-GB', { 
        month: 'long', 
        year: 'numeric' 
      });
    } catch (error) {
      return 'Invalid Date';
    }
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

  if (!pipelineData || !pipelineData.months || pipelineData.months.length === 0) {
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
  const currentClients = currentMonth?.clients || [];

  // Calculate month-specific KPIs
  const monthValue = currentMonth?.totalValue || 0;
  const monthClientCount = currentMonth?.clientCount || 0;
  const monthAverageValue = monthClientCount > 0 ? monthValue / monthClientCount : 0;

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
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground min-w-32">
                {currentMonth?.month || 'No Data'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {pipelineData.months.length} month{pipelineData.months.length !== 1 ? 's' : ''} total
              </p>
            </div>
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

      {/* Month-specific KPI Cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Month Value</h3>
                  <p className="text-xs text-muted-foreground">Total: {formatCurrency(pipelineData.totalValue)}</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(monthValue)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Month Clients</h3>
                  <p className="text-xs text-muted-foreground">Total: {pipelineData.totalClients}</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {monthClientCount}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Month Average</h3>
                  <p className="text-xs text-muted-foreground">Overall: {formatCurrency(pipelineData.averageValue)}</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(monthAverageValue)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Month Navigation Pills */}
        <div className="mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {pipelineData.months.map((month, index) => (
              <Button
                key={month.monthKey}
                variant={index === currentMonthIndex ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentMonthIndex(index)}
                className="whitespace-nowrap"
              >
                <Calendar className="w-4 h-4 mr-2" />
                {month.month}
                <span className="ml-2 text-xs opacity-75">
                  ({month.clientCount})
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Clients Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Pipeline Clients - {currentMonth?.month}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {currentClients.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No clients in pipeline</h3>
                <p className="text-muted-foreground">No clients in pipeline for {currentMonth?.month || 'this month'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-4 font-semibold text-foreground">Client</th>
                      <th className="text-left p-4 font-semibold text-foreground">Business Type</th>
                      <th className="text-left p-4 font-semibold text-foreground">Value</th>
                      <th className="text-left p-4 font-semibold text-foreground">Close Month</th>
                      <th className="text-left p-4 font-semibold text-foreground">Meetings</th>
                      <th className="text-left p-4 font-semibold text-foreground">Email</th>
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
                          <span className="text-sm text-muted-foreground">
                            {client.business_type || 'Not specified'}
                          </span>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-foreground">
                            {client.likely_value ? formatCurrency(client.likely_value) : 'Not specified'}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-muted-foreground">
                            {formatDate(client.likely_close_month)}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-muted-foreground">
                            {client.meeting_count} meetings
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-muted-foreground">
                            {client.email}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-muted-foreground">
                            -
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