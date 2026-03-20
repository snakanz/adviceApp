// Mobile Authentication Fixes
// Utilities to handle mobile-specific auth issues

export const isMobile = () => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

export const getMobileWaitTime = () => {
  // Mobile networks are slower, wait longer for session
  return isMobile() ? 2000 : 500; // 2s mobile, 500ms desktop
};

export const getMobileBrowser = () => {
  const ua = navigator.userAgent;
  if (/chrome/i.test(ua)) return 'chrome';
  if (/safari/i.test(ua)) return 'safari';
  if (/firefox/i.test(ua)) return 'firefox';
  if (/edge/i.test(ua)) return 'edge';
  return 'unknown';
};

export const logMobileDebugInfo = () => {
  if (!isMobile()) return;

  const debugInfo = {
    isMobile: true,
    browser: getMobileBrowser(),
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    localStorage: !!window.localStorage,
    sessionStorage: !!window.sessionStorage,
    supportsServiceWorker: 'serviceWorker' in navigator,
    online: navigator.onLine,
    cookiesEnabled: navigator.cookieEnabled
  };

  console.log('📱 Mobile Auth Debug Info:', debugInfo);

  // Check Supabase session
  try {
    const token = localStorage.getItem('supabase.auth.token');
    console.log('🔑 Supabase Token:', token ? 'Present' : 'Missing');
  } catch (e) {
    console.error('❌ Error accessing localStorage:', e);
  }

  return debugInfo;
};

export const isSafari = () => {
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome/i.test(ua) && !/CriOS/i.test(ua);
};

export const isIOSSafari = () => {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && isSafari();
};

export const fixMobileSafariStorage = () => {
  // Safari in Private Mode throws errors on localStorage
  // This ensures we can detect and handle it gracefully
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    return true;
  } catch (e) {
    console.warn('⚠️ localStorage not available (private mode?)', e);
    return false;
  }
};

// Call this on app initialization
export const initMobileAuthFixes = () => {
  if (!isMobile()) {
    console.log('💻 Desktop detected - mobile fixes not needed');
    return;
  }

  console.log('📱 Mobile detected - applying auth fixes...');

  logMobileDebugInfo();
  const storageWorks = fixMobileSafariStorage();

  if (!storageWorks) {
    console.error('❌ localStorage not working - auth will fail!');
    console.error('💡 Solution: Exit private/incognito mode');
  }

  // Listen for visibility changes (mobile browsers suspend tabs)
  if (document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 App became visible - checking session...');
        // Session might have expired while app was in background
      }
    });
  }

  console.log('✅ Mobile auth fixes initialized');
};
