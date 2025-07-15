import express from 'express';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Helper function to generate invoice number
const generateInvoiceNumber = async (businessId: number): Promise<string> => {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  
  const count = await dbGet(`
    SELECT COUNT(*) as count 
    FROM accounts_receivable 
    WHERE business_id = ? AND strftime('%Y', invoice_date) = ? 
    AND strftime('%m', invoice_date) = ?
  `, [businessId, year.toString(), month.toString().padStart(2, '0')]);
  
  const nextNumber = (count.count + 1).toString().padStart(4, '0');
  return `INV-${year}${month.toString().padStart(2, '0')}-${nextNumber}`;
};

// Helper function to update account status based on balance
const updateAccountStatus = async (id: number) => {
  const account = await dbGet('SELECT amount, paid_amount FROM accounts_receivable WHERE id = $1', [id]);
  
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
  
  await dbRun('UPDATE accounts_receivable SET status = ? WHERE id = $2', [status, id]);
};

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
      SELECT * FROM accounts_receivable 
      WHERE business_id = ? `;
    const params: any[] = [businessId];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status as string);
    }

    if (customer_name) {
      query += ' AND customer_name LIKE ?';
      params.push(`%${customer_name as string}%`);
    }

    if (date_from && date_to) {
      query += ' AND invoice_date BETWEEN ? AND ?';
      params.push(date_from as string, date_to as string);
    }

    if (overdue_only === 'true') {
      query += ' AND due_date < date("now") AND status != "paid"';
    }

    query += ' ORDER BY invoice_date DESC, created_at DESC';

    // Add pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query += ` LIMIT ? OFFSET $2`;
    params.push(parseInt(limit as string), offset);

    const accounts = await dbAll(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM accounts_receivable 
      WHERE business_id = ? `;
    const countParams : any[] = [businessId];

    if (status && status !== 'all') {
      countQuery += ' AND status = ?';
      countParams.push(status as string);
    }

    if (customer_name) {
      countQuery += ' AND customer_name LIKE ?';
      countParams.push(`%${customer_name as string}%`);
    }

    if (date_from && date_to) {
      countQuery += ' AND invoice_date BETWEEN ? AND ?';
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
    console.error('Error fetching accounts receivable:', error);
    res.status(500).json({ error: 'Failed to fetch accounts receivable' });
  }
});

// GET /api/accounts-receivable/:id - Get single account receivable
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;

    const account = await dbGet(
      'SELECT * FROM accounts_receivable WHERE id = ? AND business_id = $2',
      [id, businessId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Account receivable not found' });
    }

    // Get payment history
    const payments = await dbAll(
      'SELECT * FROM payment_records WHERE record_type = "receivable" AND record_id = ? ORDER BY payment_date DESC',
      [id]
    );

    res.json({
      ...account,
      payments
    });
  } catch (error) {
    console.error('Error fetching account receivable:', error);
    res.status(500).json({ error: 'Failed to fetch account receivable' });
  }
});

