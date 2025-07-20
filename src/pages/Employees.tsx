import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Eye, MoreHorizontal, Users, UserCheck, UserX, Building, Clock, Calendar, Settings, FileText, Activity } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  hire_date: string;
  employment_type: 'full_time' | 'part_time' | 'contract';
  salary_type: 'monthly' | 'daily' | 'hourly';
  base_salary: number;
  daily_wage?: number;
  hourly_rate?: number;
  department?: string;
  position?: string;
  status: 'active' | 'inactive' | 'terminated';
  username?: string;
  user_active?: boolean;
  created_at: string;
}

interface EmployeeStats {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  full_time_employees: number;
  part_time_employees: number;
  contract_employees: number;
  departments: Array<{ department: string; count: number }>;
}

interface EmployeeFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  hire_date: string;
  employment_type: string;
  salary_type: string;
  base_salary: string;
  daily_wage: string;
  hourly_rate: string;
  department: string;
  position: string;
  create_login: boolean;
  password?: string;
}

interface WorkSchedule {
  id: number;
  employee_id: number;
  schedule_name: string;
  effective_from: string;
  effective_to: string | null;
  monday_start: string | null;
  monday_end: string | null;
  tuesday_start: string | null;
  tuesday_end: string | null;
  wednesday_start: string | null;
  wednesday_end: string | null;
  thursday_start: string | null;
  thursday_end: string | null;
  friday_start: string | null;
  friday_end: string | null;
  saturday_start: string | null;
  saturday_end: string | null;
  sunday_start: string | null;
  sunday_end: string | null;
  break_duration: number;
  weekly_hours: number;
  is_active: boolean;
  first_name?: string;
  last_name?: string;
}

interface LeaveType {
  id: number;
  name: string;
  description: string;
  max_days_per_year: number;
  max_days_per_month: number;
  carry_forward: boolean;
  is_paid: boolean;
  requires_approval: boolean;
  advance_notice_days: number;
  color: string;
}

interface LeaveBalance {
  id: number;
  employee_id: number;
  leave_type_id: number;
  year: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
  carried_forward: number;
  leave_type_name: string;
  leave_type_color: string;
}

interface AttendanceRule {
  id: number;
  rule_name: string;
  late_grace_period: number;
  late_penalty_type: string;
  late_penalty_amount: number;
  half_day_threshold: number;
  overtime_threshold: number;
  overtime_rate: number;
  min_working_hours: number;
  max_working_hours: number;
  auto_clock_out: boolean;
  auto_clock_out_time: string;
  weekend_overtime: boolean;
  holiday_overtime: boolean;
  is_active: boolean;
}

interface ScheduleFormData {
  employee_id: string;
  schedule_name: string;
  effective_from: string;
  effective_to: string;
  monday_start: string | null;
  monday_end: string | null;
  tuesday_start: string | null;
  tuesday_end: string | null;
  wednesday_start: string | null;
  wednesday_end: string | null;
  thursday_start: string | null;
  thursday_end: string | null;
  friday_start: string | null;
  friday_end: string | null;
  saturday_start: string | null;
  saturday_end: string | null;
  sunday_start: string | null;
  sunday_end: string | null;
  break_duration: number;
  weekly_hours: number;
  is_active: boolean;
}

interface LeaveTypeFormData {
  name: string;
  description: string;
  max_days_per_year: number;
  max_days_per_month: number;
  carry_forward: boolean;
  is_paid: boolean;
  requires_approval: boolean;
  advance_notice_days: number;
  color: string;
}

interface AttendanceRuleFormData {
  rule_name: string;
  late_grace_period: number;
  late_penalty_type: string;
  late_penalty_amount: number;
  half_day_threshold: number;
  overtime_threshold: number;
  overtime_rate: number;
  auto_clock_out: boolean;
  auto_clock_out_time: string;
  weekend_overtime: boolean;
  holiday_overtime: boolean;
  is_active: boolean;
}

const initialFormData: EmployeeFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  hire_date: '',
  employment_type: 'full_time',
  salary_type: 'monthly',
  base_salary: '',
  daily_wage: '',
  hourly_rate: '',
  department: '',
  position: '',
  create_login: true,
};

