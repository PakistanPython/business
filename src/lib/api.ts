import axios from 'axios';

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  loginEmployee: (data: any) => api.post('/auth/employee/login', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
};

export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary'),
  getAnalytics: (params?: any) => api.get('/dashboard/analytics', { params }),
  getMetrics: () => api.get('/dashboard/metrics'),
};

export const incomeApi = {
  getAll: (params?: any) => api.get('/income', { params }),
  getById: (id: number) => api.get(`/income/${id}`),
  create: (data: any) => api.post('/income', data),
  update: (id: number, data: any) => api.put(`/income/${id}`, data),
  delete: (id: number) => api.delete(`/income/${id}`),
  getStats: () => api.get('/income/stats/summary'),
};

export const expenseApi = {
  getAll: (params?: any) => api.get('/expenses', { params }),
  getById: (id: number) => api.get(`/expenses/${id}`),
  create: (data: any) => api.post('/expenses', data),
  update: (id: number, data: any) => api.put(`/expenses/${id}`, data),
  delete: (id: number) => api.delete(`/expenses/${id}`),
  getStats: () => api.get('/expenses/stats/summary'),
};

export const purchaseApi = {
  getAll: (params?: any) => api.get('/purchases', { params }),
  getById: (id: number) => api.get(`/purchases/${id}`),
  create: (data: any) => api.post('/purchases', data),
  update: (id: number, data: any) => api.put(`/purchases/${id}`, data),
  delete: (id: number) => api.delete(`/purchases/${id}`),
  getStats: () => api.get('/purchases/stats/summary'),
};

export const saleApi = {
  getAll: (params?: any) => api.get('/sales', { params }),
  getById: (id: number) => api.get(`/sales/${id}`),
  create: (data: any) => api.post('/sales', data),
  update: (id: number, data: any) => api.put(`/sales/${id}`, data),
  delete: (id: number) => api.delete(`/sales/${id}`),
  getSummary: () => api.get('/sales/summary'),
  getAvailablePurchases: () => api.get('/sales/available/purchases'),
};

export const charityApi = {
  getAll: (params?: any) => api.get('/charity', { params }),
  getById: (id: number) => api.get(`/charity/${id}`),
  create: (data: any) => api.post('/charity', data),
  update: (id: number, data: any) => api.put(`/charity/${id}`, data),
  delete: (id: number) => api.delete(`/charity/${id}`),
  recordPayment: (data: any) => api.post('/charity/payment', data),
  getStats: () => api.get('/charity/stats/summary'),
};

export const accountApi = {
  getAll: () => api.get('/accounts'),
  getById: (id: number) => api.get(`/accounts/${id}`),
  create: (data: any) => api.post('/accounts', data),
  update: (id: number, data: any) => api.put(`/accounts/${id}`, data),
  delete: (id: number) => api.delete(`/accounts/${id}`),
  transfer: (data: any) => api.post('/accounts/transfer', data),
  getStats: () => api.get('/accounts/stats'),
};

export const loanApi = {
  getAll: (params?: any) => api.get('/loans', { params }),
  getById: (id: number) => api.get(`/loans/${id}`),
  create: (data: any) => api.post('/loans', data),
  update: (id: number, data: any) => api.put(`/loans/${id}`, data),
  delete: (id: number) => api.delete(`/loans/${id}`),
  recordPayment: (id: number, data: any) => api.post(`/loans/${id}/payment`, data),
  getStats: () => api.get('/loans/stats/summary'),
};

export const employeeApi = {
  getAll: (params?: any) => api.get('/employees', { params }),
  getById: (id: number) => api.get(`/employees/${id}`),
  create: (data: any) => api.post('/employees', data),
  update: (id: number, data: any) => api.put(`/employees/${id}`, data),
  delete: (id: number) => api.delete(`/employees/${id}`),
  getStats: () => api.get('/employees/stats'),
  getProfile: () => api.get('/employees/profile'),
};

export const attendanceApi = {
  getAll: (params?: any) => api.get('/attendance', { params }),
  getToday: (params?: any) => api.get('/attendance/today', { params }),
  create: (data: any) => api.post('/attendance', data),
  update: (id: number, data: any) => api.put(`/attendance/${id}`, data),
  delete: (id: number) => api.delete(`/attendance/${id}`),
  clockIn: (data: any) => api.post('/attendance/clock-in', data),
  clockOut: (data: any) => api.post('/attendance/clock-out', data),
  getStats: (params?: any) => api.get('/attendance/stats', { params }),
  getMonthlySummary: (params?: any) => api.get('/attendance/stats/monthly', { params }),
  getSummary: (params?: any) => api.get('/attendance/stats/summary', { params }),
};

