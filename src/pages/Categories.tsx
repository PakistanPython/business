import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import * as icons from 'lucide-react';
import { 
  Plus, 
  Tag, 
  TrendingUp, 
  TrendingDown, 
  Search,
  Edit,
  Trash2,
  Palette,
  Hash,
  BarChart3,
  DollarSign,
  Activity,
  Target,
  ShoppingBag
} from 'lucide-react';
import { categoryApi } from '../lib/api';
import { usePreferences } from '../contexts/PreferencesContext';
import { Category, CategoryForm } from '../lib/types';
import toast from 'react-hot-toast';

export const CategoriesPage: React.FC = () => {
  const { formatCurrency } = usePreferences();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [formData, setFormData] = useState<CategoryForm>({
    name: '',
    type: 'expense',
    color: '#3B82F6',
    icon: 'Tag'
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const response = await categoryApi.getUsageSummary();
      setCategories(response.data.data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingCategory) {
        await categoryApi.update(editingCategory.id, formData);
        toast.success('Category updated successfully');
      } else {
        await categoryApi.create(formData);
        toast.success('Category created successfully');
      }
      
      setIsDialogOpen(false);
      setEditingCategory(null);
      resetForm();
      loadCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      toast.error(error.response?.data?.message || 'Failed to save category');
    }
  };

  const handleEdit = async (category: Category) => {
    try {
      const response = await categoryApi.getById(category.id);
      const fullCategory = response.data.data.category;
      setEditingCategory(fullCategory);
      setFormData({
        name: fullCategory.name,
        type: fullCategory.type,
        color: fullCategory.color || '#3B82F6',
        icon: fullCategory.icon || 'Tag'
      });
      setIsDialogOpen(true);
    } catch (error) {
      console.error('Error fetching category details:', error);
      toast.error('Failed to fetch category details');
    }
  };

  const handleDelete = async (category: Category) => {
    if (window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      try {
        await categoryApi.delete(category.id);
        toast.success('Category deleted successfully');
        loadCategories();
      } catch (error: any) {
        console.error('Error deleting category:', error);
        toast.error(error.response?.data?.message || 'Failed to delete category');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'expense',
      color: '#3B82F6',
      icon: 'Tag'
    });
  };

  const openAddDialog = () => {
    setEditingCategory(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const toPascalCase = (str: string) => {
    return str.replace(/(^\w|-\w)/g, (g) => g.replace(/-/, "").toUpperCase());
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = (icons as any)[toPascalCase(iconName)] || Tag;
    return <IconComponent className="w-4 h-4" />;
  };

  const getTypeBadge = (type: string) => {
    if (type === 'income') {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <TrendingUp className="w-3 h-3 mr-1" />
          Income
        </Badge>
      );
    } else if (type === 'expense') {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <TrendingDown className="w-3 h-3 mr-1" />
          Expense
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
          <ShoppingBag className="w-3 h-3 mr-1" />
          Purchase
        </Badge>
      );
    }
  };

  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || category.type === filterType;
    return matchesSearch && matchesType;
  });

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const purchaseCategories = categories.filter(c => c.type === 'purchase');
  const totalTransactions = categories.reduce((sum, c) => sum + (c.transaction_count || 0), 0);
  const totalAmount = categories.reduce((sum, c) => sum + (c.total_amount || 0), 0);

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
          <h1 className="text-3xl font-bold text-gray-900">Category Management</h1>
          <p className="text-gray-600 mt-2">Organize your income and expense categories</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Categories</CardTitle>
            <Tag className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{categories.length}</div>
            <p className="text-xs text-blue-600 mt-1">Active categories</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Income Categories</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{incomeCategories.length}</div>
            <p className="text-xs text-green-600 mt-1">Revenue sources</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Expense Categories</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900">{expenseCategories.length}</div>
            <p className="text-xs text-red-600 mt-1">Spending areas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Purchase Categories</CardTitle>
            <ShoppingBag className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{purchaseCategories.length}</div>
            <p className="text-xs text-purple-600 mt-1">Purchase areas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-800">Total Transactions</CardTitle>
            <Activity className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-900">{totalTransactions}</div>
            <p className="text-xs text-indigo-600 mt-1">Across all categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Usage Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Top Income Categories
            </CardTitle>
            <CardDescription>Most used income categories by transaction count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {incomeCategories
                .sort((a, b) => (b.transaction_count || 0) - (a.transaction_count || 0))
                .slice(0, 5)
                .map((category) => (
                  <div key={category.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: category.color }}
                      >
                        {getIconComponent(category.icon)}
                      </div>
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{category.transaction_count || 0} transactions</div>
                      <div className="text-sm text-gray-500">{formatCurrency(category.total_amount || 0)}</div>
                    </div>
                  </div>
                ))}
              {incomeCategories.length === 0 && (
                <div className="text-center text-gray-500 py-4">No income categories found</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Top Expense Categories
            </CardTitle>
            <CardDescription>Most used expense categories by transaction count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expenseCategories
                .sort((a, b) => (b.transaction_count || 0) - (a.transaction_count || 0))
                .slice(0, 5)
                .map((category) => (
                  <div key={category.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: category.color }}
                      >
                        {getIconComponent(category.icon)}
                      </div>
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{category.transaction_count || 0} transactions</div>
                      <div className="text-sm text-gray-500">{formatCurrency(category.total_amount || 0)}</div>
                    </div>
                  </div>
                ))}
              {expenseCategories.length === 0 && (
                <div className="text-center text-gray-500 py-4">No expense categories found</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Top Purchase Categories
            </CardTitle>
            <CardDescription>Most used purchase categories by transaction count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {purchaseCategories
                .sort((a, b) => (b.transaction_count || 0) - (a.transaction_count || 0))
                .slice(0, 5)
                .map((category) => (
                  <div key={category.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: category.color }}
                      >
                        {getIconComponent(category.icon)}
                      </div>
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{category.transaction_count || 0} transactions</div>
                      <div className="text-sm text-gray-500">{formatCurrency(category.total_amount || 0)}</div>
                    </div>
                  </div>
                ))}
              {purchaseCategories.length === 0 && (
                <div className="text-center text-gray-500 py-4">No purchase categories found</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>Manage your income and expense categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="purchase">Purchase</option>
            </select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-gray-500">
                      No categories found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCategories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                            style={{ backgroundColor: category.color }}
                          >
                            {getIconComponent(category.icon)}
                          </div>
                          <span className="font-medium">{category.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(category.type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Hash className="w-4 h-4 mr-1 text-gray-400" />
                          {category.transaction_count || 0}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(category.total_amount || 0)}
                      </TableCell>
                      <TableCell>{new Date(category.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(category)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleDelete(category)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      {/* Category Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Update category information' : 'Create a new category for organizing transactions'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Category Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Groceries, Salary, Rent"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="type">Category Type *</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: any) => setFormData({...formData, type: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="purchase">Purchase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="color">Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="color"
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="p-1 h-10 w-14"
                    />
                    <Input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="#FFFFFF"
                      className="max-w-[100px]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="icon">
                  Icon Name (from{' '}
                  <a
                    href="https://lucide.dev/icons/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    lucide.dev
                  </a>
                  )
                </Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="e.g., Home, Car, ShoppingBag"
                />
              </div>

              {/* Preview */}
              <div className="grid gap-2">
                <Label>Preview</Label>
                <div className="flex items-center space-x-3 p-3 border rounded-md bg-gray-50">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: formData.color }}
                  >
                    {getIconComponent(formData.icon)}
                  </div>
                  <span className="font-medium">{formData.name || 'Category Name'}</span>
                  {getTypeBadge(formData.type)}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingCategory ? 'Update' : 'Create'} Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
