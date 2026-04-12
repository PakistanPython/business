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
        const { status, vendor_name, date_from, date_to, overdue_only, page = 1, limit = 20 } = req.query;
        let query = `
      SELECT * FROM accounts_payable 
      WHERE business_id = $1`;
        const params = [businessId];
        let paramIndex = 2;
        if (status && status !== 'all') {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        if (vendor_name) {
            query += ` AND vendor_name LIKE $${paramIndex++}`;
            params.push(`%${vendor_name}%`);
        }
        if (date_from && date_to) {
            query += ` AND due_date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
            params.push(date_from, date_to);
        }
        if (overdue_only === 'true') {
            query += ' AND due_date < NOW() AND paid = false';
        }
        query += ' ORDER BY due_date DESC, created_at DESC';
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), offset);
        const accounts = await (0, database_1.dbAll)(query, params);
        let countQuery = `
      SELECT COUNT(*) as total
      FROM accounts_payable 
      WHERE business_id = $1`;
        const countParams = [businessId];
        let countParamIndex = 2;
        if (status && status !== 'all') {
            countQuery += ` AND status = $${countParamIndex++}`;
            countParams.push(status);
        }
        if (vendor_name) {
            countQuery += ` AND vendor_name LIKE $${countParamIndex++}`;
            countParams.push(`%${vendor_name}%`);
        }
        if (date_from && date_to) {
            countQuery += ` AND due_date BETWEEN $${countParamIndex++} AND $${countParamIndex++}`;
            countParams.push(date_from, date_to);
        }
        if (overdue_only === 'true') {
            countQuery += ' AND due_date < NOW() AND paid = false';
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
        const account = await (0, database_1.dbGet)('SELECT * FROM accounts_payable WHERE id = $1 AND business_id = $2', [id, businessId]);
        if (!account) {
            return res.status(404).json({ error: 'Account payable not found' });
        }
        res.json(account);
    }
    catch (error) {
        console.error('Error fetching account payable:', error);
        res.status(500).json({ error: 'Failed to fetch account payable' });
    }
});
router.post('/', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { vendor_name, amount, due_date, } = req.body;
        if (!vendor_name || !due_date || !amount) {
            return res.status(400).json({
                error: 'Vendor name, due date, and amount are required'
            });
        }
        const result = await (0, database_1.dbRun)(`
      INSERT INTO accounts_payable (
        business_id, vendor_name, amount, due_date
      ) VALUES ($1, $2, $3, $4) RETURNING id
    `, [
            businessId, vendor_name, amount, due_date
        ]);
        const newAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_payable WHERE id = $1', [result.lastID]);
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
        const { vendor_name, amount, due_date, paid } = req.body;
        const existingAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_payable WHERE id = $1 AND business_id = $2', [id, businessId]);
        if (!existingAccount) {
            return res.status(404).json({ error: 'Account payable not found' });
        }
        await (0, database_1.dbRun)(`
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
        const updatedAccount = await (0, database_1.dbGet)('SELECT * FROM accounts_payable WHERE id = $1', [id]);
        res.json(updatedAccount);
    }
    catch (error) {
        console.error('Error updating account payable:', error);
        res.status(500).json({ error: 'Failed to update account payable' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const account = await (0, database_1.dbGet)('SELECT paid FROM accounts_payable WHERE id = $1 AND business_id = $2', [id, businessId]);
        if (!account) {
            return res.status(404).json({ error: 'Account payable not found' });
        }
        if (account.paid) {
            return res.status(400).json({ error: 'Cannot delete paid bill' });
        }
        await (0, database_1.dbRun)('DELETE FROM accounts_payable WHERE id = $1 AND business_id = $2', [id, businessId]);
        res.json({ message: 'Account payable deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting account payable:', error);
        res.status(500).json({ error: 'Failed to delete account payable' });
    }
});
exports.default = router;
