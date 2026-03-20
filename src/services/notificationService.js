// Advicly Notification Service
import logger from '../utils/logger';

class NotificationService {
  constructor() {
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    this.registration = null;
    this.subscription = null;
    this.vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
  }

  // Initialize the service worker and push notifications
  async initialize() {
    if (!this.isSupported) {
      logger.warn('Push notifications are not supported in this browser');
      return false;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      logger.log('Service Worker registered successfully');

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));

      return true;
    } catch (error) {
      logger.error('Service Worker registration failed:', error);
      return false;
    }
  }

  // Handle messages from service worker
  handleServiceWorkerMessage(event) {
    if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
      // Navigate to the specified URL
      window.location.href = event.data.url;
    }
  }

  // Request notification permission
  async requestPermission() {
    if (!this.isSupported) {
      return 'unsupported';
    }

    const permission = await Notification.requestPermission();
    logger.log('Notification permission:', permission);
    return permission;
  }

  // Get current notification permission status
  getPermissionStatus() {
    if (!this.isSupported) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  // Subscribe to push notifications
  async subscribe() {
    if (!this.registration || !this.vapidPublicKey) {
      logger.error('Service worker not registered or VAPID key missing');
      return null;
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      this.subscription = subscription;
      logger.log('Push subscription successful:', subscription);

      // Send subscription to backend
      await this.sendSubscriptionToBackend(subscription);
      
      return subscription;
    } catch (error) {
      logger.error('Push subscription failed:', error);
      return null;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe() {
    if (!this.subscription) {
      return true;
    }

    try {
      await this.subscription.unsubscribe();
      await this.removeSubscriptionFromBackend();
      this.subscription = null;
      logger.log('Push unsubscription successful');
      return true;
    } catch (error) {
      logger.error('Push unsubscription failed:', error);
      return false;
    }
  }

  // Get current subscription status
  async getSubscription() {
    if (!this.registration) {
      return null;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      this.subscription = subscription;
      return subscription;
    } catch (error) {
      logger.error('Error getting subscription:', error);
      return null;
    }
  }

  // Send subscription to backend
  async sendSubscriptionToBackend(subscription) {
    const token = localStorage.getItem('token');
    if (!token) {
      logger.error('No auth token found');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com'}/api/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to backend');
      }

      logger.log('Subscription sent to backend successfully');
    } catch (error) {
      logger.error('Error sending subscription to backend:', error);
    }
  }

  // Remove subscription from backend
  async removeSubscriptionFromBackend() {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    try {
      await fetch(`${process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com'}/api/notifications/unsubscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      logger.error('Error removing subscription from backend:', error);
    }
  }

  // Show local notification (fallback)
  showLocalNotification(title, options = {}) {
    if (!this.isSupported || Notification.permission !== 'granted') {
      return;
    }

    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    return notification;
  }

  // Utility function to convert VAPID key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Test notification
  async testNotification() {
    const token = localStorage.getItem('token');
    if (!token) {
      logger.error('No auth token found');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com'}/api/notifications/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        logger.log('Test notification sent');
      }
    } catch (error) {
      logger.error('Error sending test notification:', error);
    }
  }
}

const notificationService = new NotificationService();
export default notificationService;
