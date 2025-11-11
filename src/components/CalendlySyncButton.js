import React, { useState } from 'react';
import { Button } from './ui/button';
import { RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

/**
 * CalendlySyncButton - Manual sync button for Calendly meetings
 * Shows progress, estimated time, and clear feedback
 * 
 * Props:
 * - connectionId: The calendar connection ID
 * - onSyncComplete: Callback when sync completes
 * - variant: Button variant (default, outline, ghost)
 * - size: Button size (default, sm, lg)
 * - showEstimate: Show estimated time (default: true)
 */
const CalendlySyncButton = ({ 
  connectionId, 
  onSyncComplete, 
  variant = 'outline',
  size = 'default',
  showEstimate = true,
  className = ''
}) => {
  const { getAccessToken } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // 'success', 'error', null
  const [syncMessage, setSyncMessage] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus(null);
      setSyncMessage('');
      setSyncProgress(0);

      const token = await getAccessToken();

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 300);

      console.log('🔄 Starting manual Calendly sync...');

      const response = await axios.post(
        `${API_BASE_URL}/api/calendly/sync`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      clearInterval(progressInterval);
      setSyncProgress(100);

      console.log('✅ Sync completed:', response.data);

      const meetingsAdded = response.data.improvement?.meetings_added || 0;
      const totalMeetings = response.data.improvement?.total_after || 0;

      if (meetingsAdded > 0) {
        setSyncMessage(`✅ Synced ${meetingsAdded} new meeting${meetingsAdded !== 1 ? 's' : ''}! Total: ${totalMeetings}`);
        setSyncStatus('success');
      } else {
        setSyncMessage(`✅ All meetings up to date (${totalMeetings} total)`);
        setSyncStatus('success');
      }

      // Call completion callback
      if (onSyncComplete) {
        onSyncComplete(response.data);
      }

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSyncStatus(null);
        setSyncMessage('');
        setSyncProgress(0);
      }, 5000);

    } catch (error) {
      console.error('❌ Sync failed:', error);
      
      setSyncProgress(0);
      setSyncStatus('error');
      
      if (error.response?.status === 400) {
        setSyncMessage('❌ No Calendly connection found. Please reconnect.');
      } else if (error.response?.status === 503) {
        setSyncMessage('❌ Service temporarily unavailable. Please try again.');
      } else {
        setSyncMessage('❌ Sync failed. Please try again.');
      }

      // Clear error message after 5 seconds
      setTimeout(() => {
        setSyncStatus(null);
        setSyncMessage('');
      }, 5000);

    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <Button
        onClick={handleSync}
        disabled={isSyncing}
        variant={variant}
        size={size}
        className="relative"
      >
        {isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Syncing... {syncProgress}%
          </>
        ) : syncStatus === 'success' ? (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
            Synced
          </>
        ) : syncStatus === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4 mr-2 text-red-600" />
            Failed
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Now
          </>
        )}
      </Button>

      {/* Progress bar */}
      {isSyncing && (
        <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
          <div 
            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${syncProgress}%` }}
          />
        </div>
      )}

      {/* Estimated time */}
      {showEstimate && isSyncing && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Estimated: 5-10 seconds</span>
        </div>
      )}

      {/* Status message */}
      {syncMessage && (
        <p className={`text-xs ${
          syncStatus === 'success' ? 'text-green-600' : 
          syncStatus === 'error' ? 'text-red-600' : 
          'text-muted-foreground'
        }`}>
          {syncMessage}
        </p>
      )}
    </div>
  );
};

export default CalendlySyncButton;

