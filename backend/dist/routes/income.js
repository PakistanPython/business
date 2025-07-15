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
        const countResult = await (0, database_1.dbGet)(`SELECT COUNT(*) as total FROM income ${whereClause}`, whereParams);
        const total = countResult.total;
        const incomeRecords = await (0, database_1.dbAll)(`SELECT 
        id, amount, description, category, source, date, 
        charity_required, created_at, updated_at
       FROM income 
       ${whereClause} 
       ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
       LIMIT ? OFFSET $2`, [...whereParams, limit, offset]);
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        res.json({
            success: true,
            data: {
                income: incomeRecords,
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
        if (isNaN(incomeId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid income ID'
            });
        }
        const incomeRecord = await (0, database_1.dbGet)(`SELECT 
        id, amount, description, category, source, date, 
        charity_required, created_at, updated_at
       FROM income 
       WHERE id = ? AND user_id = $2`, [incomeId, userId]);
        if (!incomeRecord) {
            return res.status(404).json({
                success: false,
                message: 'Income record not found'
            });
        }
        res.json({
            success: true,
            data: { income: incomeRecord }
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
    (0, express_validator_1.body)('amount')
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
        .isLength({ max: 50 })
        .withMessage('Category cannot exceed 50 characters'),
    (0, express_validator_1.body)('source')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Source cannot exceed 100 characters'),
    (0, express_validator_1.body)('date')
        .isISO8601()
        .withMessage('Date must be valid ISO date')
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
        const { amount, description, category = 'General', source, date } = req.body;
        try {
            await (0, database_1.dbRun)('BEGIN TRANSACTION');
            const incomeResult = await (0, database_1.dbRun)('INSERT INTO income (user_id, amount, description, category, source, date) VALUES ($1, $2, $3, $4, $5, $6)', [userId, amount, description, category, source, date]);
            const incomeId = incomeResult.rows?.[0]?.id;
            const incomeRecord = await (0, database_1.dbGet)('SELECT * FROM income WHERE id = $1', [incomeId]);
            const charityAmount = parseFloat(incomeRecord.charity_required);
            await (0, database_1.dbRun)('INSERT INTO charity (user_id, income_id, amount_required, description) VALUES ($1, $2, $3, $4)', [userId, incomeId, charityAmount, `Charity for income: ${description || category}`]);
            await (0, database_1.dbRun)('INSERT INTO transactions (user_id, transaction_type, reference_id, reference_table, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7)', [userId, 'income', incomeId, 'income', amount, `Income: ${description || category}`, date]);
            await (0, database_1.dbRun)('COMMIT');
            res.status(201).json({
                success: true,
                message: 'Income record created successfully',
                data: {
                    income: incomeRecord,
                    charity_created: {
                        amount_required: charityAmount,
                        status: 'pending'
                    }
                }
            });
        }
        catch (error) {
            await (0, database_1.dbRun)('ROLLBACK');
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
        .isLength({ max: 50 })
        .withMessage('Category cannot exceed 50 characters'),
    (0, express_validator_1.body)('source')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Source cannot exceed 100 characters'),
    (0, express_validator_1.body)('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be valid ISO date')
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
        if (isNaN(incomeId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid income ID'
            });
        }
        const existingRecord = await (0, database_1.dbGet)('SELECT id, amount FROM income WHERE id = ? AND user_id = $2', [incomeId, userId]);
        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: 'Income record not found'
            });
        }
        const { amount, description, category, source, date } = req.body;
        const oldAmount = existingRecord.amount;
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
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        values.push(incomeId);
        try {
            await (0, database_1.dbRun)('BEGIN TRANSACTION');
            await (0, database_1.dbRun)(`UPDATE income SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, values);
            if (amount !== undefined && amount !== oldAmount) {
            }
            const updatedRecord = await (0, database_1.dbGet)('SELECT * FROM income WHERE id = $1', [incomeId]);
            await (0, database_1.dbRun)('COMMIT');
            res.json({
                success: true,
                message: 'Income record updated successfully',
                data: { income: updatedRecord }
            });
        }
        catch (error) {
            await (0, database_1.dbRun)('ROLLBACK');
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
        if (isNaN(incomeId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid income ID'
            });
        }
        const existingRecord = await (0, database_1.dbGet)('SELECT id FROM income WHERE id = ? AND user_id = $2', [incomeId, userId]);
        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: 'Income record not found'
            });
        }
        try {
            await (0, database_1.dbRun)('BEGIN TRANSACTION');
            await (0, database_1.dbRun)('DELETE FROM charity WHERE income_id = ? AND user_id = $2', [incomeId, userId]);
            await (0, database_1.dbRun)('DELETE FROM transactions WHERE reference_id = ? AND reference_table = ? AND user_id = $3', [incomeId, 'income', userId]);
            const result = await (0, database_1.dbRun)('DELETE FROM income WHERE id = ? AND user_id = $2', [incomeId, userId]);
            if (result.rowCount === 0) {
                await (0, database_1.dbRun)('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: 'Income record not found or already deleted'
                });
            }
            await (0, database_1.dbRun)('COMMIT');
            res.json({
                success: true,
                message: 'Income record deleted successfully'
            });
        }
        catch (error) {
            await (0, database_1.dbRun)('ROLLBACK');
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
        const stats = await (0, database_1.dbGet)(`SELECT 
        COUNT(*) as total_records,
        SUM(amount) as total_income,
        AVG(amount) as average_income,
        SUM(charity_required) as total_charity_required,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
       FROM income 
       WHERE user_id = $1`, [userId]);
        const monthlyStats = await (0, database_1.dbAll)(`SELECT 
        strftime('%m', date) as month,
        strftime('%Y', date) as year,
        SUM(amount) as monthly_income,
        COUNT(*) as monthly_count
       FROM income 
       WHERE user_id = ? AND strftime('%Y', date) = strftime('%Y', 'now')
       GROUP BY year, month
       ORDER BY month`, [userId]);
        const categoryStats = await (0, database_1.dbAll)(`SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount
       FROM income 
       WHERE user_id = ? GROUP BY category
       ORDER BY total_amount DESC`, [userId]);
        res.json({
            success: true,
            data: {
                summary: stats,
                monthly: monthlyStats,
                by_category: categoryStats
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
exports.default = router;
