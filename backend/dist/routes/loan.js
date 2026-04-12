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
    (0, express_validator_1.query)('status').optional().isIn(['active', 'paid', 'defaulted']).withMessage('Invalid status'),
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
        const status = req.query.status;
        let whereClause = 'WHERE business_id = $1';
        const whereParams = [req.user.businessId];
        let paramIndex = 2;
        if (status) {
            whereClause += ` AND status = $${paramIndex++}`;
            whereParams.push(status);
        }
        const loans = await (0, database_1.dbAll)(`SELECT 
        id, lender_name, principal_amount, current_balance, interest_rate, monthly_payment, loan_type, start_date, due_date, status, created_at, updated_at
       FROM loans 
       ${whereClause} 
       ORDER BY status, start_date DESC`, whereParams);
        res.json({
            success: true,
            data: {
                loans
            }
        });
    }
    catch (error) {
        console.error('Get loans error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const loanId = parseInt(req.params.id);
        if (isNaN(loanId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid loan ID'
            });
        }
        const loan = await (0, database_1.dbGet)(`SELECT 
        id, lender_name, principal_amount, current_balance, interest_rate, monthly_payment, loan_type, start_date, due_date, status, created_at, updated_at
       FROM loans 
       WHERE id = $1 AND business_id = $2`, [loanId, req.user.businessId]);
        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }
        res.json({
            success: true,
            data: { loan }
        });
    }
    catch (error) {
        console.error('Get loan by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/', [
    (0, express_validator_1.body)('lender_name').notEmpty().withMessage('Lender name is required'),
    (0, express_validator_1.body)('principal_amount').isFloat({ gt: 0 }).withMessage('Principal amount must be positive'),
    (0, express_validator_1.body)('loan_type').isIn(['personal', 'business', 'mortgage', 'auto', 'other']),
    (0, express_validator_1.body)('start_date').isISO8601().withMessage('Invalid start date'),
    (0, express_validator_1.body)('due_date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid due date'),
    (0, express_validator_1.body)('interest_rate').optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)('monthly_payment').optional().isFloat({ min: 0 }),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }
    try {
        const { lender_name, principal_amount, loan_type, start_date, due_date, interest_rate, monthly_payment, current_balance } = req.body;
        const business_id = req.user.businessId;
        if (!business_id) {
            return res.status(400).json({ success: false, message: 'Business ID not found in token' });
        }
        const result = await (0, database_1.dbRun)(`INSERT INTO loans (business_id, lender_name, principal_amount, current_balance, loan_type, start_date, due_date, interest_rate, monthly_payment, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')`, [business_id, lender_name, principal_amount, current_balance || principal_amount, loan_type, start_date, due_date || null, interest_rate, monthly_payment]);
        res.status(201).json({
            success: true,
            message: 'Loan created successfully',
            data: { id: result.lastID }
        });
    }
    catch (error) {
        console.error('Error creating loan:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
router.post('/:id/payment', [
    (0, express_validator_1.body)('amount').isFloat({ gt: 0 }).withMessage('Payment amount must be positive'),
    (0, express_validator_1.body)('payment_date').isISO8601().withMessage('Invalid payment date'),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }
    try {
        const loanId = parseInt(req.params.id);
        const { amount, payment_date, description } = req.body;
        const business_id = req.user.businessId;
        if (!business_id) {
            return res.status(400).json({ success: false, message: 'Business ID not found in token' });
        }
        const loan = await (0, database_1.dbGet)('SELECT * FROM loans WHERE id = $1 AND business_id = $2', [loanId, business_id]);
        if (!loan) {
            return res.status(404).json({ success: false, message: 'Loan not found' });
        }
        const newBalance = loan.current_balance - amount;
        await (0, database_1.dbRun)('UPDATE loans SET current_balance = $1, status = $2 WHERE id = $3', [newBalance, newBalance <= 0 ? 'paid' : 'active', loanId]);
        await (0, database_1.dbRun)('INSERT INTO loan_payments (loan_id, amount, payment_date, description) VALUES ($1, $2, $3, $4)', [loanId, amount, payment_date, description]);
        res.json({ success: true, message: 'Payment recorded successfully' });
    }
    catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
router.put('/:id', [
    (0, express_validator_1.body)('lender_name').optional().notEmpty().withMessage('Lender name is required'),
    (0, express_validator_1.body)('principal_amount').optional().isFloat({ gt: 0 }),
    (0, express_validator_1.body)('current_balance').optional().isFloat({ gt: 0 }),
    (0, express_validator_1.body)('interest_rate').optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)('monthly_payment').optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)('loan_type').optional().isIn(['personal', 'business', 'mortgage', 'auto', 'other']),
    (0, express_validator_1.body)('start_date').optional().isISO8601().toDate(),
    (0, express_validator_1.body)('due_date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid due date'),
    (0, express_validator_1.body)('status').optional().isIn(['active', 'paid']),
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
        const loanId = parseInt(req.params.id);
        if (isNaN(loanId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid loan ID'
            });
        }
        const existingLoan = await (0, database_1.dbGet)('SELECT id FROM loans WHERE id = $1 AND business_id = $2', [loanId, req.user.businessId]);
        if (!existingLoan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }
        const { lender_name, principal_amount, current_balance, interest_rate, monthly_payment, loan_type, start_date, due_date, status } = req.body;
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (lender_name !== undefined) {
            updates.push(`lender_name = $${paramIndex++}`);
            values.push(lender_name);
        }
        if (principal_amount !== undefined) {
            updates.push(`principal_amount = $${paramIndex++}`);
            values.push(principal_amount);
        }
        if (current_balance !== undefined) {
            updates.push(`current_balance = $${paramIndex++}`);
            values.push(current_balance);
        }
        if (interest_rate !== undefined) {
            updates.push(`interest_rate = $${paramIndex++}`);
            values.push(interest_rate);
        }
        if (monthly_payment !== undefined) {
            updates.push(`monthly_payment = $${paramIndex++}`);
            values.push(monthly_payment);
        }
        if (loan_type !== undefined) {
            updates.push(`loan_type = $${paramIndex++}`);
            values.push(loan_type);
        }
        if (start_date !== undefined) {
            updates.push(`start_date = $${paramIndex++}`);
            values.push(start_date);
        }
        if (due_date !== undefined) {
            updates.push(`due_date = $${paramIndex++}`);
            values.push(due_date || null);
        }
        if (status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(status);
        }
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        values.push(loanId);
        await (0, database_1.dbRun)(`UPDATE loans SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`, values);
        const updatedLoan = await (0, database_1.dbGet)('SELECT * FROM loans WHERE id = $1', [loanId]);
        res.json({
            success: true,
            message: 'Loan updated successfully',
            data: { loan: updatedLoan }
        });
    }
    catch (error) {
        console.error('Update loan error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const loanId = parseInt(req.params.id);
        if (isNaN(loanId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid loan ID'
            });
        }
        const existingLoan = await (0, database_1.dbGet)('SELECT id FROM loans WHERE id = $1 AND business_id = $2', [loanId, req.user.businessId]);
        if (!existingLoan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }
        await (0, database_1.dbRun)('DELETE FROM loans WHERE id = $1', [loanId]);
        res.json({
            success: true,
            message: 'Loan record deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete loan error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
exports.default = router;
