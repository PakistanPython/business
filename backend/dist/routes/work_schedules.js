"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const attendance_recalculation_1 = require("../utils/attendance_recalculation");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
const normalizeDateKey = (value) => {
    if (!value)
        return null;
    if (value instanceof Date)
        return value.toISOString().split('T')[0];
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw))
        return raw.slice(0, 10);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return parsed.toISOString().split('T')[0];
};
const getMinDate = (first, second) => (first <= second ? first : second);
const getMaxDate = (first, second) => (first >= second ? first : second);
router.get('/', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { employee_id } = req.query;
        let query = `
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE e.business_id = $1
    `;
        const params = [businessId];
        if (employee_id) {
            query += ' AND ws.employee_id = $2';
            params.push(employee_id);
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
router.post('/', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { employee_id, schedule_name, effective_from, effective_to, monday_start, monday_end, tuesday_start, tuesday_end, wednesday_start, wednesday_end, thursday_start, thursday_end, friday_start, friday_end, saturday_start, saturday_end, sunday_start, sunday_end, break_duration, weekly_hours, late_come_threshold_minutes, half_day_hours, is_active } = req.body;
        if (!employee_id || !schedule_name || !effective_from) {
            return res.status(400).json({
                error: 'Employee ID, schedule name and effective from are required'
            });
        }
        const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE id = $1 AND business_id = $2', [employee_id, businessId]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const result = await (0, database_1.dbRun)(`
      INSERT INTO employee_work_schedules (
        employee_id, business_id, schedule_name, effective_from, effective_to,
        monday_start, monday_end, tuesday_start, tuesday_end,
        wednesday_start, wednesday_end, thursday_start, thursday_end,
        friday_start, friday_end, saturday_start, saturday_end,
        sunday_start, sunday_end, break_duration, weekly_hours,
        late_come_threshold_minutes, half_day_hours, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) RETURNING id
    `, [
            employee_id, businessId, schedule_name, effective_from, effective_to || null,
            monday_start || null, monday_end || null, tuesday_start || null, tuesday_end || null,
            wednesday_start || null, wednesday_end || null, thursday_start || null, thursday_end || null,
            friday_start || null, friday_end || null, saturday_start || null, saturday_end || null,
            sunday_start || null, sunday_end || null, break_duration, weekly_hours,
            Number(late_come_threshold_minutes ?? 15), Number(half_day_hours ?? 4), is_active
        ]);
        await (0, attendance_recalculation_1.recalculateAttendanceForEmployeeInRange)(Number(employee_id), businessId, effective_from, effective_to || null);
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
        const businessId = req.user.userId;
        const { id } = req.params;
        const { employee_id, schedule_name, effective_from, effective_to, monday_start, monday_end, tuesday_start, tuesday_end, wednesday_start, wednesday_end, thursday_start, thursday_end, friday_start, friday_end, saturday_start, saturday_end, sunday_start, sunday_end, break_duration, weekly_hours, late_come_threshold_minutes, half_day_hours, is_active } = req.body;
        if (!employee_id || !schedule_name || !effective_from) {
            return res.status(400).json({
                error: 'Employee ID, schedule name and effective from are required'
            });
        }
        const existingSchedule = await (0, database_1.dbGet)('SELECT id, employee_id, effective_from, effective_to FROM employee_work_schedules WHERE id = $1 AND business_id = $2', [id, businessId]);
        if (!existingSchedule) {
            return res.status(404).json({ error: 'Work schedule not found' });
        }
        await (0, database_1.dbRun)(`
      UPDATE employee_work_schedules SET
        employee_id = $1, schedule_name = $2, effective_from = $3, effective_to = $4,
        monday_start = $5, monday_end = $6, tuesday_start = $7, tuesday_end = $8,
        wednesday_start = $9, wednesday_end = $10, thursday_start = $11, thursday_end = $12,
        friday_start = $13, friday_end = $14, saturday_start = $15, saturday_end = $16,
        sunday_start = $17, sunday_end = $18, break_duration = $19, weekly_hours = $20,
        late_come_threshold_minutes = $21, half_day_hours = $22, is_active = $23
      WHERE id = $24 AND business_id = $25
    `, [
            employee_id, schedule_name, effective_from, effective_to || null,
            monday_start || null, monday_end || null, tuesday_start || null, tuesday_end || null,
            wednesday_start || null, wednesday_end || null, thursday_start || null, thursday_end || null,
            friday_start || null, friday_end || null, saturday_start || null, saturday_end || null,
            sunday_start || null, sunday_end || null, break_duration, weekly_hours,
            Number(late_come_threshold_minutes ?? 15), Number(half_day_hours ?? 4), is_active,
            id, businessId
        ]);
        const previousEmployeeId = Number(existingSchedule.employee_id);
        const nextEmployeeId = Number(employee_id);
        const previousFrom = normalizeDateKey(existingSchedule.effective_from) || effective_from;
        const previousTo = normalizeDateKey(existingSchedule.effective_to);
        const nextFrom = effective_from;
        const nextTo = effective_to || null;
        if (previousEmployeeId === nextEmployeeId) {
            await (0, attendance_recalculation_1.recalculateAttendanceForEmployeeInRange)(nextEmployeeId, businessId, getMinDate(previousFrom, nextFrom), previousTo === null || nextTo === null ? null : getMaxDate(previousTo, nextTo));
        }
        else {
            await (0, attendance_recalculation_1.recalculateAttendanceForEmployeeInRange)(previousEmployeeId, businessId, previousFrom, previousTo);
            await (0, attendance_recalculation_1.recalculateAttendanceForEmployeeInRange)(nextEmployeeId, businessId, nextFrom, nextTo);
        }
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
exports.default = router;
