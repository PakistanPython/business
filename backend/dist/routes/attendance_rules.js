"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_sqlite_1 = require("../config/database_sqlite");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
router.get('/', async (req, res) => {
    try {
        const businessId = req.user?.userId;
        const rules = await (0, database_sqlite_1.dbAll)(`
      SELECT * FROM attendance_rules 
      WHERE business_id = ?
      ORDER BY is_active DESC, created_at DESC
    `, [businessId]);
        res.json(rules);
    }
    catch (error) {
        console.error('Error fetching attendance rules:', error);
        res.status(500).json({ error: 'Failed to fetch attendance rules' });
    }
});
router.get('/active', async (req, res) => {
    try {
        const businessId = req.user?.userId;
        const activeRule = await (0, database_sqlite_1.dbGet)(`
      SELECT * FROM attendance_rules 
      WHERE business_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 1
    `, [businessId]);
        res.json(activeRule || null);
    }
    catch (error) {
        console.error('Error fetching active attendance rule:', error);
        res.status(500).json({ error: 'Failed to fetch active attendance rule' });
    }
});
router.post('/', async (req, res) => {
    try {
        const businessId = req.user?.userId;
        const { rule_name, late_grace_period, late_penalty_type, late_penalty_amount, half_day_threshold, overtime_threshold, overtime_rate, min_working_hours, max_working_hours, auto_clock_out, auto_clock_out_time, weekend_overtime, holiday_overtime, is_active } = req.body;
        if (!rule_name) {
            return res.status(400).json({ error: 'Rule name is required' });
        }
        if (is_active) {
            await (0, database_sqlite_1.dbRun)('UPDATE attendance_rules SET is_active = 0 WHERE business_id = ?', [businessId]);
        }
        const result = await (0, database_sqlite_1.dbRun)(`
      INSERT INTO attendance_rules (
        business_id, rule_name, late_grace_period, late_penalty_type, late_penalty_amount,
        half_day_threshold, overtime_threshold, overtime_rate, min_working_hours,
        max_working_hours, auto_clock_out, auto_clock_out_time, weekend_overtime,
        holiday_overtime, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            businessId, rule_name,
            late_grace_period || 15,
            late_penalty_type || 'none',
            late_penalty_amount || 0,
            half_day_threshold || 240,
            overtime_threshold || 480,
            overtime_rate || 1.5,
            min_working_hours || 8,
            max_working_hours || 12,
            auto_clock_out ? 1 : 0,
            auto_clock_out_time || '18:00',
            weekend_overtime ? 1 : 0,
            holiday_overtime ? 1 : 0,
            is_active ? 1 : 0
        ]);
        const newRule = await (0, database_sqlite_1.dbGet)('SELECT * FROM attendance_rules WHERE id = ?', [result.lastID]);
        res.status(201).json(newRule);
    }
    catch (error) {
        console.error('Error creating attendance rule:', error);
        res.status(500).json({ error: 'Failed to create attendance rule' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const { rule_name, late_grace_period, late_penalty_type, late_penalty_amount, half_day_threshold, overtime_threshold, overtime_rate, min_working_hours, max_working_hours, auto_clock_out, auto_clock_out_time, weekend_overtime, holiday_overtime, is_active } = req.body;
        const existingRule = await (0, database_sqlite_1.dbGet)('SELECT * FROM attendance_rules WHERE id = ? AND business_id = ?', [id, businessId]);
        if (!existingRule) {
            return res.status(404).json({ error: 'Attendance rule not found' });
        }
        if (is_active && !existingRule.is_active) {
            await (0, database_sqlite_1.dbRun)('UPDATE attendance_rules SET is_active = 0 WHERE business_id = ? AND id != ?', [businessId, id]);
        }
        await (0, database_sqlite_1.dbRun)(`
      UPDATE attendance_rules SET
        rule_name = ?, late_grace_period = ?, late_penalty_type = ?, late_penalty_amount = ?,
        half_day_threshold = ?, overtime_threshold = ?, overtime_rate = ?, min_working_hours = ?,
        max_working_hours = ?, auto_clock_out = ?, auto_clock_out_time = ?, weekend_overtime = ?,
        holiday_overtime = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `, [
            rule_name || existingRule.rule_name,
            late_grace_period || existingRule.late_grace_period,
            late_penalty_type || existingRule.late_penalty_type,
            late_penalty_amount || existingRule.late_penalty_amount,
            half_day_threshold || existingRule.half_day_threshold,
            overtime_threshold || existingRule.overtime_threshold,
            overtime_rate || existingRule.overtime_rate,
            min_working_hours || existingRule.min_working_hours,
            max_working_hours || existingRule.max_working_hours,
            auto_clock_out !== undefined ? (auto_clock_out ? 1 : 0) : existingRule.auto_clock_out,
            auto_clock_out_time || existingRule.auto_clock_out_time,
            weekend_overtime !== undefined ? (weekend_overtime ? 1 : 0) : existingRule.weekend_overtime,
            holiday_overtime !== undefined ? (holiday_overtime ? 1 : 0) : existingRule.holiday_overtime,
            is_active !== undefined ? (is_active ? 1 : 0) : existingRule.is_active,
            id,
            businessId
        ]);
        const updatedRule = await (0, database_sqlite_1.dbGet)('SELECT * FROM attendance_rules WHERE id = ?', [id]);
        res.json(updatedRule);
    }
    catch (error) {
        console.error('Error updating attendance rule:', error);
        res.status(500).json({ error: 'Failed to update attendance rule' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const rule = await (0, database_sqlite_1.dbGet)('SELECT is_active FROM attendance_rules WHERE id = ? AND business_id = ?', [id, businessId]);
        if (!rule) {
            return res.status(404).json({ error: 'Attendance rule not found' });
        }
        if (rule.is_active) {
            return res.status(400).json({ error: 'Cannot delete active attendance rule' });
        }
        await (0, database_sqlite_1.dbRun)('DELETE FROM attendance_rules WHERE id = ? AND business_id = ?', [id, businessId]);
        res.json({ message: 'Attendance rule deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting attendance rule:', error);
        res.status(500).json({ error: 'Failed to delete attendance rule' });
    }
});
router.post('/:id/activate', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const rule = await (0, database_sqlite_1.dbGet)('SELECT * FROM attendance_rules WHERE id = ? AND business_id = ?', [id, businessId]);
        if (!rule) {
            return res.status(404).json({ error: 'Attendance rule not found' });
        }
        await (0, database_sqlite_1.dbRun)('UPDATE attendance_rules SET is_active = 0 WHERE business_id = ?', [businessId]);
        await (0, database_sqlite_1.dbRun)('UPDATE attendance_rules SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        const updatedRule = await (0, database_sqlite_1.dbGet)('SELECT * FROM attendance_rules WHERE id = ?', [id]);
        res.json(updatedRule);
    }
    catch (error) {
        console.error('Error activating attendance rule:', error);
        res.status(500).json({ error: 'Failed to activate attendance rule' });
    }
});
router.get('/defaults', async (req, res) => {
    try {
        const defaults = {
            rule_name: 'Standard Working Hours',
            late_grace_period: 15,
            late_penalty_type: 'none',
            late_penalty_amount: 0,
            half_day_threshold: 240,
            overtime_threshold: 480,
            overtime_rate: 1.5,
            min_working_hours: 8,
            max_working_hours: 12,
            auto_clock_out: false,
            auto_clock_out_time: '18:00',
            weekend_overtime: true,
            holiday_overtime: true
        };
        res.json(defaults);
    }
    catch (error) {
        console.error('Error fetching default rules:', error);
        res.status(500).json({ error: 'Failed to fetch default rules' });
    }
});
exports.default = router;
