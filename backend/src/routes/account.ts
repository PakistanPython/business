import express from 'express';
import { body, validationResult } from 'express-validator';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all accounts
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const accounts = await dbAll(
      `SELECT 
        id, account_type, account_name, balance, 
        created_at, updated_at
       FROM accounts 
       WHERE business_id = $1 
       ORDER BY account_type, account_name`,
      [userId]
    );

    // Calculate totals by account type
    const totals = accounts.reduce((acc: any, account: any) => {
      if (!acc[account.account_type]) {
        acc[account.account_type] = 0;
      }
      acc[account.account_type] += parseFloat(account.balance);
      return acc;
    }, {});

    const grandTotal = Object.values(totals).reduce((sum: any, val: any) => sum + val, 0);

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
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get account by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const accountId = parseInt(req.params.id);

    if (isNaN(accountId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID'
      });
    }

    const account = await dbGet(
      `SELECT 
        id, account_type, account_name, balance, 
        created_at, updated_at
       FROM accounts 
       WHERE id = $1 AND business_id = $2`,
      [accountId, userId]
    );

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
  } catch (error) {
    console.error('Get account by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new account
router.post('/', [
  body('account_type')
    .isIn(['cash', 'bank', 'savings', 'investment'])
    .withMessage('Account type must be cash, bank, savings, or investment'),
  body('account_name')
    .trim()
    .notEmpty()
    .isLength({ max: 100 })
    .withMessage('Account name is required and cannot exceed 100 characters'),
  body('balance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Balance must be a non-negative number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user!.userId;
    const { account_type, account_name, balance = 0 } = req.body;

    // Check for duplicate account name for the user
    const existingAccount = await dbGet(
      'SELECT id FROM accounts WHERE business_id = $1 AND account_name = $2',
      [userId, account_name]
    );

    if (existingAccount) {
      return res.status(409).json({
        success: false,
        message: 'Account name already exists'
      });
    }

    // Insert account record
    const result = await dbRun(
      'INSERT INTO accounts (business_id, account_type, account_name, balance) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, account_type, account_name, balance]
    );

    const accountId = result.lastID;

    // Get the created account record
    const newAccount = await dbGet(
      'SELECT * FROM accounts WHERE id = $1',
      [accountId]
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { account: newAccount }
    });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update account
router.put('/:id', [
  body('account_name')
    .optional()
    .trim()
    .notEmpty()
    .isLength({ max: 100 })
    .withMessage('Account name cannot be empty and cannot exceed 100 characters'),
  body('balance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Balance must be a non-negative number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user!.userId;
    const accountId = parseInt(req.params.id);

    if (isNaN(accountId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID'
      });
    }

    // Check if account exists and belongs to user
    const existingAccount = await dbGet(
      'SELECT id FROM accounts WHERE id = $1 AND business_id = $2',
      [accountId, userId]
    );

    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    const { account_name, balance } = req.body;

    // Check for duplicate account name if changing name
    if (account_name) {
      const duplicateAccount = await dbGet(
        'SELECT id FROM accounts WHERE business_id = $1 AND account_name = $2 AND id != $3',
        [userId, account_name, accountId]
      );

      if (duplicateAccount) {
        return res.status(409).json({
          success: false,
          message: 'Account name already exists'
        });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (account_name !== undefined) {
      updates.push(`account_name = $${paramIndex++}`);
      values.push(account_name);
    }
    if (balance !== undefined) {
      updates.push(`balance = $${paramIndex++}`);
      values.push(balance);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(accountId);

    // Update account record
    await dbRun(
      `UPDATE accounts SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex++}`,
      values
    );

    // Get updated record
    const updatedAccount = await dbGet(
      'SELECT * FROM accounts WHERE id = $1',
      [accountId]
    );

    res.json({
      success: true,
      message: 'Account updated successfully',
      data: { account: updatedAccount }
    });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete account
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const accountId = parseInt(req.params.id);

    if (isNaN(accountId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID'
      });
    }

    // Check if account exists and belongs to user
    const account = await dbGet(
      'SELECT id, balance FROM accounts WHERE id = $1 AND business_id = $2',
      [accountId, userId]
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Check if account has balance
    if (parseFloat(account.balance) !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete account with non-zero balance'
      });
    }

    // Delete account record
    await dbRun(
      'DELETE FROM accounts WHERE id = $1 AND business_id = $2',
      [accountId, userId]
    );

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Transfer money between accounts
router.post('/transfer', [
  body('from_account_id')
    .isInt({ min: 1 })
    .withMessage('Valid from account ID is required'),
  body('to_account_id')
    .isInt({ min: 1 })
    .withMessage('Valid to account ID is required'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('date')
    .isISO8601()
    .withMessage('Date must be valid ISO date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user!.userId;
    const { from_account_id, to_account_id, amount, description, date } = req.body;

    if (from_account_id === to_account_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer to the same account'
      });
    }

    try {
      await dbRun('BEGIN');

      const accounts = await dbAll(
        'SELECT id, account_name, balance FROM accounts WHERE id IN ($1, $2) AND business_id = $3',
        [from_account_id, to_account_id, userId]
      );

      if (accounts.length !== 2) {
        await dbRun('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'One or both accounts not found'
        });
      }

      const fromAccount = accounts.find((acc: any) => acc.id === from_account_id);
      const toAccount = accounts.find((acc: any) => acc.id === to_account_id);

      if (parseFloat(fromAccount.balance) < parseFloat(amount)) {
        await dbRun('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance in source account'
        });
      }

      await dbRun(
        'UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
        [amount, from_account_id]
      );

      await dbRun(
        'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
        [amount, to_account_id]
      );

      const updatedAccounts = await dbAll(
        'SELECT id, account_name, balance FROM accounts WHERE id IN ($1, $2)',
        [from_account_id, to_account_id]
      );

      await dbRun('COMMIT');

      res.json({
        success: true,
        message: 'Transfer completed successfully',
        data: {
          transfer: {
            from_account: updatedAccounts.find((acc: any) => acc.id === from_account_id),
            to_account: updatedAccounts.find((acc: any) => acc.id === to_account_id),
            amount,
            description,
            date
          }
        }
      });
    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
