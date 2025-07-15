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
const generateBillNumber = async (businessId) => {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const count = await (0, database_1.dbGet)(`
    SELECT COUNT(*) as count 
    FROM accounts_payable 
    WHERE business_id = AND strftime('%Y', bill_date) = AND strftime('%m', bill_date) = `, [businessId, year.toString(), month.toString().padStart(2, '0')]);
    const nextNumber = (count.count + 1).toString().padStart(4, '0');
    return `BILL-${year}${month.toString().padStart(2, '0')}-${nextNumber}`;
};
const updateAccountStatus = async (id) => {
    const account = await (0, database_1.dbGet)('SELECT amount, paid_amount, due_date FROM accounts_payable WHERE id = $1', [id]);
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
    await (0, database_1.dbRun)('UPDATE accounts_payable SET status = WHERE id = $2', [status, id]);
};
router.get('/', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { status, vendor_name, date_from, date_to, overdue_only, page = 1, limit = 20 } = req.query;
        let query = `
      SELECT * FROM accounts_payable 
      WHERE business_id = `;
        const params = [businessId];
        if (status && status !== 'all') {
            query += ' AND status = ?';
            params.push(status);
        }
        if (vendor_name) {
            query += ' AND vendor_name LIKE ?';
            params.push(`%${vendor_name}%`);
        }
        if (date_from && date_to) {
            query += ' AND bill_date BETWEEN ? AND $2';
            params.push(date_from, date_to);
        }
        if (overdue_only === 'true') {
            query += ' AND due_date < date("now") AND status != "paid"';
        }
        query += ' ORDER BY bill_date DESC, created_at DESC';
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT OFFSET $2`;
        params.push(parseInt(limit), offset);
        const accounts = await (0, database_1.dbAll)(query, params);
        let countQuery = `
      SELECT COUNT(*) as total
      FROM accounts_payable 
      WHERE business_id = `;
        const countParams = [businessId];
        if (status && status !== 'all') {
            countQuery += ' AND status = $4';
            countParams.push(status);
        }
        if (vendor_name) {
            countQuery += ' AND vendor_name LIKE $5';
            countParams.push(`%${vendor_name}%`);
        }
        if (date_from && date_to) {
            countQuery += ' AND bill_date BETWEEN ? AND $7';
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
        console.error('Error fetching accounts payable:', error);
        res.status(500).json({ error: 'Failed to fetch accounts payable' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const account = await (0, database_1.dbGet)('SELECT * FROM accounts_payable WHERE id = AND business_id = $2', [id, businessId]);
        if (!account) {
            return res.status(404).json({ error: 'Account payable not found' });
        }
        const payments = await (0, database_1.dbAll)('SELECT * FROM payment_records WHERE record_type = "payable" AND record_id = ORDER BY payment_date DESC', [id]);
        res.json({
            ...account,
            payments
        });
    }
    catch (error) {
        console.error('Error fetching account payable:', error);
        res.status(500).json({ error: 'Failed to fetch account payable' });
    }
});
router.post('/', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { vendor_name, vendor_email, vendor_phone, vendor_address, bill_number, bill_date, due_date, amount, payment_terms, description, notes } = req.body;
        if (!vendor_name || !bill_date || !due_date || !amount) {
            return res.status(400).json({
                error: 'Vendor name, bill date, due date, and amount are required'
            });
        }
        const finalBillNumber = bill_number || await generateBillNumber(businessId);
        const existingBill = await (0, database_1.dbGet)('SELECT id FROM accounts_payable WHERE bill_number = AND business_id = $2', [finalBillNumber, businessId]);
        if (existingBill) {
            return res.status(400).json({ error: 'Bill number already exists' });
        }
        const billDueDate = new Date(due_date);
        const today = new Date();
        const status = today > billDueDate ? 'overdue' : 'pending';
        const result = await (0, database_1.dbRun)(`
      INSERT INTO accounts_payable (
        business_id, vendor_name, vendor_email, vendor_phone, vendor_address,
        bill_number, bill_date, due_date, amount, balance_amount, status,
        payment_terms, description, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id
    `, [
            businessId, vendor_name, vendor_email, vendor_phone, vendor_address,
            finalBillNumber, bill_date, due_date, amount, amount, status,
            payment_terms, description, notes
        ]);
        const newAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_payable WHERE id = $3', [result.lastID]);
        res.status(201).json(newAccount);
    }
    catch (error) {
        console.error('Error creating account payable:', error);
        res.status(500).json({ error: 'Failed to create account payable' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const { vendor_name, vendor_email, vendor_phone, vendor_address, bill_number, bill_date, due_date, amount, payment_terms, description, notes } = req.body;
        const existingAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_payable WHERE id = AND business_id = $2', [id, businessId]);
        if (!existingAccount) {
            return res.status(404).json({ error: 'Account payable not found' });
        }
        if (existingAccount.status === 'paid') {
            return res.status(400).json({ error: 'Cannot update fully paid bill' });
        }
        if (bill_number && bill_number !== existingAccount.bill_number) {
            const duplicateBill = await (0, database_1.dbGet)('SELECT id FROM accounts_payable WHERE bill_number = AND business_id = AND id != $3', [bill_number, businessId, id]);
            if (duplicateBill) {
                return res.status(400).json({ error: 'Bill number already exists' });
            }
        }
        await (0, database_1.dbRun)(`
      UPDATE accounts_payable SET
        vendor_name = $1, vendor_email = $2, vendor_phone = $3, vendor_address = $4,
        bill_number = $5, bill_date = $6, due_date = $7, amount = $8,
        balance_amount = amount - paid_amount, payment_terms = $9, description = $10, notes = $11,
        updated_at = NOW()
      WHERE id = AND business_id = `, [
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
        await updateAccountStatus(parseInt(id));
        const updatedAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_payable WHERE id = $5', [id]);
        res.json(updatedAccount);
    }
    catch (error) {
        console.error('Error updating account payable:', error);
        res.status(500).json({ error: 'Failed to update account payable' });
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
        const account = await (0, database_1.dbGet)('SELECT * FROM accounts_payable WHERE id = AND business_id = $2', [id, businessId]);
        if (!account) {
            return res.status(404).json({ error: 'Account payable not found' });
        }
        const remainingBalance = account.amount - account.paid_amount;
        if (amount > remainingBalance) {
            return res.status(400).json({ error: 'Payment amount exceeds remaining balance' });
        }
        await (0, database_1.dbRun)(`
      INSERT INTO payment_records (
        business_id, record_type, record_id, payment_date, amount,
        payment_method, reference_number, notes
      ) VALUES ($1, 'payable', $1, $2, $3, $4, $5, $6)
    `, [businessId, id, payment_date, amount, payment_method, reference_number, notes]);
        const newPaidAmount = account.paid_amount + parseFloat(amount);
        await (0, database_1.dbRun)('UPDATE accounts_payable SET paid_amount = WHERE id = $8', [newPaidAmount, id]);
        await updateAccountStatus(parseInt(id));
        const updatedAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_payable WHERE id = $9', [id]);
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
        const account = await (0, database_1.dbGet)('SELECT paid_amount FROM accounts_payable WHERE id = AND business_id = $2', [id, businessId]);
        if (!account) {
            return res.status(404).json({ error: 'Account payable not found' });
        }
        if (account.paid_amount > 0) {
            return res.status(400).json({ error: 'Cannot delete bill with recorded payments' });
        }
        await (0, database_1.dbRun)('DELETE FROM payment_records WHERE record_type = "payable" AND record_id = $1', [id]);
        await (0, database_1.dbRun)('DELETE FROM accounts_payable WHERE id = AND business_id = $2', [id, businessId]);
        res.json({ message: 'Account payable deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting account payable:', error);
        res.status(500).json({ error: 'Failed to delete account payable' });
    }
});
router.get('/stats/summary', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const summary = await (0, database_1.dbGet)(`
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
      FROM accounts_payable 
      WHERE business_id = `, [businessId]);
        res.json({
            ...summary,
            aging
        });
    }
    catch (error) {
        console.error('Error fetching accounts payable summary:', error);
        res.status(500).json({ error: 'Failed to fetch accounts payable summary' });
    }
});
router.get('/stats/vendors', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const vendors = await (0, database_1.dbAll)(`
      SELECT 
        vendor_name,
        vendor_email,
        COUNT(*) as total_bills,
        ROUND(SUM(amount), 2) as total_billed,
        ROUND(SUM(paid_amount), 2) as total_paid,
        ROUND(SUM(balance_amount), 2) as outstanding_balance,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_bills
      FROM accounts_payable 
      WHERE business_id = GROUP BY vendor_name, vendor_email
      HAVING outstanding_balance > 0
      ORDER BY outstanding_balance DESC
      LIMIT 10
    `, [businessId]);
        res.json(vendors);
    }
    catch (error) {
        console.error('Error fetching vendor statistics:', error);
        res.status(500).json({ error: 'Failed to fetch vendor statistics' });
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
        const account = await (0, database_1.dbGet)('SELECT * FROM accounts_payable WHERE id = AND business_id = $2', [id, businessId]);
        if (!account) {
            return res.status(404).json({ error: 'Account payable not found' });
        }
        await (0, database_1.dbRun)('UPDATE accounts_payable SET status = ?, updated_at = NOW() WHERE id = ? AND business_id = ?', [status, id, businessId]);
        const updatedAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_payable WHERE id = ?', [id]);
        res.json(updatedAccount);
    }
    catch (error) {
        console.error('Error updating account status:', error);
        res.status(500).json({ error: 'Failed to update account status' });
    }
});
router.get('/upcoming', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { days = 7 } = req.query;
        const upcomingBills = await (0, database_1.dbAll)(`
      SELECT 
        *,
        julianday(due_date) - julianday('now') as days_until_due
      FROM accounts_payable 
      WHERE business_id = AND status IN ('pending', 'partial') 
        AND julianday(due_date) - julianday('now') BETWEEN 0 AND ? ORDER BY due_date ASC
    `, [businessId, days]);
        res.json(upcomingBills);
    }
    catch (error) {
        console.error('Error fetching upcoming bills : ', error);
        res.status(500).json({ error: 'Failed to fetch upcoming bills' });
    }
});
router.get('/overdue', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const overdueBills = await (0, database_1.dbAll)(`
      SELECT 
        *,
        julianday('now') - julianday(due_date) as days_overdue
      FROM accounts_payable 
      WHERE business_id = AND status IN ('pending', 'partial', 'overdue') 
        AND julianday('now') > julianday(due_date)
      ORDER BY days_overdue DESC
    `, [businessId]);
        res.json(overdueBills);
    }
    catch (error) {
        console.error('Error fetching overdue bills:', error);
        res.status(500).json({ error: 'Failed to fetch overdue bills' });
    }
});
exports.default = router;
