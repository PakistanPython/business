import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useAttendance } from '@/contexts/AttendanceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, MapPin, Calendar, Users, AlertCircle, CheckCircle, RefreshCw, Building2, Trophy, Target, Zap, BarChart3, TrendingUp, Home, Activity, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface EmployeeData {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  hire_date: string;
  employment_type: string;
  department: string;
  position: string;
  employee_code: string;
  status: string;
}

interface AttendanceRecord {
  id: number;
  date: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  total_hours: number | null;
  late_minutes: number;
  early_departure_minutes: number;
  status: string;
  location_latitude?: number;
  location_longitude?: number;
}

interface PayrollLedgerEntry {
  date: string;
  attendance: string;
  clock_in_time?: string | null;
  clock_out_time?: string | null;
  amount: number;
}

interface PayrollLedgerData {
  employee: {
    id: number;
    name: string;
    employee_code?: string;
    department?: string;
  };
  month: string;
  total_amount: number;
  summary?: {
    present: number;
    absent: number;
    holiday: number;
    half_day: number;
    month_days?: number;
  };
  entries: PayrollLedgerEntry[];
}

interface LeaveSummaryItem {
  leave_type: string;
  description?: string;
  is_paid: boolean;
  leave_limit_period: 'month' | 'year';
  limit_per_period: number;
  accrued_periods: number;
  accrued_total: number;
  used_total: number;
  used_current_period: number;
  remaining_total: number;
}

interface LeaveSummaryData {
  employee: {
    id: number;
    name: string;
    hire_date: string;
  };
  as_of: string;
  summary: LeaveSummaryItem[];
}

interface LeaveTypeOption {
  id: number;
  name: string;
}

interface LeaveRequest {
  id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: 'approved' | 'pending' | 'rejected';
}

