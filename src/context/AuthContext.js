import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Localhost mock user for UI development
  useEffect(() => {
    // if (window.location.hostname === 'localhost') {
    //   setUser({
    //     id: '7ddad7e1-a221-4e42-bd86-f3ff6f1b6790',
    //     name: 'Test User',
    //     email: 'testuser@gmail.com',
    //     picture: 'https://ui-avatars.com/api/?name=Test+User',
    //     provider: 'google',
    //     providerId: 'mock-google-id',
    //   });
    //   setIsAuthenticated(true);
    //   setIsLoading(false);
    //   return;
    // }
    const initAuth = async () => {
      const token = localStorage.getItem('jwt');
      if (token) {
        await verifyTokenAndGetUser(token);
      }
      setIsLoading(false);
    };
    
    initAuth();
  }, []);

  const verifyTokenAndGetUser = async (token) => {
    try {
      console.log('Verifying token with backend...');
      const response = await fetch(`${API_URL}/api/auth/verify`, {
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