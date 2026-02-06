import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

/**
 * ActionItemsContext - Unified state management for action items
 *
 * Provides a single source of truth for action items across the app.
 * When an item is toggled in one view (e.g., Pipeline), it immediately
 * reflects in all other views (e.g., ActionItems Dashboard, Meetings).
 */
const ActionItemsContext = createContext(null);

export const useActionItems = () => {
  const context = useContext(ActionItemsContext);
  if (!context) {
    throw new Error('useActionItems must be used within an ActionItemsProvider');
  }
  return context;
};

export const ActionItemsProvider = ({ children }) => {
  // Map of action items by ID for O(1) lookup
  const [actionItemsById, setActionItemsById] = useState({});

  // Grouped views for different use cases
  const [clientActionItems, setClientActionItems] = useState({}); // { clientId: [...items] }
  const [meetingActionItems, setMeetingActionItems] = useState({}); // { meetingId: [...items] }

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get auth token
  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }, []);

  /**
   * Toggle an action item's completion status
   * Optimistically updates local state, then syncs with backend
   */
  const toggleActionItem = useCallback(async (actionItemId, source = 'meeting') => {
    const token = await getToken();
    if (!token) return;

    // Get current state
    const currentItem = actionItemsById[actionItemId];
    const newCompleted = currentItem ? !currentItem.completed : true;

    // Optimistic update - update all state stores immediately
    setActionItemsById(prev => ({
      ...prev,
      [actionItemId]: { ...prev[actionItemId], completed: newCompleted }
    }));

    // Update client grouped items
    setClientActionItems(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(clientId => {
        updated[clientId] = updated[clientId].map(item =>
          item.id === actionItemId ? { ...item, completed: newCompleted } : item
        );
      });
      return updated;
    });

    // Update meeting grouped items
    setMeetingActionItems(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(meetingId => {
        updated[meetingId] = updated[meetingId].map(item =>
          item.id === actionItemId ? { ...item, completed: newCompleted } : item
        );
      });
      return updated;
    });

    try {
      const response = await fetch(
        `${API_URL}/api/transcript-action-items/action-items/${actionItemId}/toggle`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ source })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to toggle action item');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error toggling action item:', err);
      setError(err.message);

      // Revert on error
      setActionItemsById(prev => ({
        ...prev,
        [actionItemId]: { ...prev[actionItemId], completed: !newCompleted }
      }));

      setClientActionItems(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(clientId => {
          updated[clientId] = updated[clientId].map(item =>
            item.id === actionItemId ? { ...item, completed: !newCompleted } : item
          );
        });
        return updated;
      });

      setMeetingActionItems(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(meetingId => {
          updated[meetingId] = updated[meetingId].map(item =>
            item.id === actionItemId ? { ...item, completed: !newCompleted } : item
          );
        });
        return updated;
      });

      throw err;
    }
  }, [actionItemsById, getToken]);

  /**
   * Fetch action items for a specific client
   */
  const fetchClientActionItems = useCallback(async (clientId) => {
    const token = await getToken();
    if (!token) return [];

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/transcript-action-items/clients/${clientId}/action-items`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch client action items');
      }

      const data = await response.json();
      const items = data.meetings?.flatMap(m => m.actionItems) || [];

      // Update stores
      setClientActionItems(prev => ({ ...prev, [clientId]: items }));

      // Update by-ID map
      const byId = {};
      items.forEach(item => { byId[item.id] = item; });
      setActionItemsById(prev => ({ ...prev, ...byId }));

      return items;
    } catch (err) {
      console.error('Error fetching client action items:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  /**
   * Fetch action items for a specific meeting
   */
  const fetchMeetingActionItems = useCallback(async (meetingId) => {
    const token = await getToken();
    if (!token) return [];

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/transcript-action-items/meetings/${meetingId}/action-items`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch meeting action items');
      }

      const data = await response.json();
      const items = data.actionItems || [];

      // Update stores
      setMeetingActionItems(prev => ({ ...prev, [meetingId]: items }));

      // Update by-ID map
      const byId = {};
      items.forEach(item => { byId[item.id] = item; });
      setActionItemsById(prev => ({ ...prev, ...byId }));

      return items;
    } catch (err) {
      console.error('Error fetching meeting action items:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  /**
   * Edit an action item's text
   */
  const editActionItem = useCallback(async (actionItemId, newText) => {
    const token = await getToken();
    if (!token) return;

    // Optimistic update
    const oldText = actionItemsById[actionItemId]?.actionText;

    setActionItemsById(prev => ({
      ...prev,
      [actionItemId]: { ...prev[actionItemId], actionText: newText }
    }));

    try {
      const response = await fetch(
        `${API_URL}/api/transcript-action-items/action-items/${actionItemId}/text`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ actionText: newText })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to edit action item');
      }

      return await response.json();
    } catch (err) {
      console.error('Error editing action item:', err);
      setError(err.message);

      // Revert
      setActionItemsById(prev => ({
        ...prev,
        [actionItemId]: { ...prev[actionItemId], actionText: oldText }
      }));

      throw err;
    }
  }, [actionItemsById, getToken]);

  /**
   * Get action items for a client from cache
   */
  const getClientItems = useCallback((clientId) => {
    return clientActionItems[clientId] || [];
  }, [clientActionItems]);

  /**
   * Get action items for a meeting from cache
   */
  const getMeetingItems = useCallback((meetingId) => {
    return meetingActionItems[meetingId] || [];
  }, [meetingActionItems]);

  /**
   * Get a single item by ID from cache
   */
  const getItemById = useCallback((id) => {
    return actionItemsById[id] || null;
  }, [actionItemsById]);

  /**
   * Clear all cached data
   */
  const clearCache = useCallback(() => {
    setActionItemsById({});
    setClientActionItems({});
    setMeetingActionItems({});
    setError(null);
  }, []);

  const value = {
    // State
    actionItemsById,
    clientActionItems,
    meetingActionItems,
    loading,
    error,

    // Actions
    toggleActionItem,
    editActionItem,
    fetchClientActionItems,
    fetchMeetingActionItems,

    // Getters
    getClientItems,
    getMeetingItems,
    getItemById,

    // Utils
    clearCache
  };

  return (
    <ActionItemsContext.Provider value={value}>
      {children}
    </ActionItemsContext.Provider>
  );
};

export default ActionItemsContext;
