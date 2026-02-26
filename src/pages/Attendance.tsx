import React, { useState, useEffect } from 'react';
import { Plus, Search, Clock, Edit, Trash2, MoreHorizontal, Calendar, CheckCircle, XCircle, AlertCircle, Play, Square, Timer, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { api } from '../lib/api';
import { Attendance, AttendanceStats, AttendanceForm, Employee } from '../lib/types';
import toast from 'react-hot-toast';

interface LeaveRequestItem {
  id: number;
  employee_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: 'approved' | 'pending' | 'rejected';
  first_name?: string;
  last_name?: string;
  employee_code?: string;
}

interface AttendanceFormData {
  employee_id: string;
  date: string;
  clock_in_time: string;
  clock_out_time: string;
  status: string;
  notes: string;
}

const initialFormData: AttendanceFormData = {
  employee_id: '',
  date: new Date().toISOString().split('T')[0],
  clock_in_time: '',
  clock_out_time: '',
  status: 'present',
  notes: '',
};

export const AttendancePage: React.FC = () => {
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [todayRecords, setTodayRecords] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [attendanceEmployeeIdsForAbsentView, setAttendanceEmployeeIdsForAbsentView] = useState<Set<number>>(new Set());
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([]);
  const [leaveRequestsLoading, setLeaveRequestsLoading] = useState(false);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isClockInDialogOpen, setIsClockInDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);
  const [formData, setFormData] = useState<AttendanceFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAttendanceRecords();
    fetchTodayRecords();
    fetchEmployees();
    fetchStats();
    fetchLeaveRequests();
  }, [statusFilter, employeeFilter, dateFilter, monthFilter, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, employeeFilter, dateFilter, monthFilter]);

  const effectiveAbsentDate = dateFilter || new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchAttendanceEmployeeIdsForDate = async () => {
      if (!effectiveAbsentDate) {
        setAttendanceEmployeeIdsForAbsentView(new Set());
        return;
      }

      try {
        const response = await api.get(`/attendance?date_from=${effectiveAbsentDate}&date_to=${effectiveAbsentDate}&page=1&limit=5000`);
        const ids = new Set<number>((response.data.attendance || []).map((record: Attendance) => record.employee_id));
        setAttendanceEmployeeIdsForAbsentView(ids);
      } catch (error) {
        console.error('Error fetching attendance IDs for absent view:', error);
        setAttendanceEmployeeIdsForAbsentView(new Set());
      }
    };

    fetchAttendanceEmployeeIdsForDate();
  }, [effectiveAbsentDate]);

  const getMonthDateRange = (monthValue: string) => {
    const [year, month] = monthValue.split('-').map(Number);
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const toDate = new Date(year, month, 0);
    const to = `${year}-${String(month).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
    return { from, to };
  };

  const fetchAttendanceRecords = async () => {
    try {
      const params = new URLSearchParams();

      // In month grid mode, fetch full data and apply status filter on client-side
      // so we can still detect dates that already have some attendance record.
      if (!monthFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (employeeFilter !== 'all') params.append('employee_id', employeeFilter);

      if (monthFilter) {
        params.append('page', '1');
        params.append('limit', '5000');
      } else {
        params.append('page', String(currentPage));
        params.append('limit', String(pageSize));
      }

      if (dateFilter) {
        params.append('date_from', dateFilter);
        params.append('date_to', dateFilter);
      }
      if (monthFilter) {
        const [year, month] = monthFilter.split('-');
        params.append('month', month);
        params.append('year', year);
      }

      const response = await api.get(`/attendance?${params.toString()}`);
      setAttendanceRecords(response.data.attendance || []);

      if (monthFilter) {
        setTotalRecords((response.data.attendance || []).length);
        setTotalPages(1);
      } else {
        setTotalRecords(response.data.pagination?.total || 0);
        setTotalPages(response.data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      toast.error('Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayRecords = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get(`/attendance?date_from=${today}&date_to=${today}&limit=500`);
      setTodayRecords(response.data.attendance || []);
    } catch (error) {
      console.error('Error fetching today records:', error);
      setTodayRecords([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees?status=active');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      
      if (dateFilter) {
        params.append('date_from', dateFilter);
        params.append('date_to', dateFilter);
      }
      if (monthFilter) {
        const range = getMonthDateRange(monthFilter);
        params.set('date_from', range.from);
        params.set('date_to', range.to);
      }

      const statsUrl = `/attendance/stats/summary${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get(statsUrl);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      setLeaveRequestsLoading(true);
      const response = await api.get('/leaves');
      const all = response.data || [];
      setLeaveRequests(all.filter((r: LeaveRequestItem) => r.status === 'pending'));
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      setLeaveRequests([]);
    } finally {
      setLeaveRequestsLoading(false);
    }
  };

  const handleLeaveRequestAction = async (leaveId: number, status: 'approved' | 'rejected') => {
    try {
      await api.put(`/leaves/${leaveId}/status`, { status });
      toast.success(`Leave request ${status} successfully`);
      await Promise.all([fetchLeaveRequests(), fetchAttendanceRecords(), fetchTodayRecords(), fetchStats()]);
    } catch (error: any) {
      console.error(`Error ${status} leave request:`, error);
      toast.error(error.response?.data?.error || `Failed to ${status} leave request`);
    }
  };

  const getTodayAttendanceMap = () => {
    const todayMap: { [key: number]: Attendance } = {};
    (todayRecords || []).forEach((record: any) => {
      todayMap[record.employee_id] = record;
    });
    return todayMap;
  };
  
  const todayAttendanceMap = getTodayAttendanceMap();

  const handleCreateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const attendanceData: AttendanceForm = {
        employee_id: parseInt(formData.employee_id),
        date: formData.date,
        clock_in_time: formData.clock_in_time || undefined,
        clock_out_time: formData.clock_out_time || undefined,
        status: formData.status,
        notes: formData.notes,
      };

      await api.post('/attendance', attendanceData);
      toast.success('Attendance record created successfully!');
      setIsCreateDialogOpen(false);
      setFormData(initialFormData);
      fetchAttendanceRecords();
      fetchTodayRecords();
      fetchStats();
    } catch (error: any) {
      console.error('Error creating attendance:', error);
      toast.error(error.response?.data?.error || 'Failed to create attendance record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttendance) return;

    setSubmitting(true);
    try {
      const attendanceData: Partial<AttendanceForm> = {
        clock_in_time: formData.clock_in_time || undefined,
        clock_out_time: formData.clock_out_time || undefined,
        status: formData.status,
        notes: formData.notes,
      };

      await api.put(`/attendance/${selectedAttendance.id}`, attendanceData);
      toast.success('Attendance record updated successfully!');
      setIsEditDialogOpen(false);
      setSelectedAttendance(null);
      setFormData(initialFormData);
      fetchAttendanceRecords();
      fetchTodayRecords();
      fetchStats();
    } catch (error: any) {
      console.error('Error updating attendance:', error);
      toast.error(error.response?.data?.error || 'Failed to update attendance record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttendance = async (attendance: Attendance) => {
    if (!window.confirm(`Are you sure you want to delete attendance record for ${attendance.first_name} ${attendance.last_name}?`)) {
      return;
    }

    try {
      await api.delete(`/attendance/${attendance.id}`);
      toast.success('Attendance record deleted successfully!');
      fetchAttendanceRecords();
      fetchTodayRecords();
      fetchStats();
    } catch (error: any) {
      console.error('Error deleting attendance:', error);
      toast.error(error.response?.data?.error || 'Failed to delete attendance record');
    }
  };

  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      await fetchAttendanceRecords();
      await fetchTodayRecords();
      await fetchStats();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async (employee: Employee) => {
    try {
      await api.post('/attendance/clock-in', { employee_id: employee.id });
      toast.success(`${employee.first_name} ${employee.last_name} clocked in successfully!`);
      await fetchTodayRecords();
      fetchAttendanceRecords();
      fetchStats();
    } catch (error: any) {
      console.error('Error clocking in:', error);
      toast.error(error.response?.data?.error || 'Failed to clock in');
    }
  };

  const handleClockOut = async (employee: Employee) => {
    try {
      await api.post('/attendance/clock-out', { employee_id: employee.id });
      toast.success(`${employee.first_name} ${employee.last_name} clocked out successfully!`);
      await fetchTodayRecords();
      fetchAttendanceRecords();
      fetchStats();
    } catch (error: any) {
      console.error('Error clocking out:', error);
      toast.error(error.response?.data?.error || 'Failed to clock out');
    }
  };

  const openEditDialog = (attendance: Attendance) => {
    setSelectedAttendance(attendance);
    const formatToTimeInput = (isoString: string | null) => {
      if (!isoString) return '';
      // Converts "2024-07-21T10:30:00.000Z" to "10:30"
      return new Date(isoString).toTimeString().slice(0, 5);
    };

    setFormData({
      employee_id: attendance.employee_id.toString(),
      date: attendance.date,
      clock_in_time: formatToTimeInput(attendance.clock_in_time),
      clock_out_time: formatToTimeInput(attendance.clock_out_time),
      status: attendance.status,
      notes: attendance.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Present</Badge>;
      case 'absent':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Absent</Badge>;
      case 'late':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" />Late</Badge>;
      case 'half_day':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Half Day</Badge>;
      case 'holiday':
        return <Badge className="bg-purple-100 text-purple-800"><Calendar className="h-3 w-3 mr-1" />Holiday</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return '-';
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return String(dateString);
    return parsed.toLocaleDateString();
  };

  const toDateKey = (dateString?: string | null) => {
    if (!dateString) return '';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return String(dateString).slice(0, 10);
    return parsed.toISOString().slice(0, 10);
  };

  const getMonthDates = (monthValue: string) => {
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return [] as string[];
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return `${year}-${String(month).padStart(2, '0')}-${day}`;
    });
  };

  const getEffectiveMonthDates = (monthValue: string) => {
    const dates = getMonthDates(monthValue);
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return dates;

    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    if (!isCurrentMonth) return dates;

    const todayKey = now.toISOString().slice(0, 10);
    return dates.filter((d) => d <= todayKey);
  };

  const canClockOut = (employee: Employee) => {
    const todayRecord = todayAttendanceMap[employee.id];
    return todayRecord && todayRecord.clock_in_time && !todayRecord.clock_out_time;
  };

  const canClockIn = (employee: Employee) => {
    const todayRecord = todayAttendanceMap[employee.id];
    return !todayRecord || !todayRecord.clock_in_time;
  };

  const filteredAttendanceRecords = attendanceRecords.filter(attendance => {
    const searchMatch = 
      `${attendance.first_name} ${attendance.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attendance.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attendance.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return searchMatch;
  });

  const tableAttendanceRecords = React.useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const employeeMatchesSearch = (employee: Employee) => {
      return (
        `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(searchLower) ||
        employee.employee_code?.toLowerCase().includes(searchLower) ||
        employee.department?.toLowerCase().includes(searchLower)
      );
    };

    // For month + ALL employees view, show every date for every employee
    if (monthFilter && employeeFilter === 'all') {
      const monthDates = getEffectiveMonthDates(monthFilter);
      if (monthDates.length === 0) return filteredAttendanceRecords;

      const scopedEmployees = employees.filter(employeeMatchesSearch);

      const recordsByEmpDate = new Map<string, Attendance>();
      attendanceRecords.forEach((record) => {
        const key = `${record.employee_id}-${toDateKey(record.date)}`;
        if (!recordsByEmpDate.has(key)) recordsByEmpDate.set(key, record);
      });

      const allRows: Attendance[] = [];

      scopedEmployees.forEach((employee) => {
        monthDates.forEach((dateKey, index) => {
          const key = `${employee.id}-${dateKey}`;
          const existing = recordsByEmpDate.get(key);

          if (existing) {
            allRows.push(existing);
            return;
          }

          const dayOfWeek = new Date(dateKey).getDay();
          const isWeekend = dayOfWeek === 0;

          allRows.push({
            id: -(employee.id * 100000 + index + 1),
            business_id: (employee as any).business_id || 0,
            employee_id: employee.id,
            date: dateKey,
            clock_in_time: null,
            clock_out_time: null,
            total_hours: 0 as any,
            overtime_hours: 0 as any,
            status: isWeekend ? 'holiday' : 'absent',
            notes: isWeekend ? 'Weekly off / no attendance record' : 'No attendance record for this date',
            first_name: employee.first_name,
            last_name: employee.last_name,
            employee_code: employee.employee_code,
            department: employee.department,
            position: employee.position,
            created_at: new Date().toISOString(),
          } as Attendance);
        });
      });

      const statusFiltered = statusFilter === 'all'
        ? allRows
        : allRows.filter((r) => r.status === statusFilter);

      return statusFiltered.sort((a, b) => {
        const dateCompare = toDateKey(b.date).localeCompare(toDateKey(a.date));
        if (dateCompare !== 0) return dateCompare;
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      });
    }

    // For month + single employee view, show EVERY date of month (present or missing)
    if (monthFilter && employeeFilter !== 'all') {
      const employee = employees.find((e) => e.id.toString() === employeeFilter);
      if (!employee) return filteredAttendanceRecords;

      const monthDates = getEffectiveMonthDates(monthFilter);
      const employeeRecords = filteredAttendanceRecords.filter((r) => r.employee_id === employee.id);
      const byDate = new Map<string, Attendance>();
      employeeRecords.forEach((r) => {
        const key = toDateKey(r.date);
        if (key && !byDate.has(key)) byDate.set(key, r);
      });

      const fullMonthRows: Attendance[] = monthDates.map((dateKey, index) => {
        const existing = byDate.get(dateKey);
        if (existing) return existing;

        const dayOfWeek = new Date(dateKey).getDay();
        const isWeekend = dayOfWeek === 0;

        return {
          id: -(employee.id * 100000 + index + 1),
          business_id: (employee as any).business_id || 0,
          employee_id: employee.id,
          date: dateKey,
          clock_in_time: null,
          clock_out_time: null,
          total_hours: 0 as any,
          overtime_hours: 0 as any,
          status: isWeekend ? 'holiday' : 'absent',
          notes: isWeekend ? 'Weekly off / no attendance record' : 'No attendance record for this date',
          first_name: employee.first_name,
          last_name: employee.last_name,
          employee_code: employee.employee_code,
          department: employee.department,
          position: employee.position,
          created_at: new Date().toISOString(),
        } as Attendance;
      });

      const statusFiltered = statusFilter === 'all'
        ? fullMonthRows
        : fullMonthRows.filter((r) => r.status === statusFilter);

      return statusFiltered.sort((a, b) => (toDateKey(b.date)).localeCompare(toDateKey(a.date)));
    }

    // Show synthetic absents for the selected date (or today by default if no month filter)
    if (!effectiveAbsentDate) return filteredAttendanceRecords;

    // If user is specifically filtering to non-absent statuses, don't inject absent rows
    if (statusFilter !== 'all' && statusFilter !== 'absent') {
      return filteredAttendanceRecords;
    }

    const syntheticAbsents: Attendance[] = employees
      .filter((employee) => {
        if (employeeFilter !== 'all' && employee.id.toString() !== employeeFilter) return false;
        if (attendanceEmployeeIdsForAbsentView.has(employee.id)) return false;

        const searchMatch =
          `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          employee.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          employee.department?.toLowerCase().includes(searchTerm.toLowerCase());

        return searchMatch;
      })
      .map((employee, index) => ({
        id: -(employee.id * 100000 + index + 1),
        business_id: (employee as any).business_id || 0,
        employee_id: employee.id,
        date: effectiveAbsentDate || new Date().toISOString().split('T')[0],
        clock_in_time: null,
        clock_out_time: null,
        total_hours: 0 as any,
        overtime_hours: 0 as any,
        status: 'absent',
        notes: 'No attendance entry for selected date',
        first_name: employee.first_name,
        last_name: employee.last_name,
        employee_code: employee.employee_code,
        department: employee.department,
        position: employee.position,
        created_at: new Date().toISOString(),
      } as Attendance));

    if (statusFilter === 'absent') {
      const realAbsents = filteredAttendanceRecords.filter((r) => r.status === 'absent');
      return [...realAbsents, ...syntheticAbsents];
    }

    return [...filteredAttendanceRecords, ...syntheticAbsents];
  }, [
    attendanceRecords,
    filteredAttendanceRecords,
    employees,
    monthFilter,
    effectiveAbsentDate,
    employeeFilter,
    searchTerm,
    statusFilter,
    attendanceEmployeeIdsForAbsentView,
  ]);

  const isMonthGridMode = Boolean(monthFilter);
  const effectiveTotalRecords = isMonthGridMode ? tableAttendanceRecords.length : totalRecords;
  const effectiveTotalPages = isMonthGridMode
    ? Math.max(1, Math.ceil(effectiveTotalRecords / pageSize))
    : Math.max(1, totalPages);

  const visibleAttendanceRecords = React.useMemo(() => {
    if (!isMonthGridMode) return tableAttendanceRecords;
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return tableAttendanceRecords.slice(start, end);
  }, [tableAttendanceRecords, isMonthGridMode, currentPage, pageSize]);

  const summaryStats = React.useMemo(() => {
    if (!stats) return null;

    // In month mode, compute operational counts including missing-date absents.
    if (monthFilter) {
      const monthDates = getEffectiveMonthDates(monthFilter);
      if (monthDates.length === 0) return stats;

      const scopedEmployees = employeeFilter === 'all'
        ? employees
        : employees.filter((e) => e.id.toString() === employeeFilter);

      const statusByEmpDate = new Map<string, string>();
      attendanceRecords.forEach((record) => {
        const key = `${record.employee_id}-${toDateKey(record.date)}`;
        if (!statusByEmpDate.has(key)) {
          statusByEmpDate.set(key, record.status);
        }
      });

      let present = 0;
      let late = 0;
      let halfDay = 0;
      let absent = 0;

      scopedEmployees.forEach((employee) => {
        monthDates.forEach((dateKey) => {
          const key = `${employee.id}-${dateKey}`;
          const status = statusByEmpDate.get(key);

          if (!status) {
            const isSunday = new Date(dateKey).getDay() === 0;
            if (!isSunday) absent += 1;
            return;
          }

          if (status === 'present') present += 1;
          else if (status === 'late') late += 1;
          else if (status === 'half_day') halfDay += 1;
          else if (status === 'absent') absent += 1;
        });
      });

      return {
        ...stats,
        present_count: present,
        late_count: late,
        half_day_count: halfDay,
        absent_count: absent,
      };
    }

    return stats;
  }, [stats, monthFilter, employeeFilter, employees, attendanceRecords]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-600">Track employee attendance and working hours</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsClockInDialogOpen(true)} variant="outline">
            <Clock className="h-4 w-4 mr-2" />
            Quick Clock
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Record
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {summaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Present Days</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryStats.present_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Late Come</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryStats.late_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Half Day</p>
                  <p className="text-2xl font-bold text-gray-900">{(summaryStats as any).half_day_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <XCircle className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Absent Count</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryStats.absent_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Clock In/Out Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Leave Requests</CardTitle>
          <CardDescription>
            Review employee leave requests. On approval, attendance for leave dates is auto-marked as absent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaveRequestsLoading ? (
            <div className="text-sm text-gray-500">Loading leave requests...</div>
          ) : leaveRequests.length === 0 ? (
            <div className="text-sm text-gray-500">No pending leave requests.</div>
          ) : (
            <div className="space-y-3">
              {leaveRequests.map((leave) => (
                <div key={leave.id} className="rounded-lg border p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {leave.first_name} {leave.last_name} ({leave.employee_code})
                    </p>
                    <p className="text-sm text-gray-600">
                      {leave.leave_type} • {formatDate(leave.start_date)} to {formatDate(leave.end_date)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleLeaveRequestAction(leave.id, 'approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleLeaveRequestAction(leave.id, 'rejected')}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Clock In/Out Section */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Attendance</CardTitle>
          <CardDescription>
            Quick clock in/out for employees (requires active work schedule and no approved leave for today)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {employees.slice(0, 8).map((employee) => {
              const todayRecord = todayAttendanceMap[employee.id];
              return (
                <div key={employee.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                      <p className="text-sm text-gray-500">{employee.employee_code}</p>
                    </div>
                    <div className="text-right">
                      {todayRecord ? (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">
                            In: {formatTime(todayRecord.clock_in_time)}
                          </p>
                          {todayRecord.clock_out_time && (
                            <p className="text-xs text-gray-500">
                              Out: {formatTime(todayRecord.clock_out_time)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Not clocked in</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {canClockIn(employee) && (
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleClockIn(employee)}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Clock In
                      </Button>
                    )}
                    {canClockOut(employee) && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleClockOut(employee)}
                      >
                        <Square className="h-3 w-3 mr-1" />
                        Clock Out
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by employee name, code, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="half_day">Half Day</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
              </SelectContent>
            </Select>
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id.toString()}>
                    {employee.first_name} {employee.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="Date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full sm:w-[150px]"
            />
            <Input
              type="month"
              placeholder="Month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full sm:w-[150px]"
            />
            <Button 
              onClick={handleManualRefresh}
              disabled={loading}
              variant="outline"
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>
            View and manage employee attendance records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleAttendanceRecords.map((attendance, index) => {
                const currentDateKey = toDateKey(attendance.date || effectiveAbsentDate);
                const previousDateKey = index > 0
                  ? toDateKey(visibleAttendanceRecords[index - 1].date || effectiveAbsentDate)
                  : '';
                const showDate = index === 0 || currentDateKey !== previousDateKey;

                return (
                <TableRow key={attendance.id}>
                  <TableCell className="font-medium">
                    {showDate ? formatDate(attendance.date || effectiveAbsentDate) : ''}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {attendance.first_name} {attendance.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {attendance.employee_code} • {attendance.department || '-'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatTime(attendance.clock_in_time)}</TableCell>
                  <TableCell>{formatTime(attendance.clock_out_time)}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{attendance.total_hours ? parseFloat(attendance.total_hours as any).toFixed(1) : '-'}h</div>
                      {attendance.overtime_hours && parseFloat(attendance.overtime_hours as any) > 0 && (
                        <div className="text-sm text-blue-600">+{parseFloat(attendance.overtime_hours as any).toFixed(1)}h OT</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(attendance.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(attendance)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={attendance.id < 0}
                          onClick={() => handleDeleteAttendance(attendance)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );})}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              {effectiveTotalRecords > 0
                ? `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, effectiveTotalRecords)} of ${effectiveTotalRecords} records`
                : 'No records found'}
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(parseInt(value, 10));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>

              <span className="text-sm text-gray-700 min-w-[90px] text-center">
                Page {currentPage} of {effectiveTotalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(effectiveTotalPages, prev + 1))}
                disabled={currentPage >= effectiveTotalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Clock Dialog */}
      <Dialog open={isClockInDialogOpen} onOpenChange={setIsClockInDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Clock In/Out</DialogTitle>
            <DialogDescription>
              Select an employee to clock in or clock out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {employees.map((employee) => {
              const todayRecord = todayAttendanceMap[employee.id];
              return (
                <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                    <p className="text-sm text-gray-500">{employee.employee_code}</p>
                    {todayRecord && (
                      <p className="text-xs text-gray-500">
                        In: {formatTime(todayRecord.clock_in_time)} 
                        {todayRecord.clock_out_time && ` | Out: ${formatTime(todayRecord.clock_out_time)}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {canClockIn(employee) && (
                      <Button 
                        size="sm" 
                        onClick={() => {
                          handleClockIn(employee);
                          setIsClockInDialogOpen(false);
                        }}
                      >
                        Clock In
                      </Button>
                    )}
                    {canClockOut(employee) && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          handleClockOut(employee);
                          setIsClockInDialogOpen(false);
                        }}
                      >
                        Clock Out
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Attendance Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Attendance Record</DialogTitle>
            <DialogDescription>
              Manually create an attendance record for an employee.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAttendance} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employee_id">Employee *</Label>
                <Select value={formData.employee_id} onValueChange={(value) => setFormData({ ...formData, employee_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.first_name} {employee.last_name} ({employee.employee_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.status !== 'absent' && formData.status !== 'holiday' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="clock_in_time">Clock In Time</Label>
                    <Input
                      id="clock_in_time"
                      type="time"
                      value={formData.clock_in_time}
                      onChange={(e) => setFormData({ ...formData, clock_in_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="clock_out_time">Clock Out Time</Label>
                    <Input
                      id="clock_out_time"
                      type="time"
                      value={formData.clock_out_time}
                      onChange={(e) => setFormData({ ...formData, clock_out_time: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Record'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Attendance Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Attendance Record</DialogTitle>
            <DialogDescription>
              Update attendance record details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditAttendance} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee</Label>
                <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
                  {selectedAttendance?.first_name} {selectedAttendance?.last_name}
                </div>
              </div>
              <div>
                <Label>Date</Label>
                <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
                  {selectedAttendance && formatDate(selectedAttendance.date)}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_status">Status *</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.status !== 'absent' && formData.status !== 'holiday' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_clock_in_time">Clock In Time</Label>
                    <Input
                      id="edit_clock_in_time"
                      type="time"
                      value={formData.clock_in_time}
                      onChange={(e) => setFormData({ ...formData, clock_in_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_clock_out_time">Clock Out Time</Label>
                    <Input
                      id="edit_clock_out_time"
                      type="time"
                      value={formData.clock_out_time}
                      onChange={(e) => setFormData({ ...formData, clock_out_time: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea
                id="edit_notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Updating...' : 'Update Record'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
