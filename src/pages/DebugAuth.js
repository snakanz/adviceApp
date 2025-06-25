import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

const DebugAuth = () => {
  const [jwt, setJwt] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('jwt');
    setJwt(token || 'No JWT found in localStorage');
    if (token) {
      api.setToken(token);
      api.verifyToken()
        .then(res => setVerifyResult(res))
        .catch(err => setError(err.message || err.toString()));
    }
  }, []);

  return (
    <div style={{ padding: 32 }}>
      <h2>Debug Auth</h2>
      <div><strong>JWT in localStorage:</strong></div>
      <pre style={{ background: '#eee', padding: 8 }}>{jwt}</pre>
      <div><strong>/api/auth/verify result:</strong></div>
      <pre style={{ background: '#eee', padding: 8 }}>{verifyResult ? JSON.stringify(verifyResult, null, 2) : 'No result'}</pre>
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
    </div>
  );
};

export default DebugAuth; 