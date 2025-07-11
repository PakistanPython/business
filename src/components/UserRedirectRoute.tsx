import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface UserRedirectRouteProps {
  children: React.ReactNode;
}

const UserRedirectRoute: React.FC<UserRedirectRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while authentication is being verified
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Handle redirection based on user type
  if (user.user_type === 'employee') {
    // If an employee is trying to access any page other than the employee portal, redirect them
    if (location.pathname !== '/employee-portal') {
      return <Navigate to="/employee-portal" replace />;
    }
  } else {
    // If a non-employee is trying to access the employee portal, redirect them to the dashboard
    if (location.pathname === '/employee-portal') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // If no redirection is needed, render the children
  return <>{children}</>;
};

export default UserRedirectRoute;
