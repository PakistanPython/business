"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
router.get('/', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { employee_id, is_active } = req.query;
        let query = `
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE ws.business_id = $2
    `;
        const params = [businessId];
        if (employee_id) {
            query += ' AND ws.employee_id = ?';
            params.push(employee_id);
        }
        if (is_active !== undefined) {
            query += ' AND ws.is_active = ?';
            params.push(is_active === 'true' ? 1 : 0);
        }
        query += ' ORDER BY ws.effective_from DESC';
        const schedules = await (0, database_1.dbAll)(query, params);
        res.json(schedules);
    }
    catch (error) {
        console.error('Error fetching work schedules:', error);
        res.status(500).json({ error: 'Failed to fetch work schedules' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const schedule = await (0, database_1.dbGet)(`
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE ws.id = $2 AND ws.business_id = $3
    `, [id, businessId]);
        if (!schedule) {
            return res.status(404).json({ error: 'Work schedule not found' });
        }
        res.json(schedule);
    }
    catch (error) {
        console.error('Error fetching work schedule:', error);
        res.status(500).json({ error: 'Failed to fetch work schedule' });
    }
});
router.post('/', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { employee_id, schedule_name, effective_from, effective_to, monday_start, monday_end, tuesday_start, tuesday_end, wednesday_start, wednesday_end, thursday_start, thursday_end, friday_start, friday_end, saturday_start, saturday_end, sunday_start, sunday_end, break_duration, weekly_hours } = req.body;
        if (!employee_id || !schedule_name || !effective_from) {
            return res.status(400).json({
                error: 'Employee ID, schedule name, and effective from date are required'
            });
        }
        const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE id = $1 AND business_id = $2', [employee_id, businessId]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        if (req.body.is_active) {
            await (0, database_1.dbRun)('UPDATE employee_work_schedules SET is_active = 0 WHERE employee_id = $1 AND business_id = $2', [employee_id, businessId]);
        }
        const result = await (0, database_1.dbRun)(`
      INSERT INTO employee_work_schedules (
        employee_id, business_id, schedule_name, effective_from, effective_to,
        monday_start, monday_end, tuesday_start, tuesday_end,
        wednesday_start, wednesday_end, thursday_start, thursday_end,
        friday_start, friday_end, saturday_start, saturday_end,
        sunday_start, sunday_end, break_duration, weekly_hours, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING id
    `, [
            employee_id, businessId, schedule_name, effective_from, effective_to,
            monday_start, monday_end, tuesday_start, tuesday_end,
            wednesday_start, wednesday_end, thursday_start, thursday_end,
            friday_start, friday_end, saturday_start, saturday_end,
            sunday_start, sunday_end, break_duration || 60, weekly_hours || 40,
            req.body.is_active ? 1 : 0
        ]);
        const newSchedule = await (0, database_1.dbGet)(`
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE ws.id = $1
    `, [result.lastID]);
        res.status(201).json(newSchedule);
    }
    catch (error) {
        console.error('Error creating work schedule:', error);
        res.status(500).json({ error: 'Failed to create work schedule' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const { schedule_name, effective_from, effective_to, monday_start, monday_end, tuesday_start, tuesday_end, wednesday_start, wednesday_end, thursday_start, thursday_end, friday_start, friday_end, saturday_start, saturday_end, sunday_start, sunday_end, break_duration, weekly_hours, is_active } = req.body;
        const existingSchedule = await (0, database_1.dbGet)('SELECT * FROM employee_work_schedules WHERE id = $1 AND business_id = $2', [id, businessId]);
        if (!existingSchedule) {
            return res.status(404).json({ error: 'Work schedule not found' });
        }
        if (is_active) {
            await (0, database_1.dbRun)('UPDATE employee_work_schedules SET is_active = 0 WHERE employee_id = $1 AND business_id = $2 AND id != $3', [existingSchedule.employee_id, businessId, id]);
        }
        await (0, database_1.dbRun)(`
      UPDATE employee_work_schedules SET
        schedule_name = $1, effective_from = $2, effective_to = $3,
        monday_start = $4, monday_end = $5, tuesday_start = $6, tuesday_end = $7,
        wednesday_start = $8, wednesday_end = $9, thursday_start = $10, thursday_end = $11,
        friday_start = $12, friday_end = $13, saturday_start = $14, saturday_end = $15,
        sunday_start = $16, sunday_end = $17, break_duration = $18, weekly_hours = $19,
        is_active = $20, updated_at = NOW()
      WHERE id = $21 AND business_id = $22
    `, [
            schedule_name || existingSchedule.schedule_name,
            effective_from || existingSchedule.effective_from,
            effective_to || existingSchedule.effective_to,
            monday_start || existingSchedule.monday_start,
            monday_end || existingSchedule.monday_end,
            tuesday_start || existingSchedule.tuesday_start,
            tuesday_end || existingSchedule.tuesday_end,
            wednesday_start || existingSchedule.wednesday_start,
            wednesday_end || existingSchedule.wednesday_end,
            thursday_start || existingSchedule.thursday_start,
            thursday_end || existingSchedule.thursday_end,
            friday_start || existingSchedule.friday_start,
            friday_end || existingSchedule.friday_end,
            saturday_start || existingSchedule.saturday_start,
            saturday_end || existingSchedule.saturday_end,
            sunday_start || existingSchedule.sunday_start,
            sunday_end || existingSchedule.sunday_end,
            break_duration || existingSchedule.break_duration,
            weekly_hours || existingSchedule.weekly_hours,
            is_active !== undefined ? (is_active ? 1 : 0) : existingSchedule.is_active,
            id,
            businessId
        ]);
        const updatedSchedule = await (0, database_1.dbGet)(`
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE ws.id = $1
    `, [id]);
        res.json(updatedSchedule);
    }
    catch (error) {
        console.error('Error updating work schedule:', error);
        res.status(500).json({ error: 'Failed to update work schedule' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const schedule = await (0, database_1.dbGet)('SELECT id FROM employee_work_schedules WHERE id = $1 AND business_id = $2', [id, businessId]);
        if (!schedule) {
            return res.status(404).json({ error: 'Work schedule not found' });
        }
        await (0, database_1.dbRun)('DELETE FROM employee_work_schedules WHERE id = ? AND business_id = ?', [id, businessId]);
        res.json({ message: 'Work schedule deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting work schedule:', error);
        res.status(500).json({ error: 'Failed to delete work schedule' });
    }
});
router.get('/employee/:employeeId/current', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const businessId = req.user?.userId;
        const currentDate = new Date().toISOString().split('T')[0];
        const schedule = await (0, database_1.dbGet)(`
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE ws.employee_id = $1 AND ws.business_id = $2 
        AND ws.is_active = 1
        AND ws.effective_from <= $3
        AND (ws.effective_to IS NULL OR ws.effective_to >= $4)
      ORDER BY ws.effective_from DESC
      LIMIT 1
    `, [employeeId, businessId, currentDate, currentDate]);
        res.json(schedule || null);
    }
    catch (error) {
        console.error('Error fetching current work schedule:', error);
        res.status(500).json({ error: 'Failed to fetch current work schedule' });
    }
});
exports.default = router;
