"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const express_validator_1 = require("express-validator");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const userType = req.user.userType;
        if (userType === 'employee') {
            return res.json({ success: true, data: {} });
        }
        let preferences = await (0, database_1.dbGet)('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
        if (!preferences) {
            const defaultPreferences = {
                email_notifications: true,
                push_notifications: false,
                weekly_reports: true,
                monthly_summary: true,
                currency: 'USD',
                date_format: 'MM/DD/YYYY',
                theme: 'light'
            };
            await (0, database_1.dbRun)('INSERT INTO user_preferences (user_id, email_notifications, push_notifications, weekly_reports, monthly_summary, currency, date_format, theme) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [userId, ...Object.values(defaultPreferences)]);
            preferences = await (0, database_1.dbGet)('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
        }
        res.json({ success: true, data: preferences });
    }
    catch (error) {
        console.error('Error fetching preferences:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
router.put('/', [
    (0, express_validator_1.body)('email_notifications').isBoolean(),
    (0, express_validator_1.body)('push_notifications').isBoolean(),
    (0, express_validator_1.body)('weekly_reports').isBoolean(),
    (0, express_validator_1.body)('monthly_summary').isBoolean(),
    (0, express_validator_1.body)('currency').isIn(['USD', 'EUR', 'GBP', 'JPY', 'PKR']),
    (0, express_validator_1.body)('date_format').isIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']),
    (0, express_validator_1.body)('theme').isIn(['light', 'dark', 'auto'])
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
        const userId = req.user.userId;
        const userType = req.user.userType;
        if (userType === 'employee') {
            return res.status(403).json({ success: false, message: 'Employees cannot update preferences.' });
        }
        const { email_notifications, push_notifications, weekly_reports, monthly_summary, currency, date_format, theme } = req.body;
        await (0, database_1.dbRun)(`UPDATE user_preferences SET 
        email_notifications = $1, 
        push_notifications = $2, 
        weekly_reports = $3, 
        monthly_summary = $4, 
        currency = $5, 
        date_format = $6, 
        theme = $7
      WHERE user_id = $8`, [
            email_notifications,
            push_notifications,
            weekly_reports,
            monthly_summary,
            currency,
            date_format,
            theme,
            userId
        ]);
        res.json({ success: true, message: 'Preferences updated successfully' });
    }
    catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
exports.default = router;
