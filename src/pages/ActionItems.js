import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Plus,
  Search,
  Bell,
  Timer
} from 'lucide-react';

export default function ActionItems() {
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'overdue', 'completed'


  useEffect(() => {
    // Mock data for now - will be replaced with API calls
    const mockActionItems = [
    {
      id: 1,
      title: 'Chase client for booking next weekend',
      description: 'Follow up with John Smith about scheduling his pension review meeting',
      priority: 'high',
      type: 'follow-up',
      status: 'pending',
      dueDate: '2025-09-20',
      clientName: 'John Smith',
      clientEmail: 'john.smith@email.com',
      createdAt: '2025-09-15',
      source: 'manual'
    },
    {
      id: 2,
      title: 'Send pension transfer documents to Sarah',
      description: 'Email the completed pension transfer forms to Sarah Johnson',
      priority: 'medium',
      type: 'document',
      status: 'pending',
      dueDate: '2025-09-18',
      clientName: 'Sarah Johnson',
      clientEmail: 'sarah.johnson@email.com',
      createdAt: '2025-09-16',
      source: 'meeting'
    },
    {
      id: 3,
      title: 'Review investment portfolio with Mike',
      description: 'Client has no upcoming meetings scheduled - needs follow-up',
      priority: 'medium',
      type: 'follow-up',
      status: 'overdue',
      dueDate: '2025-09-15',
      clientName: 'Mike Wilson',
      clientEmail: 'mike.wilson@email.com',
      createdAt: '2025-09-10',
      source: 'auto-generated'
    },
    {
      id: 4,
      title: 'Complete ISA application for Emma',
      description: 'Finalize and submit ISA application paperwork',
      priority: 'high',
      type: 'application',
      status: 'completed',
      dueDate: '2025-09-16',
      clientName: 'Emma Davis',
      clientEmail: 'emma.davis@email.com',
      createdAt: '2025-09-12',
      completedAt: '2025-09-16',
      source: 'meeting'
    }
  ];

    // Simulate API call
    setTimeout(() => {
      setActionItems(mockActionItems);
      setLoading(false);
    }, 500);
  }, []);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'follow-up': return <User className="w-4 h-4" />;
      case 'document': return <Calendar className="w-4 h-4" />;
      case 'application': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const filteredItems = actionItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
                         item.clientName.toLowerCase().includes(search.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'pending') return matchesSearch && item.status === 'pending';
    if (filter === 'overdue') return matchesSearch && item.status === 'overdue';
    if (filter === 'completed') return matchesSearch && item.status === 'completed';
    
    return matchesSearch;
  });

  const handleCompleteItem = (itemId) => {
    setActionItems(items => 
      items.map(item => 
        item.id === itemId 
          ? { ...item, status: 'completed', completedAt: new Date().toISOString().split('T')[0] }
          : item
      )
    );
  };

  const handleSnoozeItem = (itemId, days = 7) => {
    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + days);
    
    setActionItems(items => 
      items.map(item => 
        item.id === itemId 
          ? { ...item, dueDate: newDueDate.toISOString().split('T')[0] }
          : item
      )
    );
  };

  const pendingCount = actionItems.filter(item => item.status === 'pending').length;
  const overdueCount = actionItems.filter(item => item.status === 'overdue').length;

  if (loading) {
    return (
      <div className="h-full bg-background p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-4">Action Items</h1>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background">
      {/* Header */}
      <div className="border-b border-border/50 p-6 bg-card/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">Action Items</h1>
            <div className="flex items-center gap-2">
              {overdueCount > 0 && (
                <Badge className="bg-red-100 text-red-800 border-red-200">
                  {overdueCount} Overdue
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                  {pendingCount} Pending
                </Badge>
              )}
            </div>
          </div>
          <Button
            onClick={() => console.log('Add Action Item clicked')}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Action Item
          </Button>
        </div>

        {/* Filters and Search */}
        <div className="flex gap-4 items-center">
          <div className="flex gap-2">
            <Button
              onClick={() => setFilter('all')}
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
            >
              All ({actionItems.length})
            </Button>
            <Button
              onClick={() => setFilter('pending')}
              variant={filter === 'pending' ? 'default' : 'outline'}
              size="sm"
            >
              Pending ({pendingCount})
            </Button>
            <Button
              onClick={() => setFilter('overdue')}
              variant={filter === 'overdue' ? 'default' : 'outline'}
              size="sm"
            >
              Overdue ({overdueCount})
            </Button>
            <Button
              onClick={() => setFilter('completed')}
              variant={filter === 'completed' ? 'default' : 'outline'}
              size="sm"
            >
              Completed
            </Button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search action items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Action Items List */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="border-border/50 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(item.type)}
                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getPriorityColor(item.priority)}>
                          {item.priority}
                        </Badge>
                        <Badge className={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {item.description}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{item.clientName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 ml-4">
                    {item.status !== 'completed' && (
                      <>
                        <Button
                          onClick={() => handleCompleteItem(item.id)}
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleSnoozeItem(item.id)}
                          variant="outline"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Timer className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No action items found</h3>
            <p className="text-muted-foreground">
              {search ? 'Try adjusting your search terms.' : 'All caught up! No action items to display.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
