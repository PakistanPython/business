import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  Heart,
  DollarSign,
  Users,
  Activity,
  BarChart3,
  ShoppingCart,
  ShoppingBag,
  Package,
  Target,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle,
  Timer,
  Landmark
} from 'lucide-react';
import { dashboardApi } from '../lib/api';
import { DashboardData, AnalyticsData, DashboardSummary } from '../lib/types';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePreferences } from '../contexts/PreferencesContext';

export const Dashboard: React.FC = () => {
  const { formatCurrency } = usePreferences();
  const [dashboardOverviewData, setDashboardOverviewData] = useState<DashboardData | null>(null);
  const [analyticsPageData, setAnalyticsPageData] = useState<AnalyticsData | null>(null);
  const [payrollStats, setPayrollStats] = useState<any>(null);
  const [attendanceStats, setAttendanceStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [overviewResponse, analyticsResponse, payrollResponse, attendanceResponse] = await Promise.all([
        dashboardApi.getSummary(),
        dashboardApi.getAnalytics(),
        fetch('/api/payroll/stats/summary').then(res => res.ok ? res.json() : null).catch(() => null),
        fetch('/api/attendance/stats/summary').then(res => res.ok ? res.json() : null).catch(() => null)
      ]);
      
      setDashboardOverviewData(overviewResponse.data.data);
      setAnalyticsPageData(analyticsResponse.data.data);
      setPayrollStats(payrollResponse);
      setAttendanceStats(attendanceResponse);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={loadDashboardData}>Try Again</Button>
      </div>
    );
  }

  const summary = dashboardOverviewData?.summary;

  const statsCards = [
    {
      title: 'Total Income',
      value: formatCurrency(summary?.total_income || 0),
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      change: '+12.5%', // These changes are hardcoded, ideally they would come from backend
      changeType: 'positive' as const,
      href: '/income'
    },
    {
      title: 'Total Expenses',
      value: formatCurrency(summary?.total_expenses || 0),
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      change: '+4.3%',
      changeType: 'negative' as const,
      href: '/expenses'
    },
    {
      title: 'Account Balance',
      value: formatCurrency(summary?.total_accounts_balance || 0),
      icon: Wallet,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      change: '+8.2%',
      changeType: 'positive' as const,
      href: '/accounts'
    },
    {
      title: 'Active Loans',
      value: formatCurrency(summary?.total_active_loans || 0),
      icon: CreditCard,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      change: '-2.1%',
      changeType: 'positive' as const,
      href: '/loans'
    },
    {
      title: 'Total Charity Remaining',
      value: formatCurrency(summary?.total_charity_remaining || 0),
      icon: Heart,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      change: '+5.4%',
      changeType: 'neutral' as const,
      href: '/charity'
    },
    {
      title: 'Total Purchases',
      value: formatCurrency(summary?.total_purchases || 0),
      icon: Package,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      change: `${summary?.total_purchases_count || 0} items`,
      changeType: 'neutral' as const,
      href: '/purchases'
    },
    {
      title: 'Sales Revenue',
      value: formatCurrency(summary?.total_sales_revenue || 0),
      icon: ShoppingBag,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      change: `${summary?.total_sales_count || 0} sales`,
      changeType: 'positive' as const,
      href: '/sales'
    },
    {
      title: 'Sales Profit',
      value: formatCurrency(summary?.total_sales_profit || 0),
      icon: Target,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      change: summary?.total_sales_revenue > 0 ? 
        `${((summary?.total_sales_profit / summary?.total_sales_revenue) * 100).toFixed(1)}% margin` : 
        '0% margin',
      changeType: 'positive' as const,
      href: '/sales'
    },
    {
      title: 'A/R Outstanding',
      value: formatCurrency(summary?.total_ar_outstanding || 0),
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      change: `${summary?.ar_invoices_count || 0} invoices`,
      changeType: 'neutral' as const,
      href: '/accounts-receivable'
    },
    {
      title: 'A/R Overdue',
      value: formatCurrency(summary?.total_ar_overdue || 0),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      change: `${summary?.ar_overdue_count || 0} overdue`,
      changeType: 'negative' as const,
      href: '/accounts-receivable'
    },
    {
      title: 'Total Loan Payable',
      value: formatCurrency(summary?.total_active_loans || 0),
      icon: Landmark,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      change: '',
      changeType: 'neutral' as const,
      href: '/loans'
    },
    {
      title: 'Total Net Salary',
      value: formatCurrency(summary?.total_net_salary || 0),
      icon: DollarSign,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100',
      change: 'From Payroll',
      changeType: 'neutral' as const,
      href: '/payroll'
    },
  ];

  // Payroll and HR stats cards
  const payrollCards = [
    {
      title: 'Pending Payroll',
      value: `${(payrollStats?.draft_payrolls || 0) + (payrollStats?.approved_payrolls || 0)}`,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      change: `${payrollStats?.total_payrolls || 0} total records`,
      changeType: 'neutral' as const,
      href: '/payroll'
    },
    {
      title: 'Monthly Payroll',
      value: formatCurrency(payrollStats?.total_net_salary || 0),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      change: `${payrollStats?.paid_payrolls || 0} paid this month`,
      changeType: 'positive' as const,
      href: '/payroll'
    },
    {
      title: 'Today Attendance',
      value: `${attendanceStats?.present_days || 0}`,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      change: `${attendanceStats?.total_records || 0} total records`,
      changeType: 'positive' as const,
      href: '/attendance'
    },
    {
      title: 'Overtime Hours',
      value: `${Math.round(attendanceStats?.overtime_hours || 0)}h`,
      icon: Timer,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      change: `${Math.round(attendanceStats?.total_hours || 0)}h total`,
      changeType: 'neutral' as const,
      href: '/attendance'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's your financial overview.</p>
        </div>
        <div className="flex space-x-3">
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
              <Link to={stat.href}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <div className={`p-2 rounded-md ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className={`text-xs ${
                    stat.changeType === 'positive' 
                      ? 'text-green-600' 
                      : stat.changeType === 'negative' 
                        ? 'text-red-600' 
                        : 'text-gray-600'
                  }`}>
                    {stat.change} from last month
                  </p>
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>

      {/* HR & Payroll Section */}
      {(payrollStats || attendanceStats) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">HR & Payroll</h2>
              <p className="text-gray-600">Employee management and payroll overview</p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" asChild>
                <Link to="/employees">Manage Employees</Link>
              </Button>
              <Button asChild>
                <Link to="/payroll">View Payroll</Link>
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {payrollCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={`payroll-${index}`} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <Link to={stat.href}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                      <div className={`p-2 rounded-md ${stat.bgColor}`}>
                        <Icon className={`h-4 w-4 ${stat.color}`} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <p className={`text-xs ${
                        stat.changeType === 'positive' 
                          ? 'text-green-600' 
                          : 'text-gray-600'
                      }`}>
                        {stat.change}
                      </p>
                    </CardContent>
                  </Link>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Monthly Trends
            </CardTitle>
            <CardDescription>
              Income vs Expenses over the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardOverviewData?.trend_data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month_label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="income" fill="#82ca9d" />
                <Bar dataKey="expenses" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="mr-2 h-5 w-5" />
              Recent Transactions
            </CardTitle>
            <CardDescription>
              Your latest financial activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardOverviewData?.recent_transactions?.slice(0, 5).map((transaction, index) => (
                <div key={`${transaction.id}-${index}-${transaction.transaction_type}`} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      transaction.transaction_type === 'income' 
                        ? 'bg-green-100 text-green-600' 
                        : transaction.transaction_type === 'expense'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-blue-100 text-blue-600'
                    }`}>
                      {transaction.transaction_type === 'income' ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : transaction.transaction_type === 'expense' ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <Activity className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {transaction.description || `${transaction.transaction_type} Transaction`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transaction.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${
                    transaction.transaction_type === 'income' 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {transaction.transaction_type === 'income' ? '+' : '-'}
                    {formatCurrency(Math.abs(transaction.amount))}
                  </div>
                </div>
              )) || (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No recent transactions</p>
                  <p className="text-sm text-gray-400">Start by adding some income or expenses</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks you might want to perform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Button variant="outline" className="h-20 flex flex-col" asChild>
              <Link to="/income">
                <TrendingUp className="h-6 w-6 mb-2" />
                Add Income
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col" asChild>
              <Link to="/expenses">
                <TrendingDown className="h-6 w-6 mb-2" />
                Add Expense
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col" asChild>
              <Link to="/accounts">
                <Wallet className="h-6 w-6 mb-2" />
                Manage Accounts
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col" asChild>
              <Link to="/accounts-receivable">
                <FileText className="h-6 w-6 mb-2" />
                Receivables
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col" asChild>
              <Link to="/employees">
                <Users className="h-6 w-6 mb-2" />
                Employees
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col" asChild>
              <Link to="/attendance">
                <Clock className="h-6 w-6 mb-2" />
                Attendance
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col" asChild>
              <Link to="/analytics">
                <BarChart3 className="h-6 w-6 mb-2" />
                View Reports
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
