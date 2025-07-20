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
    let whereClause = 'WHERE e.business_id = $1';
    const whereParams: any[] = [userId];
    let paramIndex = 2;

    if (category) {
      whereClause += ` AND c.name = $${paramIndex++}`;
      whereParams.push(category);
    }

    if (startDate) {
      whereClause += ` AND e.date >= $${paramIndex++}`;
      whereParams.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND e.date <= $${paramIndex++}`;
      whereParams.push(endDate);
    }

    // Get total count
    const countResult = await dbGet(
      `SELECT COUNT(*) as total FROM expenses e JOIN categories c ON e.category_id = c.id ${whereClause}`,
      whereParams
    );
    const total = countResult.total;

    // Get expense records
    const expenseRecords = await dbAll(
      `SELECT 
        e.id, e.amount, e.description, c.name as category, c.color as category_color, c.icon as category_icon, e.payment_method, e.date, 
        e.created_at, e.updated_at
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       ${whereClause} 
       ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...whereParams, limit, offset]
    );

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    res.json({
      success: true,
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
        e.id, e.amount, e.description, c.name as category, c.color as category_color, c.icon as category_icon, e.payment_method, e.date, 
        e.created_at, e.updated_at
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       WHERE e.id = $1 AND e.business_id = $2`,
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
    .withMessage('Category is required'),
  body('payment_method')
    .trim()
    .notEmpty()
    .withMessage('Payment method is required'),
  body('date')
    .isISO8601()
    .withMessage('Date must be valid ISO date')
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
    const { amount, description = null, category, payment_method, date } = req.body;

    const categoryRecord = await dbGet(
      'SELECT id FROM categories WHERE name = $1 AND business_id = $2 AND type = \'expense\'',
      [category, userId]
    );
    if (!categoryRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expense category'
      });
    }

    const expenseResult = await dbRun(
      'INSERT INTO expenses (business_id, amount, description, category_id, payment_method, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [userId, amount, description, categoryRecord.id, payment_method, date]
    );

    const expenseId = expenseResult.lastID;

    const expenseRecord = await dbGet(
      'SELECT * FROM expenses WHERE id = $1',
      [expenseId]
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
    .withMessage('Category cannot be empty'),
  body('payment_method')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Payment method cannot be empty'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be valid ISO date')
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

    const existingRecord = await dbGet(
      'SELECT id, category_id FROM expenses WHERE id = $1 AND business_id = $2',
      [expenseId, userId]
    );

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }

    const { amount, description, category, payment_method, date } = req.body;

    let categoryId = existingRecord.category_id;
    if (category) {
      const categoryRecord = await dbGet(
        'SELECT id FROM categories WHERE name = $1 AND business_id = $2 AND type = \'expense\'',
        [category, userId]
      );
      if (!categoryRecord) {
        return res.status(400).json({
          success: false,
          message: 'Invalid expense category'
        });
      }
      categoryId = categoryRecord.id;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (amount !== undefined) {
      updates.push(`amount = $${paramIndex++}`);
      values.push(amount);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (payment_method !== undefined) {
      updates.push(`payment_method = $${paramIndex++}`);
      values.push(payment_method);
    }
    if (category) {
      updates.push(`category_id = $${paramIndex++}`);
      values.push(categoryId);
    }
    if (date !== undefined) {
      updates.push(`date = $${paramIndex++}`);
      values.push(date);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(expenseId);

    await dbRun(
      `UPDATE expenses SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex++}`,
      values
    );

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

    const result = await dbRun(
      'DELETE FROM expenses WHERE id = $1 AND business_id = $2',
      [expenseId, userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }

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

    const stats = await dbGet(
      `SELECT 
        COUNT(*) as total_records,
        SUM(amount) as total_expenses,
        AVG(amount) as average_expense,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
       FROM expenses 
       WHERE business_id = $1`,
      [userId]
    );

    const monthlyStats = await dbAll(
      `SELECT 
        to_char(date, 'MM') as month,
        to_char(date, 'YYYY') as year,
        SUM(amount) as monthly_expenses,
        COUNT(*) as monthly_count
       FROM expenses 
       WHERE business_id = $1 AND to_char(date, 'YYYY') = to_char(CURRENT_DATE, 'YYYY')
       GROUP BY to_char(date, 'YYYY'), to_char(date, 'MM')
       ORDER BY month`,
      [userId]
    );

    const categoryStats = await dbAll(
      `SELECT 
        c.name as category,
        COUNT(*) as count,
        SUM(e.amount) as total_amount,
        AVG(e.amount) as average_amount
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       WHERE e.business_id = $1 
       GROUP BY c.name
       ORDER BY total_amount DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        summary: stats,
        monthly: monthlyStats,
        by_category: categoryStats
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
