import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { dbGet, dbAll, dbRun } from '../config/database_sqlite';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all income records
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional(),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date')
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
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE user_id = ?';
    const params: any[] = [userId];

    if (req.query.category) {
      whereClause += ' AND category = ?';
      params.push(req.query.category);
    }

    if (req.query.start_date) {
      whereClause += ' AND date >= ?';
      params.push(req.query.start_date);
    }

    if (req.query.end_date) {
      whereClause += ' AND date <= ?';
      params.push(req.query.end_date);
    }

    // Get total count
    const countResult = await dbGet(
      `SELECT COUNT(*) as total FROM income ${whereClause}`,
      params
    );

    // Get income records
    const income = await dbAll(
      `SELECT * FROM income ${whereClause} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        income,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
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

    const income = await dbGet(
      'SELECT * FROM income WHERE id = ? AND user_id = ?',
      [incomeId, userId]
    );

    if (!income) {
      return res.status(404).json({
        success: false,
        message: 'Income record not found'
      });
    }

    res.json({
      success: true,
      data: { income }
    });
  } catch (error) {
    console.error('Get income by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new income
router.post('/', [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('description').optional().trim(),
  body('category').notEmpty().withMessage('Category is required'),
  body('source').optional().trim(),
  body('date').isISO8601().withMessage('Valid date is required')
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
    const { amount, description, category, source, date } = req.body;

    try {
      await dbRun('BEGIN TRANSACTION');
      
      // Insert income record
      const result = await dbRun(
        'INSERT INTO income (user_id, amount, description, category, source, date) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, amount, description || null, category, source || null, date]
      );

      // Get the charity required amount (2.5% of income)
      const charityAmount = amount * 0.025;
      
      // Create automatic charity record for this income
      const charityResult = await dbRun(
        'INSERT INTO charity (user_id, income_id, amount_required, description) VALUES (?, ?, ?, ?)',
        [userId, result.lastID, charityAmount, `Charity for income: ${description || category}`]
      );

      // Add transaction record for income
      await dbRun(
        'INSERT INTO transactions (user_id, transaction_type, reference_id, reference_table, amount, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'income', result.lastID, 'income', amount, description || `Income - ${category}`, date]
      );

      await dbRun('COMMIT');

      res.status(201).json({
        success: true,
        data: {
          id: result.lastID,
          charity_id: charityResult.lastID,
          charity_amount: charityAmount
        },
        message: 'Income created successfully with automatic charity allocation'
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

// Update income
router.put('/:id', [
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('description').optional().trim(),
  body('category').optional().notEmpty().withMessage('Category cannot be empty'),
  body('source').optional().trim(),
  body('date').optional().isISO8601().withMessage('Valid date is required')
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
    const { amount, description, category, source, date } = req.body;

    // Check if income exists
    const existingIncome = await dbGet(
      'SELECT * FROM income WHERE id = ? AND user_id = ?',
      [incomeId, userId]
    );

    if (!existingIncome) {
      return res.status(404).json({
        success: false,
        message: 'Income record not found'
      });
    }

    try {
      await dbRun('BEGIN TRANSACTION');

      // Update income
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
      if (source !== undefined) {
        updates.push('source = ?');
        values.push(source);
      }
      if (date !== undefined) {
        updates.push('date = ?');
        values.push(date);
      }

      if (updates.length === 0) {
        await dbRun('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(incomeId, userId);

      await dbRun(
        `UPDATE income SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
        values
      );

      // If amount was updated, update the related charity record
      if (amount !== undefined) {
        const newCharityAmount = amount * 0.025;
        await dbRun(
          'UPDATE charity SET amount_required = ?, amount_remaining = amount_required - amount_paid, updated_at = CURRENT_TIMESTAMP WHERE income_id = ? AND user_id = ?',
          [newCharityAmount, incomeId, userId]
        );
      }

      await dbRun('COMMIT');

      res.json({
        success: true,
        message: 'Income updated successfully'
      });
    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Update income error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete income
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const incomeId = parseInt(req.params.id);

    // Check if income exists
    const existingIncome = await dbGet(
      'SELECT * FROM income WHERE id = ? AND user_id = ?',
      [incomeId, userId]
    );

    if (!existingIncome) {
      return res.status(404).json({
        success: false,
        message: 'Income record not found'
      });
    }

    try {
      await dbRun('BEGIN TRANSACTION');

      // Delete related charity record first (auto-generated charity)
      await dbRun(
        'DELETE FROM charity WHERE income_id = ? AND user_id = ?',
        [incomeId, userId]
      );

      // Delete related charity transactions
      await dbRun(
        'DELETE FROM transactions WHERE reference_table = ? AND user_id = ? AND description LIKE ?',
        ['charity', userId, `%income: ${existingIncome.description || existingIncome.category}`]
      );

      // Delete income
      await dbRun(
        'DELETE FROM income WHERE id = ? AND user_id = ?',
        [incomeId, userId]
      );

      // Delete related income transaction
      await dbRun(
        'DELETE FROM transactions WHERE reference_id = ? AND reference_table = ? AND user_id = ?',
        [incomeId, 'income', userId]
      );

      await dbRun('COMMIT');

      res.json({
        success: true,
        message: 'Income and related charity records deleted successfully'
      });
    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Delete income error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get income statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const stats = await dbGet(`
      SELECT 
        COUNT(*) as total_records,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount,
        SUM(amount * 0.025) as total_charity_required
      FROM income 
      WHERE user_id = ?
    `, [userId]);

    // Get by category
    const byCategory = await dbAll(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total,
        AVG(amount) as average
      FROM income 
      WHERE user_id = ?
      GROUP BY category
      ORDER BY total DESC
    `, [userId]);

    // Get monthly breakdown for current year
    const monthlyBreakdown = await dbAll(`
      SELECT 
        strftime('%m', date) as month,
        strftime('%Y-%m', date) as year_month,
        COUNT(*) as count,
        SUM(amount) as total
      FROM income 
      WHERE user_id = ? AND strftime('%Y', date) = strftime('%Y', 'now')
      GROUP BY strftime('%Y-%m', date)
      ORDER BY year_month
    `, [userId]);

    res.json({
      success: true,
      data: {
        summary: stats,
        by_category: byCategory,
        monthly_breakdown: monthlyBreakdown
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

// Add charity percentage configuration endpoint
router.get('/config/charity-percentage', async (req, res) => {
  try {
    // Return the charity percentage configuration (2.5%)
    res.json({
      success: true,
      data: {
        charity_percentage: 2.5,
        charity_rate: 0.025,
        description: 'Automatic charity deduction from income'
      }
    });
  } catch (error) {
    console.error('Get charity config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;