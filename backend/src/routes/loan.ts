import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all loans
router.get('/', [
  query('status').optional().isIn(['active', 'paid', 'defaulted']).withMessage('Invalid status'),
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
    const status = req.query.status as string;

    // Build WHERE clause
    let whereClause = 'WHERE employee_id IN (SELECT id FROM employees WHERE business_id = $1)';
    const whereParams: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      whereParams.push(status);
    }

    const loans = await dbAll(
      `SELECT 
        id, employee_id, amount, interest_rate, start_date, end_date, status, 
        created_at, updated_at
       FROM loans 
       ${whereClause} 
       ORDER BY status, start_date DESC`,
      whereParams
    );

    res.json({
      success: true,
      data: {
        loans
      }
    });
  } catch (error) {
    console.error('Get loans error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get loan by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const loanId = parseInt(req.params.id);

    if (isNaN(loanId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid loan ID'
      });
    }

    const loan = await dbGet(
      `SELECT 
        id, employee_id, amount, interest_rate, start_date, end_date, status, 
        created_at, updated_at
       FROM loans 
       WHERE id = $1 AND employee_id IN (SELECT id FROM employees WHERE business_id = $2)`,
      [loanId, userId]
    );

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    res.json({
      success: true,
      data: { loan }
    });
  } catch (error) {
    console.error('Get loan by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new loan
router.post('/', [
  body('employee_id').isInt({ min: 1 }),
  body('amount').isFloat({ gt: 0 }),
  body('interest_rate').optional().isFloat({ min: 0 }),
  body('start_date').isISO8601().toDate(),
  body('end_date').isISO8601().toDate(),
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

    const { 
      employee_id,
      amount, 
      interest_rate, 
      start_date, 
      end_date 
    } = req.body;

    // Insert loan record
    const result = await dbRun(
      `INSERT INTO loans 
       (employee_id, amount, interest_rate, start_date, end_date, status) 
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
      [employee_id, amount, interest_rate, start_date, end_date]
    );

    const loanId = result.lastID;

    // Get the created loan record
    const newLoan = await dbGet(
      'SELECT * FROM loans WHERE id = $1',
      [loanId]
    );

    res.status(201).json({
      success: true,
      message: 'Loan record created successfully',
      data: { loan: newLoan }
    });
  } catch (error) {
    console.error('Create loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update loan
router.put('/:id', [
    body('amount').optional().isFloat({ gt: 0 }),
    body('interest_rate').optional().isFloat({ min: 0 }),
    body('start_date').optional().isISO8601().toDate(),
    body('end_date').optional().isISO8601().toDate(),
    body('status').optional().isIn(['active', 'paid']),
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
    const loanId = parseInt(req.params.id);

    if (isNaN(loanId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid loan ID'
      });
    }

    // Check if loan exists and belongs to user
    const existingLoan = await dbGet(
      'SELECT id FROM loans WHERE id = $1 AND employee_id IN (SELECT id FROM employees WHERE business_id = $2)',
      [loanId, userId]
    );

    if (!existingLoan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    const { amount, interest_rate, start_date, end_date, status } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (amount !== undefined) {
      updates.push(`amount = $${paramIndex++}`);
      values.push(amount);
    }
    if (interest_rate !== undefined) {
      updates.push(`interest_rate = $${paramIndex++}`);
      values.push(interest_rate);
    }
    if (start_date !== undefined) {
        updates.push(`start_date = $${paramIndex++}`);
        values.push(start_date);
    }
    if (end_date !== undefined) {
        updates.push(`end_date = $${paramIndex++}`);
        values.push(end_date);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(loanId);

    // Update loan record
    await dbRun(
      `UPDATE loans SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex++}`,
      values
    );

    // Get updated record
    const updatedLoan = await dbGet(
      'SELECT * FROM loans WHERE id = $1',
      [loanId]
    );

    res.json({
      success: true,
      message: 'Loan updated successfully',
      data: { loan: updatedLoan }
    });
  } catch (error) {
    console.error('Update loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete loan
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const loanId = parseInt(req.params.id);

    if (isNaN(loanId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid loan ID'
      });
    }

    // Check if loan exists and belongs to user
    const existingLoan = await dbGet(
      'SELECT id FROM loans WHERE id = $1 AND employee_id IN (SELECT id FROM employees WHERE business_id = $2)',
      [loanId, userId]
    );

    if (!existingLoan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Delete loan record
    await dbRun(
      'DELETE FROM loans WHERE id = $1',
      [loanId]
    );

    res.json({
      success: true,
      message: 'Loan record deleted successfully'
    });
  } catch (error) {
    console.error('Delete loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
