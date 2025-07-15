import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all expense records
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().trim(),
  query('start_date').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('end_date').optional().isISO8601().withMessage('End date must be valid ISO date'),
  query('sort_by').optional().isIn(['date', 'amount', 'created_at']).withMessage('Invalid sort field'),
  query('sort_order').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const category = req.query.category as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const sortBy = req.query.sort_by as string || 'date';
    const sortOrder = req.query.sort_order as string || 'desc';

    // Build WHERE clause
    let whereClause = 'WHERE user_id = ?';
    const whereParams = [userId];

    if (category) {
      whereClause += ' AND category = ?';
      whereParams.push(category);
    }

    if (startDate) {
      whereClause += ' AND date >= ?';
      whereParams.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND date <= ?';
      whereParams.push(endDate);
    }

    // Get total count
    const countResult = await dbGet(
      `SELECT COUNT(*) as total FROM expenses ${whereClause}`,
      whereParams
    );
    const total = countResult.total;

    // Get expense records
    const expenseRecords = await dbAll(
      `SELECT 
        id, amount, description, category, payment_method, date, 
        receipt_path, created_at, updated_at
       FROM expenses 
       ${whereClause} 
       ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
       LIMIT ? OFFSET $2`,
      [...whereParams, limit, offset]
    );

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    res.json({
      success : true,
      data: {
        expenses: expenseRecords,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: total,
          limit,
          hasNext,
          hasPrev
        }
      }
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get expense by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const expenseId = parseInt(req.params.id);

    if (isNaN(expenseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expense ID'
      });
    }

    const expense = await dbGet(
      `SELECT 
        id, amount, description, category, payment_method, date, 
        receipt_path, created_at, updated_at
       FROM expenses 
       WHERE id = ? AND user_id = $2`,
      [expenseId, userId]
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }

    res.json({
      success: true,
      data: { expense }
    });
  } catch (error) {
    console.error('Get expense by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new expense record
router.post('/', [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('category')
    .trim()
    .notEmpty()
    .isLength({ max: 50 })
    .withMessage('Category is required and cannot exceed 50 characters'),
  body('payment_method')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Payment method cannot exceed 50 characters'),
  body('date')
    .isISO8601()
    .withMessage('Date must be valid ISO date'),
  body('receipt_path')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Receipt path cannot exceed 255 characters')
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
    const { amount, description = null, category, payment_method = 'Cash', date, receipt_path = null } = req.body;

    // Insert expense record
    const expenseResult = await dbRun(
      'INSERT INTO expenses (user_id, amount, description, category, payment_method, date, receipt_path) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, amount, description, category, payment_method, date, receipt_path]
    );

    const expenseId = expenseResult.rows?.[0]?.id;

    // Get the created expense record
    const expenseRecord = await dbGet(
      'SELECT * FROM expenses WHERE id = $1',
      [expenseId]
    );

    // Record transaction for audit trail
    await dbRun(
      'INSERT INTO transactions (user_id, transaction_type, reference_id, reference_table, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, 'expense', expenseId, 'expenses', amount, `Expense: ${description || category}`, date]
    );

    res.status(201).json({
      success: true,
      message: 'Expense record created successfully',
      data: { expense: expenseRecord }
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update expense record
router.put('/:id', [
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('category')
    .optional()
    .trim()
    .notEmpty()
    .isLength({ max: 50 })
    .withMessage('Category cannot be empty and cannot exceed 50 characters'),
  body('payment_method')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Payment method cannot exceed 50 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be valid ISO date'),
  body('receipt_path')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Receipt path cannot exceed 255 characters')
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
    const expenseId = parseInt(req.params.id);

    if (isNaN(expenseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expense ID'
      });
    }

    // Check if expense record exists and belongs to user
    const existingRecord = await dbGet(
      'SELECT id FROM expenses WHERE id = ? AND user_id = $2',
      [expenseId, userId]
    );

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }

    const { amount, description, category, payment_method, date, receipt_path } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (amount !== undefined) {
      updates.push('amount = ?');
      values.push(amount);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (payment_method !== undefined) {
      updates.push('payment_method = ?');
      values.push(payment_method);
    }
    if (date !== undefined) {
      updates.push('date = ?');
      values.push(date);
    }
    if (receipt_path !== undefined) {
      updates.push('receipt_path = ?');
      values.push(receipt_path);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(expenseId);

    // Update expense record
    await dbRun(
      `UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Get updated record
    const updatedRecord = await dbGet(
      'SELECT * FROM expenses WHERE id = $1',
      [expenseId]
    );

    res.json({
      success: true,
      message: 'Expense record updated successfully',
      data: { expense: updatedRecord }
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete expense record
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const expenseId = parseInt(req.params.id);

    if (isNaN(expenseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expense ID'
      });
    }

    // Check if expense record exists and belongs to user
    const existingRecord = await dbGet(
      'SELECT id FROM expenses WHERE id = ? AND user_id = $2',
      [expenseId, userId]
    );

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }

    // Delete related transactions
    await dbRun(
      'DELETE FROM transactions WHERE reference_id = ? AND reference_table = ? AND user_id = $3',
      [expenseId, 'expenses', userId]
    );

    // Delete expense record
    await dbRun(
      'DELETE FROM expenses WHERE id = ? AND user_id = $2',
      [expenseId, userId]
    );

    res.json({
      success: true,
      message: 'Expense record deleted successfully'
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get expense summary/statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user!.userId;

    // Get total expenses, monthly expenses, and category breakdown
    const stats = await dbGet(
      `SELECT 
        COUNT(*) as total_records,
        SUM(amount) as total_expenses,
        AVG(amount) as average_expense,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
       FROM expenses 
       WHERE user_id = $1`,
      [userId]
    );

    // Get monthly expenses for current year
    const monthlyStats = await dbAll(
      `SELECT 
        strftime('%m', date) as month,
        strftime('%Y', date) as year,
        SUM(amount) as monthly_expenses,
        COUNT(*) as monthly_count
       FROM expenses 
       WHERE user_id = ? AND strftime('%Y', date) = strftime('%Y', 'now')
       GROUP BY strftime('%Y', date), strftime('%m', date)
       ORDER BY month`,
      [userId]
    );

    // Get category breakdown
    const categoryStats = await dbAll(
      `SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount
       FROM expenses 
       WHERE user_id = ? GROUP BY category
       ORDER BY total_amount DESC`,
      [userId]
    );

    // Get payment method breakdown
    const paymentStats = await dbAll(
      `SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(amount) as total_amount
       FROM expenses 
       WHERE user_id = ? GROUP BY payment_method
       ORDER BY total_amount DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        summary: stats,
        monthly: monthlyStats,
        by_category: categoryStats,
        by_payment_method: paymentStats
      }
    });
  } catch (error) {
    console.error('Expense stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;