const initialScheduleFormData: ScheduleFormData = {
  employee_id: '',
  schedule_name: '',
  effective_from: '',
  effective_to: '',
  monday_start: null,
  monday_end: null,
  tuesday_start: null,
  tuesday_end: null,
  wednesday_start: null,
  wednesday_end: null,
  thursday_start: null,
  thursday_end: null,
  friday_start: null,
  friday_end: null,
  saturday_start: null,
  saturday_end: null,
  sunday_start: null,
  sunday_end: null,
  break_duration: 60,
  weekly_hours: 40,
  is_active: true,
};

const initialLeaveTypeFormData: LeaveTypeFormData = {
  name: '',
  description: '',
  max_days_per_year: 21,
  max_days_per_month: 2,
  carry_forward: false,
  is_paid: true,
  requires_approval: true,
  advance_notice_days: 1,
  color: '#3b82f6',
};

const initialAttendanceRuleFormData: AttendanceRuleFormData = {
  rule_name: '',
  late_grace_period: 15,
  late_penalty_type: 'none',
  late_penalty_amount: 0,
  half_day_threshold: 240,
  overtime_threshold: 480,
  overtime_rate: 1.5,
  auto_clock_out: false,
  auto_clock_out_time: '23:59',
  weekend_overtime: false,
  holiday_overtime: false,
  is_active: true,
};

