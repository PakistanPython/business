import express from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { dbGet, dbRun } from '../config/database';
import { generateToken } from '../utils/jwt';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts from this IP, please try again after 15 minutes'
});

// Register new user
router.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('business_name').isLength({ min: 1 }).withMessage('Business name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, email, password, business_name } = req.body;

    // Check if user already exists
    const existingUser = await dbGet(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userResult = await dbRun(
      'INSERT INTO users (username, email, password_hash, user_type) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, email, passwordHash, 'admin']
    );

    const userId = userResult.lastID;

    // Create business
    const businessResult = await dbRun(
      'INSERT INTO businesses (name, owner_id) VALUES ($1, $2) RETURNING id',
      [business_name, userId]
    );
    
    const businessId = businessResult.lastID;

    // Update user with business_id
    await dbRun(
      'UPDATE users SET business_id = $1 WHERE id = $2',
      [businessId, userId]
    );



    // Create default cash account
    await dbRun(
      'INSERT INTO accounts (business_id, account_type, account_name, balance) VALUES ($1, $2, $3, $4) RETURNING id',
      [businessId, 'cash', 'Cash', 0]
    );

    // Get user data
    const user = await dbGet(
      'SELECT u.id, u.username, u.email, u.user_type, u.business_id, b.name as business_name FROM users u JOIN businesses b ON u.business_id = b.id WHERE u.id = $1',
      [userId]
    );

    // Generate JWT token
    const token = generateToken(user.id, user.username, user.email, user.user_type, user.business_id, user.business_name);

    res.status(201).json({
      success: true,
      data: {
        user,
        token
      },
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Login user
router.post('/login', loginLimiter, [
  body('login').notEmpty().withMessage('Username or email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { login, password } = req.body;

    // Find user by username or email
    const user = await dbGet(
      'SELECT u.*, b.name as business_name FROM users u LEFT JOIN businesses b ON u.business_id = b.id WHERE (u.username = $1 OR u.email = $2) AND u.is_active = TRUE',
      [login, login]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login time
    await dbRun('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Generate JWT token
    const token = generateToken(user.id, user.username, user.email, user.user_type || 'admin', user.business_id, user.business_name);

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user profile (protected route)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const user = await dbGet(
      'SELECT u.id, u.username, u.email, u.user_type, u.business_id, b.name as business_name FROM users u LEFT JOIN businesses b ON u.business_id = b.id WHERE u.id = $1',
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user profile (protected route)
router.put('/profile', [
  authenticateToken,
  body('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('full_name').optional().isLength({ min: 1 }).withMessage('Full name is required'),
  body('business_name').optional().isLength({ min: 1 }).withMessage('Business name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user!.userId;
    const businessId = req.user!.businessId;
    const { username, email, full_name, business_name } = req.body;

    // Check if username or email is already taken by another user
    if (username) {
      const existingUser = await dbGet(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, userId]
      );
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username already taken' });
      }
    }
    if (email) {
      const existingUser = await dbGet(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already taken' });
      }
    }

    // Update user
    const updates: string[] = [];
    const values: any[] = [];
    let placeholderIndex = 1;

    if (username) {
      updates.push(`username = $${placeholderIndex++}`);
      values.push(username);
    }
    if (email) {
      updates.push(`email = $${placeholderIndex++}`);
      values.push(email);
    }
    if (full_name) {
      updates.push(`full_name = $${placeholderIndex++}`);
      values.push(full_name);
    }

    if (business_name) {
      await dbRun('UPDATE businesses SET name = $1 WHERE id = $2', [business_name, businessId]);
    }

    if (updates.length === 0 && !business_name) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    await dbRun(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${placeholderIndex}`,
      values
    );

    // Get updated user
    const user = await dbGet(
      'SELECT id, username, email, user_type, business_id, created_at, full_name FROM users WHERE id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: {
        user
      },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Change password
router.post('/change-password', [
  authenticateToken,
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user!.userId;
    const { current_password, new_password } = req.body;

    // Get user from database
    const user = await dbGet('SELECT * FROM users WHERE id = $1', [userId]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check current password
    const isPasswordValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid current password' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 12);

    // Update password
    await dbRun('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newPasswordHash, userId]);

    res.json({ success: true, message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Delete account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const businessId = req.user!.businessId;

    // It's a good practice to archive or soft-delete data first.
    // For this example, we'll perform a hard delete.
    
    // Use a transaction to ensure all or nothing is deleted
    await dbRun('BEGIN');

    // Delete all related data
    await dbRun('DELETE FROM charity_payments WHERE charity_id IN (SELECT id FROM charity WHERE business_id = $1)', [businessId]);
    await dbRun('DELETE FROM charity WHERE business_id = $1', [businessId]);
    await dbRun('DELETE FROM sales WHERE business_id = $1', [businessId]);
    await dbRun('DELETE FROM purchases WHERE business_id = $1', [businessId]);
    await dbRun('DELETE FROM expenses WHERE business_id = $1', [businessId]);
    await dbRun('DELETE FROM income WHERE business_id = $1', [businessId]);
    await dbRun('DELETE FROM loan_payments WHERE loan_id IN (SELECT id FROM loans WHERE business_id = $1)', [businessId]);
    await dbRun('DELETE FROM loans WHERE business_id = $1', [businessId]);
    await dbRun('DELETE FROM payroll WHERE employee_id IN (SELECT id FROM employees WHERE business_id = $1)', [businessId]);
    await dbRun('DELETE FROM attendance WHERE employee_id IN (SELECT id FROM employees WHERE business_id = $1)', [businessId]);
    await dbRun('DELETE FROM employees WHERE business_id = $1', [businessId]);
    await dbRun('DELETE FROM accounts_receivable WHERE business_id = $1', [businessId]);
    await dbRun('DELETE FROM accounts_payable WHERE business_id = $1', [businessId]);
    await dbRun('DELETE FROM accounts WHERE business_id = $1', [businessId]);
    await dbRun('DELETE FROM user_preferences WHERE user_id = $1', [userId]);
    await dbRun('DELETE FROM businesses WHERE id = $1', [businessId]);
    await dbRun('DELETE FROM users WHERE id = $1', [userId]);

    await dbRun('COMMIT');

    res.json({ success: true, message: 'Account deleted successfully' });

  } catch (error) {
    await dbRun('ROLLBACK');
    console.error('Account deletion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Employee Login
router.post('/employee/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find employee by email
    const employee = await dbGet(
      'SELECT * FROM employees WHERE email = $1 AND status = \'active\'',
      [email]
    );

    if (!employee) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or employee not active'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, employee.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = generateToken(employee.id, employee.email, employee.email, 'employee', employee.business_id);

    // Remove password from response
    const { password_hash, ...employeeWithoutPassword } = employee;

    res.json({
      success: true,
      data: {
        user: { ...employeeWithoutPassword, user_type: 'employee' },
        token
      },
      message: 'Employee login successful'
    });
  } catch (error) {
    console.error('Employee login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get employee profile (protected route)
router.get('/employee/profile', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user!.userId;

    const employee = await dbGet(
      'SELECT * FROM employees WHERE id = $1',
      [employeeId]
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    // Remove password from response
    const { password_hash, ...employeeWithoutPassword } = employee;

    res.json({
      success: true,
      data: {
        user: { ...employeeWithoutPassword, user_type: 'employee' }
      }
    });
  } catch (error) {
    console.error('Employee profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
