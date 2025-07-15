import express from 'express';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Helper function to generate bill number
const generateBillNumber = async (businessId: number): Promise<string> => {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  
  const count = await dbGet(`
    SELECT COUNT(*) as count 
    FROM accounts_payable 
    WHERE business_id = ? AND strftime('%Y', bill_date) = ? 
    AND strftime('%m', bill_date) = ?
  `, [businessId, year.toString(), month.toString().padStart(2, '0')]);
  
  const nextNumber = (count.count + 1).toString().padStart(4, '0');
  return `BILL-${year}${month.toString().padStart(2, '0')}-${nextNumber}`;
};

// Helper function to update account status based on balance
const updateAccountStatus = async (id: number) => {
  const account = await dbGet('SELECT amount, paid_amount, due_date FROM accounts_payable WHERE id = $1', [id]);
  
  if (!account) return;
  
  let status = 'pending';
  const balanceAmount = account.amount - account.paid_amount;
  
  if (balanceAmount <= 0) {
    status = 'paid';
  } else if (account.paid_amount > 0) {
    status = 'partial';
  } else {
    // Check if overdue
    const dueDate = new Date(account.due_date);
    const today = new Date();
    if (today > dueDate) {
      status = 'overdue';
    }
  }
  
  await dbRun('UPDATE accounts_payable SET status = ? WHERE id = $2', [status, id]);
};

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
      WHERE business_id = ? `;
    const params: any[] = [businessId];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status as string);
    }

    if (vendor_name) {
      query += ' AND vendor_name LIKE ?';
      params.push(`%${vendor_name as string}%`);
    }

    if (date_from && date_to) {
      query += ' AND bill_date BETWEEN ? AND ?';
      params.push(date_from as string, date_to as string);
    }

    if (overdue_only === 'true') {
      query += ' AND due_date < date("now") AND status != "paid"';
    }

    query += ' ORDER BY bill_date DESC, created_at DESC';

    // Add pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query += ` LIMIT ? OFFSET $2`;
    params.push(parseInt(limit as string), offset);

    const accounts = await dbAll(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM accounts_payable 
      WHERE business_id = ? `;
    const countParams : any[] = [businessId];

    if (status && status !== 'all') {
      countQuery += ' AND status = ?';
      countParams.push(status as string);
    }

    if (vendor_name) {
      countQuery += ' AND vendor_name LIKE ?';
      countParams.push(`%${vendor_name as string}%`);
    }

    if (date_from && date_to) {
      countQuery += ' AND bill_date BETWEEN ? AND ?';
      countParams.push(date_from as string, date_to as string);
    }

    if (overdue_only === 'true') {
      countQuery += ' AND due_date < date("now") AND status != "paid"';
    }

    const { total } = await dbGet(countQuery, countParams);

    res.json({
      accounts: accounts,
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
    const businessId = req.user?.userId;

    const account = await dbGet(
      'SELECT * FROM accounts_payable WHERE id = ? AND business_id = $2',
      [id, businessId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Account payable not found' });
    }

    // Get payment history
    const payments = await dbAll(
      'SELECT * FROM payment_records WHERE record_type = "payable" AND record_id = ? ORDER BY payment_date DESC',
      [id]
    );

    res.json({
      ...account,
      payments
    });
  } catch (error) {
    console.error('Error fetching account payable:', error);
    res.status(500).json({ error: 'Failed to fetch account payable' });
  }
});

