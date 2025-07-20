import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { 
  Plus, 
  FileText, 
  DollarSign, 
  Search,
  Edit,
  Trash2,
  Eye,
  Receipt,
  Clock,
  AlertTriangle,
  CheckCircle,
  UserCheck,
  Calendar,
  TrendingUp,
  Filter
} from 'lucide-react';
import { accountsReceivableApi } from '../lib/api';
import { AccountsReceivable, AccountsReceivableForm, PaymentForm, AccountsReceivableQueryParams, AccountsReceivableStats } from '../lib/types';
import toast from 'react-hot-toast';

export const AccountsReceivablePage: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountsReceivable[]>([]);
  const [stats, setStats] = useState<AccountsReceivableStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountsReceivable | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountsReceivable | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  
  const [formData, setFormData] = useState<AccountsReceivableForm>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    amount: 0,
    payment_terms: 'Net 30',
    description: '',
    notes: ''
  });

  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Cash',
    reference_number: '',
    notes: ''
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadAccountsReceivable();
    loadStats();
  }, [statusFilter, overdueOnly, searchTerm, pagination.page]);

  const loadAccountsReceivable = async () => {
    try {
      setIsLoading(true);
      const params: AccountsReceivableQueryParams = {
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter !== 'all' ? statusFilter as any : undefined,
        customer_name: searchTerm || undefined,
        overdue_only: overdueOnly
      };

      const response = await accountsReceivableApi.getAll(params);
      setAccounts(response.data.accounts || []);
      
      if (response.data.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Error loading accounts receivable:', error);
      toast.error('Failed to load accounts receivable');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await accountsReceivableApi.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_name || !formData.due_date || !formData.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingAccount) {
        await accountsReceivableApi.update(editingAccount.id, formData);
        toast.success('Invoice updated successfully');
      } else {
        await accountsReceivableApi.create(formData);
        toast.success('Invoice created successfully');
      }
      
      setIsDialogOpen(false);
      setEditingAccount(null);
      resetForm();
      loadAccountsReceivable();
      loadStats();
    } catch (error: any) {
      console.error('Error saving invoice:', error);
      toast.error(error.response?.data?.error || 'Failed to save invoice');
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAccount || !paymentForm.amount || !paymentForm.payment_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await accountsReceivableApi.recordPayment(selectedAccount.id, paymentForm);
      toast.success('Payment recorded successfully');
      setIsPaymentDialogOpen(false);
      setSelectedAccount(null);
      resetPaymentForm();
      loadAccountsReceivable();
      loadStats();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error.response?.data?.error || 'Failed to record payment');
    }
  };

  const handleEdit = (account: AccountsReceivable) => {
    setEditingAccount(account);
    setFormData({
      customer_name: account.customer_name,
      customer_email: account.customer_email || '',
      customer_phone: account.customer_phone || '',
      customer_address: account.customer_address || '',
      due_date: account.due_date,
      amount: account.amount,
      payment_terms: account.payment_terms || '',
      description: account.description || '',
      notes: account.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleView = async (account: AccountsReceivable) => {
    try {
      const response = await accountsReceivableApi.getById(account.id);
      setSelectedAccount(response.data);
      setIsViewDialogOpen(true);
    } catch (error) {
      console.error('Error loading account details:', error);
      toast.error('Failed to load account details');
    }
  };

  const handleDelete = async (account: AccountsReceivable) => {
    if (window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      try {
        await accountsReceivableApi.delete(account.id);
        toast.success('Invoice deleted successfully');
        loadAccountsReceivable();
        loadStats();
      } catch (error: any) {
        console.error('Error deleting invoice:', error);
        toast.error(error.response?.data?.error || 'Failed to delete invoice');
      }
    }
  };

  const openPaymentDialog = (account: AccountsReceivable) => {
    setSelectedAccount(account);
    setPaymentForm({
      amount: account.balance_amount,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'Cash',
      reference_number: '',
      notes: ''
    });
    setIsPaymentDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      customer_address: '',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amount: 0,
      payment_terms: 'Net 30',
      description: '',
      notes: ''
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      amount: 0,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'Cash',
      reference_number: '',
      notes: ''
    });
  };

  const openAddDialog = () => {
    setEditingAccount(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'partial':
        return <Clock className="h-4 w-4" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4" />;
      case 'pending':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <Badge className={`${colors[status]} hover:${colors[status]}`}>
        {getStatusIcon(status)}
        <span className="ml-1 capitalize">{status}</span>
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const isOverdue = (dueDate: string, status: string) => {
    return new Date(dueDate) < new Date() && status !== 'paid';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Accounts Receivable</h1>
          <p className="text-gray-600 mt-2">Manage customer invoices and track payments</p>
        </div>
        <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">Total Receivable</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(stats.total_outstanding)}</div>
              <p className="text-xs text-blue-600 mt-1">From {stats.total_invoices} invoices</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-800">Overdue Amount</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900">{formatCurrency(stats.overdue_amount || 0)}</div>
              <p className="text-xs text-red-600 mt-1">{stats.overdue_invoices} overdue invoices</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Paid Amount</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">{formatCurrency(stats.total_paid || 0)}</div>
              <p className="text-xs text-green-600 mt-1">{stats.paid_invoices} paid invoices</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-800">Total Outstanding</CardTitle>
              <Clock className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">
                {formatCurrency(stats.pending_amount || 0)}
              </div>
              <p className="text-xs text-purple-600 mt-1">{stats.pending_invoices} pending invoices</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accounts Receivable Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Invoices</CardTitle>
          <CardDescription>Track and manage your accounts receivable</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={overdueOnly ? "default" : "outline"}
              onClick={() => setOverdueOnly(!overdueOnly)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Overdue Only
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-6 text-gray-500">
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((account) => (
                    <TableRow key={account.id} className={isOverdue(account.due_date, account.status) ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">{account.id}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{account.customer_name}</div>
                          {account.customer_email && (
                            <div className="text-sm text-gray-500">{account.customer_email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={isOverdue(account.due_date, account.status) ? 'text-red-600 font-medium' : ''}>
                        {new Date(account.due_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(account.amount)}</TableCell>
                      <TableCell className="text-green-600">{formatCurrency(account.paid_amount)}</TableCell>
                      <TableCell className={`font-medium ${account.balance_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(account.balance_amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(account.status)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button size="sm" variant="outline" onClick={() => handleView(account)} title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {account.status !== 'paid' && account.status !== 'cancelled' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => openPaymentDialog(account)}
                              className="text-green-600 hover:text-green-700"
                              title="Record Payment"
                            >
                              <Receipt className="w-4 h-4" />
                            </Button>
                          )}
                          {account.status !== 'paid' && (
                            <Button size="sm" variant="outline" onClick={() => handleEdit(account)} title="Edit Invoice">
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {account.paid_amount === 0 && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleDelete(account)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} invoices
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Invoice Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) setEditingAccount(null); setIsDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Invoice' : 'Create New Invoice'}</DialogTitle>
            <DialogDescription>
              {editingAccount ? 'Update invoice information.' : 'Create a new customer invoice.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="customer_name">Customer Name *</Label>
                  <Input
                    id="customer_name"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                    placeholder="Customer Name"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customer_email">Customer Email</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
                    placeholder="customer@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="customer_phone">Customer Phone</Label>
                  <Input
                    id="customer_phone"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
                    placeholder="Phone Number"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="amount">Invoice Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="customer_address">Customer Address</Label>
                <Textarea
                  id="customer_address"
                  value={formData.customer_address}
                  onChange={(e) => setFormData({...formData, customer_address: e.target.value})}
                  placeholder="Customer Address"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="due_date">Due Date *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Select value={formData.payment_terms} onValueChange={(value) => setFormData({...formData, payment_terms: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 60">Net 60</SelectItem>
                      <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                      <SelectItem value="COD">Cash on Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Invoice description..."
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingAccount ? 'Update Invoice' : 'Create Invoice'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for invoice #{selectedAccount?.id}
              <br />
              <span className="font-medium">Outstanding Balance: {formatCurrency(selectedAccount?.balance_amount || 0)}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePayment}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="payment_amount">Payment Amount *</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedAccount?.balance_amount}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="payment_date">Payment Date *</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select value={paymentForm.payment_method} onValueChange={(value) => setPaymentForm({...paymentForm, payment_method: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Online Payment">Online Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reference_number">Reference Number</Label>
                <Input
                  id="reference_number"
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({...paymentForm, reference_number: e.target.value})}
                  placeholder="Check number, transaction ID, etc."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="payment_notes">Notes</Label>
                <Textarea
                  id="payment_notes"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                  placeholder="Payment notes..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              Invoice #{selectedAccount?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedAccount && (
            <div className="space-y-6">
              {/* Customer Information */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Customer Information</h3>
                  <div className="space-y-2">
                    <div><strong>Name:</strong> {selectedAccount.customer_name}</div>
                    {selectedAccount.customer_email && (
                      <div><strong>Email:</strong> {selectedAccount.customer_email}</div>
                    )}
                    {selectedAccount.customer_phone && (
                      <div><strong>Phone:</strong> {selectedAccount.customer_phone}</div>
                    )}
                    {selectedAccount.customer_address && (
                      <div><strong>Address:</strong> {selectedAccount.customer_address}</div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Invoice Information</h3>
                  <div className="space-y-2">
                    <div><strong>Due Date:</strong> {new Date(selectedAccount.due_date).toLocaleDateString()}</div>
                    <div><strong>Payment Terms:</strong> {selectedAccount.payment_terms || 'N/A'}</div>
                    <div><strong>Status:</strong> {getStatusBadge(selectedAccount.status)}</div>
                  </div>
                </div>
              </div>

              {/* Amount Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Amount Information</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Invoice Amount</div>
                      <div className="text-lg font-semibold">{formatCurrency(selectedAccount.amount)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Paid Amount</div>
                      <div className="text-lg font-semibold text-green-600">{formatCurrency(selectedAccount.paid_amount)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Balance</div>
                      <div className={`text-lg font-semibold ${selectedAccount.balance_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(selectedAccount.balance_amount)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description and Notes */}
              {(selectedAccount.description || selectedAccount.notes) && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Additional Information</h3>
                  {selectedAccount.description && (
                    <div className="mb-3">
                      <strong>Description:</strong>
                      <p className="mt-1 text-gray-700">{selectedAccount.description}</p>
                    </div>
                  )}
                  {selectedAccount.notes && (
                    <div>
                      <strong>Notes:</strong>
                      <p className="mt-1 text-gray-700">{selectedAccount.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Payment History */}
              {selectedAccount.payments && selectedAccount.payments.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Payment History</h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Reference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedAccount.payments.map((payment, index) => (
                          <TableRow key={index}>
                            <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-green-600 font-medium">{formatCurrency(payment.amount)}</TableCell>
                            <TableCell>{payment.payment_method}</TableCell>
                            <TableCell>{payment.reference_number || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
