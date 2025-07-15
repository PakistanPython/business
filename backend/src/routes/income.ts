import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all income records
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
    let whereClause = 'WHERE i.business_id = $1';
    const whereParams: any[] = [userId];
    let paramIndex = 2;

    if (category) {
      whereClause += ` AND c.name = $${paramIndex++}`;
      whereParams.push(category);
    }

    if (startDate) {
      whereClause += ` AND i.date >= $${paramIndex++}`;
      whereParams.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND i.date <= $${paramIndex++}`;
      whereParams.push(endDate);
    }

    // Get total count
    const countResult: { total: number } = await dbGet(
      `SELECT COUNT(*) as total FROM income i JOIN categories c ON i.category_id = c.id ${whereClause}`,
      whereParams
    );
    const total = countResult.total;

    // Get income records
    const incomeRecords = await dbAll(
      `SELECT 
        i.id, i.amount, i.description, c.name as category, i.date, 
        i.created_at, i.updated_at
       FROM income i
       JOIN categories c ON i.category_id = c.id
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
        income: incomeRecords,
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
    console.error('Get income error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get income by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const incomeId = parseInt(req.params.id);

    if (isNaN(incomeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid income ID'
      });
    }

    const incomeRecord = await dbGet(
      `SELECT 
        i.id, i.amount, i.description, c.name as category, i.date, 
        i.created_at, i.updated_at
       FROM income i
       JOIN categories c ON i.category_id = c.id
       WHERE i.id = $1 AND i.business_id = $2`,
      [incomeId, userId]
    );

    if (!incomeRecord) {
      return res.status(404).json({
        success: false,
        message: 'Income record not found'
      });
    }

    res.json({
      success: true,
      data: { income: incomeRecord }
    });
  } catch (error) {
    console.error('Get income by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new income record
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
    .notEmpty()
    .withMessage('Category is required'),
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
    const { amount, description, category, date } = req.body;

    try {
      await dbRun('BEGIN');

      const categoryRecord = await dbGet(
        'SELECT id FROM categories WHERE name = $1 AND business_id = $2 AND type = \'income\'',
        [category, userId]
      );

      if (!categoryRecord) {
        return res.status(400).json({
          success: false,
          message: 'Invalid income category'
        });
      }

      const incomeResult = await dbRun(
        'INSERT INTO income (business_id, amount, description, category_id, date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [userId, amount, description, categoryRecord.id, date]
      );

      const incomeId = incomeResult.lastID;

      const charityAmount = amount * 0.025;
      await dbRun(
        'INSERT INTO charity (business_id, amount, date) VALUES ($1, $2, $3)',
        [userId, charityAmount, date]
      );

      await dbRun('COMMIT');

      const newIncome = await dbGet('SELECT * FROM income WHERE id = $1', [incomeId]);

      res.status(201).json({
        success: true,
        message: 'Income record created successfully',
        data: {
          income: newIncome
        }
      });
    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Create income error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update income record
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
    .optional(),
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
    const incomeId = parseInt(req.params.id);

    if (isNaN(incomeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid income ID'
      });
    }

    const existingRecord = await dbGet(
      'SELECT id, amount, category_id FROM income WHERE id = $1 AND business_id = $2',
      [incomeId, userId]
    );

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: 'Income record not found'
      });
    }

    const { amount, description, category, date } = req.body;

    let categoryId = existingRecord.category_id;
    if (category) {
      const categoryRecord = await dbGet(
        'SELECT id FROM categories WHERE name = $1 AND business_id = $2 AND type = \'income\'',
        [category, userId]
      );
      if (!categoryRecord) {
        return res.status(400).json({
          success: false,
          message: 'Invalid income category'
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

    values.push(incomeId);

    await dbRun(
      `UPDATE income SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex++}`,
      values
    );

    const updatedRecord = await dbGet(
      'SELECT * FROM income WHERE id = $1',
      [incomeId]
    );

    res.json({
      success: true,
      message: 'Income record updated successfully',
      data: { income: updatedRecord }
    });
  } catch (error) {
    console.error('Update income error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete income record
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const incomeId = parseInt(req.params.id);

    if (isNaN(incomeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid income ID'
      });
    }

    const existingRecord = await dbGet(
      'SELECT id, amount FROM income WHERE id = $1 AND business_id = $2',
      [incomeId, userId]
    );

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: 'Income record not found'
      });
    }

    await dbRun('BEGIN');

    await dbRun(
      'DELETE FROM charity WHERE amount = $1 AND business_id = $2',
      [existingRecord.amount * 0.025, userId]
    );

    const result = await dbRun(
      'DELETE FROM income WHERE id = $1 AND business_id = $2',
      [incomeId, userId]
    );

    if (result.changes === 0) {
      await dbRun('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Income record not found or already deleted'
      });
    }

    await dbRun('COMMIT');

    res.json({
      success: true,
      message: 'Income record deleted successfully'
    });
  } catch (error) {
    await dbRun('ROLLBACK');
    console.error('Delete income error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get income summary/statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const stats = await dbGet(
      `SELECT 
        COUNT(*) as total_records,
        SUM(amount) as total_income,
        AVG(amount) as average_income,
        SUM(amount * 0.025) as total_charity_required,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
       FROM income 
       WHERE business_id = $1`,
      [userId]
    );

    const monthlyStats = await dbAll(
      `SELECT 
        to_char(date, 'MM') as month,
        to_char(date, 'YYYY') as year,
        SUM(amount) as monthly_income,
        COUNT(*) as monthly_count
       FROM income 
       WHERE business_id = $1 AND to_char(date, 'YYYY') = to_char(CURRENT_DATE, 'YYYY')
       GROUP BY year, month
       ORDER BY month`,
      [userId]
    );

    const categoryStats = await dbAll(
      `SELECT 
        c.name as category,
        COUNT(*) as count,
        SUM(i.amount) as total_amount,
        AVG(i.amount) as average_amount
       FROM income i
       JOIN categories c ON i.category_id = c.id
       WHERE i.business_id = $1 
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
    console.error('Income stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