export const EmployeesPage: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('employees');
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [attendanceRules, setAttendanceRules] = useState<AttendanceRule[]>([]);
  const [selectedEmployeeForSchedule, setSelectedEmployeeForSchedule] = useState<Employee | null>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isLeaveTypeDialogOpen, setIsLeaveTypeDialogOpen] = useState(false);
  const [isAttendanceRuleDialogOpen, setIsAttendanceRuleDialogOpen] = useState(false);
  const [scheduleFormData, setScheduleFormData] = useState<ScheduleFormData>(initialScheduleFormData);
  const [leaveTypeFormData, setLeaveTypeFormData] = useState<LeaveTypeFormData>(initialLeaveTypeFormData);
  const [attendanceRuleFormData, setAttendanceRuleFormData] = useState<AttendanceRuleFormData>(initialAttendanceRuleFormData);

  useEffect(() => {
    fetchEmployees();
    fetchStats();
    if (activeTab === 'schedules') {
      fetchWorkSchedules();
    } else if (activeTab === 'leave-types') {
      fetchLeaveTypes();
    } else if (activeTab === 'attendance-rules') {
      fetchAttendanceRules();
    }
  }, [statusFilter, departmentFilter, searchTerm, activeTab]);

  const handleScheduleTimeChange = (day: string, part: 'start' | 'end', value: string) => {
    const key = `${day.toLowerCase()}_${part}` as keyof ScheduleFormData;
    setScheduleFormData(prev => ({ ...prev, [key]: value }));
  };

  const getScheduleTimeValue = (day: string, part: 'start' | 'end'): string => {
    const key = `${day.toLowerCase()}_${part}` as keyof ScheduleFormData;
    const value = scheduleFormData[key];
    return (value as string) || '';
  };

  const fetchEmployees = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (departmentFilter !== 'all') params.append('department', departmentFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await api.get(`/employees?${params.toString()}`);
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/employees/stats/overview');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching employee stats:', error);
    }
  };

  const fetchWorkSchedules = async () => {
    try {
      const response = await api.get('/work-schedules');
      setWorkSchedules(response.data);
    } catch (error) {
      console.error('Error fetching work schedules:', error);
      toast.error('Failed to fetch work schedules');
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const response = await api.get('/leaves/types');
      setLeaveTypes(response.data);
    } catch (error) {
      console.error('Error fetching leave types:', error);
      toast.error('Failed to fetch leave types');
    }
  };

  const fetchAttendanceRules = async () => {
    try {
      const response = await api.get('/attendance-rules');
      setAttendanceRules(response.data);
    } catch (error) {
      console.error('Error fetching attendance rules:', error);
      toast.error('Failed to fetch attendance rules');
    }
  };

  const handleCreateWorkSchedule = async (scheduleData: any) => {
    try {
      await api.post('/work-schedules', scheduleData);
      toast.success('Work schedule created successfully!');
      fetchWorkSchedules();
      setIsScheduleDialogOpen(false);
    } catch (error: any) {
      console.error('Error creating work schedule:', error);
      toast.error(error.response?.data?.error || 'Failed to create work schedule');
    }
  };

  const handleCreateLeaveType = async (leaveTypeData: any) => {
    try {
      await api.post('/leaves/types', leaveTypeData);
      toast.success('Leave type created successfully!');
      fetchLeaveTypes();
      setIsLeaveTypeDialogOpen(false);
    } catch (error: any) {
      console.error('Error creating leave type:', error);
      toast.error(error.response?.data?.error || 'Failed to create leave type');
    }
  };

  const handleCreateAttendanceRule = async (ruleData: any) => {
    try {
      await api.post('/attendance-rules', ruleData);
      toast.success('Attendance rule created successfully!');
      fetchAttendanceRules();
      setIsAttendanceRuleDialogOpen(false);
    } catch (error: any) {
      console.error('Error creating attendance rule:', error);
      toast.error(error.response?.data?.error || 'Failed to create attendance rule');
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const employeeData = {
        ...formData,
        base_salary: parseFloat(formData.base_salary),
        daily_wage: formData.daily_wage ? parseFloat(formData.daily_wage) : undefined,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : undefined,
      };

      const response = await api.post('/employees', employeeData);
      
      if (response.data.loginCredentials) {
        toast.success(
          `Employee created successfully! Login credentials: ${response.data.loginCredentials.username} / ${response.data.loginCredentials.temporaryPassword}`,
          { duration: 8000 }
        );
      } else {
        toast.success('Employee created successfully!');
      }

      setIsCreateDialogOpen(false);
      setFormData(initialFormData);
      fetchEmployees();
      fetchStats();
    } catch (error: any) {
      console.error('Error creating employee:', error);
      toast.error(error.response?.data?.error || 'Failed to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    setSubmitting(true);
    try {
      const employeeData = {
        ...formData,
        base_salary: parseFloat(formData.base_salary),
        daily_wage: formData.daily_wage ? parseFloat(formData.daily_wage) : undefined,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : undefined,
      };

      await api.put(`/employees/${selectedEmployee.id}`, employeeData);
      toast.success('Employee updated successfully!');
      setIsEditDialogOpen(false);
      setSelectedEmployee(null);
      setFormData(initialFormData);
      fetchEmployees();
      fetchStats();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      toast.error(error.response?.data?.error || 'Failed to update employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!window.confirm(`Are you sure you want to delete ${employee.first_name} ${employee.last_name}?`)) {
      return;
    }

    try {
      await api.delete(`/employees/${employee.id}`);
      toast.success('Employee deleted successfully!');
      fetchEmployees();
      fetchStats();
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      toast.error(error.response?.data?.error || 'Failed to delete employee');
    }
  };

  const handleResetPassword = async (employee: Employee) => {
    try {
      const response = await api.post(`/employees/${employee.id}/reset-password`);
      toast.success(
        `Password reset successfully! New temporary password: ${response.data.temporaryPassword}`,
        { duration: 8000 }
      );
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.response?.data?.error || 'Failed to reset password');
    }
  };

  const openEditDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      phone: employee.phone || '',
      address: employee.address || '',
      hire_date: employee.hire_date,
      employment_type: employee.employment_type,
      salary_type: employee.salary_type,
      base_salary: employee.base_salary.toString(),
      daily_wage: employee.daily_wage?.toString() || '',
      hourly_rate: employee.hourly_rate?.toString() || '',
      department: employee.department || '',
      position: employee.position || '',
      create_login: false,
    });
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-yellow-100 text-yellow-800">Inactive</Badge>;
      case 'terminated':
        return <Badge className="bg-red-100 text-red-800">Terminated</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getEmploymentTypeBadge = (type: string) => {
    switch (type) {
      case 'full_time':
        return <Badge variant="outline">Full Time</Badge>;
      case 'part_time':
        return <Badge variant="outline">Part Time</Badge>;
      case 'contract':
        return <Badge variant="outline">Contract</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-600">Manage your employees and their information</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Employee
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Employees</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_employees}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active_employees}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserX className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Inactive</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inactive_employees}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Building className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Departments</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.departments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {stats?.departments
                  .filter((dept) => dept.department)
                  .map((dept) => (
                    <SelectItem key={dept.department} value={dept.department}>
                      {dept.department} ({dept.count})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* HR Management Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="employees">
            <Users className="h-4 w-4 mr-2" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="schedules">
            <Clock className="h-4 w-4 mr-2" />
            Work Schedules
          </TabsTrigger>
          <TabsTrigger value="leave-types">
            <Calendar className="h-4 w-4 mr-2" />
            Leave Types
          </TabsTrigger>
          <TabsTrigger value="attendance-rules">
            <Settings className="h-4 w-4 mr-2" />
            Attendance Rules
          </TabsTrigger>
          <TabsTrigger value="reports">
            <Activity className="h-4 w-4 mr-2" />
            HR Reports
          </TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee List</CardTitle>
              <CardDescription>
                A list of all employees including their details and status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Employment Type</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </div>
                          <div className="text-sm text-gray-500">{employee.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{employee.employee_code}</TableCell>
                      <TableCell>{employee.department || 'N/A'}</TableCell>
                      <TableCell>{getEmploymentTypeBadge(employee.employment_type)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">${(employee.base_salary || 0).toLocaleString()}</div>
                          <div className="text-sm text-gray-500">{employee.salary_type}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(employee.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(employee)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedEmployeeForSchedule(employee);
                              setIsScheduleDialogOpen(true);
                            }}>
                              <Clock className="mr-2 h-4 w-4" />
                              Manage Schedule
                            </DropdownMenuItem>
                            {employee.username && (
                              <DropdownMenuItem onClick={() => handleResetPassword(employee)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Reset Password
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDeleteEmployee(employee)}
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
        </TabsContent>

        {/* Work Schedules Tab */}
        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Work Schedules</CardTitle>
                  <CardDescription>
                    Manage employee work schedules and duty timings.
                  </CardDescription>
                </div>
                <Button onClick={() => setIsScheduleDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Schedule Name</TableHead>
                    <TableHead>Effective Period</TableHead>
                    <TableHead>Weekly Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workSchedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell>
                        <div className="font-medium">
                          {schedule.first_name} {schedule.last_name}
                        </div>
                      </TableCell>
                      <TableCell>{schedule.schedule_name}</TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">
                            From: {new Date(schedule.effective_from).toLocaleDateString()}
                          </div>
                          {schedule.effective_to && (
                            <div className="text-sm text-gray-500">
                              To: {new Date(schedule.effective_to).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{schedule.weekly_hours} hours</TableCell>
                      <TableCell>
                        {schedule.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
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
        </TabsContent>

        {/* Leave Types Tab */}
        <TabsContent value="leave-types" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Leave Types</CardTitle>
                  <CardDescription>
                    Configure different types of leaves for your organization.
                  </CardDescription>
                </div>
                <Button onClick={() => setIsLeaveTypeDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Leave Type
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {leaveTypes.map((leaveType) => (
                  <Card key={leaveType.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: leaveType.color }}
                        ></div>
                        <div className="flex-1">
                          <h3 className="font-medium">{leaveType.name}</h3>
                          <p className="text-sm text-gray-500">{leaveType.description}</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-gray-600">
                        <div>Max per year: {leaveType.max_days_per_year} days</div>
                        <div>Max per month: {leaveType.max_days_per_month} days</div>
                        <div className="flex space-x-2">
                          {leaveType.is_paid && <Badge variant="outline" className="text-xs">Paid</Badge>}
                          {leaveType.carry_forward && <Badge variant="outline" className="text-xs">Carry Forward</Badge>}
                          {leaveType.requires_approval && <Badge variant="outline" className="text-xs">Approval Required</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Rules Tab */}
        <TabsContent value="attendance-rules" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Attendance Rules</CardTitle>
                  <CardDescription>
                    Configure attendance policies including late penalties and overtime calculations.
                  </CardDescription>
                </div>
                <Button onClick={() => setIsAttendanceRuleDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {attendanceRules.map((rule) => (
                  <Card key={rule.id} className={rule.is_active ? 'border-green-500' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{rule.rule_name}</h3>
                        {rule.is_active && (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Late Grace:</span>
                          <br />{rule.late_grace_period} minutes
                        </div>
                        <div>
                          <span className="font-medium">Half Day:</span>
                          <br />{rule.half_day_threshold / 60} hours
                        </div>
                        <div>
                          <span className="font-medium">Overtime:</span>
                          <br />After {rule.overtime_threshold / 60} hours
                        </div>
                        <div>
                          <span className="font-medium">OT Rate:</span>
                          <br />{rule.overtime_rate}x
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HR Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>HR Reports & Analytics</CardTitle>
              <CardDescription>
                View comprehensive reports on attendance, payroll, and employee performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Activity className="h-8 w-8 text-blue-600" />
                      <div>
                        <h3 className="font-medium">Attendance Report</h3>
                        <p className="text-sm text-gray-500">Monthly attendance summary</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-green-600" />
                      <div>
                        <h3 className="font-medium">Payroll Report</h3>
                        <p className="text-sm text-gray-500">Salary and deductions summary</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-8 w-8 text-purple-600" />
                      <div>
                        <h3 className="font-medium">Leave Report</h3>
                        <p className="text-sm text-gray-500">Leave balances and requests</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Employee Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Create a new employee record. You can optionally create a login account for the employee.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="create_login"
                checked={formData.create_login}
                onCheckedChange={(checked) => setFormData({ ...formData, create_login: checked })}
              />
              <Label htmlFor="create_login">Create Login Account</Label>
            </div>

            {formData.create_login && (
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password || ''}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={formData.create_login}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="hire_date">Hire Date *</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employment_type">Employment Type</Label>
                <Select value={formData.employment_type} onValueChange={(value) => setFormData({ ...formData, employment_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="salary_type">Salary Type</Label>
                <Select value={formData.salary_type} onValueChange={(value) => setFormData({ ...formData, salary_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="base_salary">Base Salary *</Label>
                <Input
                  id="base_salary"
                  type="number"
                  step="0.01"
                  value={formData.base_salary}
                  onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                  required
                />
              </div>
              {formData.salary_type === 'daily' && (
                <div>
                  <Label htmlFor="daily_wage">Daily Wage</Label>
                  <Input
                    id="daily_wage"
                    type="number"
                    step="0.01"
                    value={formData.daily_wage}
                    onChange={(e) => setFormData({ ...formData, daily_wage: e.target.value })}
                  />
                </div>
              )}
              {formData.salary_type === 'hourly' && (
                <div>
                  <Label htmlFor="hourly_rate">Hourly Rate</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                  />
                </div>
              )}
            </div>


            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Employee'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_first_name">First Name *</Label>
                <Input
                  id="edit_first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_last_name">Last Name *</Label>
                <Input
                  id="edit_last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit_email">Email *</Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_phone">Phone</Label>
                <Input
                  id="edit_phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_hire_date">Hire Date *</Label>
                <Input
                  id="edit_hire_date"
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit_address">Address</Label>
              <Textarea
                id="edit_address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_department">Department</Label>
                <Input
                  id="edit_department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_position">Position</Label>
                <Input
                  id="edit_position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_employment_type">Employment Type</Label>
                <Select value={formData.employment_type} onValueChange={(value) => setFormData({ ...formData, employment_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_salary_type">Salary Type</Label>
                <Select value={formData.salary_type} onValueChange={(value) => setFormData({ ...formData, salary_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_base_salary">Base Salary *</Label>
                <Input
                  id="edit_base_salary"
                  type="number"
                  step="0.01"
                  value={formData.base_salary}
                  onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                  required
                />
              </div>
              {formData.salary_type === 'daily' && (
                <div>
                  <Label htmlFor="edit_daily_wage">Daily Wage</Label>
                  <Input
                    id="edit_daily_wage"
                    type="number"
                    step="0.01"
                    value={formData.daily_wage}
                    onChange={(e) => setFormData({ ...formData, daily_wage: e.target.value })}
                  />
                </div>
              )}
              {formData.salary_type === 'hourly' && (
                <div>
                  <Label htmlFor="edit_hourly_rate">Hourly Rate</Label>
                  <Input
                    id="edit_hourly_rate"
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Updating...' : 'Update Employee'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Work Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Work Schedule</DialogTitle>
            <DialogDescription>
              Set up duty timings and work schedule for employees.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee</Label>
                <Select value={scheduleFormData.employee_id} onValueChange={(value) => setScheduleFormData(prev => ({...prev, employee_id: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.first_name} {employee.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Schedule Name</Label>
                <Input 
                  value={scheduleFormData.schedule_name}
                  onChange={(e) => setScheduleFormData(prev => ({...prev, schedule_name: e.target.value}))}
                  placeholder="e.g., Standard Working Hours" 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Effective From</Label>
                <Input 
                  type="date"
                  value={scheduleFormData.effective_from}
                  onChange={(e) => setScheduleFormData(prev => ({...prev, effective_from: e.target.value}))}
                />
              </div>
              <div>
                <Label>Effective To (Optional)</Label>
                <Input 
                  type="date"
                  value={scheduleFormData.effective_to}
                  onChange={(e) => setScheduleFormData(prev => ({...prev, effective_to: e.target.value}))}
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-medium">Weekly Schedule</h3>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                <div key={day} className="grid grid-cols-4 gap-4 items-center">
                  <Label className="w-20">{day}</Label>
                  <div>
                    <Label className="text-xs">Start Time</Label>
                    <Input
                      type="time"
                      value={getScheduleTimeValue(day, 'start')}
                      onChange={(e) => handleScheduleTimeChange(day, 'start', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">End Time</Label>
                    <Input
                      type="time"
                      value={getScheduleTimeValue(day, 'end')}
                      onChange={(e) => handleScheduleTimeChange(day, 'end', e.target.value)}
                    />
                  </div>
                  <Switch />
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Break Duration (minutes)</Label>
                <Input 
                  type="number" 
                  value={scheduleFormData.break_duration}
                  onChange={(e) => setScheduleFormData(prev => ({...prev, break_duration: parseInt(e.target.value) || 0}))}
                  placeholder="60" 
                />
              </div>
              <div>
                <Label>Weekly Hours</Label>
                <Input 
                  type="number" 
                  value={scheduleFormData.weekly_hours}
                  onChange={(e) => setScheduleFormData(prev => ({...prev, weekly_hours: parseInt(e.target.value) || 0}))}
                  placeholder="40" 
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => handleCreateWorkSchedule(scheduleFormData)}>
                Create Schedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Type Dialog */}
      <Dialog open={isLeaveTypeDialogOpen} onOpenChange={setIsLeaveTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Leave Type</DialogTitle>
            <DialogDescription>
              Define a new type of leave for your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Leave Type Name</Label>
              <Input 
                value={leaveTypeFormData.name}
                onChange={(e) => setLeaveTypeFormData(prev => ({...prev, name: e.target.value}))}
                placeholder="e.g., Annual Leave, Sick Leave" 
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea 
                value={leaveTypeFormData.description}
                onChange={(e) => setLeaveTypeFormData(prev => ({...prev, description: e.target.value}))}
                placeholder="Brief description of this leave type" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Max Days Per Year</Label>
                <Input 
                  type="number" 
                  value={leaveTypeFormData.max_days_per_year}
                  onChange={(e) => setLeaveTypeFormData(prev => ({...prev, max_days_per_year: parseInt(e.target.value) || 0}))}
                  placeholder="21" 
                />
              </div>
              <div>
                <Label>Max Days Per Month</Label>
                <Input 
                  type="number" 
                  value={leaveTypeFormData.max_days_per_month}
                  onChange={(e) => setLeaveTypeFormData(prev => ({...prev, max_days_per_month: parseInt(e.target.value) || 0}))}
                  placeholder="2" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Advance Notice (Days)</Label>
                <Input 
                  type="number" 
                  value={leaveTypeFormData.advance_notice_days}
                  onChange={(e) => setLeaveTypeFormData(prev => ({...prev, advance_notice_days: parseInt(e.target.value) || 0}))}
                  placeholder="1" 
                />
              </div>
              <div>
                <Label>Color</Label>
                <Input 
                  type="color" 
                  value={leaveTypeFormData.color}
                  onChange={(e) => setLeaveTypeFormData(prev => ({...prev, color: e.target.value}))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="is_paid" 
                  checked={leaveTypeFormData.is_paid}
                  onCheckedChange={(checked) => setLeaveTypeFormData(prev => ({...prev, is_paid: checked}))}
                />
                <Label htmlFor="is_paid">Paid Leave</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="carry_forward" 
                  checked={leaveTypeFormData.carry_forward}
                  onCheckedChange={(checked) => setLeaveTypeFormData(prev => ({...prev, carry_forward: checked}))}
                />
                <Label htmlFor="carry_forward">Allow Carry Forward</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="requires_approval" 
                  checked={leaveTypeFormData.requires_approval}
                  onCheckedChange={(checked) => setLeaveTypeFormData(prev => ({...prev, requires_approval: checked}))}
                />
                <Label htmlFor="requires_approval">Requires Approval</Label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsLeaveTypeDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => handleCreateLeaveType(leaveTypeFormData)}>
                Create Leave Type
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attendance Rule Dialog */}
      <Dialog open={isAttendanceRuleDialogOpen} onOpenChange={setIsAttendanceRuleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Attendance Rule</DialogTitle>
            <DialogDescription>
              Define attendance policies and overtime calculations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input 
                value={attendanceRuleFormData.rule_name}
                onChange={(e) => setAttendanceRuleFormData(prev => ({...prev, rule_name: e.target.value}))}
                placeholder="e.g., Standard Working Hours" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Late Grace Period (minutes)</Label>
                <Input 
                  type="number" 
                  value={attendanceRuleFormData.late_grace_period}
                  onChange={(e) => setAttendanceRuleFormData(prev => ({...prev, late_grace_period: parseInt(e.target.value) || 0}))}
                  placeholder="15" 
                />
              </div>
              <div>
                <Label>Late Penalty Type</Label>
                <Select 
                  value={attendanceRuleFormData.late_penalty_type}
                  onValueChange={(value) => setAttendanceRuleFormData(prev => ({...prev, late_penalty_type: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select penalty type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Penalty</SelectItem>
                    <SelectItem value="deduction">Salary Deduction</SelectItem>
                    <SelectItem value="half_day">Mark as Half Day</SelectItem>
                    <SelectItem value="warning">Warning Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Half Day Threshold (minutes)</Label>
                <Input 
                  type="number" 
                  value={attendanceRuleFormData.half_day_threshold}
                  onChange={(e) => setAttendanceRuleFormData(prev => ({...prev, half_day_threshold: parseInt(e.target.value) || 0}))}
                  placeholder="240" 
                />
              </div>
              <div>
                <Label>Overtime Threshold (minutes)</Label>
                <Input 
                  type="number" 
                  value={attendanceRuleFormData.overtime_threshold}
                  onChange={(e) => setAttendanceRuleFormData(prev => ({...prev, overtime_threshold: parseInt(e.target.value) || 0}))}
                  placeholder="480" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Overtime Rate</Label>
                <Input 
                  type="number" 
                  step="0.1" 
                  value={attendanceRuleFormData.overtime_rate}
                  onChange={(e) => setAttendanceRuleFormData(prev => ({...prev, overtime_rate: parseFloat(e.target.value) || 0}))}
                  placeholder="1.5" 
                />
              </div>
              <div>
                <Label>Auto Clock Out Time</Label>
                <Input 
                  type="time" 
                  value={attendanceRuleFormData.auto_clock_out_time}
                  onChange={(e) => setAttendanceRuleFormData(prev => ({...prev, auto_clock_out_time: e.target.value}))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="auto_clock_out" 
                  checked={attendanceRuleFormData.auto_clock_out}
                  onCheckedChange={(checked) => setAttendanceRuleFormData(prev => ({...prev, auto_clock_out: checked}))}
                />
                <Label htmlFor="auto_clock_out">Enable Auto Clock Out</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="weekend_overtime" 
                  checked={attendanceRuleFormData.weekend_overtime}
                  onCheckedChange={(checked) => setAttendanceRuleFormData(prev => ({...prev, weekend_overtime: checked}))}
                />
                <Label htmlFor="weekend_overtime">Weekend Overtime</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="holiday_overtime" 
                  checked={attendanceRuleFormData.holiday_overtime}
                  onCheckedChange={(checked) => setAttendanceRuleFormData(prev => ({...prev, holiday_overtime: checked}))}
                />
                <Label htmlFor="holiday_overtime">Holiday Overtime</Label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAttendanceRuleDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => handleCreateAttendanceRule(attendanceRuleFormData)}>
                Create Rule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
