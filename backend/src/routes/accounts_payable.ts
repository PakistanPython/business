import express from 'express';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/accounts-payable - Get all accounts payable
router.get('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const { 
      status, 
      vendor_name, 
      date_from, 
      date_to,
      overdue_only,
      page = 1, 
      limit = 20 
    } = req.query;

    let query = `
      SELECT * FROM accounts_payable 
      WHERE business_id = $1`;
    const params: any[] = [businessId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      query += ` AND status = $${paramIndex++}`;
      params.push(status as string);
    }

    if (vendor_name) {
      query += ` AND vendor_name LIKE $${paramIndex++}`;
      params.push(`%${vendor_name as string}%`);
    }

    if (date_from && date_to) {
      query += ` AND due_date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(date_from as string, date_to as string);
    }

    if (overdue_only === 'true') {
      query += ' AND due_date < NOW() AND paid = false';
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
      FROM accounts_payable 
      WHERE business_id = $1`;
    const countParams : any[] = [businessId];
    let countParamIndex = 2;

    if (status && status !== 'all') {
      countQuery += ` AND status = $${countParamIndex++}`;
      countParams.push(status as string);
    }

    if (vendor_name) {
      countQuery += ` AND vendor_name LIKE $${countParamIndex++}`;
      countParams.push(`%${vendor_name as string}%`);
    }

    if (date_from && date_to) {
      countQuery += ` AND due_date BETWEEN $${countParamIndex++} AND $${countParamIndex++}`;
      countParams.push(date_from as string, date_to as string);
    }

    if (overdue_only === 'true') {
      countQuery += ' AND due_date < NOW() AND paid = false';
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
    console.error('Error fetching accounts payable:', error);
    res.status(500).json({ error: 'Failed to fetch accounts payable' });
  }
});

// GET /api/accounts-payable/:id - Get single account payable
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.userId;

    const account = await dbGet(
      'SELECT * FROM accounts_payable WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Account payable not found' });
    }

    res.json(account);
  } catch (error) {
    console.error('Error fetching account payable:', error);
    res.status(500).json({ error: 'Failed to fetch account payable' });
  }
});

// POST /api/accounts-payable - Create new account payable
router.post('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const {
      vendor_name,
      amount,
      due_date,
    } = req.body;

    // Validate required fields
    if (!vendor_name || !due_date || !amount) {
      return res.status(400).json({ 
        error: 'Vendor name, due date, and amount are required' 
      });
    }

    // Create account payable
    const result = await dbRun(`
      INSERT INTO accounts_payable (
        business_id, vendor_name, amount, due_date
      ) VALUES ($1, $2, $3, $4) RETURNING id
    `, [
      businessId, vendor_name, amount, due_date
    ]);

    // Fetch the created record
    const newAccount = await dbGet(
      'SELECT * FROM accounts_payable WHERE id = $1',
      [result.lastID]
    );

    res.status(201).json(newAccount);
  } catch (error) {
    console.error('Error creating account payable:', error);
    res.status(500).json({ error: 'Failed to create account payable' });
  }
});

// PUT /api/accounts-payable/:id - Update account payable
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.userId;
    const {
      vendor_name,
      amount,
      due_date,
      paid
    } = req.body;

    // Check if account exists and belongs to this business
    const existingAccount = await dbGet(
      'SELECT * FROM accounts_payable WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account payable not found' });
    }

    // Update account payable
    await dbRun(`
      UPDATE accounts_payable SET
        vendor_name = $1,
        amount = $2,
        due_date = $3,
        paid = $4,
        updated_at = NOW()
      WHERE id = $5 AND business_id = $6`, [
      vendor_name || existingAccount.vendor_name,
      amount || existingAccount.amount,
      due_date || existingAccount.due_date,
      paid || existingAccount.paid,
      id, businessId
    ]);

    // Fetch updated record
    const updatedAccount = await dbGet(
      'SELECT * FROM accounts_payable WHERE id = $1',
      [id]
    );

    res.json(updatedAccount);
  } catch (error) {
    console.error('Error updating account payable:', error);
    res.status(500).json({ error: 'Failed to update account payable' });
  }
});

// DELETE /api/accounts-payable/:id - Delete account payable
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.userId;

    // Check if account exists and belongs to this business
    const account = await dbGet(
      'SELECT paid FROM accounts_payable WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Account payable not found' });
    }

    // Don't allow deleting if payments have been made
    if (account.paid) {
      return res.status(400).json({ error: 'Cannot delete paid bill' });
    }

    // Delete account payable and related payment records
    await dbRun('DELETE FROM accounts_payable WHERE id = $1 AND business_id = $2', [id, businessId]);

    res.json({ message: 'Account payable deleted successfully' });
  } catch (error) {
    console.error('Error deleting account payable:', error);
    res.status(500).json({ error: 'Failed to delete account payable' });
  }
});

export default router;
