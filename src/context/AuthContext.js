import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API_URL = 'https://marloo-dashboard-backend.nelson-ec5.workers.dev/api';

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  const verifyTokenAndGetUser = async (token) => {
    try {
      const response = await fetch(`${API_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
        return true;
      } else {
        // Token is invalid
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
    localStorage.setItem('jwt', token);
    await verifyTokenAndGetUser(token);
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