// POST /api/accounts-receivable - Create new account receivable
router.post('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user?.userId;
    const {
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      invoice_number,
      invoice_date,
      due_date,
      amount,
      payment_terms,
      description,
      notes
    } = req.body;

    // Validate required fields
    if (!customer_name || !invoice_date || !due_date || !amount) {
      return res.status(400).json({ 
        error: 'Customer name, invoice date, due date, and amount are required' 
      });
    }

    // Generate invoice number if not provided
    const finalInvoiceNumber = invoice_number || await generateInvoiceNumber(businessId!);

    // Check if invoice number already exists
    const existingInvoice = await dbGet(
      'SELECT id FROM accounts_receivable WHERE invoice_number = ? AND business_id = $2',
      [finalInvoiceNumber, businessId]
    );

    if (existingInvoice) {
      return res.status(400).json({ error: 'Invoice number already exists' });
    }

    // Determine initial status
    const invoiceDueDate = new Date(due_date);
    const today = new Date();
    const status = today > invoiceDueDate ? 'overdue' : 'pending';

    // Create account receivable
    const result = await dbRun(`
      INSERT INTO accounts_receivable (
        business_id, customer_name, customer_email, customer_phone, customer_address,
        invoice_number, invoice_date, due_date, amount, status,
        payment_terms, description, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      businessId, customer_name, customer_email, customer_phone, customer_address,
      finalInvoiceNumber, invoice_date, due_date, amount, status,
      payment_terms, description, notes
    ]);

    // Fetch the created record
    const newAccount = await dbGet(
      'SELECT * FROM accounts_receivable WHERE id = ?',
      [result.rows?.[0]?.id]
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
    const businessId = req.user?.userId;
    const {
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      invoice_number,
      invoice_date,
      due_date,
      amount,
      payment_terms,
      description,
      notes
    } = req.body;

    // Check if account exists and belongs to this business
    const existingAccount = await dbGet(
      'SELECT * FROM accounts_receivable WHERE id = ? AND business_id = $2',
      [id, businessId]
    );

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account receivable not found' });
    }

    // Don't allow updating if fully paid
    if (existingAccount.status === 'paid') {
      return res.status(400).json({ error: 'Cannot update fully paid invoice' });
    }

    // Check if invoice number is being changed and already exists
    if (invoice_number && invoice_number !== existingAccount.invoice_number) {
      const duplicateInvoice = await dbGet(
        'SELECT id FROM accounts_receivable WHERE invoice_number = ? AND business_id = ? AND id != $3',
        [invoice_number, businessId, id]
      );
      if (duplicateInvoice) {
        return res.status(400).json({ error: 'Invoice number already exists' });
      }
    }

    // Update account receivable
    await dbRun(`
      UPDATE accounts_receivable SET
        customer_name = $1, customer_email = $2, customer_phone = $3, customer_address = $4,
        invoice_number = $5, invoice_date = $6, due_date = $7, amount = $8,
        balance_amount = amount - paid_amount, payment_terms = $9, description = $10, notes = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ? `, [
      customer_name || existingAccount.customer_name,
      customer_email || existingAccount.customer_email,
      customer_phone || existingAccount.customer_phone,
      customer_address || existingAccount.customer_address,
      invoice_number || existingAccount.invoice_number,
      invoice_date || existingAccount.invoice_date,
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
      'SELECT * FROM accounts_receivable WHERE id = ?',
      [id]
    );

    res.json(updatedAccount);
  } catch (error) {
    console.error('Error updating account receivable:', error);
    res.status(500).json({ error: 'Failed to update account receivable' });
  }
});

// POST /api/accounts-receivable/:id/payment - Record payment
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
      'SELECT * FROM accounts_receivable WHERE id = ? AND business_id = $2',
      [id, businessId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Account receivable not found' });
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
      ) VALUES ($1, 'receivable', ?, ?, ?, ?, ?, ?)
    `, [businessId, id, payment_date, amount, payment_method, reference_number, notes]);

    // Update paid amount
    const newPaidAmount = account.paid_amount + parseFloat(amount);
    await dbRun(
      'UPDATE accounts_receivable SET paid_amount = ? WHERE id = $2',
      [newPaidAmount, id]
    );

    // Update status
    await updateAccountStatus(parseInt(id));

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

// DELETE /api/accounts-receivable/:id - Delete account receivable
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;

    // Check if account exists and belongs to this business
    const account = await dbGet(
      'SELECT paid_amount FROM accounts_receivable WHERE id = ? AND business_id = $2',
      [id, businessId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Account receivable not found' });
    }

    // Don't allow deleting if payments have been made
    if (account.paid_amount > 0) {
      return res.status(400).json({ error: 'Cannot delete invoice with recorded payments' });
    }

    // Delete account receivable and related payment records
    await dbRun('DELETE FROM payment_records WHERE record_type = "receivable" AND record_id = $1', [id]);
    await dbRun('DELETE FROM accounts_receivable WHERE id = ? AND business_id = $2', [id, businessId]);

    res.json({ message: 'Account receivable deleted successfully' });
  } catch (error) {
    console.error('Error deleting account receivable:', error);
    res.status(500).json({ error: 'Failed to delete account receivable' });
  }
});

// GET /api/accounts-receivable/stats/summary - Get accounts receivable summary
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const businessId = req.user?.userId;

    const summary = await dbGet(`
      SELECT 
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invoices,
        COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_invoices,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_invoices,
        ROUND(SUM(amount), 2) as total_amount,
        ROUND(SUM(paid_amount), 2) as total_paid,
        ROUND(SUM(balance_amount), 2) as total_outstanding,
        ROUND(SUM(CASE WHEN status = 'overdue' THEN balance_amount ELSE 0 END), 2) as overdue_amount
      FROM accounts_receivable 
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
      FROM accounts_receivable 
      WHERE business_id = ?
    `, [businessId]);

    res.json({
      ...summary,
      aging
    });
  } catch (error) {
    console.error('Error fetching accounts receivable summary:', error);
    res.status(500).json({ error: 'Failed to fetch accounts receivable summary' });
  }
});

// GET /api/accounts-receivable/stats/customers - Get top customers by outstanding balance
router.get('/stats/customers', async (req: Request, res: Response) => {
  try {
    const businessId = req.user?.userId;

    const customers = await dbAll(`
      SELECT 
        customer_name,
        customer_email,
        COUNT(*) as total_invoices,
        ROUND(SUM(amount), 2) as total_invoiced,
        ROUND(SUM(paid_amount), 2) as total_paid,
        ROUND(SUM(balance_amount), 2) as outstanding_balance,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_invoices
      FROM accounts_receivable 
      WHERE business_id = ?
      GROUP BY customer_name, customer_email
      HAVING outstanding_balance > 0
      ORDER BY outstanding_balance DESC
      LIMIT 10
    `, [businessId]);

    res.json(customers);
  } catch (error) {
    console.error('Error fetching customer statistics:', error);
    res.status(500).json({ error: 'Failed to fetch customer statistics' });
  }
});

// PUT /api/accounts-receivable/:id/status - Update account status
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
      'SELECT * FROM accounts_receivable WHERE id = ? AND business_id = $2',
      [id, businessId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Account receivable not found' });
    }

    // Update status
    await dbRun(
      'UPDATE accounts_receivable SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = $3',
      [status, id, businessId]
    );

    // Fetch updated record
    const updatedAccount = await dbGet(
      'SELECT * FROM accounts_receivable WHERE id = $1',
      [id]
    );

    res.json(updatedAccount);
  } catch (error) {
    console.error('Error updating account status:', error);
    res.status(500).json({ error: 'Failed to update account status' });
  }
});

export default router;
