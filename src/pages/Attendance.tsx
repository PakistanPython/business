import React, { useState, useEffect } from 'react';
import { Plus, Search, Clock, Edit, Trash2, MoreHorizontal, Calendar, Users, CheckCircle, XCircle, AlertCircle, Play, Square, Timer, RefreshCw } from 'lucide-react';
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
import { useAuth } from '../contexts/AuthContext';
import { useAttendance } from '../contexts/AttendanceContext';
import { api } from '../lib/api';
import { Attendance, AttendanceStats, AttendanceForm, Employee } from '../lib/types';
import toast from 'react-hot-toast';

interface AttendanceFormData {
  employee_id: string;
  date: string;
  clock_in_time: string;
  clock_out_time: string;
  total_hours: string;
  overtime_hours: string;
  break_hours: string;
  status: string;
  notes: string;
}

const initialFormData: AttendanceFormData = {
  employee_id: '',
  date: new Date().toISOString().split('T')[0],
  clock_in_time: '',
  clock_out_time: '',
  total_hours: '',
  overtime_hours: '0',
  break_hours: '0',
  status: 'present',
  notes: '',
};

export const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { 
    todayAttendance, 
    allAttendance, 
    loading: attendanceLoading, 
    refreshAttendance, 
    refreshTodayAttendance,
    clockInEmployee,
    clockOutEmployee 
  } = useAttendance();
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isClockInDialogOpen, setIsClockInDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);
  const [selectedEmployeeForClock, setSelectedEmployeeForClock] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<AttendanceFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAttendanceRecords();
    fetchEmployees();
    fetchStats();
    // Note: today's attendance and all attendance are managed by AttendanceContext
  }, [statusFilter, employeeFilter, dateFilter, monthFilter, searchTerm]);

  const fetchAttendanceRecords = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (employeeFilter !== 'all') params.append('employee_id', employeeFilter);
      if (dateFilter) params.append('date_from', dateFilter);
      if (monthFilter) params.append('month', monthFilter);

      const response = await api.get(`/attendance?${params.toString()}`);
      setAttendanceRecords(response.data.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      toast.error('Failed to fetch attendance records');
    } finally {
      setLoading(false);
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
      let statsUrl = '/attendance/stats/summary';
      if (monthFilter) {
        const [year, month] = monthFilter.split('-');
        statsUrl += `?year=${year}&month=${month}`;
      }
      const response = await api.get(statsUrl);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
    }
  };

  // Convert today attendance array to map for easier lookup
  const getTodayAttendanceMap = () => {
    const todayMap: { [key: number]: Attendance } = {};
    (todayAttendance || []).forEach((record: any) => {
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
        total_hours: formData.total_hours ? parseFloat(formData.total_hours) : undefined,
        overtime_hours: parseFloat(formData.overtime_hours) || 0,
        break_hours: parseFloat(formData.break_hours) || 0,
        status: formData.status,
        notes: formData.notes,
      };

      await api.post('/attendance', attendanceData);
      toast.success('Attendance record created successfully!');
      setIsCreateDialogOpen(false);
      setFormData(initialFormData);
      fetchAttendanceRecords();
      fetchStats();
      refreshTodayAttendance();
      refreshAttendance();
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
        total_hours: formData.total_hours ? parseFloat(formData.total_hours) : undefined,
        overtime_hours: parseFloat(formData.overtime_hours) || 0,
        break_hours: parseFloat(formData.break_hours) || 0,
        status: formData.status,
        notes: formData.notes,
      };

      await api.put(`/attendance/${selectedAttendance.id}`, attendanceData);
      toast.success('Attendance record updated successfully!');
      setIsEditDialogOpen(false);
      setSelectedAttendance(null);
      setFormData(initialFormData);
      fetchAttendanceRecords();
      fetchStats();
      refreshTodayAttendance();
      refreshAttendance();
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
      fetchStats();
      refreshTodayAttendance();
      refreshAttendance();
    } catch (error: any) {
      console.error('Error deleting attendance:', error);
      toast.error(error.response?.data?.error || 'Failed to delete attendance record');
    }
  };

  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      // Manually refresh all data
      await refreshTodayAttendance();
      await refreshAttendance(); 
      await fetchAttendanceRecords();
      await fetchStats();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async (employee: Employee) => {
    try {
      await clockInEmployee(employee.id);
      toast.success(`${employee.first_name} ${employee.last_name} clocked in successfully!`);
      // Manually trigger refresh after action
      await refreshTodayAttendance();
      await refreshAttendance();
      fetchAttendanceRecords();
      fetchStats();
    } catch (error: any) {
      console.error('Error clocking in:', error);
      toast.error(error.response?.data?.error || 'Failed to clock in');
    }
  };

  const handleClockOut = async (employee: Employee) => {
    try {
      await clockOutEmployee(employee.id);
      toast.success(`${employee.first_name} ${employee.last_name} clocked out successfully!`);
      // Manually trigger refresh after action
      await refreshTodayAttendance();
      await refreshAttendance();
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
      total_hours: attendance.total_hours?.toString() || '',
      overtime_hours: attendance.overtime_hours?.toString() || '0',
      break_hours: attendance.break_hours?.toString() || '0',
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Records</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_records}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Present Days</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.present_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Timer className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Hours</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_hours ? parseFloat(stats.total_hours as any).toFixed(1) : '0.0'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Overtime Hours</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_overtime_hours ? parseFloat(stats.total_overtime_hours as any).toFixed(1) : '0.0'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Clock In/Out Section */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Attendance</CardTitle>
          <CardDescription>Quick clock in/out for employees</CardDescription>
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
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttendanceRecords.map((attendance) => (
                <TableRow key={attendance.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {attendance.first_name} {attendance.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {attendance.employee_code} • {attendance.department}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(attendance.date)}</TableCell>
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
              ))}
            </TableBody>
          </Table>
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

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="total_hours">Total Hours</Label>
                    <Input
                      id="total_hours"
                      type="number"
                      step="0.1"
                      value={formData.total_hours}
                      onChange={(e) => setFormData({ ...formData, total_hours: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="overtime_hours">Overtime Hours</Label>
                    <Input
                      id="overtime_hours"
                      type="number"
                      step="0.1"
                      value={formData.overtime_hours}
                      onChange={(e) => setFormData({ ...formData, overtime_hours: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="break_hours">Break Hours</Label>
                    <Input
                      id="break_hours"
                      type="number"
                      step="0.1"
                      value={formData.break_hours}
                      onChange={(e) => setFormData({ ...formData, break_hours: e.target.value })}
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

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="edit_total_hours">Total Hours</Label>
                    <Input
                      id="edit_total_hours"
                      type="number"
                      step="0.1"
                      value={formData.total_hours}
                      onChange={(e) => setFormData({ ...formData, total_hours: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_overtime_hours">Overtime Hours</Label>
                    <Input
                      id="edit_overtime_hours"
                      type="number"
                      step="0.1"
                      value={formData.overtime_hours}
                      onChange={(e) => setFormData({ ...formData, overtime_hours: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_break_hours">Break Hours</Label>
                    <Input
                      id="edit_break_hours"
                      type="number"
                      step="0.1"
                      value={formData.break_hours}
                      onChange={(e) => setFormData({ ...formData, break_hours: e.target.value })}
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
