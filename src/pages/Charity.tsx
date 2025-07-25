import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { 
  Heart, 
  TrendingUp, 
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  Search,
  MoreVertical,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { charityApi } from '../lib/api';
import { Charity, CharityPaymentForm } from '../lib/types';
import toast from 'react-hot-toast';
import { useAppStore } from '../lib/store';
import { usePreferences } from '../contexts/PreferencesContext';

export const CharityPage: React.FC = () => {
  const { formatCurrency } = usePreferences();
  const { charityDataNeedsRefresh, resetCharityRefresh } = useAppStore();
  const [charities, setCharities] = useState<Charity[]>([]);
  const [summary, setSummary] = useState({ total_required: 0, total_paid: 0, total_remaining: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingCharity, setEditingCharity] = useState<Charity | null>(null);
  const [viewingCharity, setViewingCharity] = useState<Charity | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [paymentForm, setPaymentForm] = useState<CharityPaymentForm>({
    charity_id: 0,
    payment_amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    recipient: '',
    description: ''
  });

  useEffect(() => {
    loadCharityData();
  }, []);

  useEffect(() => {
    if (charityDataNeedsRefresh) {
      loadCharityData();
      resetCharityRefresh();
    }
  }, [charityDataNeedsRefresh]);

  const loadCharityData = async () => {
    try {
      setIsLoading(true);
      const [charitiesRes, summaryRes] = await Promise.all([
        charityApi.getAll(),
        charityApi.getSummary()
      ]);
      setCharities(charitiesRes.data.data.charity || []);
      setSummary(summaryRes.data.data.summary);
    } catch (error) {
      console.error('Error loading charity data:', error);
      toast.error('Failed to load charity data');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentForm.payment_amount || !paymentForm.payment_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (selectedCharity && paymentForm.payment_amount > Number(selectedCharity.amount_remaining)) {
      toast.error('Payment amount cannot exceed remaining amount');
      return;
    }

    try {
      await charityApi.recordPayment(paymentForm);
      toast.success('Payment recorded successfully');
      setIsPaymentDialogOpen(false);
      setSelectedCharity(null);
      resetPaymentForm();
      loadCharityData();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error.response?.data?.message || 'Failed to record payment');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this charity record?')) {
      return;
    }

    try {
      await charityApi.delete(id);
      toast.success('Charity record deleted successfully');
      loadCharityData();
    } catch (error: any) {
      console.error('Error deleting charity record:', error);
      toast.error(error.response?.data?.message || 'Failed to delete charity record');
    }
  };

  const handleView = async (charity: Charity) => {
    setViewingCharity(charity);
    try {
      const response = await charityApi.getPaymentHistory(charity.id);
      setPaymentHistory(response.data.data.payments || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      toast.error('Failed to fetch payment history');
    }
    setIsViewDialogOpen(true);
  };

  const handleEdit = (charity: Charity) => {
    setEditingCharity(charity);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCharity) return;

    try {
      await charityApi.update(editingCharity.id, editingCharity);
      toast.success('Charity record updated successfully');
      setIsEditDialogOpen(false);
      setEditingCharity(null);
      loadCharityData();
    } catch (error: any) {
      console.error('Error updating charity record:', error);
      toast.error(error.response?.data?.message || 'Failed to update charity record');
    }
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      charity_id: 0,
      payment_amount: 0,
      payment_date: new Date().toISOString().split('T')[0],
      recipient: '',
      description: ''
    });
  };

  const openPaymentDialog = (charity: Charity) => {
    setSelectedCharity(charity);
    setPaymentForm({
      charity_id: charity.id,
      payment_amount: 0,
      payment_date: new Date().toISOString().split('T')[0],
      recipient: charity.recipient || '',
      description: ''
    });
    setIsPaymentDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="w-3 h-3 mr-1" />Partial</Badge>;
      case 'pending':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><AlertCircle className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getProgressPercentage = (charity: Charity) => {
    const required = Number(charity.amount_required);
    const paid = Number(charity.amount_paid);
    return required > 0 ? (paid / required) * 100 : 0;
  };

  const filteredCharities = charities.filter(charity => {
    const matchesSearch = 
      charity.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      charity.recipient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      charity.income_description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || charity.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

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
          <h1 className="text-3xl font-bold text-gray-900">Charity Management</h1>
          <p className="text-gray-600 mt-2">Track your charity obligations and payments</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Total Required</CardTitle>
            <Heart className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{formatCurrency(Number(summary.total_required) || 0)}</div>
            <p className="text-xs text-green-600 mt-1">Total charity obligations</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{formatCurrency(Number(summary.total_paid) || 0)}</div>
            <p className="text-xs text-blue-600 mt-1">Payments made</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Remaining</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-900">{formatCurrency(Number(summary.total_remaining) || 0)}</div>
            <p className="text-xs text-yellow-600 mt-1">Amount still due</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">
              {Number(summary.total_required) > 0 ? ((Number(summary.total_paid) / Number(summary.total_required)) * 100).toFixed(1) : '0.0'}%
            </div>
            <p className="text-xs text-purple-600 mt-1">Payment progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Charity Records</CardTitle>
          <CardDescription>Manage your charity obligations and track payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by description, recipient, or income..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {/* Charity Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Income Source / Description</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCharities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-gray-500">
                      No charity records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCharities.map((charity) => (
                    <TableRow key={charity.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{charity.income_source || charity.recipient || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{charity.income_description || charity.description}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(Number(charity.amount_required))}</TableCell>
                      <TableCell className="text-green-600">{formatCurrency(Number(charity.amount_paid))}</TableCell>
                      <TableCell className="text-red-600">{formatCurrency(Number(charity.amount_remaining))}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress value={getProgressPercentage(charity)} className="w-16" />
                          <span className="text-xs text-gray-500">
                            {getProgressPercentage(charity).toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(charity.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{new Date(charity.income_date || charity.created_at).toLocaleDateString()}</div>
                          {charity.payment_date && (
                            <div className="text-gray-500">Paid: {new Date(charity.payment_date).toLocaleDateString()}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {charity.status !== 'paid' && (
                            <Button
                              size="sm"
                              onClick={() => openPaymentDialog(charity)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <CreditCard className="w-4 h-4 mr-1" />
                              Pay
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(charity)}>
                                <Eye className="mr-2 h-4 w-4" />
                                <span>View</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(charity)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(charity.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Record Charity Payment</DialogTitle>
            <DialogDescription>
              Record a payment for charity obligation
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePayment}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Payment Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(selectedCharity?.amount_remaining) || 0}
                  value={paymentForm.payment_amount}
                  onChange={(e) => setPaymentForm({
                    ...paymentForm,
                    payment_amount: parseFloat(e.target.value) || 0
                  })}
                  placeholder="0.00"
                  required
                />
                {selectedCharity && (
                  <p className="text-sm text-gray-500">
                    Remaining: {formatCurrency(Number(selectedCharity.amount_remaining))}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="payment_date">Payment Date *</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({
                    ...paymentForm,
                    payment_date: e.target.value
                  })}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="recipient">Recipient</Label>
                <Input
                  id="recipient"
                  value={paymentForm.recipient}
                  onChange={(e) => setPaymentForm({
                    ...paymentForm,
                    recipient: e.target.value
                  })}
                  placeholder="Organization or person"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm({
                    ...paymentForm,
                    description: e.target.value
                  })}
                  placeholder="Payment details..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsPaymentDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Charity Record</DialogTitle>
            <DialogDescription>
              Update the details of the charity record
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-recipient">Recipient</Label>
                <Input
                  id="edit-recipient"
                  value={editingCharity?.recipient || ''}
                  onChange={(e) =>
                    setEditingCharity(
                      editingCharity ? { ...editingCharity, recipient: e.target.value } : null
                    )
                  }
                  placeholder="Organization or person"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingCharity?.description || ''}
                  onChange={(e) =>
                    setEditingCharity(
                      editingCharity ? { ...editingCharity, description: e.target.value } : null
                    )
                  }
                  placeholder="Charity details..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Update Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>View Charity Record</DialogTitle>
            <DialogDescription>
              Details of the charity record
            </DialogDescription>
          </DialogHeader>
          {viewingCharity && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="font-semibold">Recipient:</div>
                <div>{viewingCharity.recipient}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="font-semibold">Description:</div>
                <div>{viewingCharity.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="font-semibold">Amount Required:</div>
                <div>{formatCurrency(Number(viewingCharity.amount_required))}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="font-semibold">Amount Paid:</div>
                <div>{formatCurrency(Number(viewingCharity.amount_paid))}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="font-semibold">Amount Remaining:</div>
                <div>{formatCurrency(Number(viewingCharity.amount_remaining))}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="font-semibold">Status:</div>
                <div>{getStatusBadge(viewingCharity.status)}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="font-semibold">Date:</div>
                <div>{new Date(viewingCharity.income_date || viewingCharity.created_at).toLocaleDateString()}</div>
              </div>
              <div className="col-span-2">
                <h3 className="font-semibold mt-4">Payment History</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Recipient</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistory.length > 0 ? (
                      paymentHistory.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                          <TableCell>{formatCurrency(payment.payment_amount)}</TableCell>
                          <TableCell>{payment.recipient}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center">
                          No payment history found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
