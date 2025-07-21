import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Eye, MoreHorizontal, DollarSign, Users, Calendar, CheckCircle, Clock, FileText, Download } from 'lucide-react';
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
import { Separator } from '../components/ui/separator';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Payroll, PayrollStats, PayrollForm, Employee, BulkPayrollForm } from '../lib/types';
import toast from 'react-hot-toast';

interface PayrollFormData {
  employee_id: string;
  pay_period_start: string;
  pay_period_end: string;
  basic_salary: string;
  overtime_amount: string;
  bonuses: string;
  reimbursements: string;
  tax_deduction: string;
  insurance_deduction: string;
  other_deductions: string;
  total_working_days: string;
  total_present_days: string;
  total_overtime_hours: string;
  pay_method: string;
  notes: string;
  auto_calculate: boolean;
}

interface BulkPayrollFormData {
  pay_period_start: string;
  pay_period_end: string;
  selected_employees: number[];
  auto_calculate: boolean;
}

const initialFormData: PayrollFormData = {
  employee_id: '',
  pay_period_start: '',
  pay_period_end: '',
  basic_salary: '',
  overtime_amount: '',
  bonuses: '0',
  reimbursements: '0',
  tax_deduction: '0',
  insurance_deduction: '0',
  other_deductions: '0',
  total_working_days: '',
  total_present_days: '',
  total_overtime_hours: '',
  pay_method: 'bank_transfer',
  notes: '',
  auto_calculate: true,
};

const initialBulkFormData: BulkPayrollFormData = {
  pay_period_start: '',
  pay_period_end: '',
  selected_employees: [],
  auto_calculate: true,
};

