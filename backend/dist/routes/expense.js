"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
router.get('/', [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('category').optional().trim(),
    (0, express_validator_1.query)('start_date').optional().isISO8601().withMessage('Start date must be valid ISO date'),
    (0, express_validator_1.query)('end_date').optional().isISO8601().withMessage('End date must be valid ISO date'),
    (0, express_validator_1.query)('sort_by').optional().isIn(['date', 'amount', 'created_at']).withMessage('Invalid sort field'),
    (0, express_validator_1.query)('sort_order').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const category = req.query.category;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        const sortBy = req.query.sort_by || 'date';
        const sortOrder = req.query.sort_order || 'desc';
        let whereClause = 'WHERE user_id = ?';
        const whereParams = [userId];
        if (category) {
            whereClause += ' AND category = ?';
            whereParams.push(category);
        }
        if (startDate) {
            whereClause += ' AND date >= ?';
            whereParams.push(startDate);
        }
        if (endDate) {
            whereClause += ' AND date <= ?';
            whereParams.push(endDate);
        }
        const countResult = await (0, database_1.dbGet)(`SELECT COUNT(*) as total FROM expenses ${whereClause}`, whereParams);
        const total = countResult.total;
        const expenseRecords = await (0, database_1.dbAll)(`SELECT 
        id, amount, description, category, payment_method, date, 
        receipt_path, created_at, updated_at
       FROM expenses 
       ${whereClause} 
       ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
       LIMIT $1 OFFSET $2`, [...whereParams, limit, offset]);
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        res.json({
            success: true,
            data: {
                expenses: expenseRecords,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalRecords: total,
                    limit,
                    hasNext,
                    hasPrev
                }
            }
        });
    }
    catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const expenseId = parseInt(req.params.id);
        if (isNaN(expenseId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid expense ID'
            });
        }
        const expense = await (0, database_1.dbGet)(`SELECT 
        id, amount, description, category, payment_method, date, 
        receipt_path, created_at, updated_at
       FROM expenses 
       WHERE id = $1 AND user_id = $2`, [expenseId, userId]);
        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense record not found'
            });
        }
        res.json({
            success: true,
            data: { expense }
        });
    }
    catch (error) {
        console.error('Get expense by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/', [
    (0, express_validator_1.body)('amount')
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be a positive number'),
    (0, express_validator_1.body)('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters'),
    (0, express_validator_1.body)('category')
        .trim()
        .notEmpty()
        .isLength({ max: 50 })
        .withMessage('Category is required and cannot exceed 50 characters'),
    (0, express_validator_1.body)('payment_method')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Payment method cannot exceed 50 characters'),
    (0, express_validator_1.body)('date')
        .isISO8601()
        .withMessage('Date must be valid ISO date'),
    (0, express_validator_1.body)('receipt_path')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Receipt path cannot exceed 255 characters')
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        const userId = req.user.userId;
        const { amount, description = null, category, payment_method = 'Cash', date, receipt_path = null } = req.body;
        const expenseResult = await (0, database_1.dbRun)('INSERT INTO expenses (user_id, amount, description, category, payment_method, date, receipt_path) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, amount, description, category, payment_method, date, receipt_path]);
        const expenseId = expenseResult.lastID;
        const expenseRecord = await (0, database_1.dbGet)('SELECT * FROM expenses WHERE id = ?', [expenseId]);
        await (0, database_1.dbRun)('INSERT INTO transactions (user_id, transaction_type, reference_id, reference_table, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', [userId, 'expense', expenseId, 'expenses', amount, `Expense: ${description || category}`, date]);
        res.status(201).json({
            success: true,
            message: 'Expense record created successfully',
            data: { expense: expenseRecord }
        });
    }
    catch (error) {
        console.error('Create expense error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.put('/:id', [
    (0, express_validator_1.body)('amount')
        .optional()
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be a positive number'),
    (0, express_validator_1.body)('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters'),
    (0, express_validator_1.body)('category')
        .optional()
        .trim()
        .notEmpty()
        .isLength({ max: 50 })
        .withMessage('Category cannot be empty and cannot exceed 50 characters'),
    (0, express_validator_1.body)('payment_method')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Payment method cannot exceed 50 characters'),
    (0, express_validator_1.body)('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be valid ISO date'),
    (0, express_validator_1.body)('receipt_path')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Receipt path cannot exceed 255 characters')
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        const userId = req.user.userId;
        const expenseId = parseInt(req.params.id);
        if (isNaN(expenseId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid expense ID'
            });
        }
        const existingRecord = await (0, database_1.dbGet)('SELECT id FROM expenses WHERE id = $1 AND user_id = $2', [expenseId, userId]);
        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: 'Expense record not found'
            });
        }
        const { amount, description, category, payment_method, date, receipt_path } = req.body;
        const updates = [];
        const values = [];
        if (amount !== undefined) {
            updates.push('amount = $1');
            values.push(amount);
        }
        if (description !== undefined) {
            updates.push('description = $2');
            values.push(description);
        }
        if (category !== undefined) {
            updates.push('category = $3');
            values.push(category);
        }
        if (payment_method !== undefined) {
            updates.push('payment_method = $4');
            values.push(payment_method);
        }
        if (date !== undefined) {
            updates.push('date = $5');
            values.push(date);
        }
        if (receipt_path !== undefined) {
            updates.push('receipt_path = $6');
            values.push(receipt_path);
        }
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        updates.push('updated_at = NOW()');
        values.push(expenseId);
        await (0, database_1.dbRun)(`UPDATE expenses SET ${updates.join(', ')} WHERE id = $1`, values);
        const updatedRecord = await (0, database_1.dbGet)('SELECT * FROM expenses WHERE id = $1', [expenseId]);
        res.json({
            success: true,
            message: 'Expense record updated successfully',
            data: { expense: updatedRecord }
        });
    }
    catch (error) {
        console.error('Update expense error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const expenseId = parseInt(req.params.id);
        if (isNaN(expenseId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid expense ID'
            });
        }
        const existingRecord = await (0, database_1.dbGet)('SELECT id FROM expenses WHERE id = $1 AND user_id = $2', [expenseId, userId]);
        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: 'Expense record not found'
            });
        }
        await (0, database_1.dbRun)('DELETE FROM transactions WHERE reference_id = $2 AND reference_table = $3 AND user_id = $4', [expenseId, 'expenses', userId]);
        await (0, database_1.dbRun)('DELETE FROM expenses WHERE id = $5 AND user_id = $6', [expenseId, userId]);
        res.json({
            success: true,
            message: 'Expense record deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete expense error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/stats/summary', async (req, res) => {
    try {
        const userId = req.user.userId;
        const stats = await (0, database_1.dbGet)(`SELECT 
        COUNT(*) as total_records,
        SUM(amount) as total_expenses,
        AVG(amount) as average_expense,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
       FROM expenses 
       WHERE user_id = $1`, [userId]);
        const monthlyStats = await (0, database_1.dbAll)(`SELECT 
        strftime('%m', date) as month,
        strftime('%Y', date) as year,
        SUM(amount) as monthly_expenses,
        COUNT(*) as monthly_count
       FROM expenses 
       WHERE user_id = $1 AND strftime('%Y', date) = strftime('%Y', 'now')
       GROUP BY strftime('%Y', date), strftime('%m', date)
       ORDER BY month`, [userId]);
        const categoryStats = await (0, database_1.dbAll)(`SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount
       FROM expenses 
       WHERE user_id = $1 
       GROUP BY category
       ORDER BY total_amount DESC`, [userId]);
        const paymentStats = await (0, database_1.dbAll)(`SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(amount) as total_amount
       FROM expenses 
       WHERE user_id = $2 
       GROUP BY payment_method
       ORDER BY total_amount DESC`, [userId]);
        res.json({
            success: true,
            data: {
                summary: stats,
                monthly: monthlyStats,
                by_category: categoryStats,
                by_payment_method: paymentStats
            }
        });
    }
    catch (error) {
        console.error('Expense stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
exports.default = router;
