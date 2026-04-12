"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const jwt_1 = require("../utils/jwt");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes'
});
router.post('/register', [
    (0, express_validator_1.body)('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    (0, express_validator_1.body)('business_name').isLength({ min: 1 }).withMessage('Business name is required')
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
        const { username, email, password, business_name } = req.body;
        const existingUser = await (0, database_1.dbGet)('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username or email already exists'
            });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const userResult = await (0, database_1.dbRun)('INSERT INTO users (username, email, password_hash, user_type) VALUES ($1, $2, $3, $4) RETURNING id', [username, email, passwordHash, 'admin']);
        const userId = userResult.lastID;
        const businessResult = await (0, database_1.dbRun)('INSERT INTO businesses (name, owner_id) VALUES ($1, $2) RETURNING id', [business_name, userId]);
        const businessId = businessResult.lastID;
        await (0, database_1.dbRun)('UPDATE users SET business_id = $1 WHERE id = $2', [businessId, userId]);
        await (0, database_1.dbRun)('INSERT INTO accounts (business_id, account_type, account_name, balance) VALUES ($1, $2, $3, $4) RETURNING id', [businessId, 'cash', 'Cash', 0]);
        const user = await (0, database_1.dbGet)('SELECT u.id, u.username, u.email, u.user_type, u.business_id, b.name as business_name FROM users u JOIN businesses b ON u.business_id = b.id WHERE u.id = $1', [userId]);
        const token = (0, jwt_1.generateToken)(user.id, user.username, user.email, user.user_type, user.business_id, user.business_name);
        res.status(201).json({
            success: true,
            data: {
                user,
                token
            },
            message: 'User registered successfully'
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/login', loginLimiter, [
    (0, express_validator_1.body)('login').notEmpty().withMessage('Username or email is required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required')
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
        const { login, password } = req.body;
        const user = await (0, database_1.dbGet)('SELECT u.*, b.name as business_name FROM users u LEFT JOIN businesses b ON u.business_id = b.id WHERE (u.username = $1 OR u.email = $2) AND u.is_active = TRUE', [login, login]);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        await (0, database_1.dbRun)('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        const token = (0, jwt_1.generateToken)(user.id, user.username, user.email, user.user_type || 'admin', user.business_id, user.business_name);
        const { password_hash, ...userWithoutPassword } = user;
        res.json({
            success: true,
            data: {
                user: userWithoutPassword,
                token
            },
            message: 'Login successful'
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await (0, database_1.dbGet)('SELECT u.id, u.username, u.email, u.user_type, u.business_id, b.name as business_name FROM users u LEFT JOIN businesses b ON u.business_id = b.id WHERE u.id = $1', [userId]);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.json({
            success: true,
            data: {
                user
            }
        });
    }
    catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.put('/profile', [
    auth_1.authenticateToken,
    (0, express_validator_1.body)('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    (0, express_validator_1.body)('email').optional().isEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('full_name').optional().isLength({ min: 1 }).withMessage('Full name is required'),
    (0, express_validator_1.body)('business_name').optional().isLength({ min: 1 }).withMessage('Business name is required')
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
        const businessId = req.user.businessId;
        const { username, email, full_name, business_name } = req.body;
        if (username) {
            const existingUser = await (0, database_1.dbGet)('SELECT id FROM users WHERE username = $1 AND id != $2', [username, userId]);
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Username already taken' });
            }
        }
        if (email) {
            const existingUser = await (0, database_1.dbGet)('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Email already taken' });
            }
        }
        const updates = [];
        const values = [];
        let placeholderIndex = 1;
        if (username) {
            updates.push(`username = $${placeholderIndex++}`);
            values.push(username);
        }
        if (email) {
            updates.push(`email = $${placeholderIndex++}`);
            values.push(email);
        }
        if (full_name) {
            updates.push(`full_name = $${placeholderIndex++}`);
            values.push(full_name);
        }
        if (business_name) {
            await (0, database_1.dbRun)('UPDATE businesses SET name = $1 WHERE id = $2', [business_name, businessId]);
        }
        if (updates.length === 0 && !business_name) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }
        updates.push('updated_at = NOW()');
        values.push(userId);
        await (0, database_1.dbRun)(`UPDATE users SET ${updates.join(', ')} WHERE id = $${placeholderIndex}`, values);
        const user = await (0, database_1.dbGet)('SELECT id, username, email, user_type, business_id, created_at, full_name FROM users WHERE id = $1', [userId]);
        res.json({
            success: true,
            data: {
                user
            },
            message: 'Profile updated successfully'
        });
    }
    catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/change-password', [
    auth_1.authenticateToken,
    (0, express_validator_1.body)('current_password').notEmpty().withMessage('Current password is required'),
    (0, express_validator_1.body)('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
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
        const { current_password, new_password } = req.body;
        const user = await (0, database_1.dbGet)('SELECT * FROM users WHERE id = $1', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const isPasswordValid = await bcryptjs_1.default.compare(current_password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid current password' });
        }
        const newPasswordHash = await bcryptjs_1.default.hash(new_password, 12);
        await (0, database_1.dbRun)('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newPasswordHash, userId]);
        res.json({ success: true, message: 'Password changed successfully' });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
router.delete('/account', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const businessId = req.user.businessId;
        await (0, database_1.dbRun)('BEGIN');
        await (0, database_1.dbRun)('DELETE FROM charity_payments WHERE charity_id IN (SELECT id FROM charity WHERE business_id = $1)', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM charity WHERE business_id = $1', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM sales WHERE business_id = $1', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM purchases WHERE business_id = $1', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM expenses WHERE business_id = $1', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM income WHERE business_id = $1', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM loan_payments WHERE loan_id IN (SELECT id FROM loans WHERE business_id = $1)', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM loans WHERE business_id = $1', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM payroll WHERE employee_id IN (SELECT id FROM employees WHERE business_id = $1)', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM attendance WHERE employee_id IN (SELECT id FROM employees WHERE business_id = $1)', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM employees WHERE business_id = $1', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM accounts_receivable WHERE business_id = $1', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM accounts_payable WHERE business_id = $1', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM accounts WHERE business_id = $1', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM user_preferences WHERE user_id = $1', [userId]);
        await (0, database_1.dbRun)('DELETE FROM businesses WHERE id = $1', [businessId]);
        await (0, database_1.dbRun)('DELETE FROM users WHERE id = $1', [userId]);
        await (0, database_1.dbRun)('COMMIT');
        res.json({ success: true, message: 'Account deleted successfully' });
    }
    catch (error) {
        await (0, database_1.dbRun)('ROLLBACK');
        console.error('Account deletion error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
router.post('/employee/login', [
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required')
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
        const { email, password } = req.body;
        const employee = await (0, database_1.dbGet)('SELECT * FROM employees WHERE email = $1 AND status = \'active\'', [email]);
        if (!employee) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials or employee not active'
            });
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, employee.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        const token = (0, jwt_1.generateToken)(employee.id, employee.email, employee.email, 'employee', employee.business_id);
        const { password_hash, ...employeeWithoutPassword } = employee;
        res.json({
            success: true,
            data: {
                user: { ...employeeWithoutPassword, user_type: 'employee' },
                token
            },
            message: 'Employee login successful'
        });
    }
    catch (error) {
        console.error('Employee login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/employee/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const employeeId = req.user.userId;
        const employee = await (0, database_1.dbGet)('SELECT * FROM employees WHERE id = $1', [employeeId]);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }
        const { password_hash, ...employeeWithoutPassword } = employee;
        res.json({
            success: true,
            data: {
                user: { ...employeeWithoutPassword, user_type: 'employee' }
            }
        });
    }
    catch (error) {
        console.error('Employee profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
exports.default = router;
