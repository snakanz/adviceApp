import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import {
  Bell,
  BellOff,
  Calendar,
  Users,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import notificationService from '../services/notificationService';

const NotificationSettings = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const initializeNotifications = useCallback(async () => {
    setLoading(true);

    // Check if notifications are supported
    const supported = await notificationService.initialize();
    setIsSupported(supported);

    if (supported) {
      // Get current permission status
      const currentPermission = notificationService.getPermissionStatus();
      setPermission(currentPermission);

      // Check subscription status
      const subscription = await notificationService.getSubscription();
      setIsSubscribed(!!subscription);

      // Load preferences
      await loadPreferences();
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  const loadPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com'}/api/notifications/preferences`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const prefs = await response.json();
        setPreferences(prefs);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const handleEnableNotifications = async () => {
    setUpdating(true);
    
    try {
      // Request permission
      const newPermission = await notificationService.requestPermission();
      setPermission(newPermission);
      
      if (newPermission === 'granted') {
        // Subscribe to push notifications
        const subscription = await notificationService.subscribe();
        setIsSubscribed(!!subscription);
        
        if (subscription) {
          // Load preferences after successful subscription
          await loadPreferences();
        }
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    }
    
    setUpdating(false);
  };

  const handleDisableNotifications = async () => {
    setUpdating(true);
    
    try {
      await notificationService.unsubscribe();
      setIsSubscribed(false);
    } catch (error) {
      console.error('Error disabling notifications:', error);
    }
    
    setUpdating(false);
  };

  const handlePreferenceChange = async (key, value) => {
    if (!preferences) return;
    
    const updatedPreferences = {
      ...preferences,
      [key]: value
    };
    
    setPreferences(updatedPreferences);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com'}/api/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedPreferences)
      });
      
      if (!response.ok) {
        // Revert on error
        setPreferences(preferences);
        console.error('Failed to update preferences');
      }
    } catch (error) {
      // Revert on error
      setPreferences(preferences);
      console.error('Error updating preferences:', error);
    }
  };

  const handleTestNotification = async () => {
    try {
      await notificationService.testNotification();
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return { icon: CheckCircle, color: 'text-green-600', text: 'Enabled' };
      case 'denied':
        return { icon: XCircle, color: 'text-red-600', text: 'Blocked' };
      default:
        return { icon: AlertCircle, color: 'text-yellow-600', text: 'Not Set' };
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="w-5 h-5 text-muted-foreground" />
            Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Push notifications are not supported in this browser.
          </p>
        </CardContent>
      </Card>
    );
  }

  const statusInfo = getPermissionStatus();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      {/* Main Notification Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
              <div>
                <p className="font-medium">Browser Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Status: {statusInfo.text}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSubscribed && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Active
                </Badge>
              )}
              {permission === 'granted' && !isSubscribed ? (
                <Button 
                  onClick={handleEnableNotifications}
                  disabled={updating}
                  size="sm"
                >
                  {updating ? 'Enabling...' : 'Enable'}
                </Button>
              ) : permission === 'granted' && isSubscribed ? (
                <Button 
                  onClick={handleDisableNotifications}
                  disabled={updating}
                  variant="outline"
                  size="sm"
                >
                  {updating ? 'Disabling...' : 'Disable'}
                </Button>
              ) : (
                <Button 
                  onClick={handleEnableNotifications}
                  disabled={updating}
                  size="sm"
                >
                  {updating ? 'Requesting...' : 'Enable Notifications'}
                </Button>
              )}
            </div>
          </div>
          
          {isSubscribed && (
            <div className="pt-4 border-t">
              <Button 
                onClick={handleTestNotification}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Send Test Notification
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      {preferences && isSubscribed && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Meeting Notifications */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h4 className="font-medium">Meeting Notifications</h4>
              </div>
              <div className="space-y-3 ml-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm">Meeting reminders</label>
                  <Switch
                    checked={preferences.meeting_reminders}
                    onCheckedChange={(checked) => handlePreferenceChange('meeting_reminders', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">AI summaries ready</label>
                  <Switch
                    checked={preferences.meeting_summaries}
                    onCheckedChange={(checked) => handlePreferenceChange('meeting_summaries', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">Meeting updates</label>
                  <Switch
                    checked={preferences.meeting_updates}
                    onCheckedChange={(checked) => handlePreferenceChange('meeting_updates', checked)}
                  />
                </div>
              </div>
            </div>

            {/* Client Notifications */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h4 className="font-medium">Client Notifications</h4>
              </div>
              <div className="space-y-3 ml-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm">Client updates</label>
                  <Switch
                    checked={preferences.client_updates}
                    onCheckedChange={(checked) => handlePreferenceChange('client_updates', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">New clients</label>
                  <Switch
                    checked={preferences.new_clients}
                    onCheckedChange={(checked) => handlePreferenceChange('new_clients', checked)}
                  />
                </div>
              </div>
            </div>

            {/* Ask Advicly Notifications */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h4 className="font-medium">Ask Advicly</h4>
              </div>
              <div className="space-y-3 ml-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm">AI responses</label>
                  <Switch
                    checked={preferences.ask_advicly_responses}
                    onCheckedChange={(checked) => handlePreferenceChange('ask_advicly_responses', checked)}
                  />
                </div>
              </div>
            </div>

            {/* Reminder Timing */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <h4 className="font-medium">Reminder Timing</h4>
              </div>
              <div className="space-y-3 ml-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm">15 minutes before</label>
                  <Switch
                    checked={preferences.reminder_15_min}
                    onCheckedChange={(checked) => handlePreferenceChange('reminder_15_min', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">1 hour before</label>
                  <Switch
                    checked={preferences.reminder_1_hour}
                    onCheckedChange={(checked) => handlePreferenceChange('reminder_1_hour', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">1 day before</label>
                  <Switch
                    checked={preferences.reminder_1_day}
                    onCheckedChange={(checked) => handlePreferenceChange('reminder_1_day', checked)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationSettings;
