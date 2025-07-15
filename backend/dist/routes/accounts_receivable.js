"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
const generateInvoiceNumber = async (businessId) => {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const count = await (0, database_1.dbGet)(`
    SELECT COUNT(*) as count 
    FROM accounts_receivable 
    WHERE business_id = AND strftime('%Y', invoice_date) = AND strftime('%m', invoice_date) = `, [businessId, year.toString(), month.toString().padStart(2, '0')]);
    const nextNumber = (count.count + 1).toString().padStart(4, '0');
    return `INV-${year}${month.toString().padStart(2, '0')}-${nextNumber}`;
};
const updateAccountStatus = async (id) => {
    const account = await (0, database_1.dbGet)('SELECT amount, paid_amount FROM accounts_receivable WHERE id = $1', [id]);
    if (!account)
        return;
    let status = 'pending';
    const balanceAmount = account.amount - account.paid_amount;
    if (balanceAmount <= 0) {
        status = 'paid';
    }
    else if (account.paid_amount > 0) {
        status = 'partial';
    }
    else {
        const dueDate = new Date(account.due_date);
        const today = new Date();
        if (today > dueDate) {
            status = 'overdue';
        }
    }
    await (0, database_1.dbRun)('UPDATE accounts_receivable SET status = WHERE id = $2', [status, id]);
};
router.get('/', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { status, customer_name, date_from, date_to, overdue_only, page = 1, limit = 20 } = req.query;
        let query = `
      SELECT * FROM accounts_receivable 
      WHERE business_id = `;
        const params = [businessId];
        if (status && status !== 'all') {
            query += ' AND status = ?';
            params.push(status);
        }
        if (customer_name) {
            query += ' AND customer_name LIKE ?';
            params.push(`%${customer_name}%`);
        }
        if (date_from && date_to) {
            query += ' AND invoice_date BETWEEN ? AND $2';
            params.push(date_from, date_to);
        }
        if (overdue_only === 'true') {
            query += ' AND due_date < date("now") AND status != "paid"';
        }
        query += ' ORDER BY invoice_date DESC, created_at DESC';
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT OFFSET $2`;
        params.push(parseInt(limit), offset);
        const accounts = await (0, database_1.dbAll)(query, params);
        let countQuery = `
      SELECT COUNT(*) as total
      FROM accounts_receivable 
      WHERE business_id = `;
        const countParams = [businessId];
        if (status && status !== 'all') {
            countQuery += ' AND status = $4';
            countParams.push(status);
        }
        if (customer_name) {
            countQuery += ' AND customer_name LIKE $5';
            countParams.push(`%${customer_name}%`);
        }
        if (date_from && date_to) {
            countQuery += ' AND invoice_date BETWEEN ? AND $7';
            countParams.push(date_from, date_to);
        }
        if (overdue_only === 'true') {
            countQuery += ' AND due_date < date("now") AND status != "paid"';
        }
        const { total } = await (0, database_1.dbGet)(countQuery, countParams);
        res.json({
            accounts: accounts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching accounts receivable:', error);
        res.status(500).json({ error: 'Failed to fetch accounts receivable' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const account = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = AND business_id = $2', [id, businessId]);
        if (!account) {
            return res.status(404).json({ error: 'Account receivable not found' });
        }
        const payments = await (0, database_1.dbAll)('SELECT * FROM payment_records WHERE record_type = "receivable" AND record_id = ORDER BY payment_date DESC', [id]);
        res.json({
            ...account,
            payments
        });
    }
    catch (error) {
        console.error('Error fetching account receivable:', error);
        res.status(500).json({ error: 'Failed to fetch account receivable' });
    }
});
router.post('/', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { customer_name, customer_email, customer_phone, customer_address, invoice_number, invoice_date, due_date, amount, payment_terms, description, notes } = req.body;
        if (!customer_name || !invoice_date || !due_date || !amount) {
            return res.status(400).json({
                error: 'Customer name, invoice date, due date, and amount are required'
            });
        }
        const finalInvoiceNumber = invoice_number || await generateInvoiceNumber(businessId);
        const existingInvoice = await (0, database_1.dbGet)('SELECT id FROM accounts_receivable WHERE invoice_number = AND business_id = $2', [finalInvoiceNumber, businessId]);
        if (existingInvoice) {
            return res.status(400).json({ error: 'Invoice number already exists' });
        }
        const invoiceDueDate = new Date(due_date);
        const today = new Date();
        const status = today > invoiceDueDate ? 'overdue' : 'pending';
        const result = await (0, database_1.dbRun)(`
      INSERT INTO accounts_receivable (
        business_id, customer_name, customer_email, customer_phone, customer_address,
        invoice_number, invoice_date, due_date, amount, status,
        payment_terms, description, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id
    `, [
            businessId, customer_name, customer_email, customer_phone, customer_address,
            finalInvoiceNumber, invoice_date, due_date, amount, status,
            payment_terms, description, notes
        ]);
        const newAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = $3', [result.lastID]);
        res.status(201).json(newAccount);
    }
    catch (error) {
        console.error('Error creating account receivable:', error);
        res.status(500).json({ error: 'Failed to create account receivable' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const { customer_name, customer_email, customer_phone, customer_address, invoice_number, invoice_date, due_date, amount, payment_terms, description, notes } = req.body;
        const existingAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = AND business_id = $2', [id, businessId]);
        if (!existingAccount) {
            return res.status(404).json({ error: 'Account receivable not found' });
        }
        if (existingAccount.status === 'paid') {
            return res.status(400).json({ error: 'Cannot update fully paid invoice' });
        }
        if (invoice_number && invoice_number !== existingAccount.invoice_number) {
            const duplicateInvoice = await (0, database_1.dbGet)('SELECT id FROM accounts_receivable WHERE invoice_number = AND business_id = AND id != $3', [invoice_number, businessId, id]);
            if (duplicateInvoice) {
                return res.status(400).json({ error: 'Invoice number already exists' });
            }
        }
        await (0, database_1.dbRun)(`
      UPDATE accounts_receivable SET
        customer_name = $1, customer_email = $2, customer_phone = $3, customer_address = $4,
        invoice_number = $5, invoice_date = $6, due_date = $7, amount = $8,
        balance_amount = amount - paid_amount, payment_terms = $9, description = $10, notes = $11,
        updated_at = NOW()
      WHERE id = AND business_id = `, [
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
        await updateAccountStatus(parseInt(id));
        const updatedAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = $5', [id]);
        res.json(updatedAccount);
    }
    catch (error) {
        console.error('Error updating account receivable:', error);
        res.status(500).json({ error: 'Failed to update account receivable' });
    }
});
router.post('/:id/payment', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const { amount, payment_date, payment_method, reference_number, notes } = req.body;
        if (!amount || !payment_date) {
            return res.status(400).json({ error: 'Payment amount and date are required' });
        }
        const account = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = AND business_id = $2', [id, businessId]);
        if (!account) {
            return res.status(404).json({ error: 'Account receivable not found' });
        }
        const remainingBalance = account.amount - account.paid_amount;
        if (amount > remainingBalance) {
            return res.status(400).json({ error: 'Payment amount exceeds remaining balance' });
        }
        await (0, database_1.dbRun)(`
      INSERT INTO payment_records (
        business_id, record_type, record_id, payment_date, amount,
        payment_method, reference_number, notes
      ) VALUES ($1, 'receivable', $1, $2, $3, $4, $5, $6)
    `, [businessId, id, payment_date, amount, payment_method, reference_number, notes]);
        const newPaidAmount = account.paid_amount + parseFloat(amount);
        await (0, database_1.dbRun)('UPDATE accounts_receivable SET paid_amount = WHERE id = $8', [newPaidAmount, id]);
        await updateAccountStatus(parseInt(id));
        const updatedAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = $9', [id]);
        res.json(updatedAccount);
    }
    catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ error: 'Failed to record payment' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const account = await (0, database_1.dbGet)('SELECT paid_amount FROM accounts_receivable WHERE id = AND business_id = $2', [id, businessId]);
        if (!account) {
            return res.status(404).json({ error: 'Account receivable not found' });
        }
        if (account.paid_amount > 0) {
            return res.status(400).json({ error: 'Cannot delete invoice with recorded payments' });
        }
        await (0, database_1.dbRun)('DELETE FROM payment_records WHERE record_type = "receivable" AND record_id = $1', [id]);
        await (0, database_1.dbRun)('DELETE FROM accounts_receivable WHERE id = AND business_id = $2', [id, businessId]);
        res.json({ message: 'Account receivable deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting account receivable:', error);
        res.status(500).json({ error: 'Failed to delete account receivable' });
    }
});
router.get('/stats/summary', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const summary = await (0, database_1.dbGet)(`
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
      WHERE business_id = `, [businessId]);
        const aging = await (0, database_1.dbGet)(`
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
      WHERE business_id = `, [businessId]);
        res.json({
            ...summary,
            aging
        });
    }
    catch (error) {
        console.error('Error fetching accounts receivable summary:', error);
        res.status(500).json({ error: 'Failed to fetch accounts receivable summary' });
    }
});
router.get('/stats/customers', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const customers = await (0, database_1.dbAll)(`
      SELECT 
        customer_name,
        customer_email,
        COUNT(*) as total_invoices,
        ROUND(SUM(amount), 2) as total_invoiced,
        ROUND(SUM(paid_amount), 2) as total_paid,
        ROUND(SUM(balance_amount), 2) as outstanding_balance,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_invoices
      FROM accounts_receivable 
      WHERE business_id = GROUP BY customer_name, customer_email
      HAVING outstanding_balance > 0
      ORDER BY outstanding_balance DESC
      LIMIT 10
    `, [businessId]);
        res.json(customers);
    }
    catch (error) {
        console.error('Error fetching customer statistics:', error);
        res.status(500).json({ error: 'Failed to fetch customer statistics' });
    }
});
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const { status } = req.body;
        if (!['pending', 'partial', 'paid', 'overdue', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const account = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = AND business_id = $2', [id, businessId]);
        if (!account) {
            return res.status(404).json({ error: 'Account receivable not found' });
        }
        await (0, database_1.dbRun)('UPDATE accounts_receivable SET status = ?, updated_at = NOW() WHERE id = ? AND business_id = ?', [status, id, businessId]);
        const updatedAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = ?', [id]);
        res.json(updatedAccount);
    }
    catch (error) {
        console.error('Error updating account status:', error);
        res.status(500).json({ error: 'Failed to update account status' });
    }
});
exports.default = router;
