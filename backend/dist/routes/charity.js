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
    (0, express_validator_1.query)('start_date').optional().isISO8601().withMessage('Start date must be valid ISO date'),
    (0, express_validator_1.query)('end_date').optional().isISO8601().withMessage('End date must be valid ISO date'),
    (0, express_validator_1.query)('sort_by').optional().isIn(['amount_required', 'created_at']).withMessage('Invalid sort field'),
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
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        const sortBy = req.query.sort_by || 'created_at';
        const sortOrder = req.query.sort_order || 'desc';
        let whereClause = 'WHERE business_id = $1';
        const whereParams = [userId];
        let paramIndex = 2;
        if (startDate) {
            whereClause += ` AND created_at >= $${paramIndex++}`;
            whereParams.push(startDate);
        }
        if (endDate) {
            whereClause += ` AND created_at <= $${paramIndex++}`;
            whereParams.push(endDate);
        }
        const countResult = await (0, database_1.dbGet)(`SELECT COUNT(*) as total FROM charity ${whereClause}`, whereParams);
        const total = countResult.total;
        const charityRecords = await (0, database_1.dbAll)(`SELECT 
        c.id, 
        c.amount_required, 
        COALESCE(c.amount_paid, 0) as amount_paid, 
        c.status, 
        c.description, 
        c.recipient, 
        c.created_at, 
        c.updated_at,
        (c.amount_required - COALESCE(c.amount_paid, 0)) as amount_remaining,
        (COALESCE(c.amount_paid, 0) * 100 / c.amount_required) as progress,
        i.description as income_description,
        i.source as income_source,
        i.date as income_date,
        cat.name as income_category
       FROM charity c
       LEFT JOIN income i ON c.income_id = i.id
       LEFT JOIN categories cat ON i.category_id = cat.id
       ${whereClause.replace('business_id', 'c.business_id')} 
       ORDER BY c.${sortBy} ${sortOrder.toUpperCase()}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`, [...whereParams, limit, offset]);
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
router.get('/summary', async (req, res) => {
    try {
        const userId = req.user.userId;
        const summary = await (0, database_1.dbGet)(`SELECT 
                SUM(amount_required) as total_required,
                SUM(COALESCE(amount_paid, 0)) as total_paid,
                SUM(amount_required - COALESCE(amount_paid, 0)) as total_remaining
             FROM charity
             WHERE business_id = $1`, [userId]);
        res.json({
            success: true,
            data: {
                summary
            }
        });
    }
    catch (error) {
        console.error('Get charity summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/payment', [
    (0, express_validator_1.body)('charity_id').isInt(),
    (0, express_validator_1.body)('payment_amount').isFloat({ gt: 0 }),
    (0, express_validator_1.body)('payment_date').isISO8601().toDate(),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const userId = req.user.userId;
        const { charity_id, payment_amount, payment_date, recipient, description } = req.body;
        const charityRecord = await (0, database_1.dbGet)('SELECT *, COALESCE(amount_paid, 0) as amount_paid FROM charity WHERE id = $1 AND business_id = $2', [charity_id, userId]);
        if (!charityRecord) {
            return res.status(404).json({ message: 'Charity record not found' });
        }
        const newAmountPaid = Number(charityRecord.amount_paid) + payment_amount;
        const newStatus = newAmountPaid >= charityRecord.amount_required ? 'paid' : 'partial';
        await (0, database_1.dbRun)('UPDATE charity SET amount_paid = $1, status = $2, updated_at = NOW() WHERE id = $3', [newAmountPaid, newStatus, charity_id]);
        await (0, database_1.dbRun)('INSERT INTO charity_payments (charity_id, business_id, payment_amount, payment_date, recipient, description) VALUES ($1, $2, $3, $4, $5, $6)', [charity_id, userId, payment_amount, payment_date, recipient, description]);
        res.status(200).json({ message: 'Payment recorded successfully' });
    }
    catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/payments/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const charityId = parseInt(req.params.id);
        if (isNaN(charityId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid charity ID'
            });
        }
        const paymentHistory = await (0, database_1.dbAll)(`SELECT 
                id,
                payment_amount,
                payment_date,
                recipient,
                description
             FROM charity_payments
             WHERE charity_id = $1 AND business_id = $2
             ORDER BY payment_date DESC`, [charityId, userId]);
        res.json({
            success: true,
            data: {
                payments: paymentHistory
            }
        });
    }
    catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
exports.default = router;
