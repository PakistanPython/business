// User and Authentication Types
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  business_name?: string;
  user_type: 'admin' | 'manager' | 'hr' | 'employee' | 'accountant';
  business_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Financial Data Types
export interface Income {
  id: number;
  amount: number;
  description?: string;
  category: string;
  category_id: number;
  source?: string;
  date: string;
  charity_percentage?: number;
  created_at: string;
  updated_at: string;
  category_color?: string;
  category_icon?: string;
}

export interface Expense {
  id: number;
  amount: number;
  description?: string;
  category: string;
  category_id: number;
  payment_method: string;
  date: string;
  receipt_path?: string;
  created_at: string;
  updated_at: string;
  category_color?: string;
  category_icon?: string;
}

export interface Purchase {
  id: number;
  amount: number;
  description?: string;
  category: string;
  category_id: number;
  payment_method: string;
  date: string;
  receipt_path?: string;
  created_at: string;
  updated_at: string;
  category_color?: string;
  category_icon?: string;
}

export interface Sale {
  id: number;
  purchase_id?: number;
  amount: number;
  selling_price: number;
  profit: number;
  profit_percentage: number;
  description?: string;
  customer_name?: string;
  customer_contact?: string;
  payment_method: string;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields from purchase
  purchase_description?: string;
  purchase_category?: string;
  purchase_date?: string;
}

export interface Charity {
  id: number;
  income_id?: number;
  amount_required: number;
  amount_paid: number;
  amount_remaining: number;
  status: 'pending' | 'partial' | 'paid';
  payment_date?: string;
  description?: string;
  recipient?: string;
  created_at: string;
  updated_at: string;
  income_amount?: number;
  income_description?: string;
  income_source?: string;
  income_date?: string;
  income_category?: string;
}

export interface CharityPaymentForm {
  charity_id: number;
  payment_amount: number;
  payment_date: string;
  recipient?: string;
  description?: string;
}

export interface Account {
  id: number;
  account_type: 'cash' | 'bank' | 'savings' | 'investment';
  account_name: string;
  balance: number;
  bank_name?: string;
  account_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: number;
  loan_type: 'personal' | 'business' | 'mortgage' | 'auto' | 'other';
  lender_name: string;
  principal_amount: number;
  current_balance: number;
  interest_rate?: number;
  monthly_payment?: number;
  start_date: string;
  due_date?: string;
  status: 'active' | 'paid' | 'defaulted';
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense' | 'purchase' | 'sale';
  color: string;
  icon: string;
  created_at: string;
  transaction_count?: number;
  total_amount?: number;
}

export interface AccountsReceivable {
  id: number;
  business_id: number;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  balance_amount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  payment_terms?: string;
  description?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  payments?: PaymentRecord[];
}

export interface PaymentRecord {
  id: number;
  business_id: number;
  record_type: 'receivable' | 'payable' | 'loan';
  record_id: number;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  transaction_type: 'income' | 'expense' | 'purchase' | 'sale' | 'transfer' | 'loan_payment' | 'charity';
  reference_id?: number;
  reference_table?: string;
  amount: number;
  description?: string;
  account_id?: number;
  date: string;
  created_at: string;
}

// Dashboard and Analytics Types
export interface DashboardSummary {
  total_income: number;
  total_expenses: number;
  total_purchases: number;
  total_sales_revenue: number;
  total_sales_profit: number;
  total_purchases_count: number;
  total_sales_count: number;
  total_accounts_balance: number;
  total_active_loans: number;
  total_charity_required: number;
  total_charity_paid: number;
  total_charity_remaining: number;
  total_accounts_receivable: number;
  total_ar_outstanding: number;
  total_ar_overdue: number;
  ar_invoices_count: number;
  ar_overdue_count: number;
  net_worth: number;
  available_cash: number;
  total_net_salary: number;
}

export interface MonthlyData {
  month_num: number;
  month_name: string;
  monthly_income: number;
  monthly_expenses: number;
  monthly_charity: number;
  monthly_profit: number;
}

export interface TrendData {
  month: string;
  month_label: string;
  income: number;
  expenses: number;
}

export interface CategoryStats {
  category: string;
  total_amount: number;
  transaction_count: number;
  percentage: number;
}

