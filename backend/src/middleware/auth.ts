import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

// Role-based authorization middleware
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (!allowedRoles.includes(req.user.userType)) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

// Business owner only middleware
export const requireBusinessOwner = requireRole(['business_owner', 'admin']);

// Employee access middleware (can access their own data)
export const requireEmployee = requireRole(['employee', 'business_owner', 'admin']);

// Admin only middleware
export const requireAdmin = requireRole(['admin']);

// Check if user can access business data
export const checkBusinessAccess = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const requestedBusinessId = req.params.businessId || req.body.business_id || req.query.business_id;
    
    // Business owners can access their own business data
    if (req.user.userType === 'business_owner') {
      // For business owners, their userId is their business ID
      if (requestedBusinessId && parseInt(requestedBusinessId) !== req.user.userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied to this business'
        });
        return;
      }
    }
    
    // Employees can only access their own business data
    if (req.user.userType === 'employee') {
      if (requestedBusinessId && req.user.businessId && parseInt(requestedBusinessId) !== req.user.businessId) {
        res.status(403).json({
          success: false,
          message: 'Access denied to this business'
        });
        return;
      }
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Business access check error'
    });
  }
};
