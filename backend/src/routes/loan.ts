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
    let whereClause = 'WHERE business_id = $1';
    const whereParams: any[] = [req.user!.businessId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      whereParams.push(status);
    }

    const loans = await dbAll(
      `SELECT 
        id, lender_name, principal_amount, current_balance, interest_rate, monthly_payment, loan_type, start_date, due_date, status, created_at, updated_at
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
        id, lender_name, principal_amount, current_balance, interest_rate, monthly_payment, loan_type, start_date, due_date, status, created_at, updated_at
       FROM loans 
       WHERE id = $1 AND business_id = $2`,
      [loanId, req.user!.businessId]
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
    body('lender_name').notEmpty().withMessage('Lender name is required'),
    body('principal_amount').isFloat({ gt: 0 }).withMessage('Principal amount must be positive'),
    body('loan_type').isIn(['personal', 'business', 'mortgage', 'auto', 'other']),
    body('start_date').isISO8601().withMessage('Invalid start date'),
    body('due_date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid due date'),
    body('interest_rate').optional().isFloat({ min: 0 }),
    body('monthly_payment').optional().isFloat({ min: 0 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    try {
        const {
            lender_name,
            principal_amount,
            loan_type,
            start_date,
            due_date,
            interest_rate,
            monthly_payment,
            current_balance
        } = req.body;
        
        const business_id = req.user!.businessId;

        if (!business_id) {
            return res.status(400).json({ success: false, message: 'Business ID not found in token' });
        }

        const result = await dbRun(
            `INSERT INTO loans (business_id, lender_name, principal_amount, current_balance, loan_type, start_date, due_date, interest_rate, monthly_payment, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')`,
            [business_id, lender_name, principal_amount, current_balance || principal_amount, loan_type, start_date, due_date, interest_rate, monthly_payment]
        );

        res.status(201).json({
            success: true,
            message: 'Loan created successfully',
            data: { id: result.lastID }
        });
    } catch (error) {
        console.error('Error creating loan:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Record loan payment
router.post('/:id/payment', [
    body('amount').isFloat({ gt: 0 }).withMessage('Payment amount must be positive'),
    body('payment_date').isISO8601().withMessage('Invalid payment date'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    try {
        const loanId = parseInt(req.params.id);
        const { amount, payment_date, description } = req.body;
        const business_id = req.user!.businessId;

        if (!business_id) {
            return res.status(400).json({ success: false, message: 'Business ID not found in token' });
        }

        // Check if loan exists and belongs to user
        const loan = await dbGet(
            'SELECT * FROM loans WHERE id = $1 AND business_id = $2',
            [loanId, business_id]
        );

        if (!loan) {
            return res.status(404).json({ success: false, message: 'Loan not found' });
        }

        const newBalance = loan.current_balance - amount;

        await dbRun(
            'UPDATE loans SET current_balance = $1, status = $2 WHERE id = $3',
            [newBalance, newBalance <= 0 ? 'paid' : 'active', loanId]
        );

        await dbRun(
            'INSERT INTO loan_payments (loan_id, amount, payment_date, description) VALUES ($1, $2, $3, $4)',
            [loanId, amount, payment_date, description]
        );

        res.json({ success: true, message: 'Payment recorded successfully' });
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
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
      'SELECT id FROM loans WHERE id = $1 AND business_id = $2',
      [loanId, req.user!.businessId]
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
      'SELECT id FROM loans WHERE id = $1 AND business_id = $2',
      [loanId, req.user!.businessId]
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
