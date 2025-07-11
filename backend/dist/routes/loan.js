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
    (0, express_validator_1.query)('loan_type').optional().isIn(['personal', 'business', 'mortgage', 'auto', 'other']).withMessage('Invalid loan type')
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
        const loanType = req.query.loan_type;
        let whereClause = 'WHERE user_id = ?';
        const whereParams = [userId];
        if (status) {
            whereClause += ' AND status = ?';
            whereParams.push(status);
        }
        if (loanType) {
            whereClause += ' AND loan_type = ?';
            whereParams.push(loanType);
        }
        const loans = await (0, database_1.dbAll)(`SELECT 
        id, loan_type, lender_name, principal_amount, current_balance, 
        interest_rate, monthly_payment, start_date, due_date, status, 
        created_at, updated_at
       FROM loans 
       ${whereClause} 
       ORDER BY status, start_date DESC`, whereParams);
        const totals = loans.reduce((acc, loan) => {
            acc.total_principal += parseFloat(loan.principal_amount);
            acc.total_current_balance += parseFloat(loan.current_balance);
            if (loan.status === 'active') {
                acc.active_balance += parseFloat(loan.current_balance);
            }
            return acc;
        }, { total_principal: 0, total_current_balance: 0, active_balance: 0 });
        res.json({
            success: true,
            data: {
                loans,
                totals
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
router.get('/:id/payments', async (req, res) => {
    try {
        const userId = req.user.userId;
        const loanId = parseInt(req.params.id);
        if (isNaN(loanId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid loan ID'
            });
        }
        const loan = await (0, database_1.dbGet)('SELECT id FROM loans WHERE id = ? AND user_id = ?', [loanId, userId]);
        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }
        const payments = await (0, database_1.dbAll)(`SELECT 
        amount,
        description,
        date,
        created_at
      FROM transactions 
      WHERE user_id = ? AND transaction_type = 'loan_payment' AND reference_id = ?
      ORDER BY date DESC, created_at DESC`, [userId, loanId]);
        res.json({
            success: true,
            data: {
                loan_id: loanId,
                payments: payments
            }
        });
    }
    catch (error) {
        console.error('Get loan payments error:', error);
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
        id, loan_type, lender_name, principal_amount, current_balance, 
        interest_rate, monthly_payment, start_date, due_date, status, 
        created_at, updated_at
       FROM loans 
       WHERE id = ? AND user_id = ?`, [loanId, userId]);
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
    (0, express_validator_1.body)('loan_type')
        .isIn(['personal', 'business', 'mortgage', 'auto', 'other'])
        .withMessage('Loan type must be personal, business, mortgage, auto, or other'),
    (0, express_validator_1.body)('lender_name')
        .trim()
        .notEmpty()
        .isLength({ max: 100 })
        .withMessage('Lender name is required and cannot exceed 100 characters'),
    (0, express_validator_1.body)('principal_amount')
        .isFloat({ min: 0.01 })
        .withMessage('Principal amount must be a positive number'),
    (0, express_validator_1.body)('current_balance')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Current balance must be a non-negative number'),
    (0, express_validator_1.body)('interest_rate')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Interest rate must be between 0 and 100'),
    (0, express_validator_1.body)('monthly_payment')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Monthly payment must be a non-negative number'),
    (0, express_validator_1.body)('start_date')
        .isISO8601()
        .withMessage('Start date must be valid ISO date'),
    (0, express_validator_1.body)('due_date')
        .optional()
        .isISO8601()
        .withMessage('Due date must be valid ISO date')
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
        const { loan_type, lender_name, principal_amount, current_balance = principal_amount, interest_rate, monthly_payment, start_date, due_date } = req.body;
        const result = await (0, database_1.dbRun)(`INSERT INTO loans 
       (user_id, loan_type, lender_name, principal_amount, current_balance, 
        interest_rate, monthly_payment, start_date, due_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [userId, loan_type, lender_name, principal_amount, current_balance,
            interest_rate, monthly_payment, start_date, due_date]);
        const loanId = result.lastID;
        const newLoan = await (0, database_1.dbGet)('SELECT * FROM loans WHERE id = ?', [loanId]);
        res.status(201).json({
            success: true,
            message: 'Loan record created successfully',
            data: { loan: newLoan }
        });
    }
    catch (error) {
        console.error('Create loan error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.put('/:id', [
    (0, express_validator_1.body)('lender_name')
        .optional()
        .trim()
        .notEmpty()
        .isLength({ max: 100 })
        .withMessage('Lender name cannot be empty and cannot exceed 100 characters'),
    (0, express_validator_1.body)('current_balance')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Current balance must be a non-negative number'),
    (0, express_validator_1.body)('interest_rate')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Interest rate must be between 0 and 100'),
    (0, express_validator_1.body)('monthly_payment')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Monthly payment must be a non-negative number'),
    (0, express_validator_1.body)('due_date')
        .optional()
        .isISO8601()
        .withMessage('Due date must be valid ISO date'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['active', 'paid', 'defaulted'])
        .withMessage('Status must be active, paid, or defaulted')
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
        const existingLoan = await (0, database_1.dbGet)('SELECT id FROM loans WHERE id = ? AND user_id = ?', [loanId, userId]);
        if (!existingLoan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }
        const { lender_name, current_balance, interest_rate, monthly_payment, due_date, status } = req.body;
        const updates = [];
        const values = [];
        if (lender_name !== undefined) {
            updates.push('lender_name = ?');
            values.push(lender_name);
        }
        if (current_balance !== undefined) {
            updates.push('current_balance = ?');
            values.push(current_balance);
        }
        if (interest_rate !== undefined) {
            updates.push('interest_rate = ?');
            values.push(interest_rate);
        }
        if (monthly_payment !== undefined) {
            updates.push('monthly_payment = ?');
            values.push(monthly_payment);
        }
        if (due_date !== undefined) {
            updates.push('due_date = ?');
            values.push(due_date);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            values.push(status);
        }
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        values.push(loanId);
        await (0, database_1.dbRun)(`UPDATE loans SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
        const updatedLoan = await (0, database_1.dbGet)('SELECT * FROM loans WHERE id = ?', [loanId]);
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
router.post('/:id/payment', [
    (0, express_validator_1.body)('amount')
        .isFloat({ min: 0.01 })
        .withMessage('Payment amount must be a positive number'),
    (0, express_validator_1.body)('payment_date')
        .isISO8601()
        .withMessage('Payment date must be valid ISO date'),
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
        const loanId = parseInt(req.params.id);
        const { amount, payment_date, description } = req.body;
        if (isNaN(loanId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid loan ID'
            });
        }
        try {
            await (0, database_1.dbRun)('BEGIN TRANSACTION');
            const loan = await (0, database_1.dbGet)('SELECT id, lender_name, current_balance, status FROM loans WHERE id = ? AND user_id = ?', [loanId, userId]);
            if (!loan) {
                await (0, database_1.dbRun)('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: 'Loan not found'
                });
            }
            if (loan.status !== 'active') {
                await (0, database_1.dbRun)('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: 'Cannot make payments on inactive loans'
                });
            }
            if (parseFloat(amount) > parseFloat(loan.current_balance)) {
                await (0, database_1.dbRun)('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: `Payment amount cannot exceed current balance of ${loan.current_balance}`
                });
            }
            const newBalance = parseFloat(loan.current_balance) - parseFloat(amount);
            const newStatus = newBalance <= 0 ? 'paid' : 'active';
            await (0, database_1.dbRun)('UPDATE loans SET current_balance = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBalance, newStatus, loanId]);
            await (0, database_1.dbRun)('INSERT INTO transactions (user_id, transaction_type, reference_id, reference_table, amount, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, 'loan_payment', loanId, 'loans', amount, description || `Loan payment to ${loan.lender_name}`, payment_date]);
            const updatedLoan = await (0, database_1.dbGet)('SELECT * FROM loans WHERE id = ?', [loanId]);
            await (0, database_1.dbRun)('COMMIT');
            res.json({
                success: true,
                message: 'Loan payment recorded successfully',
                data: {
                    loan: updatedLoan,
                    payment: {
                        amount: amount,
                        date: payment_date,
                        description: description || `Loan payment to ${loan.lender_name}`,
                        new_balance: newBalance,
                        status: newStatus
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
        console.error('Record loan payment error:', error);
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
        const existingLoan = await (0, database_1.dbGet)('SELECT id, status FROM loans WHERE id = ? AND user_id = ?', [loanId, userId]);
        if (!existingLoan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }
        try {
            await (0, database_1.dbRun)('BEGIN TRANSACTION');
            await (0, database_1.dbRun)('DELETE FROM transactions WHERE reference_id = ? AND reference_table = ? AND user_id = ?', [loanId, 'loans', userId]);
            await (0, database_1.dbRun)('DELETE FROM loans WHERE id = ? AND user_id = ?', [loanId, userId]);
            await (0, database_1.dbRun)('COMMIT');
            res.json({
                success: true,
                message: 'Loan record deleted successfully'
            });
        }
        catch (error) {
            await (0, database_1.dbRun)('ROLLBACK');
            throw error;
        }
    }
    catch (error) {
        console.error('Delete loan error:', error);
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
        COUNT(*) as total_loans,
        SUM(principal_amount) as total_principal,
        SUM(current_balance) as total_current_balance,
        SUM(CASE WHEN status = 'active' THEN current_balance ELSE 0 END) as active_balance,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_loans,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_loans,
        AVG(CASE WHEN status = 'active' THEN interest_rate END) as avg_interest_rate
       FROM loans 
       WHERE user_id = ?`, [userId]);
        const typeStats = await (0, database_1.dbAll)(`SELECT 
        loan_type,
        COUNT(*) as count,
        SUM(principal_amount) as total_principal,
        SUM(current_balance) as total_balance
       FROM loans 
       WHERE user_id = ? 
       GROUP BY loan_type
       ORDER BY total_balance DESC`, [userId]);
        const recentPayments = await (0, database_1.dbAll)(`SELECT 
        t.amount, t.description, t.date, t.created_at,
        l.lender_name, l.loan_type
       FROM transactions t
       JOIN loans l ON t.reference_id = l.id
       WHERE t.user_id = ? AND t.transaction_type = 'loan_payment'
       ORDER BY t.created_at DESC
       LIMIT 10`, [userId]);
        res.json({
            success: true,
            data: {
                summary: stats,
                by_type: typeStats,
                recent_payments: recentPayments
            }
        });
    }
    catch (error) {
        console.error('Loan stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
exports.default = router;
