import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { preferencesApi } from '../lib/api';
import { useAuth } from './AuthContext';

interface Preferences {
  currency: string;
  date_format: string;
  theme: string;
}

interface PreferencesContextType {
  preferences: Preferences;
  setPreferences: (preferences: Preferences) => void;
  formatCurrency: (amount: number) => string;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>({
    currency: 'USD',
    date_format: 'MM/DD/YYYY',
    theme: 'light',
  });

  useEffect(() => {
    const loadPreferences = async () => {
      if (user) {
        try {
          const response = await preferencesApi.get();
          if (response.data.success) {
            setPreferences(response.data.data);
          }
        } catch (error) {
          console.error('Failed to load preferences', error);
        }
      }
    };
    loadPreferences();
  }, [user]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: preferences.currency,
    }).format(amount);
  };

  return (
    <PreferencesContext.Provider value={{ preferences, setPreferences, formatCurrency }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};
