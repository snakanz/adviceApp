import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API_URL = 'https://marloo-dashboard-backend.nelson-ec5.workers.dev/api';

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  const verifyTokenAndGetUser = async (token) => {
    try {
      console.log('Verifying token with backend...');
      const response = await fetch(`${API_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Token verification response status:', response.status);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('User data received:', userData);
        setUser(userData);
        setIsAuthenticated(true);
        return true;
      } else {
        // Token is invalid
        console.error('Token verification failed:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        localStorage.removeItem('jwt');
        setIsAuthenticated(false);
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      localStorage.removeItem('jwt');
      setIsAuthenticated(false);
      setUser(null);
      return false;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('jwt');
      if (token) {
        await verifyTokenAndGetUser(token);
      }
      setIsLoading(false);
    };
    
    initAuth();
  }, []);

  const login = async (token) => {
    console.log('Login function called with token');
    localStorage.setItem('jwt', token);
    const success = await verifyTokenAndGetUser(token);
    console.log('Login verification result:', success);
    return success;
  };

  const logout = () => {
    localStorage.removeItem('jwt');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, user }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 