export interface CharityOverview {
  status: string;
  count: number;
  total_required: number;
  total_paid: number;
  total_remaining: number;
}

export interface AnalyticsData {
  period: string;
  year: number;
  income_analytics: AnalyticsRecord[];
  expense_analytics: AnalyticsRecord[];
  purchase_analytics: AnalyticsRecord[];
  profit_analysis: ProfitAnalysisRecord[];
}

export interface AnalyticsRecord {
  period: string;
  total_amount: number;
  transaction_count: number;
  average_amount: number;
  category: string;
  charity_generated?: number;
}

export interface ProfitAnalysisRecord {
  period: string;
  income: number;
  expenses: number;
  profit: number;
  profit_margin: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  monthly_data: MonthlyData[];
  recent_transactions: Transaction[];
  top_expense_categories: CategoryStats[];
  trend_data: TrendData[];
  charity_overview: CharityOverview[];
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any[];
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: {
    [key: string]: T[] | PaginationInfo;
    pagination: PaginationInfo;
  };
}

// Form Types
export interface LoginForm {
  login: string;
  password: string;
}

export interface RegisterForm {
  username: string;
  email: string;
  password: string;
  full_name: string;
  business_name?: string;
}

export interface IncomeForm {
  amount: number;
  description?: string;
  category_id: number;
  source?: string;
  date: string;
  charity_percentage?: number;
}

export interface ExpenseForm {
  amount: number;
  description?: string;
  category_id: number;
  payment_method: string;
  date: string;
}

export interface PurchaseForm {
  amount: number;
  description?: string;
  category_id: number;
  payment_method: string;
  date: string;
}

export interface SaleForm {
  purchase_id?: number;
  amount: number;
  selling_price: number;
  description?: string;
  customer_name?: string;
  customer_contact?: string;
  payment_method: string;
  date: string;
  status?: 'pending' | 'completed' | 'cancelled';
  notes?: string;
}


export interface AccountForm {
  account_type: 'cash' | 'bank' | 'savings' | 'investment';
  account_name: string;
  balance?: number;
  bank_name?: string;
  account_number?: string;
}

export interface LoanForm {
  loan_type: 'personal' | 'business' | 'mortgage' | 'auto' | 'other';
  lender_name: string;
  principal_amount: number;
  current_balance?: number;
  interest_rate?: number;
  monthly_payment?: number;
  start_date: string;
  due_date?: string;
}

export interface CategoryForm {
  name: string;
  type: 'income' | 'expense' | 'purchase' | 'sale';
  color?: string;
  icon?: string;
}

export interface AccountsReceivableForm {
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  due_date: string;
  amount: number;
  payment_terms?: string;
  description?: string;
  notes?: string;
}

export interface PaymentForm {
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string;
  notes?: string;
}

// Filter and Query Types
export interface BaseQueryParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface FinancialQueryParams extends BaseQueryParams {
  category?: string;
  start_date?: string;
  end_date?: string;
}

export interface CharityQueryParams extends BaseQueryParams {
  status?: 'pending' | 'partial' | 'paid';
  start_date?: string;
  end_date?: string;
}

export interface LoanQueryParams extends BaseQueryParams {
  status?: 'active' | 'paid' | 'defaulted';
  loan_type?: 'personal' | 'business' | 'mortgage' | 'auto' | 'other';
}

export interface AccountsReceivableQueryParams extends BaseQueryParams {
  status?: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'all';
  customer_name?: string;
  date_from?: string;
  date_to?: string;
  overdue_only?: boolean;
}

export interface AccountsReceivableStats {
  total_invoices: number;
  pending_invoices: number;
  partial_invoices: number;
  paid_invoices: number;
  overdue_invoices: number;
  total_amount: number;
  total_receivable: number;
  total_paid: number;
  total_outstanding: number;
  overdue_amount: number;
  pending_amount: number;
  aging: {
    current_0_30: number;
    days_31_60: number;
    days_61_90: number;
    over_90_days: number;
    amount_0_30: number;
    amount_31_60: number;
    amount_61_90: number;
    amount_over_90: number;
  };
}

