import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { AttendanceProvider } from './contexts/AttendanceContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import UserRedirectRoute from './components/UserRedirectRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainLayout } from './components/Layout/MainLayout';
import { LoginForm } from './components/Auth/LoginForm';
import { RegisterForm } from './components/Auth/RegisterForm';

// Import pages
import { Dashboard } from './pages/Dashboard';
import { IncomePage } from './pages/Income';
import { ExpensesPage } from './pages/Expenses';
import { PurchasesPage } from './pages/Purchases';
import { SalesPage } from './pages/Sales';
import { CharityPage } from './pages/Charity';
import { AccountsPage } from './pages/Accounts';
import { LoansPage } from './pages/Loans';
import { AnalyticsPage } from './pages/Analytics';
import { CategoriesPage } from './pages/Categories';
import { ProfilePage } from './pages/Profile';
import { EmployeesPage } from './pages/Employees';
import { PayrollPage } from './pages/Payroll';
import { AttendancePage } from './pages/Attendance';
import { AccountsReceivablePage } from './pages/AccountsReceivable';
import EmployeePortal from './pages/EmployeePortal';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PreferencesProvider>
          <AttendanceProvider>
            <Router>
              <div className="App">
                <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginForm />} />
              <Route path="/register" element={<RegisterForm />} />
              
              {/* Employee Portal route */}
              <Route path="/employee-portal" element={
                <ProtectedRoute>
                  <UserRedirectRoute>
                    <EmployeePortal />
                  </UserRedirectRoute>
                </ProtectedRoute>
              } />
              
              {/* Protected business owner routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <UserRedirectRoute>
                    <MainLayout />
                  </UserRedirectRoute>
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="income" element={<IncomePage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="purchases" element={<PurchasesPage />} />
                <Route path="sales" element={<SalesPage />} />
                <Route path="charity" element={<CharityPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="accounts-receivable" element={<AccountsReceivablePage />} />
                <Route path="loans" element={<LoansPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="payroll" element={<PayrollPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>

              {/* Catch all route - only redirect non-employee paths */}
              <Route path="*" element={
                <ProtectedRoute>
                  <UserRedirectRoute>
                    <Navigate to="/dashboard" replace />
                  </UserRedirectRoute>
                </ProtectedRoute>
              } />
                </Routes>
                
                {/* Toast notifications */}
                <Toaster />
              </div>
            </Router>
          </AttendanceProvider>
        </PreferencesProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
