"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = express_1.default.Router();
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const rows = await (0, database_1.dbAll)(`
      SELECT 
        s.*, 
        p.description as purchase_description,
        p.category as purchase_category,
        p.date as purchase_date
      FROM sales s
      LEFT JOIN purchases p ON s.purchase_id = p.id
      WHERE s.user_id = ?
      ORDER BY s.date DESC, s.created_at DESC
    `, [userId]);
        res.json({
            success: true,
            data: {
                sales: rows,
                total: rows.length
            }
        });
    }
    catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sales'
        });
    }
});
router.get('/summary', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const summary = await (0, database_1.dbGet)(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(selling_price), 0) as total_revenue,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(AVG(profit_percentage), 0) as avg_profit_percentage,
        COALESCE(SUM(CASE WHEN date >= date('now', '-30 days') THEN selling_price ELSE 0 END), 0) as monthly_revenue,
        COALESCE(SUM(CASE WHEN date >= date('now', '-30 days') THEN profit ELSE 0 END), 0) as monthly_profit
      FROM sales 
      WHERE user_id = ? AND status = 'completed'
    `, [userId]);
        res.json({
            success: true,
            data: summary
        });
    }
    catch (error) {
        console.error('Error fetching sales summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sales summary'
        });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const saleId = req.params.id;
        const sale = await (0, database_1.dbGet)(`
      SELECT 
        s.*, 
        p.description as purchase_description,
        p.category as purchase_category,
        p.date as purchase_date
      FROM sales s
      LEFT JOIN purchases p ON s.purchase_id = p.id
      WHERE s.id = ? AND s.user_id = ?
    `, [saleId, userId]);
        if (!sale) {
            return res.status(404).json({
                success: false,
                message: 'Sale not found'
            });
        }
        res.json({
            success: true,
            data: sale
        });
    }
    catch (error) {
        console.error('Error fetching sale:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sale'
        });
    }
});
router.post('/', auth_1.authenticateToken, validation_1.validateSale, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { purchase_id, amount, selling_price, description, customer_name, customer_contact, payment_method, date, status = 'completed', notes } = req.body;
        const result = await (0, database_1.dbRun)(`
      INSERT INTO sales 
      (user_id, purchase_id, amount, selling_price, description, customer_name, customer_contact, payment_method, date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, purchase_id || null, amount, selling_price, description, customer_name, customer_contact, payment_method, date, status, notes]);
        const saleId = result.lastID;
        await (0, database_1.dbRun)(`
      INSERT INTO transactions 
      (user_id, transaction_type, reference_id, reference_table, amount, description, date)
      VALUES (?, 'sale', ?, 'sales', ?, ?, ?)
    `, [userId, saleId, selling_price, description || 'Sale transaction', date]);
        const sale = await (0, database_1.dbGet)(`
      SELECT 
        s.*, 
        p.description as purchase_description,
        p.category as purchase_category,
        p.date as purchase_date
      FROM sales s
      LEFT JOIN purchases p ON s.purchase_id = p.id
      WHERE s.id = ?
    `, [saleId]);
        res.status(201).json({
            success: true,
            message: 'Sale created successfully',
            data: sale
        });
    }
    catch (error) {
        console.error('Error creating sale:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create sale'
        });
    }
});
router.put('/:id', auth_1.authenticateToken, validation_1.validateSale, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const saleId = req.params.id;
        const { purchase_id, amount, selling_price, description, customer_name, customer_contact, payment_method, date, status, notes } = req.body;
        const existing = await (0, database_1.dbGet)('SELECT id FROM sales WHERE id = ? AND user_id = ?', [saleId, userId]);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Sale not found'
            });
        }
        await (0, database_1.dbRun)(`
      UPDATE sales 
      SET purchase_id = ?, amount = ?, selling_price = ?, description = ?, 
          customer_name = ?, customer_contact = ?, payment_method = ?, 
          date = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [purchase_id || null, amount, selling_price, description, customer_name, customer_contact, payment_method, date, status, notes, saleId, userId]);
        await (0, database_1.dbRun)(`
      UPDATE transactions 
      SET amount = ?, description = ?, date = ?
      WHERE reference_id = ? AND reference_table = 'sales' AND user_id = ?
    `, [selling_price, description || 'Sale transaction', date, saleId, userId]);
        const sale = await (0, database_1.dbGet)(`
      SELECT 
        s.*, 
        p.description as purchase_description,
        p.category as purchase_category,
        p.date as purchase_date
      FROM sales s
      LEFT JOIN purchases p ON s.purchase_id = p.id
      WHERE s.id = ?
    `, [saleId]);
        res.json({
            success: true,
            message: 'Sale updated successfully',
            data: sale
        });
    }
    catch (error) {
        console.error('Error updating sale:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update sale'
        });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const saleId = req.params.id;
        const existing = await (0, database_1.dbGet)('SELECT id FROM sales WHERE id = ? AND user_id = ?', [saleId, userId]);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Sale not found'
            });
        }
        await (0, database_1.dbRun)(`
      DELETE FROM transactions 
      WHERE reference_id = ? AND reference_table = 'sales' AND user_id = ?
    `, [saleId, userId]);
        await (0, database_1.dbRun)('DELETE FROM sales WHERE id = ? AND user_id = ?', [saleId, userId]);
        res.json({
            success: true,
            message: 'Sale deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting sale:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete sale'
        });
    }
});
router.get('/available/purchases', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const rows = await (0, database_1.dbAll)(`
      SELECT p.*
      FROM purchases p
      LEFT JOIN sales s ON p.id = s.purchase_id
      WHERE p.user_id = ? AND s.purchase_id IS NULL
      ORDER BY p.date DESC, p.created_at DESC
    `, [userId]);
        res.json({
            success: true,
            data: {
                purchases: rows,
                total: rows.length
            }
        });
    }
    catch (error) {
        console.error('Error fetching available purchases:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch available purchases'
        });
    }
});
exports.default = router;
