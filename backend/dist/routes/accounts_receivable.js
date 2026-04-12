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
router.get('/', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { status, customer_name, date_from, date_to, overdue_only, page = 1, limit = 20 } = req.query;
        let query = `
      SELECT 
        ar.*,
        ar.amount - ar.paid_amount as balance_amount
      FROM accounts_receivable ar
      WHERE ar.business_id = $1`;
        const params = [businessId];
        let paramIndex = 2;
        if (status && status !== 'all') {
            if (status === 'paid') {
                query += ` AND ar.received = true`;
            }
            else if (status === 'pending') {
                query += ` AND ar.received = false`;
            }
        }
        if (customer_name) {
            query += ` AND customer_name LIKE $${paramIndex++}`;
            params.push(`%${customer_name}%`);
        }
        if (date_from && date_to) {
            query += ` AND due_date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
            params.push(date_from, date_to);
        }
        if (overdue_only === 'true') {
            query += ' AND due_date < NOW() AND received = false';
        }
        query += ' ORDER BY due_date DESC, created_at DESC';
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), offset);
        const accounts = await (0, database_1.dbAll)(query, params);
        let countQuery = `
      SELECT COUNT(*) as total
      FROM accounts_receivable ar
      WHERE ar.business_id = $1`;
        const countParams = [businessId];
        let countParamIndex = 2;
        if (status && status !== 'all') {
            if (status === 'paid') {
                countQuery += ` AND ar.received = true`;
            }
            else if (status === 'pending') {
                countQuery += ` AND ar.received = false`;
            }
        }
        if (customer_name) {
            countQuery += ` AND customer_name LIKE $${countParamIndex++}`;
            countParams.push(`%${customer_name}%`);
        }
        if (date_from && date_to) {
            countQuery += ` AND due_date BETWEEN $${countParamIndex++} AND $${countParamIndex++}`;
            countParams.push(date_from, date_to);
        }
        if (overdue_only === 'true') {
            countQuery += ' AND due_date < NOW() AND received = false';
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
        const account = await (0, database_1.dbGet)('SELECT *, amount - paid_amount as balance_amount FROM accounts_receivable WHERE id = $1 AND business_id = $2', [id, businessId]);
        if (!account) {
            return res.status(404).json({ error: 'Account receivable not found' });
        }
        res.json(account);
    }
    catch (error) {
        console.error('Error fetching account receivable:', error);
        res.status(500).json({ error: 'Failed to fetch account receivable' });
    }
});
router.post('/', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { customer_name, amount, due_date, customer_email, customer_phone, customer_address, payment_terms, description, notes } = req.body;
        if (!customer_name || !due_date || !amount) {
            return res.status(400).json({
                error: 'Customer name, due date, and amount are required'
            });
        }
        const result = await (0, database_1.dbRun)(`
      INSERT INTO accounts_receivable (
        business_id, customer_name, amount, due_date, customer_email, customer_phone, customer_address, payment_terms, description, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
    `, [
            businessId, customer_name, amount, due_date, customer_email, customer_phone, customer_address, payment_terms, description, notes
        ]);
        const newAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = $1', [result.lastID]);
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
        const { customer_name, amount, due_date, received } = req.body;
        const existingAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = $1 AND business_id = $2', [id, businessId]);
        if (!existingAccount) {
            return res.status(404).json({ error: 'Account receivable not found' });
        }
        await (0, database_1.dbRun)(`
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
        const updatedAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = $1', [id]);
        res.json(updatedAccount);
    }
    catch (error) {
        console.error('Error updating account receivable:', error);
        res.status(500).json({ error: 'Failed to update account receivable' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const account = await (0, database_1.dbGet)('SELECT received FROM accounts_receivable WHERE id = $1 AND business_id = $2', [id, businessId]);
        if (!account) {
            return res.status(404).json({ error: 'Account receivable not found' });
        }
        if (account.received) {
            return res.status(400).json({ error: 'Cannot delete received invoice' });
        }
        await (0, database_1.dbRun)('DELETE FROM accounts_receivable WHERE id = $1 AND business_id = $2', [id, businessId]);
        res.json({ message: 'Account receivable deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting account receivable:', error);
        res.status(500).json({ error: 'Failed to delete account receivable' });
    }
});
router.post('/:id/payment', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const { amount, payment_date, payment_method, notes } = req.body;
        const existingAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = $1 AND business_id = $2', [id, businessId]);
        if (!existingAccount) {
            return res.status(404).json({ error: 'Account receivable not found' });
        }
        const newPaidAmount = Number(existingAccount.paid_amount) + Number(amount);
        const newStatus = newPaidAmount >= existingAccount.amount ? 'paid' : 'partial';
        await (0, database_1.dbRun)(`
      UPDATE accounts_receivable SET
        paid_amount = $1,
        status = $2,
        updated_at = NOW()
      WHERE id = $3 AND business_id = $4`, [newPaidAmount, newStatus, id, businessId]);
        const updatedAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_receivable WHERE id = $1', [id]);
        res.json(updatedAccount);
    }
    catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ error: 'Failed to record payment' });
    }
});
router.get('/stats/summary', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const summary = await (0, database_1.dbGet)(`
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
    }
    catch (error) {
        console.error('Error fetching accounts receivable summary:', error);
        res.status(500).json({ error: 'Failed to fetch accounts receivable summary' });
    }
});
exports.default = router;