export interface CustomerStats {
  customer_name: string;
  customer_email?: string;
  total_invoices: number;
  total_invoiced: number;
  total_paid: number;
  outstanding_balance: number;
  overdue_invoices: number;
}

// Employee Management Types
export interface Employee {
  id: number;
  user_id?: number;
  business_id: number;
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
  user_email?: string;
  user_active?: boolean;
  created_by_user_id?: number;
  created_at: string;
  updated_at?: string;
}

export interface EmployeeStats {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  full_time_employees: number;
  part_time_employees: number;
  contract_employees: number;
  departments: Array<{ department: string; count: number }>;
}

export interface EmployeeForm {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  hire_date: string;
  employment_type: string;
  salary_type: string;
  base_salary: number;
  daily_wage?: number;
  hourly_rate?: number;
  department?: string;
  position?: string;
  create_login?: boolean;
}

// Attendance Management Types
export interface Attendance {
  id: number;
  business_id: number;
  employee_id: number;
  date: string;
  clock_in_time?: string;
  clock_out_time?: string;
  total_hours?: number;
  overtime_hours?: number;
  break_hours?: number;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'holiday';
  notes?: string;
  created_at: string;
  updated_at?: string;
  // Joined employee fields
  first_name?: string;
  last_name?: string;
  employee_code?: string;
  department?: string;
}

export interface AttendanceStats {
  total_records: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  total_hours: number;
  total_overtime_hours: number;
  avg_working_hours: number;
  total_active_employees: number;
}

export interface AttendanceForm {
  employee_id: number;
  date: string;
  clock_in_time?: string;
  clock_out_time?: string;
  total_hours?: number;
  overtime_hours?: number;
  break_hours?: number;
  status: string;
  notes?: string;
}

// Payroll Management Types
export interface Payroll {
  id: number;
  business_id: number;
  employee_id: number;
  pay_period_start: string;
  pay_period_end: string;
  basic_salary: number;
  overtime_amount: number;
  bonuses: number;
  reimbursements: number;
  gross_salary: number;
  tax_deduction: number;
  insurance_deduction: number;
  other_deductions: number;
  total_deductions: number;
  deductions: number;
  net_salary: number;
  total_working_days: number;
  total_present_days: number;
  total_overtime_hours: number;
  status: 'draft' | 'approved' | 'paid';
  payment_date?: string;
  pay_method?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  // Joined employee fields
  first_name?: string;
  last_name?: string;
  employee_code?: string;
  department?: string;
  position?: string;
  salary_type?: string;
  base_salary_rate?: number;
}

export interface PayrollStats {
  total_payrolls: number;
  draft_payrolls: number;
  approved_payrolls: number;
  paid_payrolls: number;
  total_gross_salary: number;
  total_net_salary: number;
  total_deductions: number;
  avg_net_salary: number;
}

export interface PayrollForm {
  employee_id: number;
  pay_period_start: string;
  pay_period_end: string;
  basic_salary?: number;
  overtime_amount?: number;
  bonuses?: number;
  reimbursements?: number;
  tax_deduction?: number;
  insurance_deduction?: number;
  other_deductions?: number;
  total_working_days?: number;
  total_present_days?: number;
  total_overtime_hours?: number;
  pay_method?: string;
  notes?: string;
  auto_calculate?: boolean;
}

export interface BulkPayrollForm {
  pay_period_start: string;
  pay_period_end: string;
  employee_ids: number[];
  auto_calculate?: boolean;
}

export interface PaySlip {
  id: number;
  business_id: number;
  payroll_id: number;
  employee_id: number;
  slip_number: string;
  generated_date: string;
  pdf_path?: string;
  created_at: string;
  // Joined payroll and employee data
  payroll?: Payroll;
  employee?: Employee;
}

// Payroll Query Types
export interface PayrollQueryParams extends BaseQueryParams {
  employee_id?: number;
  status?: 'draft' | 'approved' | 'paid' | 'all';
  pay_period_start?: string;
  pay_period_end?: string;
}

export interface AttendanceQueryParams extends BaseQueryParams {
  employee_id?: number;
  status?: 'present' | 'absent' | 'late' | 'half_day' | 'holiday' | 'all';
  date_from?: string;
  date_to?: string;
  month?: string;
  year?: string;
}
