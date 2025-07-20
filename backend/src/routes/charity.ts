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
  query('sort_by').optional().isIn(['amount_required', 'created_at']).withMessage('Invalid sort field'),
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
    const sortBy = req.query.sort_by as string || 'created_at';
    const sortOrder = req.query.sort_order as string || 'desc';

    // Build WHERE clause
    let whereClause = 'WHERE business_id = $1';
    const whereParams: any[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      whereParams.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
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
        c.id, 
        c.amount_required, 
        COALESCE(c.amount_paid, 0) as amount_paid, 
        c.status, 
        c.description, 
        c.recipient, 
        c.created_at, 
        c.updated_at,
        (c.amount_required - COALESCE(c.amount_paid, 0)) as amount_remaining,
        (COALESCE(c.amount_paid, 0) * 100 / c.amount_required) as progress,
        i.description as income_description,
        i.source as income_source,
        i.date as income_date
       FROM charity c
       LEFT JOIN income i ON c.income_id = i.id
       ${whereClause.replace('business_id', 'c.business_id')} 
       ORDER BY c.${sortBy} ${sortOrder.toUpperCase()}
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

// Get charity summary
router.get('/summary', async (req, res) => {
    try {
        const userId = req.user!.userId;

        const summary = await dbGet(
            `SELECT 
                SUM(amount_required) as total_required,
                SUM(COALESCE(amount_paid, 0)) as total_paid,
                SUM(amount_required - COALESCE(amount_paid, 0)) as total_remaining
             FROM charity
             WHERE business_id = $1`,
            [userId]
        );

        res.json({
            success: true,
            data: {
                summary
            }
        });
    } catch (error) {
        console.error('Get charity summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Record a payment for a charity
router.post('/payment', [
    body('charity_id').isInt(),
    body('payment_amount').isFloat({ gt: 0 }),
    body('payment_date').isISO8601().toDate(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user!.userId;
        const { charity_id, payment_amount, payment_date, recipient, description } = req.body;

        const charityRecord = await dbGet(
            'SELECT *, COALESCE(amount_paid, 0) as amount_paid FROM charity WHERE id = $1 AND business_id = $2',
            [charity_id, userId]
        );

        if (!charityRecord) {
            return res.status(404).json({ message: 'Charity record not found' });
        }

        const newAmountPaid = Number(charityRecord.amount_paid) + payment_amount;
        const newStatus = newAmountPaid >= charityRecord.amount_required ? 'paid' : 'partial';

        await dbRun(
            'UPDATE charity SET amount_paid = $1, status = $2, recipient = $3, description = $4, updated_at = NOW() WHERE id = $5',
            [newAmountPaid, newStatus, recipient, description, charity_id]
        );

        res.status(200).json({ message: 'Payment recorded successfully' });
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
