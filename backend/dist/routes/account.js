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
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const accounts = await (0, database_1.dbAll)(`SELECT 
        id, account_type, account_name, balance, bank_name, account_number,
        created_at, updated_at
       FROM accounts 
       WHERE business_id = $1 
       ORDER BY account_type, account_name`, [userId]);
        const totals = accounts.reduce((acc, account) => {
            if (!acc[account.account_type]) {
                acc[account.account_type] = 0;
            }
            acc[account.account_type] += parseFloat(account.balance);
            return acc;
        }, {});
        const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);
        res.json({
            success: true,
            data: {
                accounts,
                totals: {
                    ...totals,
                    grand_total: grandTotal
                }
            }
        });
    }
    catch (error) {
        console.error('Get accounts error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const accountId = parseInt(req.params.id);
        if (isNaN(accountId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid account ID'
            });
        }
        const account = await (0, database_1.dbGet)(`SELECT 
        id, account_type, account_name, balance, 
        created_at, updated_at
       FROM accounts 
       WHERE id = $1 AND business_id = $2`, [accountId, userId]);
        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }
        res.json({
            success: true,
            data: { account }
        });
    }
    catch (error) {
        console.error('Get account by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/', [
    (0, express_validator_1.body)('account_type')
        .isIn(['cash', 'bank', 'savings', 'investment'])
        .withMessage('Account type must be cash, bank, savings, or investment'),
    (0, express_validator_1.body)('account_name')
        .trim()
        .notEmpty()
        .isLength({ max: 100 })
        .withMessage('Account name is required and cannot exceed 100 characters'),
    (0, express_validator_1.body)('balance')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Balance must be a non-negative number')
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
        const { account_type, account_name, balance = 0, bank_name, account_number } = req.body;
        const existingAccount = await (0, database_1.dbGet)('SELECT id FROM accounts WHERE business_id = $1 AND account_name = $2', [userId, account_name]);
        if (existingAccount) {
            return res.status(409).json({
                success: false,
                message: 'Account name already exists'
            });
        }
        const result = await (0, database_1.dbRun)('INSERT INTO accounts (business_id, account_type, account_name, balance, bank_name, account_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [userId, account_type, account_name, balance, bank_name, account_number]);
        const accountId = result.lastID;
        const newAccount = await (0, database_1.dbGet)('SELECT * FROM accounts WHERE id = $1', [accountId]);
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: { account: newAccount }
        });
    }
    catch (error) {
        console.error('Create account error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.put('/:id', [
    (0, express_validator_1.body)('account_name')
        .optional()
        .trim()
        .notEmpty()
        .isLength({ max: 100 })
        .withMessage('Account name cannot be empty and cannot exceed 100 characters'),
    (0, express_validator_1.body)('balance')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Balance must be a non-negative number')
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
        const accountId = parseInt(req.params.id);
        if (isNaN(accountId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid account ID'
            });
        }
        const existingAccount = await (0, database_1.dbGet)('SELECT id FROM accounts WHERE id = $1 AND business_id = $2', [accountId, userId]);
        if (!existingAccount) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }
        const { account_name, balance, bank_name, account_number, account_type } = req.body;
        if (account_name) {
            const duplicateAccount = await (0, database_1.dbGet)('SELECT id FROM accounts WHERE business_id = $1 AND account_name = $2 AND id != $3', [userId, account_name, accountId]);
            if (duplicateAccount) {
                return res.status(409).json({
                    success: false,
                    message: 'Account name already exists'
                });
            }
        }
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (account_name !== undefined) {
            updates.push(`account_name = $${paramIndex++}`);
            values.push(account_name);
        }
        if (account_type !== undefined) {
            updates.push(`account_type = $${paramIndex++}`);
            values.push(account_type);
        }
        if (balance !== undefined) {
            updates.push(`balance = $${paramIndex++}`);
            values.push(balance);
        }
        if (bank_name !== undefined) {
            updates.push(`bank_name = $${paramIndex++}`);
            values.push(bank_name);
        }
        if (account_number !== undefined) {
            updates.push(`account_number = $${paramIndex++}`);
            values.push(account_number);
        }
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        values.push(accountId);
        await (0, database_1.dbRun)(`UPDATE accounts SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex++}`, values);
        const updatedAccount = await (0, database_1.dbGet)('SELECT * FROM accounts WHERE id = $1', [accountId]);
        res.json({
            success: true,
            message: 'Account updated successfully',
            data: { account: updatedAccount }
        });
    }
    catch (error) {
        console.error('Update account error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const accountId = parseInt(req.params.id);
        if (isNaN(accountId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid account ID'
            });
        }
        const account = await (0, database_1.dbGet)('SELECT id, balance FROM accounts WHERE id = $1 AND business_id = $2', [accountId, userId]);
        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }
        await (0, database_1.dbRun)('DELETE FROM accounts WHERE id = $1 AND business_id = $2', [accountId, userId]);
        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/transfer', [
    (0, express_validator_1.body)('from_account_id')
        .isInt({ min: 1 })
        .withMessage('Valid from account ID is required'),
    (0, express_validator_1.body)('to_account_id')
        .isInt({ min: 1 })
        .withMessage('Valid to account ID is required'),
    (0, express_validator_1.body)('amount')
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be a positive number'),
    (0, express_validator_1.body)('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters'),
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
        const { from_account_id, to_account_id, amount, description, date } = req.body;
        const fromId = parseInt(from_account_id);
        const toId = parseInt(to_account_id);
        if (fromId === toId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot transfer to the same account'
            });
        }
        try {
            await (0, database_1.dbRun)('BEGIN');
            const accounts = await (0, database_1.dbAll)('SELECT id, account_name, balance FROM accounts WHERE id IN ($1, $2) AND business_id = $3', [fromId, toId, userId]);
            if (accounts.length !== 2) {
                await (0, database_1.dbRun)('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: 'One or both accounts not found'
                });
            }
            const fromAccount = accounts.find((acc) => acc.id === fromId);
            const toAccount = accounts.find((acc) => acc.id === toId);
            if (parseFloat(fromAccount.balance) < parseFloat(amount)) {
                await (0, database_1.dbRun)('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient balance in source account'
                });
            }
            await (0, database_1.dbRun)('UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [amount, fromId]);
            await (0, database_1.dbRun)('UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [amount, toId]);
            const updatedAccounts = await (0, database_1.dbAll)('SELECT id, account_name, balance FROM accounts WHERE id IN ($1, $2)', [fromId, toId]);
            await (0, database_1.dbRun)('COMMIT');
            res.json({
                success: true,
                message: 'Transfer completed successfully',
                data: {
                    transfer: {
                        from_account: updatedAccounts.find((acc) => acc.id === fromId),
                        to_account: updatedAccounts.find((acc) => acc.id === toId),
                        amount,
                        description,
                        date
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
        console.error('Transfer error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
exports.default = router;
