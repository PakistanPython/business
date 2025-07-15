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
    (0, express_validator_1.query)('status').optional().isIn(['pending', 'partial', 'paid']).withMessage('Invalid status'),
    (0, express_validator_1.query)('start_date').optional().isISO8601().withMessage('Start date must be valid ISO date'),
    (0, express_validator_1.query)('end_date').optional().isISO8601().withMessage('End date must be valid ISO date'),
    (0, express_validator_1.query)('sort_by').optional().isIn(['created_at', 'amount_required', 'amount_remaining']).withMessage('Invalid sort field'),
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
        const status = req.query.status;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        const sortBy = req.query.sort_by || 'created_at';
        const sortOrder = req.query.sort_order || 'desc';
        let whereClause = 'WHERE c.user_id = ?';
        const whereParams = [userId];
        if (status) {
            whereClause += ' AND c.status = ?';
            whereParams.push(status);
        }
        if (startDate) {
            whereClause += ' AND c.created_at >= $1';
            whereParams.push(startDate);
        }
        if (endDate) {
            whereClause += ' AND c.created_at <= $1';
            whereParams.push(endDate);
        }
        const countResult = await (0, database_1.dbGet)(`SELECT COUNT(*) as total FROM charity c ${whereClause}`, whereParams);
        const total = countResult.total;
        const charityRecords = await (0, database_1.dbAll)(`SELECT 
        c.id, c.income_id, c.amount_required, c.amount_paid, c.amount_remaining,
        c.status, c.payment_date, c.description, c.recipient, c.created_at, c.updated_at,
        i.amount as income_amount, i.description as income_description, i.date as income_date
       FROM charity c 
       LEFT JOIN income i ON c.income_id = i.id
       ${whereClause} 
       ORDER BY c.${sortBy} ${sortOrder.toUpperCase()}
       LIMIT ? OFFSET ?`, [...whereParams, limit, offset]);
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        res.json({
            success: true,
            data: {
                charity: charityRecords,
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
        console.error('Get charity error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const charityId = parseInt(req.params.id);
        if (isNaN(charityId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid charity ID'
            });
        }
        const charityRecord = await (0, database_1.dbGet)(`SELECT 
        c.id, c.income_id, c.amount_required, c.amount_paid, c.amount_remaining,
        c.status, c.payment_date, c.description, c.recipient, c.created_at, c.updated_at,
        i.amount as income_amount, i.description as income_description, i.date as income_date
       FROM charity c 
       LEFT JOIN income i ON c.income_id = i.id
       WHERE c.id = ? AND c.user_id = $2`, [charityId, userId]);
        if (!charityRecord) {
            return res.status(404).json({
                success: false,
                message: 'Charity record not found'
            });
        }
        res.json({
            success: true,
            data: { charity: charityRecord }
        });
    }
    catch (error) {
        console.error('Get charity by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/payment', [
    (0, express_validator_1.body)('charity_id')
        .isInt({ min: 1 })
        .withMessage('Valid charity ID is required'),
    (0, express_validator_1.body)('payment_amount')
        .isFloat({ min: 0.01 })
        .withMessage('Payment amount must be a positive number'),
    (0, express_validator_1.body)('payment_date')
        .isISO8601()
        .withMessage('Payment date must be valid ISO date'),
    (0, express_validator_1.body)('recipient')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Recipient cannot exceed 100 characters'),
    (0, express_validator_1.body)('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters')
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
        const { charity_id, payment_amount, payment_date, recipient, description } = req.body;
        try {
            await (0, database_1.dbRun)('BEGIN TRANSACTION');
            const charity = await (0, database_1.dbGet)('SELECT id, amount_required, amount_paid, amount_remaining, status FROM charity WHERE id = ? AND user_id = $2', [charity_id, userId]);
            if (!charity) {
                await (0, database_1.dbRun)('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: 'Charity record not found'
                });
            }
            if (payment_amount > charity.amount_remaining) {
                await (0, database_1.dbRun)('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: `Payment amount cannot exceed remaining balance of ${charity.amount_remaining}`
                });
            }
            const newAmountPaid = parseFloat(charity.amount_paid) + parseFloat(payment_amount);
            const newAmountRemaining = parseFloat(charity.amount_required) - newAmountPaid;
            let newStatus = 'partial';
            if (newAmountRemaining <= 0) {
                newStatus = 'paid';
            }
            else if (newAmountPaid === 0) {
                newStatus = 'pending';
            }
            await (0, database_1.dbRun)(`UPDATE charity SET 
          amount_paid = $1, 
          status = $2, 
          payment_date = $3,
          recipient = COALESCE($4, recipient),
          description = COALESCE($5, description),
          updated_at = CURRENT_TIMESTAMP 
         WHERE id = $6`, [newAmountPaid, newStatus, payment_date, recipient, description, charity_id]);
            await (0, database_1.dbRun)('INSERT INTO transactions (user_id, transaction_type, reference_id, reference_table, amount, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, 'charity', charity_id, 'charity', payment_amount, `Charity payment: ${description || 'Charity contribution'}`, payment_date]);
            const updatedRecord = await (0, database_1.dbGet)(`SELECT 
          c.id, c.income_id, c.amount_required, c.amount_paid, c.amount_remaining,
          c.status, c.payment_date, c.description, c.recipient, c.created_at, c.updated_at,
          i.amount as income_amount, i.description as income_description, i.date as income_date
         FROM charity c 
         LEFT JOIN income i ON c.income_id = i.id
         WHERE c.id = $1`, [charity_id]);
            await (0, database_1.dbRun)('COMMIT');
            res.json({
                success: true,
                message: 'Charity payment recorded successfully',
                data: {
                    charity: updatedRecord,
                    payment: {
                        amount: payment_amount,
                        date: payment_date,
                        recipient,
                        description
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
        console.error('Record charity payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/', [
    (0, express_validator_1.body)('amount_required')
        .isFloat({ min: 0.01 })
        .withMessage('Amount required must be a positive number'),
    (0, express_validator_1.body)('description')
        .trim()
        .notEmpty()
        .isLength({ max: 500 })
        .withMessage('Description is required and cannot exceed 500 characters'),
    (0, express_validator_1.body)('recipient')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Recipient cannot exceed 100 characters')
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
        const { amount_required, description, recipient } = req.body;
        const result = await (0, database_1.dbRun)('INSERT INTO charity (user_id, amount_required, description, recipient) VALUES ($1, $2, $3, $4) RETURNING id', [userId, amount_required, description, recipient]);
        const charityId = result.rows?.[0]?.id;
        const newCharity = await (0, database_1.dbGet)('SELECT * FROM charity WHERE id = $1', [charityId]);
        res.status(201).json({
            success: true,
            message: 'Manual charity record created successfully',
            data: { charity: newCharity }
        });
    }
    catch (error) {
        console.error('Create manual charity error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.put('/:id', [
    (0, express_validator_1.body)('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters'),
    (0, express_validator_1.body)('recipient')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Recipient cannot exceed 100 characters')
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
        const charityId = parseInt(req.params.id);
        if (isNaN(charityId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid charity ID'
            });
        }
        const existingRecord = await (0, database_1.dbGet)('SELECT id FROM charity WHERE id = ? AND user_id = $2', [charityId, userId]);
        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: 'Charity record not found'
            });
        }
        const { description, recipient } = req.body;
        const updates = [];
        const values = [];
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        if (recipient !== undefined) {
            updates.push('recipient = ?');
            values.push(recipient);
        }
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        values.push(charityId);
        await (0, database_1.dbRun)(`UPDATE charity SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, values);
        const updatedRecord = await (0, database_1.dbGet)(`SELECT 
        c.id, c.income_id, c.amount_required, c.amount_paid, c.amount_remaining,
        c.status, c.payment_date, c.description, c.recipient, c.created_at, c.updated_at,
        i.amount as income_amount, i.description as income_description, i.date as income_date
       FROM charity c 
       LEFT JOIN income i ON c.income_id = i.id
       WHERE c.id = $2`, [charityId]);
        res.json({
            success: true,
            message: 'Charity record updated successfully',
            data: { charity: updatedRecord }
        });
    }
    catch (error) {
        console.error('Update charity error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const charityId = parseInt(req.params.id);
        if (isNaN(charityId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid charity ID'
            });
        }
        const charity = await (0, database_1.dbGet)('SELECT id, income_id FROM charity WHERE id = ? AND user_id = $2', [charityId, userId]);
        if (!charity) {
            return res.status(404).json({
                success: false,
                message: 'Charity record not found'
            });
        }
        if (charity.income_id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete auto-generated charity records. Delete the related income record instead.'
            });
        }
        try {
            await (0, database_1.dbRun)('BEGIN TRANSACTION');
            await (0, database_1.dbRun)('DELETE FROM transactions WHERE reference_id = ? AND reference_table = ? AND user_id = $3', [charityId, 'charity', userId]);
            await (0, database_1.dbRun)('DELETE FROM charity WHERE id = ? AND user_id = $2', [charityId, userId]);
            await (0, database_1.dbRun)('COMMIT');
            res.json({
                success: true,
                message: 'Charity record deleted successfully'
            });
        }
        catch (error) {
            await (0, database_1.dbRun)('ROLLBACK');
            throw error;
        }
    }
    catch (error) {
        console.error('Delete charity error:', error);
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
        SUM(amount_required) as total_required,
        SUM(amount_paid) as total_paid,
        SUM(amount_remaining) as total_remaining,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count
       FROM charity 
       WHERE user_id = ?`, [userId]);
        const monthlyStats = await (0, database_1.dbAll)(`SELECT 
        strftime('%m', payment_date) as month,
        strftime('%Y', payment_date) as year,
        SUM(amount_paid) as monthly_payments,
        COUNT(*) as monthly_count
       FROM charity 
       WHERE user_id = ? AND payment_date IS NOT NULL AND strftime('%Y', payment_date) = strftime('%Y', 'now')
       GROUP BY strftime('%Y', payment_date), strftime('%m', payment_date)
       ORDER BY month`, [userId]);
        const recentActivities = await (0, database_1.dbAll)(`SELECT 
        c.id, c.amount_required, c.amount_paid, c.amount_remaining, c.status,
        c.description, c.payment_date, c.created_at,
        i.description as income_description
       FROM charity c
       LEFT JOIN income i ON c.income_id = i.id
       WHERE c.user_id = ? ORDER BY c.updated_at DESC
       LIMIT 10`, [userId]);
        res.json({
            success: true,
            data: {
                summary: stats,
                monthly_payments: monthlyStats,
                recent_activities: recentActivities
            }
        });
    }
    catch (error) {
        console.error('Charity stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
exports.default = router;