// POST /api/accounts-payable - Create new account payable
router.post('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user?.userId;
    const {
      vendor_name,
      vendor_email,
      vendor_phone,
      vendor_address,
      bill_number,
      bill_date,
      due_date,
      amount,
      payment_terms,
      description,
      notes
    } = req.body;

    // Validate required fields
    if (!vendor_name || !bill_date || !due_date || !amount) {
      return res.status(400).json({ 
        error: 'Vendor name, bill date, due date, and amount are required' 
      });
    }

    // Generate bill number if not provided
    const finalBillNumber = bill_number || await generateBillNumber(businessId!);

    // Check if bill number already exists
    const existingBill = await dbGet(
      'SELECT id FROM accounts_payable WHERE bill_number = ? AND business_id = $2',
      [finalBillNumber, businessId]
    );

    if (existingBill) {
      return res.status(400).json({ error: 'Bill number already exists' });
    }

    // Determine initial status
    const billDueDate = new Date(due_date);
    const today = new Date();
    const status = today > billDueDate ? 'overdue' : 'pending';

    // Create account payable
    const result = await dbRun(`
      INSERT INTO accounts_payable (
        business_id, vendor_name, vendor_email, vendor_phone, vendor_address,
        bill_number, bill_date, due_date, amount, balance_amount, status,
        payment_terms, description, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      businessId, vendor_name, vendor_email, vendor_phone, vendor_address,
      finalBillNumber, bill_date, due_date, amount, amount, status,
      payment_terms, description, notes
    ]);

    // Fetch the created record
    const newAccount = await dbGet(
      'SELECT * FROM accounts_payable WHERE id = ?',
      [result.rows?.[0]?.id]
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
    const businessId = req.user?.userId;
    const {
      vendor_name,
      vendor_email,
      vendor_phone,
      vendor_address,
      bill_number,
      bill_date,
      due_date,
      amount,
      payment_terms,
      description,
      notes
    } = req.body;

    // Check if account exists and belongs to this business
    const existingAccount = await dbGet(
      'SELECT * FROM accounts_payable WHERE id = ? AND business_id = $2',
      [id, businessId]
    );

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account payable not found' });
    }

    // Don't allow updating if fully paid
    if (existingAccount.status === 'paid') {
      return res.status(400).json({ error: 'Cannot update fully paid bill' });
    }

    // Check if bill number is being changed and already exists
    if (bill_number && bill_number !== existingAccount.bill_number) {
      const duplicateBill = await dbGet(
        'SELECT id FROM accounts_payable WHERE bill_number = ? AND business_id = ? AND id != $3',
        [bill_number, businessId, id]
      );
      if (duplicateBill) {
        return res.status(400).json({ error: 'Bill number already exists' });
      }
    }

    // Update account payable
    await dbRun(`
      UPDATE accounts_payable SET
        vendor_name = $1, vendor_email = $2, vendor_phone = $3, vendor_address = $4,
        bill_number = $5, bill_date = $6, due_date = $7, amount = $8,
        balance_amount = amount - paid_amount, payment_terms = $9, description = $10, notes = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ? `, [
      vendor_name || existingAccount.vendor_name,
      vendor_email || existingAccount.vendor_email,
      vendor_phone || existingAccount.vendor_phone,
      vendor_address || existingAccount.vendor_address,
      bill_number || existingAccount.bill_number,
      bill_date || existingAccount.bill_date,
      due_date || existingAccount.due_date,
      amount || existingAccount.amount,
      payment_terms || existingAccount.payment_terms,
      description || existingAccount.description,
      notes || existingAccount.notes,
      id, businessId
    ]);

    // Update status based on new values
    await updateAccountStatus(parseInt(id));

    // Fetch updated record
    const updatedAccount = await dbGet(
      'SELECT * FROM accounts_payable WHERE id = ?',
      [id]
    );

    res.json(updatedAccount);
  } catch (error) {
    console.error('Error updating account payable:', error);
    res.status(500).json({ error: 'Failed to update account payable' });
  }
});

// POST /api/accounts-payable/:id/payment - Record payment
router.post('/:id/payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;
    const {
      amount,
      payment_date,
      payment_method,
      reference_number,
      notes
    } = req.body;

    // Validate required fields
    if (!amount || !payment_date) {
      return res.status(400).json({ error: 'Payment amount and date are required' });
    }

    // Check if account exists and belongs to this business
    const account = await dbGet(
      'SELECT * FROM accounts_payable WHERE id = ? AND business_id = $2',
      [id, businessId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Account payable not found' });
    }

    // Check if payment amount is valid
    const remainingBalance = account.amount - account.paid_amount;
    if (amount > remainingBalance) {
      return res.status(400).json({ error: 'Payment amount exceeds remaining balance' });
    }

    // Record payment
    await dbRun(`
      INSERT INTO payment_records (
        business_id, record_type, record_id, payment_date, amount,
        payment_method, reference_number, notes
      ) VALUES ($1, 'payable', ?, ?, ?, ?, ?, ?)
    `, [businessId, id, payment_date, amount, payment_method, reference_number, notes]);

    // Update paid amount
    const newPaidAmount = account.paid_amount + parseFloat(amount);
    await dbRun(
      'UPDATE accounts_payable SET paid_amount = ? WHERE id = $2',
      [newPaidAmount, id]
    );

    // Update status
    await updateAccountStatus(parseInt(id));

    // Fetch updated record
    const updatedAccount = await dbGet(
      'SELECT * FROM accounts_payable WHERE id = $1',
      [id]
    );

    res.json(updatedAccount);
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// DELETE /api/accounts-payable/:id - Delete account payable
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;

    // Check if account exists and belongs to this business
    const account = await dbGet(
      'SELECT paid_amount FROM accounts_payable WHERE id = ? AND business_id = $2',
      [id, businessId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Account payable not found' });
    }

    // Don't allow deleting if payments have been made
    if (account.paid_amount > 0) {
      return res.status(400).json({ error: 'Cannot delete bill with recorded payments' });
    }

    // Delete account payable and related payment records
    await dbRun('DELETE FROM payment_records WHERE record_type = "payable" AND record_id = $1', [id]);
    await dbRun('DELETE FROM accounts_payable WHERE id = ? AND business_id = $2', [id, businessId]);

    res.json({ message: 'Account payable deleted successfully' });
  } catch (error) {
    console.error('Error deleting account payable:', error);
    res.status(500).json({ error: 'Failed to delete account payable' });
  }
});

// GET /api/accounts-payable/stats/summary - Get accounts payable summary
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const businessId = req.user?.userId;

    const summary = await dbGet(`
      SELECT 
        COUNT(*) as total_bills,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bills,
        COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_bills,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_bills,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_bills,
        ROUND(SUM(amount), 2) as total_amount,
        ROUND(SUM(paid_amount), 2) as total_paid,
        ROUND(SUM(balance_amount), 2) as total_outstanding,
        ROUND(SUM(CASE WHEN status = 'overdue' THEN balance_amount ELSE 0 END), 2) as overdue_amount
      FROM accounts_payable 
      WHERE business_id = ?
    `, [businessId]);

    // Get aging analysis
    const aging = await dbGet(`
      SELECT 
        COUNT(CASE WHEN julianday('now') - julianday(due_date) <= 30 AND status != 'paid' THEN 1 END) as current_0_30,
        COUNT(CASE WHEN julianday('now') - julianday(due_date) BETWEEN 31 AND 60 AND status != 'paid' THEN 1 END) as days_31_60,
        COUNT(CASE WHEN julianday('now') - julianday(due_date) BETWEEN 61 AND 90 AND status != 'paid' THEN 1 END) as days_61_90,
        COUNT(CASE WHEN julianday('now') - julianday(due_date) > 90 AND status != 'paid' THEN 1 END) as over_90_days,
        ROUND(SUM(CASE WHEN julianday('now') - julianday(due_date) <= 30 AND status != 'paid' THEN balance_amount ELSE 0 END), 2) as amount_0_30,
        ROUND(SUM(CASE WHEN julianday('now') - julianday(due_date) BETWEEN 31 AND 60 AND status != 'paid' THEN balance_amount ELSE 0 END), 2) as amount_31_60,
        ROUND(SUM(CASE WHEN julianday('now') - julianday(due_date) BETWEEN 61 AND 90 AND status != 'paid' THEN balance_amount ELSE 0 END), 2) as amount_61_90,
        ROUND(SUM(CASE WHEN julianday('now') - julianday(due_date) > 90 AND status != 'paid' THEN balance_amount ELSE 0 END), 2) as amount_over_90
      FROM accounts_payable 
      WHERE business_id = ?
    `, [businessId]);

    res.json({
      ...summary,
      aging
    });
  } catch (error) {
    console.error('Error fetching accounts payable summary:', error);
    res.status(500).json({ error: 'Failed to fetch accounts payable summary' });
  }
});

// GET /api/accounts-payable/stats/vendors - Get top vendors by outstanding balance
router.get('/stats/vendors', async (req: Request, res: Response) => {
  try {
    const businessId = req.user?.userId;

    const vendors = await dbAll(`
      SELECT 
        vendor_name,
        vendor_email,
        COUNT(*) as total_bills,
        ROUND(SUM(amount), 2) as total_billed,
        ROUND(SUM(paid_amount), 2) as total_paid,
        ROUND(SUM(balance_amount), 2) as outstanding_balance,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_bills
      FROM accounts_payable 
      WHERE business_id = ?
      GROUP BY vendor_name, vendor_email
      HAVING outstanding_balance > 0
      ORDER BY outstanding_balance DESC
      LIMIT 10
    `, [businessId]);

    res.json(vendors);
  } catch (error) {
    console.error('Error fetching vendor statistics:', error);
    res.status(500).json({ error: 'Failed to fetch vendor statistics' });
  }
});

// PUT /api/accounts-payable/:id/status - Update account status
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;
    const { status } = req.body;

    // Validate status
    if (!['pending', 'partial', 'paid', 'overdue', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if account exists and belongs to this business
    const account = await dbGet(
      'SELECT * FROM accounts_payable WHERE id = ? AND business_id = $2',
      [id, businessId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Account payable not found' });
    }

    // Update status
    await dbRun(
      'UPDATE accounts_payable SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = $3',
      [status, id, businessId]
    );

    // Fetch updated record
    const updatedAccount = await dbGet(
      'SELECT * FROM accounts_payable WHERE id = $1',
      [id]
    );

    res.json(updatedAccount);
  } catch (error) {
    console.error('Error updating account status:', error);
    res.status(500).json({ error: 'Failed to update account status' });
  }
});

// GET /api/accounts-payable/upcoming - Get upcoming bills due in next 7 days
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const businessId = req.user?.userId;
    const { days = 7 } = req.query;

    const upcomingBills = await dbAll(`
      SELECT 
        *,
        julianday(due_date) - julianday('now') as days_until_due
      FROM accounts_payable 
      WHERE business_id = ? 
        AND status IN ('pending', 'partial') 
        AND julianday(due_date) - julianday('now') BETWEEN 0 AND ?
      ORDER BY due_date ASC
    `, [businessId, days]);

    res.json(upcomingBills);
  } catch (error) {
    console.error('Error fetching upcoming bills:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming bills' });
  }
});

// GET /api/accounts-payable/overdue - Get overdue bills
router.get('/overdue', async (req: Request, res: Response) => {
  try {
    const businessId = req.user?.userId;

    const overdueBills = await dbAll(`
      SELECT 
        *,
        julianday('now') - julianday(due_date) as days_overdue
      FROM accounts_payable 
      WHERE business_id = ? 
        AND status IN ('pending', 'partial', 'overdue') 
        AND julianday('now') > julianday(due_date)
      ORDER BY days_overdue DESC
    `, [businessId]);

    res.json(overdueBills);
  } catch (error) {
    console.error('Error fetching overdue bills:', error);
    res.status(500).json({ error: 'Failed to fetch overdue bills' });
  }
});

export default router;
