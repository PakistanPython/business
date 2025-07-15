"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const jwt_1 = require("../utils/jwt");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/register', [
    (0, express_validator_1.body)('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    (0, express_validator_1.body)('full_name').notEmpty().withMessage('Full name is required'),
    (0, express_validator_1.body)('business_name').optional()
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
        const { username, email, password, full_name, business_name } = req.body;
        const existingUser = await (0, database_1.dbGet)('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username or email already exists'
            });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const result = await (0, database_1.dbRun)('INSERT INTO users (username, email, password_hash, full_name, business_name) VALUES ($1, $2, $3, $4, $5) RETURNING id', [username, email, passwordHash, full_name, business_name || null]);
        const userId = result.rows?.[0]?.id;
        const defaultCategories = [
            { name: 'Salary', type: 'income', color: '#10B981', icon: 'dollar-sign' },
            { name: 'Business', type: 'income', color: '#3B82F6', icon: 'briefcase' },
            { name: 'Investment', type: 'income', color: '#8B5CF6', icon: 'trending-up' },
            { name: 'Food', type: 'expense', color: '#EF4444', icon: 'utensils' },
            { name: 'Transport', type: 'expense', color: '#F59E0B', icon: 'car' },
            { name: 'Utilities', type: 'expense', color: '#6B7280', icon: 'zap' },
            { name: 'Entertainment', type: 'expense', color: '#EC4899', icon: 'music' },
            { name: 'Inventory', type: 'purchase', color: '#059669', icon: 'package' },
            { name: 'Equipment', type: 'purchase', color: '#DC2626', icon: 'tool' },
            { name: 'Retail', type: 'sale', color: '#16A34A', icon: 'shopping-bag' },
            { name: 'Service', type: 'sale', color: '#2563EB', icon: 'service' }
        ];
        for (const category of defaultCategories) {
            await (0, database_1.dbRun)('INSERT INTO categories (user_id, name, type, color, icon) VALUES ($1, $2, $3, $4, $5)', [userId, category.name, category.type, category.color, category.icon]);
        }
        await (0, database_1.dbRun)('INSERT INTO accounts (user_id, account_type, account_name, balance) VALUES ($1, $2, $3, $4)', [userId, 'cash', 'Cash', 0]);
        const user = await (0, database_1.dbGet)('SELECT id, username, email, full_name, business_name, user_type, business_id, created_at FROM users WHERE id = $1', [userId]);
        const token = (0, jwt_1.generateToken)(user.id, user.username, user.email, user.user_type, user.business_id);
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
router.post('/login', [
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
        const user = await (0, database_1.dbGet)('SELECT * FROM users WHERE (username = $1 OR email = $2) AND is_active = 1', [login, login]);
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
        const token = (0, jwt_1.generateToken)(user.id, user.username, user.email, user.user_type || 'business_owner', user.business_id);
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
        const user = await (0, database_1.dbGet)('SELECT id, username, email, full_name, business_name, user_type, business_id, created_at FROM users WHERE id = $1', [userId]);
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
    (0, express_validator_1.body)('email').optional().isEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('full_name').optional().notEmpty().withMessage('Full name cannot be empty'),
    (0, express_validator_1.body)('business_name').optional()
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
        const { email, full_name, business_name } = req.body;
        if (email) {
            const existingUser = await (0, database_1.dbGet)('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already taken'
                });
            }
        }
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (email) {
            updates.push(`email = $${paramIndex++}`);
            values.push(email);
        }
        if (full_name) {
            updates.push(`full_name = $${paramIndex++}`);
            values.push(full_name);
        }
        if (business_name !== undefined) {
            updates.push(`business_name = $${paramIndex++}`);
            values.push(business_name);
        }
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }
        await (0, database_1.dbRun)(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`, [...values, userId]);
        const user = await (0, database_1.dbGet)('SELECT id, username, email, full_name, business_name, user_type, business_id, created_at FROM users WHERE id = $1', [userId]);
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
        const employee = await (0, database_1.dbGet)('SELECT * FROM employees WHERE email = $1 AND status = $2', [email, 'active']);
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
                user: employeeWithoutPassword,
                token,
                user_type: 'employee'
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
exports.default = router;