const EmployeePortal: React.FC = () => {
  const { user } = useAuth();
  const { todayAttendance, allAttendance, clockIn, clockOut, loading: attendanceLoading, refreshAttendance } = useAttendance();
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingin] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [ledgerMonth, setLedgerMonth] = useState(new Date().toISOString().slice(0, 7));
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState<PayrollLedgerData | null>(null);
  const [leaveSummaryLoading, setLeaveSummaryLoading] = useState(false);
  const [leaveSummaryData, setLeaveSummaryData] = useState<LeaveSummaryData | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveRequestLoading, setLeaveRequestLoading] = useState(false);
  const [submittingLeaveRequest, setSubmittingLeaveRequest] = useState(false);
  const [leaveRequestForm, setLeaveRequestForm] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
  });
  
  // Get current user's attendance records
  const userTodayAttendance = Array.isArray(todayAttendance) 
    ? todayAttendance.find(record => record.employee_id === user?.id) || null 
    : null;
    
  const userRecentAttendance = Array.isArray(allAttendance) 
    ? allAttendance
        .filter(record => record.employee_id === user?.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 7)
    : [];

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch employee profile
        const profileResponse = await api.get('/employees/profile');
        setEmployeeData(profileResponse.data);

      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.response?.data?.message || 'Failed to fetch employee data.');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
      // Note: refreshAttendance is called automatically by AttendanceContext when user changes
    }
  }, [user]);

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          // Provide default location if GPS fails
          resolve({
            latitude: 0,
            longitude: 0,
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const refreshTodayAttendance = async () => {
    await refreshAttendance();
  };

  const handleManualRefresh = async () => {
    try {
      await refreshTodayAttendance();
      toast.success('Attendance data refreshed!');
    } catch (error) {
      console.error('Error refreshing:', error);
      toast.error('Failed to refresh data');
    }
  };

  const handleClockIn = async () => {
    try {
      setClockingin(true);
      const location = await getCurrentLocation();
      
      await clockIn({
        location_latitude: location.latitude,
        location_longitude: location.longitude,
      });

      toast.success('Clocked in successfully!');
      
    } catch (err: any) {
      console.error('Clock in error:', err);
      toast.error(err.response?.data?.message || 'Failed to clock in. Please try again.');
    } finally {
      setClockingin(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setClockingOut(true);
      const location = await getCurrentLocation();
      
      await clockOut({
        location_latitude: location.latitude,
        location_longitude: location.longitude,
      });

      toast.success('Clocked out successfully!');
      
    } catch (err: any) {
      console.error('Clock out error:', err);
      toast.error(err.response?.data?.message || 'Failed to clock out. Please try again.');
    } finally {
      setClockingOut(false);
    }
  };

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return '-';
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (hours: number | null) => {
    if (hours === null || isNaN(hours)) return '0h 0m';
    const totalMinutes = Math.round(hours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      present: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      late: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      absent: { color: 'bg-red-100 text-red-800', icon: AlertCircle },
      half_day: { color: 'bg-blue-100 text-blue-800', icon: Clock },
      holiday: { color: 'bg-purple-100 text-purple-800', icon: Calendar },
      on_leave: { color: 'bg-purple-100 text-purple-800', icon: Calendar },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.present;
    const IconComponent = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <IconComponent className="w-3 h-3" />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount || 0);
  };

  const parseLedgerDate = (dateString: string) => {
    const [year, month, day] = String(dateString).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  };

  const getDayName = (dateString: string) => {
    return parseLedgerDate(dateString).toLocaleDateString(undefined, { weekday: 'long' });
  };

  const formatLedgerDate = (dateString: string) => {
    return parseLedgerDate(dateString).toLocaleDateString();
  };

  const loadEmployeeLedger = async () => {
    if (!user?.id || !ledgerMonth) return;

    try {
      setLedgerLoading(true);
      const response = await api.get(`/payroll/ledger?employee_id=${user.id}&month=${ledgerMonth}`);
      setLedgerData(response.data);
    } catch (err: any) {
      console.error('Error loading employee ledger:', err);
      toast.error(err.response?.data?.error || 'Failed to load employee ledger');
      setLedgerData(null);
    } finally {
      setLedgerLoading(false);
    }
  };

  const loadLeaveSummary = async () => {
    if (!user?.id) return;

    try {
      setLeaveSummaryLoading(true);
      const response = await api.get(`/leaves/summary?employee_id=${user.id}`);
      setLeaveSummaryData(response.data);
    } catch (err: any) {
      console.error('Error loading leave summary:', err);
      toast.error(err.response?.data?.error || 'Failed to load leave summary');
      setLeaveSummaryData(null);
    } finally {
      setLeaveSummaryLoading(false);
    }
  };

  const loadLeaveTypes = async () => {
    try {
      const response = await api.get('/leaves/types');
      setLeaveTypes(response.data || []);
    } catch (err) {
      console.error('Error loading leave types:', err);
    }
  };

  const loadLeaveRequests = async () => {
    try {
      setLeaveRequestLoading(true);
      const response = await api.get('/leaves');
      setLeaveRequests(response.data || []);
    } catch (err: any) {
      console.error('Error loading leave requests:', err);
      toast.error(err.response?.data?.error || 'Failed to load leave requests');
      setLeaveRequests([]);
    } finally {
      setLeaveRequestLoading(false);
    }
  };

  const handleApplyLeave = async () => {
    try {
      if (!leaveRequestForm.leave_type || !leaveRequestForm.start_date || !leaveRequestForm.end_date) {
        toast.error('Please select leave type, start date, and end date');
        return;
      }

      const start = new Date(leaveRequestForm.start_date);
      const end = new Date(leaveRequestForm.end_date);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        toast.error('Invalid leave date range');
        return;
      }

      const requestedDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const selectedLeaveSummary = leaveSummaryData?.summary?.find(
        (item) => item.leave_type === leaveRequestForm.leave_type
      );
      const availableDays = Number(selectedLeaveSummary?.remaining_total || 0);

      if (!selectedLeaveSummary || availableDays <= 0) {
        toast.error('You do not have available leave for this leave type');
        return;
      }

      if (requestedDays > availableDays) {
        toast.error(`You have available leave count ${availableDays} day(s) only`);
        return;
      }

      setSubmittingLeaveRequest(true);
      await api.post('/leaves', {
        leave_type: leaveRequestForm.leave_type,
        start_date: leaveRequestForm.start_date,
        end_date: leaveRequestForm.end_date,
      });

      toast.success('Leave request submitted successfully');
      setLeaveRequestForm({ leave_type: '', start_date: '', end_date: '' });
      await Promise.all([loadLeaveRequests(), loadLeaveSummary()]);
    } catch (err: any) {
      console.error('Error applying leave:', err);
      toast.error(err.response?.data?.error || 'Failed to submit leave request');
    } finally {
      setSubmittingLeaveRequest(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadEmployeeLedger();
      loadLeaveSummary();
      loadLeaveTypes();
      loadLeaveRequests();
    }
  }, [user?.id, ledgerMonth]);

  const getLeaveStatusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800">APPROVED</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-100 text-red-800">REJECTED</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-800">PENDING</Badge>;
  };

  const selectedLeaveSummary = leaveSummaryData?.summary?.find(
    (item) => item.leave_type === leaveRequestForm.leave_type
  );
  const availableLeaveDays = Number(selectedLeaveSummary?.remaining_total || 0);

  const requestedLeaveDays = (() => {
    if (!leaveRequestForm.start_date || !leaveRequestForm.end_date) return 0;
    const start = new Date(leaveRequestForm.start_date);
    const end = new Date(leaveRequestForm.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
    return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  })();

  const hasInvalidDateRange = Boolean(leaveRequestForm.start_date && leaveRequestForm.end_date) && requestedLeaveDays === 0;
  const hasAnyLeaveBalance = availableLeaveDays > 0;
  const isOverLimit = requestedLeaveDays > 0 && requestedLeaveDays > availableLeaveDays;
  const remainingAfterRequest = Math.max(0, availableLeaveDays - requestedLeaveDays);
  const canSubmitLeaveRequest = Boolean(
    leaveRequestForm.leave_type &&
    leaveRequestForm.start_date &&
    leaveRequestForm.end_date &&
    requestedLeaveDays > 0 &&
    hasAnyLeaveBalance &&
    !isOverLimit
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Error</h3>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!employeeData) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Employee Data</h3>
            <p className="text-muted-foreground">Unable to find your employee profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { first_name, last_name, email, position, department, employee_code, hire_date, status } = employeeData;
  const initials = `${first_name?.[0] ?? ''}${last_name?.[0] ?? ''}`.toUpperCase();
  const isClockInDisabled = userTodayAttendance?.clock_in_time && !userTodayAttendance?.clock_out_time;
  const isClockOutDisabled = !userTodayAttendance?.clock_in_time || userTodayAttendance?.clock_out_time;
  const weeklyPresent = userRecentAttendance.filter(r => r.status === 'present').length;
  const weeklyTrackedDays = userRecentAttendance.length;
  const weeklyOnTimeRate = weeklyTrackedDays > 0 ? Math.round((weeklyPresent / weeklyTrackedDays) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Header Section */}
      <div className="relative bg-gradient-to-r from-slate-800 via-indigo-800 to-blue-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 opacity-50">
          <div className="w-full h-full bg-gradient-to-br from-transparent via-white/5 to-transparent"></div>
        </div>
        <div className="relative container mx-auto px-6 py-12">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur opacity-75 animate-pulse"></div>
                <Avatar className="relative h-20 w-20 border-4 border-white/20 shadow-2xl">
                  <AvatarImage 
                    src={`https://ui-avatars.com/api/?name=${first_name}+${last_name}&background=1e40af&color=fff&size=80`} 
                    alt={`${first_name} ${last_name}`} 
                  />
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold mb-2 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                  Welcome back, {first_name}
                </h1>
                <div className="flex items-center gap-2 text-blue-100 mb-2">
                  <Building2 className="w-5 h-5" />
                  <span className="text-lg font-medium">{position} • {department}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-blue-200">
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    {employee_code}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Since {new Date(hire_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col lg:flex-row gap-3">
              <Button 
                onClick={handleManualRefresh}
                disabled={attendanceLoading}
                variant="secondary"
                className="bg-white/10 hover:bg-white/20 border-white/20 text-white backdrop-blur-sm transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${attendanceLoading ? 'animate-spin' : ''}`} />
                {attendanceLoading ? 'Refreshing...' : 'Refresh Data'}
              </Button>
              <div className="flex items-center gap-2">
                {getStatusBadge(status)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="container mx-auto max-w-7xl px-6 -mt-6 relative z-10">
        {/* Stats Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Hours Today</p>
                  <p className="text-2xl font-bold text-emerald-700">{formatDuration(userTodayAttendance?.total_hours)}</p>
                </div>
                <div className="bg-emerald-100 rounded-full p-3">
                  <Clock className="w-6 h-6 text-emerald-700" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Tracked Days</p>
                  <p className="text-2xl font-bold text-blue-700">{weeklyTrackedDays} Days</p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <BarChart3 className="w-6 h-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">On-Time Rate</p>
                  <p className="text-2xl font-bold text-violet-700">{weeklyOnTimeRate}%</p>
                </div>
                <div className="bg-violet-100 rounded-full p-3">
                  <Trophy className="w-6 h-6 text-violet-700" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Current Time</p>
                  <p className="text-xl font-bold font-mono text-rose-700">
                    {currentTime.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </p>
                </div>
                <div className="bg-rose-100 rounded-full p-3">
                  <Activity className="w-6 h-6 text-rose-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile & Quick Actions */}
          <div className="lg:col-span-1 space-y-6">
            {/* Enhanced Profile Card */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-t-lg">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Avatar className="h-16 w-16 border-3 border-white shadow-lg">
                      <AvatarImage 
                        src={`https://ui-avatars.com/api/?name=${first_name}+${last_name}&background=1e293b&color=fff&size=64`} 
                        alt={`${first_name} ${last_name}`} 
                      />
                      <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-700 text-white text-lg font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full w-5 h-5 border-2 border-white flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl text-white">{`${first_name} ${last_name}`}</CardTitle>
                    <p className="text-slate-200 text-sm">{position}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                        <Home className="w-3 h-3 mr-1" />
                        {department}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <span className="text-slate-600 font-medium">Email</span>
                    <span className="font-semibold text-slate-800">{email}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <span className="text-slate-600 font-medium">Employee ID</span>
                    <span className="font-semibold text-slate-800 font-mono">{employee_code}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <span className="text-slate-600 font-medium">Hire Date</span>
                    <span className="font-semibold text-slate-800">{new Date(hire_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <span className="text-slate-600 font-medium">Status</span>
                    {getStatusBadge(status)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Time Widget */}
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur opacity-75 animate-pulse"></div>
                    <div className="relative bg-white/10 rounded-full p-4 backdrop-blur-sm">
                      <Clock className="w-8 h-8 mx-auto text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-mono font-bold mb-1">
                      {currentTime.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                      })}
                    </div>
                    <div className="text-slate-300 text-sm">
                      {currentTime.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/10 rounded p-2">
                      <div className="text-slate-300">Week</div>
                      <div className="font-bold">{currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </div>
                    <div className="bg-white/10 rounded p-2">
                      <div className="text-slate-300">Day</div>
                      <div className="font-bold">{currentTime.getDay() + 1}/7</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leave Summary Card */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-t-lg">
                <CardTitle className="text-lg flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Leave Summary
                  </span>
                  <Button
                    onClick={loadLeaveSummary}
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                    disabled={leaveSummaryLoading}
                  >
                    {leaveSummaryLoading ? 'Loading...' : 'Refresh'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {leaveSummaryLoading ? (
                  <div className="text-sm text-slate-500">Loading leave summary...</div>
                ) : leaveSummaryData?.summary?.length ? (
                  leaveSummaryData.summary.map((item) => (
                    <div key={item.leave_type} className="rounded-lg border p-3 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-800">{item.leave_type}</p>
                        <Badge className="capitalize">{item.leave_limit_period}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded bg-white p-2 border">
                          <p className="text-slate-500">Per {item.leave_limit_period}</p>
                          <p className="font-bold text-slate-800">{item.limit_per_period} day(s)</p>
                        </div>
                        <div className="rounded bg-white p-2 border">
                          <p className="text-slate-500">Accrued</p>
                          <p className="font-bold text-slate-800">{item.accrued_total} day(s)</p>
                        </div>
                        <div className="rounded bg-white p-2 border">
                          <p className="text-slate-500">Used</p>
                          <p className="font-bold text-rose-700">{item.used_total} day(s)</p>
                        </div>
                        <div className="rounded bg-emerald-50 p-2 border border-emerald-200">
                          <p className="text-emerald-700">Available</p>
                          <p className="font-bold text-emerald-800">{item.remaining_total} day(s)</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2">
                        {item.leave_limit_period === 'month'
                          ? `Monthly accrual: each month adds ${item.limit_per_period} day(s).`
                          : `Yearly accrual: each year adds ${item.limit_per_period} day(s).`}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No leave summary available yet.</div>
                )}
              </CardContent>
            </Card>

            {/* Apply Leave Request Card (Sidebar) */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-violet-700 to-purple-700 text-white rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Apply Leave Request
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label>Leave Type</Label>
                  <Select
                    value={leaveRequestForm.leave_type}
                    onValueChange={(value) => setLeaveRequestForm((prev) => ({ ...prev, leave_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((lt) => (
                        <SelectItem key={lt.id} value={lt.name}>
                          {lt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={leaveRequestForm.start_date}
                      onChange={(e) => setLeaveRequestForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={leaveRequestForm.end_date}
                      onChange={(e) => setLeaveRequestForm((prev) => ({ ...prev, end_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="rounded-md border bg-slate-50 p-3 text-sm space-y-1">
                  <p><span className="font-medium">Selected days:</span> {requestedLeaveDays || 0}</p>
                  <p><span className="font-medium">Available days:</span> {availableLeaveDays}</p>
                  <p><span className="font-medium">Remaining after request:</span> {remainingAfterRequest}</p>

                  {hasInvalidDateRange && (
                    <p className="text-red-600">Invalid date range. End date must be same or after start date.</p>
                  )}
                  {!selectedLeaveSummary && leaveRequestForm.leave_type && (
                    <p className="text-red-600">No leave balance information found for selected leave type.</p>
                  )}
                  {selectedLeaveSummary && !hasAnyLeaveBalance && (
                    <p className="text-red-600">You do not have leave for apply.</p>
                  )}
                  {isOverLimit && (
                    <p className="text-red-600">You have available leave count only {availableLeaveDays} day(s). Please select within this limit.</p>
                  )}
                </div>

                {canSubmitLeaveRequest ? (
                  <Button onClick={handleApplyLeave} disabled={submittingLeaveRequest} className="w-full">
                    {submittingLeaveRequest ? 'Submitting...' : 'Submit Leave Request'}
                  </Button>
                ) : null}

                <div className="pt-2 border-t">
                  <h4 className="font-semibold mb-2">My Leave Requests</h4>
                  {leaveRequestLoading ? (
                    <p className="text-sm text-slate-500">Loading leave requests...</p>
                  ) : leaveRequests.length === 0 ? (
                    <p className="text-sm text-slate-500">No leave requests yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {leaveRequests.slice(0, 8).map((lr) => (
                        <div key={lr.id} className="flex items-center justify-between rounded border p-2 bg-slate-50">
                          <div>
                            <p className="text-sm font-medium">{lr.leave_type}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(lr.start_date).toLocaleDateString()} - {new Date(lr.end_date).toLocaleDateString()}
                            </p>
                          </div>
                          {getLeaveStatusBadge(lr.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Attendance Dashboard */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Attendance - Enhanced */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="bg-white/20 rounded-full p-2">
                    <Calendar className="w-6 h-6" />
                  </div>
                  Today's Attendance Dashboard
                  <Badge className="bg-white/20 text-white border-white/30 ml-auto">
                    {currentTime.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {userTodayAttendance ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200 hover:shadow-lg transition-all duration-300 group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform duration-300"></div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-3">
                            <div className="bg-green-500 rounded-full p-2">
                              <Clock className="w-5 h-5 text-white" />
                            </div>
                            <Zap className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="text-sm font-medium text-green-700 mb-1">Clock In</div>
                          <div className="text-2xl font-bold text-green-800">{formatTime(userTodayAttendance.clock_in_time)}</div>
                        </div>
                      </div>
                      
                      <div className="relative overflow-hidden bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-xl border border-red-200 hover:shadow-lg transition-all duration-300 group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform duration-300"></div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-3">
                            <div className="bg-red-500 rounded-full p-2">
                              <Clock className="w-5 h-5 text-white" />
                            </div>
                            <TrendingUp className="w-4 h-4 text-red-600" />
                          </div>
                          <div className="text-sm font-medium text-red-700 mb-1">Clock Out</div>
                          <div className="text-2xl font-bold text-red-800">{formatTime(userTodayAttendance.clock_out_time)}</div>
                        </div>
                      </div>
                      
                      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-200 hover:shadow-lg transition-all duration-300 group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform duration-300"></div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-3">
                            <div className="bg-blue-500 rounded-full p-2">
                              <BarChart3 className="w-5 h-5 text-white" />
                            </div>
                            <Activity className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="text-sm font-medium text-blue-700 mb-1">Total Hours</div>
                          <div className="text-2xl font-bold text-blue-800">{formatDuration(userTodayAttendance.total_hours)}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-600 font-medium">Status:</span>
                        {getStatusBadge(userTodayAttendance.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {userTodayAttendance.late_minutes > 0 && (
                          <div className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full">
                            <AlertCircle className="w-4 h-4" />
                            Late by {Math.round(userTodayAttendance.late_minutes)} minutes
                          </div>
                        )}
                        {(userTodayAttendance.location_latitude || userTodayAttendance.location_longitude) && (
                          <div className="flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1 rounded-full">
                            <MapPin className="w-4 h-4" />
                            Location verified
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-slate-300 rounded-full blur opacity-50"></div>
                      <div className="relative bg-slate-100 rounded-full p-6 w-24 h-24 mx-auto flex items-center justify-center">
                        <Calendar className="w-12 h-12 text-slate-400" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Ready to Start Your Day?</h3>
                    <p className="text-slate-500">No attendance recorded for today. Clock in to get started!</p>
                  </div>
                )}

                {/* Enhanced Clock In/Out Buttons */}
                <div className="flex flex-col md:flex-row gap-4 mt-8">
                  <Button
                    onClick={handleClockIn}
                    disabled={!!isClockInDisabled || clockingIn}
                    className={`flex-1 h-16 text-lg font-semibold transition-all duration-300 ${
                      isClockInDisabled 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:scale-105 shadow-lg hover:shadow-xl'
                    }`}
                    size="lg"
                  >
                    {clockingIn ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        Clocking In...
                      </>
                    ) : (
                      <>
                        <Clock className="w-5 h-5 mr-3" />
                        {isClockInDisabled ? 'Already Clocked In' : 'Clock In'}
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleClockOut}
                    disabled={isClockOutDisabled || clockingOut}
                    variant="outline"
                    className={`flex-1 h-16 text-lg font-semibold transition-all duration-300 ${
                      isClockOutDisabled 
                        ? 'border-gray-300 text-gray-400 cursor-not-allowed' 
                        : 'border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:scale-105 shadow-lg hover:shadow-xl'
                    }`}
                    size="lg"
                  >
                    {clockingOut ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-3"></div>
                        Clocking Out...
                      </>
                    ) : (
                      <>
                        <Clock className="w-5 h-5 mr-3" />
                        {isClockOutDisabled ? 'Not Clocked In' : 'Clock Out'}
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Quick Action Buttons */}
                <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-slate-200">
                  <Button
                    onClick={handleManualRefresh}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 text-slate-600 border-slate-300 hover:border-slate-400"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Refresh
                  </Button>
                  
                  <Button
                    onClick={() => refreshAttendance()}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 text-slate-600 border-slate-300 hover:border-slate-400"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Load History
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Employee Ledger - Monthly (Same logic as Payroll page) */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="bg-white/20 rounded-full p-2">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  Employee Ledger
                  <Badge className="bg-white/20 text-white border-white/30 ml-auto">Monthly</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-3 md:items-end mb-4">
                  <div>
                    <label className="text-sm text-slate-600">Ledger Month</label>
                    <Input
                      type="month"
                      value={ledgerMonth}
                      onChange={(e) => setLedgerMonth(e.target.value)}
                      className="w-[220px]"
                    />
                  </div>
                  <Button onClick={loadEmployeeLedger} disabled={ledgerLoading} variant="outline">
                    {ledgerLoading ? 'Loading...' : 'Refresh Ledger'}
                  </Button>
                </div>

                {ledgerLoading ? (
                  <div className="text-center py-8 text-slate-500">Loading employee ledger...</div>
                ) : ledgerData ? (
                  <div className="space-y-4">
                    {ledgerData.summary && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="rounded-lg border bg-green-50 p-3 text-center">
                          <p className="text-xs text-green-700">Present</p>
                          <p className="text-xl font-bold text-green-800">{ledgerData.summary.present}</p>
                        </div>
                        <div className="rounded-lg border bg-red-50 p-3 text-center">
                          <p className="text-xs text-red-700">Absent</p>
                          <p className="text-xl font-bold text-red-800">{ledgerData.summary.absent}</p>
                        </div>
                        <div className="rounded-lg border bg-purple-50 p-3 text-center">
                          <p className="text-xs text-purple-700">Holiday</p>
                          <p className="text-xl font-bold text-purple-800">{ledgerData.summary.holiday}</p>
                        </div>
                        <div className="rounded-lg border bg-blue-50 p-3 text-center">
                          <p className="text-xs text-blue-700">Half Day</p>
                          <p className="text-xl font-bold text-blue-800">{ledgerData.summary.half_day}</p>
                        </div>
                        <div className="rounded-lg border bg-slate-100 p-3 text-center">
                          <p className="text-xs text-slate-600">Total Amount</p>
                          <p className="text-xl font-bold text-slate-800">{formatCurrency(ledgerData.total_amount)}</p>
                        </div>
                      </div>
                    )}

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Day</TableHead>
                          <TableHead>In</TableHead>
                          <TableHead>Out</TableHead>
                          <TableHead>Attendance</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerData.entries.map((entry) => (
                          <TableRow key={entry.date}>
                            <TableCell>{formatLedgerDate(entry.date)}</TableCell>
                            <TableCell>{getDayName(entry.date)}</TableCell>
                            <TableCell>{formatTime(entry.clock_in_time)}</TableCell>
                            <TableCell>{formatTime(entry.clock_out_time)}</TableCell>
                            <TableCell>{getStatusBadge(entry.attendance)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(entry.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-slate-300 rounded-full blur opacity-50"></div>
                      <div className="relative bg-slate-100 rounded-full p-6 w-24 h-24 mx-auto flex items-center justify-center">
                        <Clock className="w-12 h-12 text-slate-400" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Ledger Data</h3>
                    <p className="text-slate-500">No payroll ledger entries found for selected month.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeePortal;
