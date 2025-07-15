import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all charity records
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
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
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const sortBy = req.query.sort_by as string || 'date';
    const sortOrder = req.query.sort_order as string || 'desc';

    // Build WHERE clause
    let whereClause = 'WHERE business_id = $1';
    const whereParams: any[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      whereClause += ` AND date >= $${paramIndex++}`;
      whereParams.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND date <= $${paramIndex++}`;
      whereParams.push(endDate);
    }

    // Get total count
    const countResult = await dbGet(
      `SELECT COUNT(*) as total FROM charity ${whereClause}`,
      whereParams
    );
    const total = countResult.total;

    // Get charity records
    const charityRecords = await dbAll(
      `SELECT 
        id, amount, date, created_at, updated_at
       FROM charity 
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
        charity: charityRecords,
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
    console.error('Get charity error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get charity by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const charityId = parseInt(req.params.id);

    if (isNaN(charityId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid charity ID'
      });
    }

    const charityRecord = await dbGet(
      `SELECT 
        id, amount, date, created_at, updated_at
       FROM charity 
       WHERE id = $1 AND business_id = $2`,
      [charityId, userId]
    );

    if (!charityRecord) {
      return res.status(404).json({
        success: false,
        message: 'Charity record not found'
      });
    }

    res.json({
      success: true,
      data: { charity: charityRecord }
    });
  } catch (error) {
    console.error('Get charity by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new charity record
router.post('/', [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
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
    const { amount, date } = req.body;

    const result = await dbRun(
      'INSERT INTO charity (business_id, amount, date) VALUES ($1, $2, $3) RETURNING id',
      [userId, amount, date]
    );

    const charityId = result.lastID;

    const newCharity = await dbGet(
      'SELECT * FROM charity WHERE id = $1',
      [charityId]
    );

    res.status(201).json({
      success: true,
      message: 'Charity record created successfully',
      data: { charity: newCharity }
    });
  } catch (error) {
    console.error('Create charity error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update charity record
router.put('/:id', [
    body('amount').optional().isFloat({ gt: 0 }),
    body('date').optional().isISO8601().toDate(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.userId;
    const charityId = parseInt(req.params.id);

    if (isNaN(charityId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid charity ID'
      });
    }

    const existingRecord = await dbGet(
      'SELECT id FROM charity WHERE id = $1 AND business_id = $2',
      [charityId, userId]
    );

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: 'Charity record not found'
      });
    }

    const { amount, date } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (amount) {
        updates.push(`amount = $${paramIndex++}`);
        values.push(amount);
    }
    if (date) {
        updates.push(`date = $${paramIndex++}`);
        values.push(date);
    }

    if (updates.length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(charityId, userId);

    await dbRun(
      `UPDATE charity SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND business_id = $${paramIndex++}`,
      values
    );

    const updatedRecord = await dbGet(
      'SELECT * FROM charity WHERE id = $1',
      [charityId]
    );

    res.json({
      success: true,
      message: 'Charity record updated successfully',
      data: { charity: updatedRecord }
    });
  } catch (error) {
    console.error('Update charity error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete charity record
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const charityId = parseInt(req.params.id);

    if (isNaN(charityId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid charity ID'
      });
    }

    const result = await dbRun(
      'DELETE FROM charity WHERE id = $1 AND business_id = $2',
      [charityId, userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Charity record not found'
      });
    }

    res.json({
      success: true,
      message: 'Charity record deleted successfully'
    });
  } catch (error) {
    console.error('Delete charity error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get charity summary/statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const stats = await dbGet(
      `SELECT 
        COUNT(*) as total_records,
        SUM(amount) as total_paid
       FROM charity 
       WHERE business_id = $1`,
      [userId]
    );

    const monthlyStats = await dbAll(
      `SELECT 
        to_char(date, 'MM') as month,
        to_char(date, 'YYYY') as year,
        SUM(amount) as monthly_payments,
        COUNT(*) as monthly_count
       FROM charity 
       WHERE business_id = $1 AND to_char(date, 'YYYY') = to_char(CURRENT_DATE, 'YYYY')
       GROUP BY to_char(date, 'YYYY'), to_char(date, 'MM')
       ORDER BY month`,
      [userId]
    );

    const recentActivities = await dbAll(
      `SELECT 
        id, amount, date, created_at
       FROM charity
       WHERE business_id = $1
       ORDER BY updated_at DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        summary: stats,
        monthly_payments: monthlyStats,
        recent_activities: recentActivities
      }
    });
  } catch (error) {
    console.error('Charity stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
