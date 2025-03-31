import React, { createContext, useContext, useState, useEffect } from 'react';

// Create the context
const DarkModeContext = createContext();

// Custom hook to use the dark mode context
export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};

// Provider component
export const DarkModeProvider = ({ children }) => {
  // Check if user has a saved preference in localStorage
  const getSavedTheme = () => {
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme === 'dark') return true;
    if (savedTheme === 'light') return false;
    
    // If no saved preference, use system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  // Initialize state
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Initialize on client-side
  useEffect(() => {
    setIsDarkMode(getSavedTheme());
  }, []);

  // Update HTML class and localStorage when dark mode changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'light');
    }
  }, [isDarkMode]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      // Only update if user hasn't set a preference
      if (!localStorage.getItem('darkMode')) {
        setIsDarkMode(mediaQuery.matches);
      }
    };
    
    // Set up listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }
    
    // Clean up
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Toggle function
  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};