export const PayrollPage: React.FC = () => {
  const { user } = useAuth();
  const [payrollRecords, setPayrollRecords] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<PayrollStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('');
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isBulkCreateDialogOpen, setIsBulkCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [formData, setFormData] = useState<PayrollFormData>(initialFormData);
  const [bulkFormData, setBulkFormData] = useState<BulkPayrollFormData>(initialBulkFormData);
  const [submitting, setSubmitting] = useState(false);
  const [calculatedData, setCalculatedData] = useState<any>(null);

  useEffect(() => {
    if (formData.auto_calculate && formData.employee_id && formData.pay_period_start && formData.pay_period_end) {
      const calculate = async () => {
        try {
          const response = await api.post('/payroll/calculate', {
            employee_id: parseInt(formData.employee_id),
            pay_period_start: formData.pay_period_start,
            pay_period_end: formData.pay_period_end,
          });
          setCalculatedData(response.data);
        } catch (error) {
          console.error('Error calculating payroll:', error);
          setCalculatedData(null);
        }
      };
      calculate();
    } else {
      setCalculatedData(null);
    }
  }, [formData.auto_calculate, formData.employee_id, formData.pay_period_start, formData.pay_period_end]);

  useEffect(() => {
    if (calculatedData) {
      setFormData((prev) => ({
        ...prev,
        basic_salary: calculatedData.basicSalary?.toString() || '',
        overtime_amount: calculatedData.overtimeAmount?.toString() || '',
        total_working_days: calculatedData.totalWorkingDays?.toString() || '',
        total_present_days: calculatedData.totalPresentDays?.toString() || '',
        total_overtime_hours: calculatedData.totalOvertimeHours?.toString() || '',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        basic_salary: '',
        overtime_amount: '',
        total_working_days: '',
        total_present_days: '',
        total_overtime_hours: '',
      }));
    }
  }, [calculatedData]);

  useEffect(() => {
    fetchPayrollRecords();
    fetchEmployees();
    fetchStats();
  }, [statusFilter, employeeFilter, periodFilter, searchTerm]);

  const fetchPayrollRecords = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (employeeFilter !== 'all') params.append('employee_id', employeeFilter);
      if (periodFilter) {
        const [year, month] = periodFilter.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
        params.append('pay_period_start', startDate);
        params.append('pay_period_end', endDate);
      }

      const response = await api.get(`/payroll?${params.toString()}`);
      setPayrollRecords(response.data.payroll || []);
    } catch (error) {
      console.error('Error fetching payroll records:', error);
      toast.error('Failed to fetch payroll records');
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
      const response = await api.get('/payroll/stats/summary');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching payroll stats:', error);
    }
  };

  const handleCreatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let finalCalculatedData = calculatedData;

      // If auto-calculating, ensure we have the latest data
      if (formData.auto_calculate) {
        try {
          const response = await api.post('/payroll/calculate', {
            employee_id: parseInt(formData.employee_id),
            pay_period_start: formData.pay_period_start,
            pay_period_end: formData.pay_period_end,
          });
          finalCalculatedData = response.data;
        } catch (error) {
          console.error('Error re-calculating payroll on submit:', error);
          toast.error('Could not calculate payroll. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      const payrollData: PayrollForm = {
        employee_id: parseInt(formData.employee_id),
        pay_period_start: formData.pay_period_start,
        pay_period_end: formData.pay_period_end,
        bonuses: parseFloat(formData.bonuses) || 0,
        reimbursements: parseFloat(formData.reimbursements) || 0,
        tax_deduction: parseFloat(formData.tax_deduction) || 0,
        insurance_deduction: parseFloat(formData.insurance_deduction) || 0,
        other_deductions: parseFloat(formData.other_deductions) || 0,
        pay_method: formData.pay_method,
        notes: formData.notes,
        auto_calculate: formData.auto_calculate,
      };

      if (formData.auto_calculate && finalCalculatedData) {
        payrollData.basic_salary = finalCalculatedData.basicSalary;
        payrollData.overtime_amount = finalCalculatedData.overtimeAmount;
        payrollData.total_working_days = finalCalculatedData.totalWorkingDays;
        payrollData.total_present_days = finalCalculatedData.totalPresentDays;
        payrollData.total_overtime_hours = finalCalculatedData.totalOvertimeHours;
      } else if (!formData.auto_calculate) {
        payrollData.basic_salary = formData.basic_salary ? parseFloat(formData.basic_salary) : 0;
        payrollData.overtime_amount = formData.overtime_amount ? parseFloat(formData.overtime_amount) : 0;
        payrollData.total_working_days = formData.total_working_days ? parseInt(formData.total_working_days) : 0;
        payrollData.total_present_days = formData.total_present_days ? parseInt(formData.total_present_days) : 0;
        payrollData.total_overtime_hours = formData.total_overtime_hours ? parseFloat(formData.total_overtime_hours) : 0;
      }

      await api.post('/payroll', payrollData);
      toast.success('Payroll record created successfully!');
      setIsCreateDialogOpen(false);
      setFormData(initialFormData);
      fetchPayrollRecords();
      fetchStats();
    } catch (error: any) {
      console.error('Error creating payroll:', error);
      toast.error(error.response?.data?.error || 'Failed to create payroll record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkCreatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const bulkData: BulkPayrollForm = {
        pay_period_start: bulkFormData.pay_period_start,
        pay_period_end: bulkFormData.pay_period_end,
        employee_ids: bulkFormData.selected_employees,
        auto_calculate: bulkFormData.auto_calculate,
      };

      const response = await api.post('/payroll/bulk-create', bulkData);
      toast.success(`Payroll created for ${response.data.results.length} employees!`);
      
      if (response.data.errors.length > 0) {
        toast.error(`${response.data.errors.length} employees had errors. Check console for details.`);
        console.log('Bulk payroll errors:', response.data.errors);
      }

      setIsBulkCreateDialogOpen(false);
      setBulkFormData(initialBulkFormData);
      fetchPayrollRecords();
      fetchStats();
    } catch (error: any) {
      console.error('Error creating bulk payroll:', error);
      toast.error(error.response?.data?.error || 'Failed to create bulk payroll');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayroll) return;

    setSubmitting(true);
    try {
      const payrollData: Partial<PayrollForm> = {
        basic_salary: formData.basic_salary ? parseFloat(formData.basic_salary) : undefined,
        overtime_amount: formData.overtime_amount ? parseFloat(formData.overtime_amount) : undefined,
        bonuses: parseFloat(formData.bonuses) || 0,
        reimbursements: parseFloat(formData.reimbursements) || 0,
        tax_deduction: parseFloat(formData.tax_deduction) || 0,
        insurance_deduction: parseFloat(formData.insurance_deduction) || 0,
        other_deductions: parseFloat(formData.other_deductions) || 0,
        total_working_days: formData.total_working_days ? parseInt(formData.total_working_days) : undefined,
        total_present_days: formData.total_present_days ? parseInt(formData.total_present_days) : undefined,
        total_overtime_hours: formData.total_overtime_hours ? parseFloat(formData.total_overtime_hours) : undefined,
        pay_method: formData.pay_method,
        notes: formData.notes,
      };

      await api.put(`/payroll/${selectedPayroll.id}`, payrollData);
      toast.success('Payroll record updated successfully!');
      setIsEditDialogOpen(false);
      setSelectedPayroll(null);
      setFormData(initialFormData);
      fetchPayrollRecords();
      fetchStats();
    } catch (error: any) {
      console.error('Error updating payroll:', error);
      toast.error(error.response?.data?.error || 'Failed to update payroll record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayroll = async (payroll: Payroll) => {
    if (!window.confirm(`Are you sure you want to delete payroll record for ${payroll.first_name} ${payroll.last_name}?`)) {
      return;
    }

    try {
      await api.delete(`/payroll/${payroll.id}`);
      toast.success('Payroll record deleted successfully!');
      fetchPayrollRecords();
      fetchStats();
    } catch (error: any) {
      console.error('Error deleting payroll:', error);
      toast.error(error.response?.data?.error || 'Failed to delete payroll record');
    }
  };

  const handleStatusUpdate = async (payroll: Payroll, newStatus: string) => {
    try {
      await api.put(`/payroll/${payroll.id}/status`, { 
        status: newStatus,
        payment_date: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : undefined
      });
      toast.success(`Payroll status updated to ${newStatus}!`);
      fetchPayrollRecords();
      fetchStats();
    } catch (error: any) {
      console.error('Error updating payroll status:', error);
      toast.error(error.response?.data?.error || 'Failed to update payroll status');
    }
  };

  const openEditDialog = (payroll: Payroll) => {
    setSelectedPayroll(payroll);
    setFormData({
      employee_id: payroll.employee_id.toString(),
      pay_period_start: payroll.pay_period_start,
      pay_period_end: payroll.pay_period_end,
      basic_salary: payroll.basic_salary.toString(),
      overtime_amount: payroll.overtime_amount.toString(),
      bonuses: payroll.bonuses.toString(),
      reimbursements: payroll.reimbursements.toString(),
      tax_deduction: payroll.tax_deduction.toString(),
      insurance_deduction: payroll.insurance_deduction.toString(),
      other_deductions: payroll.other_deductions.toString(),
      total_working_days: payroll.total_working_days.toString(),
      total_present_days: payroll.total_present_days.toString(),
      total_overtime_hours: payroll.total_overtime_hours.toString(),
      pay_method: payroll.pay_method || 'bank_transfer',
      notes: payroll.notes || '',
      auto_calculate: false,
    });
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge className="bg-gray-100 text-gray-800">Draft</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800">Approved</Badge>;
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const filteredPayrollRecords = payrollRecords.filter(payroll => {
    const searchMatch = 
      `${payroll.first_name} ${payroll.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payroll.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payroll.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
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
          <h1 className="text-3xl font-bold text-gray-900">Payroll Management</h1>
          <p className="text-gray-600">Manage employee salaries and payroll records</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsBulkCreateDialogOpen(true)} variant="outline">
            <Users className="h-4 w-4 mr-2" />
            Bulk Create
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Payroll
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Records</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_payrolls}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.draft_payrolls + stats.approved_payrolls}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Paid</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.paid_payrolls}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Net Salary</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_net_salary)}</p>
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
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
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
              type="month"
              placeholder="Period"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="w-full sm:w-[150px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Payroll Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Records</CardTitle>
          <CardDescription>
            Manage employee payroll records and salary calculations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Gross Salary</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayrollRecords.map((payroll) => (
                <TableRow key={payroll.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {payroll.first_name} {payroll.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {payroll.employee_code} • {payroll.department}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDate(payroll.pay_period_start)} - {formatDate(payroll.pay_period_end)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatCurrency(payroll.gross_salary)}</div>
                    <div className="text-sm text-gray-500">
                      {payroll.total_present_days}/{payroll.total_working_days} days
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(payroll.deductions)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-green-600">
                      {formatCurrency(payroll.net_salary)}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(payroll.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(payroll)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {payroll.status === 'draft' && (
                          <DropdownMenuItem onClick={() => handleStatusUpdate(payroll, 'approved')}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                        )}
                        {payroll.status === 'approved' && (
                          <DropdownMenuItem onClick={() => handleStatusUpdate(payroll, 'paid')}>
                            <DollarSign className="mr-2 h-4 w-4" />
                            Mark as Paid
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem>
                          <Download className="mr-2 h-4 w-4" />
                          Generate Pay Slip
                        </DropdownMenuItem>
                        {payroll.status !== 'paid' && (
                          <DropdownMenuItem
                            onClick={() => handleDeletePayroll(payroll)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Payroll Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Payroll Record</DialogTitle>
            <DialogDescription>
              Create a new payroll record for an employee. Auto-calculation will use attendance data.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePayroll} className="space-y-6">
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
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="auto_calculate"
                  checked={formData.auto_calculate}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_calculate: checked })}
                />
                <Label htmlFor="auto_calculate">Auto-calculate from attendance</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pay_period_start">Pay Period Start *</Label>
                <Input
                  id="pay_period_start"
                  type="date"
                  value={formData.pay_period_start}
                  onChange={(e) => setFormData({ ...formData, pay_period_start: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="pay_period_end">Pay Period End *</Label>
                <Input
                  id="pay_period_end"
                  type="date"
                  value={formData.pay_period_end}
                  onChange={(e) => setFormData({ ...formData, pay_period_end: e.target.value })}
                  required
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Salary Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="basic_salary">Basic Salary</Label>
                  <Input
                    id="basic_salary"
                    type="number"
                    step="0.01"
                    value={formData.basic_salary}
                    onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                    disabled={formData.auto_calculate}
                  />
                </div>
                <div>
                  <Label htmlFor="overtime_amount">Overtime Amount</Label>
                  <Input
                    id="overtime_amount"
                    type="number"
                    step="0.01"
                    value={formData.overtime_amount}
                    onChange={(e) => setFormData({ ...formData, overtime_amount: e.target.value })}
                    disabled={formData.auto_calculate}
                  />
                </div>
                <div>
                  <Label htmlFor="bonuses">Bonuses</Label>
                  <Input
                    id="bonuses"
                    type="number"
                    step="0.01"
                    value={formData.bonuses}
                    onChange={(e) => setFormData({ ...formData, bonuses: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="reimbursements">Reimbursements</Label>
                  <Input
                    id="reimbursements"
                    type="number"
                    step="0.01"
                    value={formData.reimbursements}
                    onChange={(e) => setFormData({ ...formData, reimbursements: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="tax_deduction">Tax Deduction</Label>
                  <Input
                    id="tax_deduction"
                    type="number"
                    step="0.01"
                    value={formData.tax_deduction}
                    onChange={(e) => setFormData({ ...formData, tax_deduction: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="insurance_deduction">Insurance Deduction</Label>
                  <Input
                    id="insurance_deduction"
                    type="number"
                    step="0.01"
                    value={formData.insurance_deduction}
                    onChange={(e) => setFormData({ ...formData, insurance_deduction: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="other_deductions">Other Deductions</Label>
                <Input
                  id="other_deductions"
                  type="number"
                  step="0.01"
                  value={formData.other_deductions}
                  onChange={(e) => setFormData({ ...formData, other_deductions: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Attendance Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="total_working_days">Total Working Days</Label>
                  <Input
                    id="total_working_days"
                    type="number"
                    value={formData.total_working_days}
                    onChange={(e) => setFormData({ ...formData, total_working_days: e.target.value })}
                    disabled={formData.auto_calculate}
                  />
                </div>
                <div>
                  <Label htmlFor="total_present_days">Total Present Days</Label>
                  <Input
                    id="total_present_days"
                    type="number"
                    value={formData.total_present_days}
                    onChange={(e) => setFormData({ ...formData, total_present_days: e.target.value })}
                    disabled={formData.auto_calculate}
                  />
                </div>
                <div>
                  <Label htmlFor="total_overtime_hours">Overtime Hours</Label>
                  <Input
                    id="total_overtime_hours"
                    type="number"
                    step="0.01"
                    value={formData.total_overtime_hours}
                    onChange={(e) => setFormData({ ...formData, total_overtime_hours: e.target.value })}
                    disabled={formData.auto_calculate}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pay_method">Payment Method</Label>
                <Select value={formData.pay_method} onValueChange={(value) => setFormData({ ...formData, pay_method: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                {submitting ? 'Creating...' : 'Create Payroll'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Payroll Dialog */}
      <Dialog open={isBulkCreateDialogOpen} onOpenChange={setIsBulkCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Create Payroll</DialogTitle>
            <DialogDescription>
              Create payroll records for multiple employees for the same pay period.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBulkCreatePayroll} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bulk_pay_period_start">Pay Period Start *</Label>
                <Input
                  id="bulk_pay_period_start"
                  type="date"
                  value={bulkFormData.pay_period_start}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, pay_period_start: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="bulk_pay_period_end">Pay Period End *</Label>
                <Input
                  id="bulk_pay_period_end"
                  type="date"
                  value={bulkFormData.pay_period_end}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, pay_period_end: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Select Employees *</Label>
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-md p-3 space-y-2">
                {employees.map((employee) => (
                  <div key={employee.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`employee_${employee.id}`}
                      checked={bulkFormData.selected_employees.includes(employee.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBulkFormData({
                            ...bulkFormData,
                            selected_employees: [...bulkFormData.selected_employees, employee.id]
                          });
                        } else {
                          setBulkFormData({
                            ...bulkFormData,
                            selected_employees: bulkFormData.selected_employees.filter(id => id !== employee.id)
                          });
                        }
                      }}
                      className="rounded"
                    />
                    <label htmlFor={`employee_${employee.id}`} className="text-sm">
                      {employee.first_name} {employee.last_name} ({employee.employee_code})
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="bulk_auto_calculate"
                checked={bulkFormData.auto_calculate}
                onCheckedChange={(checked) => setBulkFormData({ ...bulkFormData, auto_calculate: checked })}
              />
              <Label htmlFor="bulk_auto_calculate">Auto-calculate from attendance</Label>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsBulkCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || bulkFormData.selected_employees.length === 0}>
                {submitting ? 'Creating...' : `Create for ${bulkFormData.selected_employees.length} employees`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Payroll Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Payroll Record</DialogTitle>
            <DialogDescription>
              Update payroll record details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditPayroll} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee</Label>
                <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
                  {selectedPayroll?.first_name} {selectedPayroll?.last_name}
                </div>
              </div>
              <div>
                <Label>Pay Period</Label>
                <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
                  {selectedPayroll && formatDate(selectedPayroll.pay_period_start)} - {selectedPayroll && formatDate(selectedPayroll.pay_period_end)}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Salary Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit_basic_salary">Basic Salary</Label>
                  <Input
                    id="edit_basic_salary"
                    type="number"
                    step="0.01"
                    value={formData.basic_salary}
                    onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_overtime_amount">Overtime Amount</Label>
                  <Input
                    id="edit_overtime_amount"
                    type="number"
                    step="0.01"
                    value={formData.overtime_amount}
                    onChange={(e) => setFormData({ ...formData, overtime_amount: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_bonuses">Bonuses</Label>
                  <Input
                    id="edit_bonuses"
                    type="number"
                    step="0.01"
                    value={formData.bonuses}
                    onChange={(e) => setFormData({ ...formData, bonuses: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit_reimbursements">Reimbursements</Label>
                  <Input
                    id="edit_reimbursements"
                    type="number"
                    step="0.01"
                    value={formData.reimbursements}
                    onChange={(e) => setFormData({ ...formData, reimbursements: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_tax_deduction">Tax Deduction</Label>
                  <Input
                    id="edit_tax_deduction"
                    type="number"
                    step="0.01"
                    value={formData.tax_deduction}
                    onChange={(e) => setFormData({ ...formData, tax_deduction: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_insurance_deduction">Insurance Deduction</Label>
                  <Input
                    id="edit_insurance_deduction"
                    type="number"
                    step="0.01"
                    value={formData.insurance_deduction}
                    onChange={(e) => setFormData({ ...formData, insurance_deduction: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit_other_deductions">Other Deductions</Label>
                <Input
                  id="edit_other_deductions"
                  type="number"
                  step="0.01"
                  value={formData.other_deductions}
                  onChange={(e) => setFormData({ ...formData, other_deductions: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Attendance Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit_total_working_days">Total Working Days</Label>
                  <Input
                    id="edit_total_working_days"
                    type="number"
                    value={formData.total_working_days}
                    onChange={(e) => setFormData({ ...formData, total_working_days: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_total_present_days">Total Present Days</Label>
                  <Input
                    id="edit_total_present_days"
                    type="number"
                    value={formData.total_present_days}
                    onChange={(e) => setFormData({ ...formData, total_present_days: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_total_overtime_hours">Overtime Hours</Label>
                  <Input
                    id="edit_total_overtime_hours"
                    type="number"
                    step="0.01"
                    value={formData.total_overtime_hours}
                    onChange={(e) => setFormData({ ...formData, total_overtime_hours: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_pay_method">Payment Method</Label>
                <Select value={formData.pay_method} onValueChange={(value) => setFormData({ ...formData, pay_method: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                {submitting ? 'Updating...' : 'Update Payroll'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
