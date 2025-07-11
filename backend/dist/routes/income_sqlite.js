"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const database_sqlite_1 = require("../config/database_sqlite");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
router.get('/', [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('category').optional(),
    (0, express_validator_1.query)('start_date').optional().isISO8601().withMessage('Invalid start date'),
    (0, express_validator_1.query)('end_date').optional().isISO8601().withMessage('Invalid end date')
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
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE user_id = ?';
        const params = [userId];
        if (req.query.category) {
            whereClause += ' AND category = ?';
            params.push(req.query.category);
        }
        if (req.query.start_date) {
            whereClause += ' AND date >= ?';
            params.push(req.query.start_date);
        }
        if (req.query.end_date) {
            whereClause += ' AND date <= ?';
            params.push(req.query.end_date);
        }
        const countResult = await (0, database_sqlite_1.dbGet)(`SELECT COUNT(*) as total FROM income ${whereClause}`, params);
        const income = await (0, database_sqlite_1.dbAll)(`SELECT * FROM income ${whereClause} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        res.json({
            success: true,
            data: {
                income,
                pagination: {
                    page,
                    limit,
                    total: countResult.total,
                    totalPages: Math.ceil(countResult.total / limit)
                }
            }
        });
    }
    catch (error) {
        console.error('Get income error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const incomeId = parseInt(req.params.id);
        const income = await (0, database_sqlite_1.dbGet)('SELECT * FROM income WHERE id = ? AND user_id = ?', [incomeId, userId]);
        if (!income) {
            return res.status(404).json({
                success: false,
                message: 'Income record not found'
            });
        }
        res.json({
            success: true,
            data: { income }
        });
    }
    catch (error) {
        console.error('Get income by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/', [
    (0, express_validator_1.body)('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    (0, express_validator_1.body)('description').optional().trim(),
    (0, express_validator_1.body)('category').notEmpty().withMessage('Category is required'),
    (0, express_validator_1.body)('source').optional().trim(),
    (0, express_validator_1.body)('date').isISO8601().withMessage('Valid date is required')
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
        const { amount, description, category, source, date } = req.body;
        try {
            await (0, database_sqlite_1.dbRun)('BEGIN TRANSACTION');
            const result = await (0, database_sqlite_1.dbRun)('INSERT INTO income (user_id, amount, description, category, source, date) VALUES (?, ?, ?, ?, ?, ?)', [userId, amount, description || null, category, source || null, date]);
            const charityAmount = amount * 0.025;
            const charityResult = await (0, database_sqlite_1.dbRun)('INSERT INTO charity (user_id, income_id, amount_required, description) VALUES (?, ?, ?, ?)', [userId, result.lastID, charityAmount, `Charity for income: ${description || category}`]);
            await (0, database_sqlite_1.dbRun)('INSERT INTO transactions (user_id, transaction_type, reference_id, reference_table, amount, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, 'income', result.lastID, 'income', amount, description || `Income - ${category}`, date]);
            await (0, database_sqlite_1.dbRun)('COMMIT');
            res.status(201).json({
                success: true,
                data: {
                    id: result.lastID,
                    charity_id: charityResult.lastID,
                    charity_amount: charityAmount
                },
                message: 'Income created successfully with automatic charity allocation'
            });
        }
        catch (error) {
            await (0, database_sqlite_1.dbRun)('ROLLBACK');
            throw error;
        }
    }
    catch (error) {
        console.error('Create income error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.put('/:id', [
    (0, express_validator_1.body)('amount').optional().isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    (0, express_validator_1.body)('description').optional().trim(),
    (0, express_validator_1.body)('category').optional().notEmpty().withMessage('Category cannot be empty'),
    (0, express_validator_1.body)('source').optional().trim(),
    (0, express_validator_1.body)('date').optional().isISO8601().withMessage('Valid date is required')
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
        const incomeId = parseInt(req.params.id);
        const { amount, description, category, source, date } = req.body;
        const existingIncome = await (0, database_sqlite_1.dbGet)('SELECT * FROM income WHERE id = ? AND user_id = ?', [incomeId, userId]);
        if (!existingIncome) {
            return res.status(404).json({
                success: false,
                message: 'Income record not found'
            });
        }
        try {
            await (0, database_sqlite_1.dbRun)('BEGIN TRANSACTION');
            const updates = [];
            const values = [];
            if (amount !== undefined) {
                updates.push('amount = ?');
                values.push(amount);
            }
            if (description !== undefined) {
                updates.push('description = ?');
                values.push(description);
            }
            if (category !== undefined) {
                updates.push('category = ?');
                values.push(category);
            }
            if (source !== undefined) {
                updates.push('source = ?');
                values.push(source);
            }
            if (date !== undefined) {
                updates.push('date = ?');
                values.push(date);
            }
            if (updates.length === 0) {
                await (0, database_sqlite_1.dbRun)('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: 'No fields to update'
                });
            }
            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(incomeId, userId);
            await (0, database_sqlite_1.dbRun)(`UPDATE income SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
            if (amount !== undefined) {
                const newCharityAmount = amount * 0.025;
                await (0, database_sqlite_1.dbRun)('UPDATE charity SET amount_required = ?, amount_remaining = amount_required - amount_paid, updated_at = CURRENT_TIMESTAMP WHERE income_id = ? AND user_id = ?', [newCharityAmount, incomeId, userId]);
            }
            await (0, database_sqlite_1.dbRun)('COMMIT');
            res.json({
                success: true,
                message: 'Income updated successfully'
            });
        }
        catch (error) {
            await (0, database_sqlite_1.dbRun)('ROLLBACK');
            throw error;
        }
    }
    catch (error) {
        console.error('Update income error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const incomeId = parseInt(req.params.id);
        const existingIncome = await (0, database_sqlite_1.dbGet)('SELECT * FROM income WHERE id = ? AND user_id = ?', [incomeId, userId]);
        if (!existingIncome) {
            return res.status(404).json({
                success: false,
                message: 'Income record not found'
            });
        }
        try {
            await (0, database_sqlite_1.dbRun)('BEGIN TRANSACTION');
            await (0, database_sqlite_1.dbRun)('DELETE FROM charity WHERE income_id = ? AND user_id = ?', [incomeId, userId]);
            await (0, database_sqlite_1.dbRun)('DELETE FROM transactions WHERE reference_table = ? AND user_id = ? AND description LIKE ?', ['charity', userId, `%income: ${existingIncome.description || existingIncome.category}`]);
            await (0, database_sqlite_1.dbRun)('DELETE FROM income WHERE id = ? AND user_id = ?', [incomeId, userId]);
            await (0, database_sqlite_1.dbRun)('DELETE FROM transactions WHERE reference_id = ? AND reference_table = ? AND user_id = ?', [incomeId, 'income', userId]);
            await (0, database_sqlite_1.dbRun)('COMMIT');
            res.json({
                success: true,
                message: 'Income and related charity records deleted successfully'
            });
        }
        catch (error) {
            await (0, database_sqlite_1.dbRun)('ROLLBACK');
            throw error;
        }
    }
    catch (error) {
        console.error('Delete income error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/stats/summary', async (req, res) => {
    try {
        const userId = req.user.userId;
        const stats = await (0, database_sqlite_1.dbGet)(`
      SELECT 
        COUNT(*) as total_records,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount,
        SUM(amount * 0.025) as total_charity_required
      FROM income 
      WHERE user_id = ?
    `, [userId]);
        const byCategory = await (0, database_sqlite_1.dbAll)(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total,
        AVG(amount) as average
      FROM income 
      WHERE user_id = ?
      GROUP BY category
      ORDER BY total DESC
    `, [userId]);
        const monthlyBreakdown = await (0, database_sqlite_1.dbAll)(`
      SELECT 
        strftime('%m', date) as month,
        strftime('%Y-%m', date) as year_month,
        COUNT(*) as count,
        SUM(amount) as total
      FROM income 
      WHERE user_id = ? AND strftime('%Y', date) = strftime('%Y', 'now')
      GROUP BY strftime('%Y-%m', date)
      ORDER BY year_month
    `, [userId]);
        res.json({
            success: true,
            data: {
                summary: stats,
                by_category: byCategory,
                monthly_breakdown: monthlyBreakdown
            }
        });
    }
    catch (error) {
        console.error('Income stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/config/charity-percentage', async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                charity_percentage: 2.5,
                charity_rate: 0.025,
                description: 'Automatic charity deduction from income'
            }
        });
    }
    catch (error) {
        console.error('Get charity config error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
exports.default = router;
