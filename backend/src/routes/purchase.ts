import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all purchase records
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().trim(),
  query('start_date').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('end_date').optional().isISO8601().withMessage('End date must be valid ISO date'),
  query('sort_by').optional().isIn(['date', 'amount', 'created_at']).withMessage('Invalid sort field'),
  query('sort_order').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('unsold').optional().isBoolean().withMessage('Unsold must be a boolean')
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
    const unsold = req.query.unsold === 'true';

    // Build WHERE clause
    let whereClause = 'WHERE p.business_id = $1';
    const whereParams: any[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      whereClause += ` AND p.date >= $${paramIndex++}`;
      whereParams.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND p.date <= $${paramIndex++}`;
      whereParams.push(endDate);
    }

    if (unsold) {
      whereClause += ' AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.purchase_id = p.id)';
    }

    // Get total count
    const countResult = await dbGet(
      `SELECT COUNT(*) as total FROM purchases p ${whereClause}`,
      whereParams
    );
    const total = countResult.total;

    // Get purchase records
    const purchaseRecords = await dbAll(
      `SELECT 
        p.id, p.amount, p.description, c.name as category, c.color as category_color, c.icon as category_icon, p.payment_method, p.date, 
        p.created_at, p.updated_at
       FROM purchases p
       LEFT JOIN categories c ON p.category_id = c.id
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
        purchases: purchaseRecords,
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
    console.error('Get purchases error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get purchase by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const purchaseId = parseInt(req.params.id);

    if (isNaN(purchaseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid purchase ID'
      });
    }

    const purchaseRecord = await dbGet(
      `SELECT 
        p.id, p.amount, p.description, c.name as category, c.color as category_color, c.icon as category_icon, p.payment_method, p.date, 
        p.created_at, p.updated_at
       FROM purchases p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.business_id = $2`,
      [purchaseId, userId]
    );

    if (!purchaseRecord) {
      return res.status(404).json({
        success: false,
        message: 'Purchase record not found'
      });
    }

    res.json({
      success: true,
      data: { purchase: purchaseRecord }
    });
  } catch (error) {
    console.error('Get purchase by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new purchase record
router.post('/', [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category is required'),
  body('payment_method')
    .optional()
    .trim(),
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
    const { amount, description = null, category_id, payment_method, date } = req.body;

    const purchaseResult = await dbRun(
      'INSERT INTO purchases (business_id, amount, description, category_id, payment_method, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [userId, amount, description, category_id, payment_method, date]
    );

    const purchaseId = purchaseResult.lastID;

    const purchaseRecord = await dbGet(
      'SELECT * FROM purchases WHERE id = $1',
      [purchaseId]
    );

    res.status(201).json({
      success: true,
      message: 'Purchase record created successfully',
      data: { purchase: purchaseRecord }
    });
  } catch (error) {
    console.error('Create purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update purchase record
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
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid category ID'),
  body('payment_method')
    .optional()
    .trim(),
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
    const purchaseId = parseInt(req.params.id);

    if (isNaN(purchaseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid purchase ID'
      });
    }

    const existingRecord = await dbGet(
      'SELECT id FROM purchases WHERE id = $1 AND business_id = $2',
      [purchaseId, userId]
    );

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: 'Purchase record not found'
      });
    }

    const { amount, description, category_id, payment_method, date } = req.body;

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
    if (category_id) {
      updates.push(`category_id = $${paramIndex++}`);
      values.push(category_id);
    }
    if (payment_method) {
      updates.push(`payment_method = $${paramIndex++}`);
      values.push(payment_method);
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

    values.push(purchaseId);

    await dbRun(
      `UPDATE purchases SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex++}`,
      values
    );

    const updatedRecord = await dbGet(
      'SELECT * FROM purchases WHERE id = $1',
      [purchaseId]
    );

    res.json({
      success: true,
      message: 'Purchase record updated successfully',
      data: { purchase: updatedRecord }
    });
  } catch (error) {
    console.error('Update purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete purchase record
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const purchaseId = parseInt(req.params.id);

    if (isNaN(purchaseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid purchase ID'
      });
    }

    const result = await dbRun(
      'DELETE FROM purchases WHERE id = $1 AND business_id = $2',
      [purchaseId, userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase record not found'
      });
    }

    res.json({
      success: true,
      message: 'Purchase record deleted successfully'
    });
  } catch (error) {
    console.error('Delete purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get purchase summary/statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const stats = await dbGet(
      `SELECT 
        COUNT(*) as total_records,
        SUM(amount) as total_purchases,
        AVG(amount) as average_purchase,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
       FROM purchases 
       WHERE business_id = $1`,
      [userId]
    );

    const monthlyStats = await dbAll(
      `SELECT 
        to_char(date, 'MM') as month,
        to_char(date, 'YYYY') as year,
        SUM(amount) as monthly_purchases,
        COUNT(*) as monthly_count
       FROM purchases 
       WHERE business_id = $1 AND to_char(date, 'YYYY') = to_char(CURRENT_DATE, 'YYYY')
       GROUP BY to_char(date, 'YYYY'), to_char(date, 'MM')
       ORDER BY month`,
      [userId]
    );

    const categoryStats = await dbAll(
      `SELECT 
        c.name as category,
        COUNT(*) as count,
        SUM(p.amount) as total_amount,
        AVG(p.amount) as average_amount
       FROM purchases p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.business_id = $1 
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
    console.error('Purchase stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
