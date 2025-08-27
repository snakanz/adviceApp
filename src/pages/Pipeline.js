import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  Plus,
  CheckCircle,
  Circle,
  Clock,
  ArrowRight,
  Target,
  User,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import {
  useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

// Generate next 12 months starting from current month
function generateMonthColumns() {
  const months = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthKey = date.toISOString().substring(0, 7); // YYYY-MM
    const monthName = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });

    months.push({
      monthKey,
      monthName,
      clients: []
    });
  }

  return months;
}

export default function Pipeline() {
  const navigate = useNavigate();
  useAuth(); // Keep for potential future use
  const [pipelineData, setPipelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monthColumns, setMonthColumns] = useState(generateMonthColumns());
  const [unscheduledClients, setUnscheduledClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showTodoDialog, setShowTodoDialog] = useState(false);
  const [clientTodos, setClientTodos] = useState([]);
  const [newTodo, setNewTodo] = useState({ title: '', description: '', priority: 3, category: 'general' });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchPipelineData();
  }, []);

  const fetchPipelineData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/pipeline`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch pipeline data');
      }
      const data = await response.json();
      setPipelineData(data);

      // Organize clients into month columns and unscheduled
      const newMonthColumns = generateMonthColumns();
      const newUnscheduledClients = data.unscheduledClients || [];

      // Populate month columns with clients
      if (data.months) {
        data.months.forEach(monthData => {
          const columnIndex = newMonthColumns.findIndex(col => col.monthKey === monthData.monthKey);
          if (columnIndex !== -1) {
            newMonthColumns[columnIndex].clients = monthData.clients || [];
          }
        });
      }

      setMonthColumns(newMonthColumns);
      setUnscheduledClients(newUnscheduledClients);
    } catch (err) {
      setError(err.message);
      setPipelineData(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle drag end for moving clients between months
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Find the client being dragged
    let draggedClient = null;
    let sourceContainer = null;

    // Check unscheduled clients
    const unscheduledIndex = unscheduledClients.findIndex(client => client.id === activeId);
    if (unscheduledIndex !== -1) {
      draggedClient = unscheduledClients[unscheduledIndex];
      sourceContainer = 'unscheduled';
    } else {
      // Check month columns
      for (let i = 0; i < monthColumns.length; i++) {
        const clientIndex = monthColumns[i].clients.findIndex(client => client.id === activeId);
        if (clientIndex !== -1) {
          draggedClient = monthColumns[i].clients[clientIndex];
          sourceContainer = monthColumns[i].monthKey;
          break;
        }
      }
    }

    if (!draggedClient) return;

    // Determine target container
    let targetContainer = overId;
    let targetMonthKey = null;

    if (overId === 'unscheduled') {
      targetMonthKey = null;
    } else {
      // Find the month column
      const targetColumn = monthColumns.find(col => col.monthKey === overId);
      if (targetColumn) {
        targetMonthKey = targetColumn.monthKey;
      }
    }

    // Don't do anything if dropping in the same container
    if (sourceContainer === targetContainer) return;

    try {
      // Update client in backend
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/pipeline/client/${draggedClient.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          likely_close_month: targetMonthKey ? `${targetMonthKey}-01` : null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update client');
      }

      // Update local state
      const updatedClient = { ...draggedClient, likely_close_month: targetMonthKey ? `${targetMonthKey}-01` : null };

      // Remove from source
      if (sourceContainer === 'unscheduled') {
        setUnscheduledClients(prev => prev.filter(client => client.id !== activeId));
      } else {
        setMonthColumns(prev => prev.map(col =>
          col.monthKey === sourceContainer
            ? { ...col, clients: col.clients.filter(client => client.id !== activeId) }
            : col
        ));
      }

      // Add to target
      if (targetContainer === 'unscheduled') {
        setUnscheduledClients(prev => [...prev, updatedClient]);
      } else {
        setMonthColumns(prev => prev.map(col =>
          col.monthKey === targetContainer
            ? { ...col, clients: [...col.clients, updatedClient] }
            : col
        ));
      }

    } catch (error) {
      console.error('Error updating client:', error);
      // Could add a toast notification here
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Fetch todos for a client
  const fetchClientTodos = async (clientId) => {
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/pipeline/client/${clientId}/todos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const todos = await response.json();
        setClientTodos(todos);
      }
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  };

  // Handle client card click to show details and todos
  const handleClientClick = (client) => {
    setSelectedClient(client);
    setShowTodoDialog(true);
    fetchClientTodos(client.id);
  };

  // Create a new todo
  const handleCreateTodo = async () => {
    if (!newTodo.title.trim() || !selectedClient) return;

    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/pipeline/client/${selectedClient.id}/todos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newTodo)
      });

      if (response.ok) {
        const todo = await response.json();
        setClientTodos(prev => [...prev, todo]);
        setNewTodo({ title: '', description: '', priority: 3, category: 'general' });
      }
    } catch (error) {
      console.error('Error creating todo:', error);
    }
  };

  // Toggle todo completion
  const handleToggleTodo = async (todoId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/pipeline/todos/${todoId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const updatedTodo = await response.json();
        setClientTodos(prev => prev.map(todo =>
          todo.id === todoId ? updatedTodo : todo
        ));
      }
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  };

  // Droppable Column Component
  function DroppableColumn({ id, title, icon, clients, children }) {
    const { isOver, setNodeRef } = useDroppable({
      id: id,
    });

    return (
      <Card
        ref={setNodeRef}
        className={cn(
          "border-border/50 flex flex-col transition-colors",
          isOver && "bg-primary/5 border-primary/30"
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {icon}
            {title}
            <span className="text-sm font-normal text-muted-foreground">
              ({clients.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-3 p-4">
          {children}
        </CardContent>
      </Card>
    );
  }

  // Draggable Client Card Component
  function ClientCard({ client, isDragging = false }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: client.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const completedTodos = clientTodos.filter(todo =>
      todo.client_id === client.id && todo.status === 'completed'
    ).length;
    const totalTodos = clientTodos.filter(todo => todo.client_id === client.id).length;

    return (
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          "cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md",
          isDragging && "opacity-50 rotate-2 shadow-lg"
        )}
        onClick={(e) => {
          e.stopPropagation();
          handleClientClick(client);
        }}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Client Name and Priority */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground truncate">
                {client.name || client.email}
              </h3>
              {client.priority_level && client.priority_level <= 2 && (
                <div className="w-2 h-2 bg-red-500 rounded-full" title="High Priority" />
              )}
            </div>

            {/* Business Type */}
            {client.business_type && (
              <p className="text-sm text-muted-foreground truncate">
                {client.business_type}
              </p>
            )}

            {/* Value */}
            {client.likely_value && (
              <div className="flex items-center gap-1 text-sm">
                <DollarSign className="w-3 h-3 text-green-600" />
                <span className="font-medium text-green-600">
                  {formatCurrency(client.likely_value)}
                </span>
              </div>
            )}

            {/* Meeting Count */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>{client.meeting_count || 0} meetings</span>
            </div>

            {/* Todo Progress */}
            {totalTodos > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-3 h-3 text-blue-600" />
                <span className="text-blue-600">
                  {completedTodos}/{totalTodos} tasks
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

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

  // Calculate totals for KPI display
  const totalClients = (pipelineData?.totalClients || 0) + unscheduledClients.length;
  const totalValue = pipelineData?.totalValue || 0;
  const averageValue = totalClients > 0 ? totalValue / totalClients : 0;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border/50 p-6 bg-card/50">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Client Pipeline</h1>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => fetchPipelineData()}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
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
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Total Pipeline Value</h3>
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(totalValue)}
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
                    <h3 className="text-sm font-medium text-muted-foreground">Total Clients</h3>
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {totalClients}
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
                    <h3 className="text-sm font-medium text-muted-foreground">Average Value</h3>
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(averageValue)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Pipeline Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-6 h-[calc(100vh-400px)] overflow-hidden">
            {/* Unscheduled Clients Column */}
            <DroppableColumn
              id="unscheduled"
              title="Unscheduled Clients"
              icon={<Clock className="w-5 h-5 text-orange-600" />}
              clients={unscheduledClients}
            >
              <SortableContext
                items={unscheduledClients.map(client => client.id)}
                strategy={verticalListSortingStrategy}
              >
                {unscheduledClients.map((client) => (
                  <ClientCard key={client.id} client={client} />
                ))}
              </SortableContext>
              {unscheduledClients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No unscheduled clients</p>
                </div>
              )}
            </DroppableColumn>

            {/* Month Columns */}
            {monthColumns.slice(0, 4).map((monthColumn) => (
              <DroppableColumn
                key={monthColumn.monthKey}
                id={monthColumn.monthKey}
                title={monthColumn.monthName}
                icon={<Calendar className="w-5 h-5 text-blue-600" />}
                clients={monthColumn.clients}
              >
                <SortableContext
                  items={monthColumn.clients.map(client => client.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {monthColumn.clients.map((client) => (
                    <ClientCard key={client.id} client={client} />
                  ))}
                </SortableContext>
                {monthColumn.clients.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No clients scheduled</p>
                  </div>
                )}
              </DroppableColumn>
            ))}
          </div>
        </div>
      </div>

      {/* Client Details and Todo Dialog */}
      <Dialog open={showTodoDialog} onOpenChange={setShowTodoDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {selectedClient?.name || selectedClient?.email}
            </DialogTitle>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-6">
              {/* Client Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-sm">{selectedClient.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Business Type</p>
                  <p className="text-sm">{selectedClient.business_type || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expected Value</p>
                  <p className="text-sm">
                    {selectedClient.likely_value ? formatCurrency(selectedClient.likely_value) : 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Meetings</p>
                  <p className="text-sm">{selectedClient.meeting_count || 0} meetings held</p>
                </div>
              </div>

              {/* Todo Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Tasks & Todo Items</h3>
                  <Button
                    onClick={() => navigate(`/clients/${selectedClient.id}`)}
                    variant="outline"
                    size="sm"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    View Full Client
                  </Button>
                </div>

                {/* Add New Todo */}
                <div className="space-y-3 p-4 border border-border/50 rounded-lg">
                  <h4 className="font-medium">Add New Task</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Task title..."
                      value={newTodo.title}
                      onChange={(e) => setNewTodo(prev => ({ ...prev, title: e.target.value }))}
                    />
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newTodo.category}
                      onChange={(e) => setNewTodo(prev => ({ ...prev, category: e.target.value }))}
                    >
                      <option value="general">General</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="meeting">Meeting</option>
                      <option value="document">Document</option>
                      <option value="research">Research</option>
                      <option value="proposal">Proposal</option>
                    </select>
                  </div>
                  <Textarea
                    placeholder="Task description (optional)..."
                    value={newTodo.description}
                    onChange={(e) => setNewTodo(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                  <div className="flex items-center justify-between">
                    <select
                      className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newTodo.priority}
                      onChange={(e) => setNewTodo(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    >
                      <option value={1}>High Priority</option>
                      <option value={2}>Medium-High</option>
                      <option value={3}>Medium</option>
                      <option value={4}>Low-Medium</option>
                      <option value={5}>Low Priority</option>
                    </select>
                    <Button onClick={handleCreateTodo} disabled={!newTodo.title.trim()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  </div>
                </div>

                {/* Todo List */}
                <div className="space-y-2">
                  {clientTodos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No tasks yet. Add one above to get started.</p>
                    </div>
                  ) : (
                    clientTodos.map((todo) => (
                      <div
                        key={todo.id}
                        className={cn(
                          "flex items-center gap-3 p-3 border border-border/50 rounded-lg transition-colors",
                          todo.status === 'completed' && "bg-muted/50 opacity-75"
                        )}
                      >
                        <button
                          onClick={() => handleToggleTodo(todo.id, todo.status)}
                          className="flex-shrink-0"
                        >
                          {todo.status === 'completed' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground hover:text-primary" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-medium",
                            todo.status === 'completed' && "line-through text-muted-foreground"
                          )}>
                            {todo.title}
                          </p>
                          {todo.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {todo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              todo.priority <= 2 ? "bg-red-100 text-red-700" :
                              todo.priority === 3 ? "bg-yellow-100 text-yellow-700" :
                              "bg-green-100 text-green-700"
                            )}>
                              Priority {todo.priority}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                              {todo.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}