import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { dbGet, dbRun } from '../config/database';
import { generateToken } from '../utils/jwt';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Register new user
router.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
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

    const { username, email, password } = req.body;

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
    const result = await dbRun(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [username, email, passwordHash]
    );

    const userId = result.lastID;

    // Create default categories for the user
    const defaultCategories = [
      { name: 'Salary', type: 'income', color: '#10B981', icon: 'dollar-sign' },
      { name: 'Business', type: 'income', color: '#3B82F6', icon: 'briefcase' },
      { name: 'Investment', type: 'income', color: '#8B5CF6', icon: 'trending-up' },
      { name: 'Food', type: 'expense', color: '#EF4444', icon: 'utensils' },
      { name: 'Transport', type: 'expense', color: '#F59E0B', icon: 'car' },
      { name: 'Utilities', type: 'expense', color: '#6B7280', icon: 'zap' },
      { name: 'Entertainment', type: 'expense', color: '#EC4899', icon: 'music' },
      { name: 'Inventory', type: 'purchase', color: '#059669', icon: 'package' },
      { name: 'Equipment', type: 'purchase', color: '#DC2626', icon: 'tool' },
      { name: 'Retail', type: 'sale', color: '#16A34A', icon: 'shopping-bag' },
      { name: 'Service', type: 'sale', color: '#2563EB', icon: 'service' }
    ];

    for (const category of defaultCategories) {
      await dbRun(
        'INSERT INTO categories (business_id, name, type) VALUES ($1, $2, $3) RETURNING id',
        [userId, category.name, category.type]
      );
    }

    // Create default cash account
    await dbRun(
      'INSERT INTO accounts (business_id, account_type, account_name, balance) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, 'cash', 'Cash', 0]
    );

    // Get user data
    const user = await dbGet(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [userId]
    );

    // Generate JWT token
    const token = generateToken(user.id, user.username, user.email, user.user_type, user.business_id);

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
router.post('/login', [
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
      'SELECT * FROM users WHERE (username = $1 OR email = $2) AND is_active = TRUE',
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

    // Generate JWT token
    const token = generateToken(user.id, user.username, user.email, user.user_type || 'business_owner', user.business_id);

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
      'SELECT id, username, email, user_type, business_id, created_at FROM users WHERE id = $1',
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
  body('email').optional().isEmail().withMessage('Valid email is required')
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
    const { email } = req.body;

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await dbGet(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already taken'
        });
      }
    }

    // Update user
    const updates: string[] = [];
    const values: any[] = [];

    if (email) {
      updates.push('email = ?');
      values.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    await dbRun(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $1`,
      values
    );

    // Get updated user
    const user = await dbGet(
      'SELECT id, username, email, user_type, business_id, created_at FROM users WHERE id = $1',
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
      'SELECT * FROM employees WHERE email = $1 AND status = "active"',
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
        user: employeeWithoutPassword,
        token,
        user_type: 'employee'
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

export default router;
