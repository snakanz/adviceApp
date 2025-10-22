import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar as CalendarIntegrationsIcon, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

export default function CalendarSyncButton() {
  const { getAccessToken } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkCalendarStatus();
    // Check status every 30 seconds
    const interval = setInterval(checkCalendarStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkCalendarStatus = async () => {
    try {
      setIsLoading(true);
      const token = await getAccessToken();

      // Check for any active calendar connection
      const response = await axios.get(`${API_BASE_URL}/api/calendar-connections`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Check if there's at least one active connection
      const hasActiveConnection = response.data.connections &&
        response.data.connections.some(conn => conn.is_active);

      setIsConnected(hasActiveConnection || false);
    } catch (error) {
      console.error('Error checking calendar status:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <NavLink
      to="/settings/calendar"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )
      }
    >
      <div className="relative">
        <CalendarIntegrationsIcon className="w-4 h-4" />
        {/* Status indicator */}
        <div className="absolute -bottom-1 -right-1">
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
          ) : isConnected ? (
            <CheckCircle2 className="w-3 h-3 text-green-500" />
          ) : (
            <AlertCircle className="w-3 h-3 text-red-500" />
          )}
        </div>
      </div>
      <span>Calendar Sync</span>
    </NavLink>
  );
}

