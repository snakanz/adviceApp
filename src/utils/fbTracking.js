/**
 * Facebook/Meta Click ID (fbclid) Tracking Utility
 * Captures fbclid from URL and stores it for Meta Conversions API attribution.
 */

/**
 * Capture fbclid from URL and store as fbc parameter.
 * fbc format: fb.1.{timestamp_ms}.{fbclid}
 * Call once on app load.
 */
export function captureFbclid() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get('fbclid');

    if (fbclid) {
      const fbc = `fb.1.${Date.now()}.${fbclid}`;
      localStorage.setItem('_fbc', fbc);
      localStorage.setItem('_fbclid', fbclid);

      // Also set as first-party cookie (survives localStorage clears)
      const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `_fbc=${fbc}; path=/; expires=${expires}; SameSite=Lax; Secure`;
    }
  } catch (e) {
    // Silent fail — tracking should never break the app
  }
}

/** Retrieve stored fbc value (localStorage first, cookie fallback) */
export function getStoredFbc() {
  try {
    return localStorage.getItem('_fbc') || getCookie('_fbc') || null;
  } catch (e) {
    return null;
  }
}

/** Retrieve stored raw fbclid value */
export function getStoredFbclid() {
  try {
    return localStorage.getItem('_fbclid') || null;
  } catch (e) {
    return null;
  }
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? match[1] : null;
}