export const payrollApi = {
  getAll: (params?: any) => api.get('/payroll', { params }),
  getById: (id: number) => api.get(`/payroll/${id}`),
  create: (data: any) => api.post('/payroll', data),
  update: (id: number, data: any) => api.put(`/payroll/${id}`, data),
  delete: (id: number) => api.delete(`/payroll/${id}`),
  getStats: (params?: any) => api.get('/payroll/stats', { params }),
};

export const workScheduleApi = {
  getAll: (params?: any) => api.get('/work-schedules', { params }),
  getById: (id: number) => api.get(`/work-schedules/${id}`),
  create: (data: any) => api.post('/work-schedules', data),
  update: (id: number, data: any) => api.put(`/work-schedules/${id}`, data),
  delete: (id: number) => api.delete(`/work-schedules/${id}`),
  getStats: (params?: any) => api.get('/work-schedules/stats', { params }),
};

export const leaveApi = {
  // Leave Types
  getLeaveTypes: () => api.get('/leaves/types'),
  createLeaveType: (data: any) => api.post('/leaves/types', data),
  updateLeaveType: (id: number, data: any) => api.put(`/leaves/types/${id}`, data),
  deleteLeaveType: (id: number) => api.delete(`/leaves/types/${id}`),
  
  // Leave Requests
  getLeaveRequests: (params?: any) => api.get('/leaves/requests', { params }),
  getLeaveRequestById: (id: number) => api.get(`/leaves/requests/${id}`),
  createLeaveRequest: (data: any) => api.post('/leaves/requests', data),
  updateLeaveRequest: (id: number, data: any) => api.put(`/leaves/requests/${id}`, data),
  deleteLeaveRequest: (id: number) => api.delete(`/leaves/requests/${id}`),
  approveLeaveRequest: (id: number, data: any) => api.put(`/leaves/requests/${id}/approve`, data),
  rejectLeaveRequest: (id: number, data: any) => api.put(`/leaves/requests/${id}/reject`, data),
  
  // Leave Entitlements
  getLeaveEntitlements: (params?: any) => api.get('/leaves/entitlements', { params }),
  createLeaveEntitlement: (data: any) => api.post('/leaves/entitlements', data),
  updateLeaveEntitlement: (id: number, data: any) => api.put(`/leaves/entitlements/${id}`, data),
  deleteLeaveEntitlement: (id: number) => api.delete(`/leaves/entitlements/${id}`),
  
  // Leave Statistics
  getLeaveStats: (params?: any) => api.get('/leaves/stats', { params }),
};

export const attendanceRuleApi = {
  getAll: () => api.get('/attendance-rules'),
  getActive: () => api.get('/attendance-rules/active'),
  getById: (id: number) => api.get(`/attendance-rules/${id}`),
  create: (data: any) => api.post('/attendance-rules', data),
  update: (id: number, data: any) => api.put(`/attendance-rules/${id}`, data),
  delete: (id: number) => api.delete(`/attendance-rules/${id}`),
  setActive: (id: number) => api.put(`/attendance-rules/${id}/activate`),
};

export const categoryApi = {
  getAll: (params?: any) => api.get('/categories', { params }),
  getById: (id: number) => api.get(`/categories/${id}`),
  create: (data: any) => api.post('/categories', data),
  update: (id: number, data: any) => api.put(`/categories/${id}`, data),
  delete: (id: number) => api.delete(`/categories/${id}`),
  getStats: (id: number) => api.get(`/categories/${id}/stats`),
  getUsageSummary: () => api.get('/categories/usage/summary'),
};

export const accountsReceivableApi = {
  getAll: (params?: any) => api.get('/accounts-receivable', { params }),
  getById: (id: number) => api.get(`/accounts-receivable/${id}`),
  create: (data: any) => api.post('/accounts-receivable', data),
  update: (id: number, data: any) => api.put(`/accounts-receivable/${id}`, data),
  delete: (id: number) => api.delete(`/accounts-receivable/${id}`),
  recordPayment: (id: number, data: any) => api.post(`/accounts-receivable/${id}/payment`, data),
  updateStatus: (id: number, data: any) => api.put(`/accounts-receivable/${id}/status`, data),
  getStats: () => api.get('/accounts-receivable/stats/summary'),
  getCustomerStats: () => api.get('/accounts-receivable/stats/customers'),
};

export const accountsPayableApi = {
  getAll: (params?: any) => api.get('/accounts-payable', { params }),
  getById: (id: number) => api.get(`/accounts-payable/${id}`),
  create: (data: any) => api.post('/accounts-payable', data),
  update: (id: number, data: any) => api.put(`/accounts-payable/${id}`, data),
  delete: (id: number) => api.delete(`/accounts-payable/${id}`),
  recordPayment: (id: number, data: any) => api.post(`/accounts-payable/${id}/payment`, data),
  updateStatus: (id: number, data: any) => api.put(`/accounts-payable/${id}/status`, data),
  getStats: () => api.get('/accounts-payable/stats/summary'),
  getVendorStats: () => api.get('/accounts-payable/stats/vendors'),
};
