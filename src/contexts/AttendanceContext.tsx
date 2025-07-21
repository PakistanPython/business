import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { attendanceApi } from '../lib/api';
import { useAuth } from './AuthContext';

interface AttendanceRecord {
  id: number;
  employee_id: number;
  date: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  total_hours: number | null;
  overtime_hours: number | null;
  break_hours: number | null;
  late_minutes: number;
  early_departure_minutes: number;
  status: string;
  location_latitude?: number;
  location_longitude?: number;
  notes?: string;
  // Employee info from join
  first_name?: string;
  last_name?: string;
  employee_code?: string;
  department?: string;
}

interface AttendanceStats {
  total_records: number;
  present_days: number;
  total_hours: number;
  overtime_hours: number;
  average_hours: number;
  late_days: number;
  early_departure_days: number;
}

interface AttendanceContextType {
  todayAttendance: AttendanceRecord[];
  allAttendance: AttendanceRecord[];
  stats: AttendanceStats | null;
  loading: boolean;
  error: string | null;
  refreshAttendance: () => Promise<void>;
  refreshTodayAttendance: () => Promise<void>;
  refreshStats: () => Promise<void>;
  clockIn: (data?: { location_latitude?: number; location_longitude?: number }) => Promise<AttendanceRecord>;
  clockOut: (data?: { location_latitude?: number; location_longitude?: number }) => Promise<AttendanceRecord>;
  clockInEmployee: (employeeId: number) => Promise<void>;
  clockOutEmployee: (employeeId: number) => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (context === undefined) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
};

interface AttendanceProviderProps {
  children: ReactNode;
}

export const AttendanceProvider: React.FC<AttendanceProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Rate limiting and debouncing
  const lastRefreshTime = useRef<number>(0);
  const refreshCooldown = 5000; // 5 seconds minimum between refreshes
  const retryDelay = useRef<number>(1000); // Start with 1 second retry delay
  const maxRetryDelay = 30000; // Max 30 seconds

  // Helper function to check if we can make a request (rate limiting)
  const canMakeRequest = () => {
    const now = Date.now();
    return now - lastRefreshTime.current >= refreshCooldown;
  };

  // Helper function to handle rate limit errors with exponential backoff
  const handleRateLimit = async (fn: () => Promise<void>, attempt = 1): Promise<void> => {
    try {
      if (!canMakeRequest()) {
        console.log('Rate limit: Skipping request, too soon since last refresh');
        return;
      }
      
      lastRefreshTime.current = Date.now();
      await fn();
      retryDelay.current = 1000; // Reset retry delay on success
    } catch (err: any) {
      if (err.response?.status === 429 && attempt <= 3) {
        console.log(`Rate limited, retrying in ${retryDelay.current}ms (attempt ${attempt})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay.current));
        retryDelay.current = Math.min(retryDelay.current * 2, maxRetryDelay); // Exponential backoff
        return handleRateLimit(fn, attempt + 1);
      }
      throw err; // Re-throw if not rate limited or max attempts reached
    }
  };

  const refreshTodayAttendance = async () => {
    const refreshFn = async () => {
      setLoading(true);
      setError(null);
      
      const today = new Date().toISOString().split('T')[0];
      const response = await attendanceApi.getAll({ date: today });
      
      // Ensure we have a valid response structure
      if (response && response.data && Array.isArray(response.data.attendance)) {
        setTodayAttendance(response.data.attendance);
      } else if (response && response.data && Array.isArray(response.data)) {
        setTodayAttendance(response.data);
      } else {
        console.warn('Unexpected today attendance response structure:', response);
        setTodayAttendance([]);
      }
      setLoading(false);
    };

    try {
      await handleRateLimit(refreshFn);
    } catch (err: any) {
      console.error('Error fetching today attendance:', err);
      setTodayAttendance([]);
      setError(err.response?.status === 429 ? 'Too many requests. Please wait a moment.' : (err.response?.data?.message || 'Failed to fetch today\'s attendance'));
      setLoading(false);
    }
  };

  const refreshStats = async () => {
    const refreshFn = async () => {
      const response = await attendanceApi.getSummary();
      setStats(response.data);
    };

    try {
      await handleRateLimit(refreshFn);
    } catch (err: any) {
      console.error('Error fetching attendance stats:', err);
      // Don't set error state for stats failures
    }
  };

  const refreshAttendance = async () => {
    const refreshFn = async () => {
      setLoading(true);
      setError(null);
      
      const response = await attendanceApi.getAll({});
      
      // Ensure we have a valid response structure
      if (response && response.data && Array.isArray(response.data.attendance)) {
        setAllAttendance(response.data.attendance);
      } else if (response && response.data && Array.isArray(response.data)) {
        setAllAttendance(response.data);
      } else {
        console.warn('Unexpected attendance response structure:', response);
        setAllAttendance([]);
      }
      setLoading(false);
    };

    try {
      await handleRateLimit(refreshFn);
    } catch (err: any) {
      console.error('Error fetching attendance:', err);
      setAllAttendance([]);
      setError(err.response?.status === 429 ? 'Too many requests. Please wait a moment.' : (err.response?.data?.message || 'Failed to fetch attendance records'));
      setLoading(false);
    }
  };

  const clockIn = async (data?: { location_latitude?: number; location_longitude?: number }) => {
    try {
      const response = await attendanceApi.clockIn(data || {});
      await Promise.all([refreshTodayAttendance(), refreshAttendance()]);
      return response.data;
    } catch (err: any) {
      console.error('Clock in error:', err);
      throw err;
    }
  };

  const clockOut = async (data?: { location_latitude?: number; location_longitude?: number }) => {
    try {
      const response = await attendanceApi.clockOut(data || {});
      await Promise.all([refreshTodayAttendance(), refreshAttendance()]);
      return response.data;
    } catch (err: any) {
      console.error('Clock out error:', err);
      throw err;
    }
  };

  const clockInEmployee = async (employeeId: number) => {
    try {
      const response = await attendanceApi.clockIn({ employee_id: employeeId });
      await Promise.all([refreshTodayAttendance(), refreshAttendance()]);
      return response.data;
    } catch (err: any) {
      console.error('Employee clock in error:', err);
      throw err;
    }
  };

  const clockOutEmployee = async (employeeId: number) => {
    try {
      const response = await attendanceApi.clockOut({ employee_id: employeeId });
      await Promise.all([refreshTodayAttendance(), refreshAttendance()]);
      return response.data;
    } catch (err: any) {
      console.error('Employee clock out error:', err);
      throw err;
    }
  };

  // Initialize data when user logs in - NO AUTO-REFRESH
  useEffect(() => {
    if (user) {
      // Only load data once when user changes
      console.log('Loading initial attendance data for user:', user.id);
      refreshTodayAttendance();
      refreshAttendance(); // Also load all attendance for history
    }
  }, [user?.id]); // Only depend on user ID change

  const value: AttendanceContextType = {
    todayAttendance,
    allAttendance,
    stats,
    loading,
    error,
    refreshAttendance,
    refreshTodayAttendance,
    refreshStats,
    clockIn,
    clockOut,
    clockInEmployee,
    clockOutEmployee,
  };

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
};
