import express from 'express';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/accounts-receivable - Get all accounts receivable
router.get('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const { 
      status, 
      customer_name, 
      date_from, 
      date_to,
      overdue_only,
      page = 1, 
      limit = 20 
    } = req.query;

    let query = `
      SELECT 
        ar.*,
        ar.amount - ar.paid_amount as balance_amount
      FROM accounts_receivable ar
      WHERE ar.business_id = $1`;
    const params: any[] = [businessId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      if (status === 'paid') {
        query += ` AND ar.received = true`;
      } else if (status === 'pending') {
        query += ` AND ar.received = false`;
      }
    }

    if (customer_name) {
      query += ` AND customer_name LIKE $${paramIndex++}`;
      params.push(`%${customer_name as string}%`);
    }

    if (date_from && date_to) {
      query += ` AND due_date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(date_from as string, date_to as string);
    }

    if (overdue_only === 'true') {
      query += ' AND due_date < NOW() AND received = false';
    }

    query += ' ORDER BY due_date DESC, created_at DESC';

    // Add pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit as string), offset);

    const accounts = await dbAll(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM accounts_receivable ar
      WHERE ar.business_id = $1`;
    const countParams : any[] = [businessId];
    let countParamIndex = 2;

    if (status && status !== 'all') {
      if (status === 'paid') {
        countQuery += ` AND ar.received = true`;
      } else if (status === 'pending') {
        countQuery += ` AND ar.received = false`;
      }
    }

    if (customer_name) {
      countQuery += ` AND customer_name LIKE $${countParamIndex++}`;
      countParams.push(`%${customer_name as string}%`);
    }

    if (date_from && date_to) {
      countQuery += ` AND due_date BETWEEN $${countParamIndex++} AND $${countParamIndex++}`;
      countParams.push(date_from as string, date_to as string);
    }

    if (overdue_only === 'true') {
      countQuery += ' AND due_date < NOW() AND received = false';
    }

    const { total } = await dbGet(countQuery, countParams);

    res.json({
      accounts : accounts,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Error fetching accounts receivable:', error);
    res.status(500).json({ error: 'Failed to fetch accounts receivable' });
  }
});

// GET /api/accounts-receivable/:id - Get single account receivable
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.userId;

    const account = await dbGet(
      'SELECT *, amount - paid_amount as balance_amount FROM accounts_receivable WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Account receivable not found' });
    }

    res.json(account);
  } catch (error) {
    console.error('Error fetching account receivable:', error);
    res.status(500).json({ error: 'Failed to fetch account receivable' });
  }
});

// POST /api/accounts-receivable - Create new account receivable
router.post('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const {
      customer_name,
      amount,
      due_date,
      customer_email,
      customer_phone,
      customer_address,
      payment_terms,
      description,
      notes
    } = req.body;

    // Validate required fields
    if (!customer_name || !due_date || !amount) {
      return res.status(400).json({ 
        error: 'Customer name, due date, and amount are required' 
      });
    }

    // Create account receivable
    const result = await dbRun(`
      INSERT INTO accounts_receivable (
        business_id, customer_name, amount, due_date, customer_email, customer_phone, customer_address, payment_terms, description, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
    `, [
      businessId, customer_name, amount, due_date, customer_email, customer_phone, customer_address, payment_terms, description, notes
    ]);

    // Fetch the created record
    const newAccount = await dbGet(
      'SELECT * FROM accounts_receivable WHERE id = $1',
      [result.lastID]
    );

    res.status(201).json(newAccount);
  } catch (error) {
    console.error('Error creating account receivable:', error);
    res.status(500).json({ error: 'Failed to create account receivable' });
  }
});

// PUT /api/accounts-receivable/:id - Update account receivable
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.userId;
    const {
      customer_name,
      amount,
      due_date,
      received
    } = req.body;

    // Check if account exists and belongs to this business
    const existingAccount = await dbGet(
      'SELECT * FROM accounts_receivable WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account receivable not found' });
    }

    // Update account receivable
    await dbRun(`
      UPDATE accounts_receivable SET
        customer_name = $1,
        amount = $2,
        due_date = $3,
        received = $4,
        updated_at = NOW()
      WHERE id = $5 AND business_id = $6`, [
      customer_name || existingAccount.customer_name,
      amount || existingAccount.amount,
      due_date || existingAccount.due_date,
      received || existingAccount.received,
      id, businessId
    ]);

    // Fetch updated record
    const updatedAccount = await dbGet(
      'SELECT * FROM accounts_receivable WHERE id = $1',
      [id]
    );

    res.json(updatedAccount);
  } catch (error) {
    console.error('Error updating account receivable:', error);
    res.status(500).json({ error: 'Failed to update account receivable' });
  }
});

// DELETE /api/accounts-receivable/:id - Delete account receivable
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.userId;

    // Check if account exists and belongs to this business
    const account = await dbGet(
      'SELECT received FROM accounts_receivable WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Account receivable not found' });
    }

    // Don't allow deleting if payments have been made
    if (account.received) {
      return res.status(400).json({ error: 'Cannot delete received invoice' });
    }

    // Delete account receivable and related payment records
    await dbRun('DELETE FROM accounts_receivable WHERE id = $1 AND business_id = $2', [id, businessId]);

    res.json({ message: 'Account receivable deleted successfully' });
  } catch (error) {
    console.error('Error deleting account receivable:', error);
    res.status(500).json({ error: 'Failed to delete account receivable' });
  }
});

// POST /api/accounts-receivable/:id/payment - Record a payment for an accounts receivable
router.post('/:id/payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.userId;
    const { amount, payment_date, payment_method, notes } = req.body;

    // Check if account exists and belongs to this business
    const existingAccount = await dbGet(
      'SELECT * FROM accounts_receivable WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account receivable not found' });
    }

    const newPaidAmount = Number(existingAccount.paid_amount) + Number(amount);
    const newStatus = newPaidAmount >= existingAccount.amount ? 'paid' : 'partial';

    // Update account receivable
    await dbRun(`
      UPDATE accounts_receivable SET
        paid_amount = $1,
        status = $2,
        updated_at = NOW()
      WHERE id = $3 AND business_id = $4`,
      [newPaidAmount, newStatus, id, businessId]
    );

    // Fetch updated record
    const updatedAccount = await dbGet(
      'SELECT * FROM accounts_receivable WHERE id = $1',
      [id]
    );

    res.json(updatedAccount);
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// GET /api/accounts-receivable/stats/summary - Get accounts receivable summary statistics
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;

    const summary = await dbGet(`
      SELECT
        COUNT(*) as total_invoices,
        SUM(amount) as total_receivable,
        SUM(paid_amount) as total_paid,
        SUM(amount - paid_amount) as total_outstanding,
        AVG(amount) as average_invoice_amount,
        COUNT(CASE WHEN due_date < NOW() AND status != 'paid' THEN 1 END) as overdue_invoices,
        SUM(CASE WHEN due_date < NOW() AND status != 'paid' THEN amount - paid_amount ELSE 0 END) as overdue_amount,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN status = 'pending' OR status = 'partial' THEN 1 END) as pending_invoices,
        SUM(CASE WHEN status = 'pending' OR status = 'partial' THEN amount - paid_amount ELSE 0 END) as pending_amount
      FROM accounts_receivable
      WHERE business_id = $1
    `, [businessId]);

    res.json(summary);
  } catch (error) {
    console.error('Error fetching accounts receivable summary:', error);
    res.status(500).json({ error: 'Failed to fetch accounts receivable summary' });
  }
});

export default router;
