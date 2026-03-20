# Detailed Changes Made - Line by Line

## Frontend Changes (Issue 1: Token Expiration)

### 1. src/pages/AuthCallback.js (Lines 44-47)

**REMOVED:**
```javascript
// Store the JWT token in localStorage for API calls
localStorage.setItem('jwt', session.access_token);
console.log('✅ JWT token stored in localStorage');
```

**REPLACED WITH:**
```javascript
// Note: Supabase automatically manages token storage in localStorage
// No need to manually store the JWT token
```

**Reason:** Supabase handles token storage automatically. Manual storage creates the legacy `'jwt'` key that causes expiration issues.

---

### 2. src/pages/Meetings.js (Line 425)

**CHANGED FROM:**
```javascript
const token = localStorage.getItem('jwt');
console.log('🔑 Using JWT token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

if (!token) {
  console.error('❌ No JWT token found in localStorage');
```

**CHANGED TO:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
console.log('🔑 Using access token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

if (!token) {
  console.error('❌ No access token found in session');
```

---

### 3. src/pages/Meetings.js (Line 1094)

**CHANGED FROM:**
```javascript
const token = localStorage.getItem('jwt');
const response = await fetch(`${API_URL}/api/transcript-action-items/meetings/${meetingId}/action-items`, {
```

**CHANGED TO:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
const response = await fetch(`${API_URL}/api/transcript-action-items/meetings/${meetingId}/action-items`, {
```

---

### 4. src/pages/Clients.js (Line 125)

**CHANGED FROM:**
```javascript
const token = localStorage.getItem('jwt');
const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com'}/api/transcript-action-items/clients/${clientId}/action-items`, {
```

**CHANGED TO:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com'}/api/transcript-action-items/clients/${clientId}/action-items`, {
```

---

### 5. src/pages/ActionItems.js (Line 99)

**CHANGED FROM:**
```javascript
const fetchActionItems = async () => {
  try {
    setLoading(true);
    const token = localStorage.getItem('jwt');

    // Build query params
```

**CHANGED TO:**
```javascript
const fetchActionItems = async () => {
  try {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // Build query params
```

---

### 6. src/pages/ActionItems.js (Line 163)

**CHANGED FROM:**
```javascript
const fetchStarredMeetings = async () => {
  try {
    const token = localStorage.getItem('jwt');
    const response = await fetch(`${API_URL}/api/calendar/meetings/starred`, {
```

**CHANGED TO:**
```javascript
const fetchStarredMeetings = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const response = await fetch(`${API_URL}/api/calendar/meetings/starred`, {
```

---

### 7. src/components/DataImport.js (Line 87)

**CHANGED FROM:**
```javascript
const formData = new FormData();
formData.append('file', file);

const token = localStorage.getItem('jwt');
const response = await fetch(`${API_URL}/api/data-import/preview`, {
```

**CHANGED TO:**
```javascript
const formData = new FormData();
formData.append('file', file);

const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
const response = await fetch(`${API_URL}/api/data-import/preview`, {
```

---

### 8. src/components/DataImport.js (Line 125)

**CHANGED FROM:**
```javascript
formData.append('skipDuplicates', importOptions.skipDuplicates.toString());
formData.append('updateExisting', importOptions.updateExisting.toString());

const token = localStorage.getItem('jwt');
const response = await fetch(`${API_URL}/api/data-import/execute`, {
```

**CHANGED TO:**
```javascript
formData.append('skipDuplicates', importOptions.skipDuplicates.toString());
formData.append('updateExisting', importOptions.updateExisting.toString());

const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
const response = await fetch(`${API_URL}/api/data-import/execute`, {
```

---

### 9. src/components/DataImport.js (Line 159)

**CHANGED FROM:**
```javascript
const handleDownloadTemplate = async () => {
  try {
    const token = localStorage.getItem('jwt');
    const response = await fetch(`${API_URL}/api/data-import/template`, {
```

**CHANGED TO:**
```javascript
const handleDownloadTemplate = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const response = await fetch(`${API_URL}/api/data-import/template`, {
```

---

### 10. src/components/DocumentsTab.js (Line 53)

**CHANGED FROM:**
```javascript
setLoading(true);
setError(null);

try {
  const token = localStorage.getItem('jwt');
  const response = await fetch(`${API_URL}/api/calendar/meetings/${meetingId}/documents`, {
```

**CHANGED TO:**
```javascript
setLoading(true);
setError(null);

try {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const response = await fetch(`${API_URL}/api/calendar/meetings/${meetingId}/documents`, {
```

---

### 11. src/components/ClientDocumentsSection.js (Line 67)

**CHANGED FROM:**
```javascript
const fetchClientDocuments = useCallback(async () => {
  try {
    const token = localStorage.getItem('jwt');
    const response = await fetch(`${API_URL}/api/client-documents/client/${clientId}`, {
```

**CHANGED TO:**
```javascript
const fetchClientDocuments = useCallback(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const response = await fetch(`${API_URL}/api/client-documents/client/${clientId}`, {
```

---

## Backend Changes (Issue 2: Calendar Switching)

### 12. backend/src/routes/auth.js (Lines 649-658)

**CHANGED FROM:**
```javascript
if (!providerToken) {
  console.log('⚠️ No provider token found - user may not have signed in with Google');
  return res.json({
    success: false,
    message: 'No Google Calendar access - user did not sign in with Google OAuth'
  });
}
```

**CHANGED TO:**
```javascript
if (!providerToken) {
  console.log('⚠️ No provider token found in app_metadata');
  console.log('ℹ️ This may occur when switching calendars or if user did not sign in with Google');
  
  return res.json({
    success: false,
    message: 'Cannot auto-connect Google Calendar. Please use the manual connection flow in Settings.',
    reason: 'provider_token_not_available'
  });
}
```

---

### 13. backend/src/routes/auth.js (After Line 709, Before Line 711)

**ADDED:**
```javascript
    // Deactivate all other active connections (single active per user)
    console.log('🔄 Deactivating other active calendar connections...');
    const { error: deactivateError } = await req.supabase
      .from('calendar_connections')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (deactivateError) {
      console.warn('Warning: Could not deactivate other connections:', deactivateError);
    } else {
      console.log('✅ Other connections deactivated');
    }

    // Create new calendar connection
```

---

## Summary

**Total Changes:** 13 modifications
- **Frontend:** 11 changes (7 files)
- **Backend:** 2 changes (1 file)

**Lines Modified:** ~50 lines total
**Files Changed:** 8 files
**Commit:** 2eb2fb0

All changes follow existing code patterns and maintain consistency with the codebase.

