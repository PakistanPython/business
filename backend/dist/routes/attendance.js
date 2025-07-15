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
const calculateWorkingHours = (clockIn, clockOut, breakStart, breakEnd) => {
    if (!clockIn || !clockOut)
        return 0;
    const clockInTime = new Date(`1970-01-01T${clockIn}`);
    const clockOutTime = new Date(`1970-01-01T${clockOut}`);
    let totalMinutes = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60);
    if (breakStart && breakEnd) {
        const breakStartTime = new Date(`1970-01-01T${breakStart}`);
        const breakEndTime = new Date(`1970-01-01T${breakEnd}`);
        const breakMinutes = (breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60);
        totalMinutes -= breakMinutes;
    }
    return Math.max(0, totalMinutes / 60);
};
const calculateLateMinutes = (clockInTime, expectedStartTime) => {
    if (!clockInTime || !expectedStartTime)
        return 0;
    const actual = new Date(`1970-01-01T${clockInTime}`);
    const expected = new Date(`1970-01-01T${expectedStartTime}`);
    const diffMinutes = (actual.getTime() - expected.getTime()) / (1000 * 60);
    return Math.max(0, diffMinutes);
};
const calculateEarlyDepartureMinutes = (clockOutTime, expectedEndTime) => {
    if (!clockOutTime || !expectedEndTime)
        return 0;
    const actual = new Date(`1970-01-01T${clockOutTime}`);
    const expected = new Date(`1970-01-01T${expectedEndTime}`);
    const diffMinutes = (expected.getTime() - actual.getTime()) / (1000 * 60);
    return Math.max(0, diffMinutes);
};
const determineAttendanceStatus = async (employeeId, businessId, clockInTime, clockOutTime, totalHours, lateMinutes) => {
    const rule = await (0, database_1.dbGet)(`
    SELECT * FROM attendance_rules 
    WHERE business_id = AND is_active = 1
    ORDER BY created_at DESC LIMIT 1
  `, [businessId]);
    if (!rule) {
        if (lateMinutes > 30)
            return 'late';
        if (totalHours < 4)
            return 'half_day';
        return 'present';
    }
    if (lateMinutes > rule.late_grace_period) {
        if (rule.late_penalty_type === 'half_day' && totalHours < (rule.half_day_threshold / 60)) {
            return 'half_day';
        }
        return 'late';
    }
    if (totalHours < (rule.half_day_threshold / 60)) {
        return 'half_day';
    }
    return 'present';
};
const calculateOvertime = async (businessId, totalHours, isWeekend, isHoliday) => {
    const rule = await (0, database_1.dbGet)(`
    SELECT * FROM attendance_rules 
    WHERE business_id = AND is_active = 1
    ORDER BY created_at DESC LIMIT 1
  `, [businessId]);
    if (!rule)
        return 0;
    const regularThreshold = rule.overtime_threshold / 60;
    if ((isWeekend && rule.weekend_overtime) || (isHoliday && rule.holiday_overtime)) {
        return totalHours;
    }
    return Math.max(0, totalHours - regularThreshold);
};
router.get('/', async (req, res) => {
    try {
        const userType = req.user.userType;
        let businessId;
        const { employee_id, date_from, date_to, status, page = 1, limit = 50, month, year } = req.query;
        if (userType === 'employee') {
            businessId = req.user.businessId;
        }
        else {
            businessId = req.user.userId;
        }
        let query = `
      SELECT 
        a.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department,
        e.position
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.business_id = `;
        const params = [businessId];
        if (userType === 'employee') {
            const actualEmployeeId = req.user?.userId;
            query += ' AND a.employee_id = ?';
            params.push(actualEmployeeId);
        }
        else if (employee_id) {
            query += ' AND a.employee_id = ?';
            params.push(employee_id);
        }
        if (date_from && date_to) {
            query += ' AND a.date BETWEEN ? AND ?';
            params.push(date_from, date_to);
        }
        else if (month && year) {
            query += ' AND strftime("%m", a.date) = ? AND strftime("%Y", a.date) = $1';
            params.push(month.padStart(2, '0'), year);
        }
        if (status && status !== 'all') {
            query += ' AND a.status = $2';
            params.push(status);
        }
        query += ' ORDER BY a.date DESC, a.clock_in_time DESC';
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET $2`;
        params.push(parseInt(limit), offset);
        const attendanceRecords = await (0, database_1.dbAll)(query, params);
        let countQuery = `
      SELECT COUNT(*) as total
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.business_id = `;
        const countParams = [businessId];
        if (userType === 'employee') {
            const actualEmployeeId = req.user.userId;
            countQuery += ' AND a.employee_id = $4';
            countParams.push(actualEmployeeId);
        }
        else if (employee_id) {
            countQuery += ' AND a.employee_id = $5';
            countParams.push(employee_id);
        }
        if (date_from && date_to) {
            countQuery += ' AND a.date BETWEEN ? AND $7';
            countParams.push(date_from, date_to);
        }
        else if (month && year) {
            countQuery += ' AND strftime("%m", a.date) = ? AND strftime("%Y", a.date) = $1';
            countParams.push(month.padStart(2, '0'), year);
        }
        if (status && status !== 'all') {
            countQuery += ' AND a.status = $2';
            countParams.push(status);
        }
        const { total } = await (0, database_1.dbGet)(countQuery, countParams);
        res.json({
            attendance: attendanceRecords,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
});
router.get('/today', async (req, res) => {
    try {
        const userType = req.user.userType;
        let businessId;
        let actualEmployeeId;
        const { employee_id } = req.query;
        if (userType === 'employee') {
            actualEmployeeId = req.user.userId;
            businessId = req.user.businessId;
        }
        else {
            businessId = req.user.userId;
            actualEmployeeId = employee_id;
        }
        if (!actualEmployeeId) {
            return res.status(400).json({ error: 'Employee ID is required' });
        }
        const today = new Date().toISOString().split('T')[0];
        const attendance = await (0, database_1.dbGet)(`
      SELECT 
        a.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.employee_id = AND a.business_id = AND a.date = `, [actualEmployeeId, businessId, today]);
        res.json(attendance || null);
    }
    catch (error) {
        console.error('Error fetching today\'s attendance:', error);
        res.status(500).json({ error: 'Failed to fetch today\'s attendance' });
    }
});
router.post('/clock-in', async (req, res) => {
    try {
        const userType = req.user.userType;
        let businessId = req.user.userId;
        const { employee_id, entry_method = 'manual', notes, location_latitude, location_longitude } = req.body;
        let actualEmployeeId = employee_id;
        if (userType === 'employee') {
            actualEmployeeId = req.user.userId;
            businessId = req.user.businessId;
            const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE id = $1', [actualEmployeeId]);
            if (!employee) {
                return res.status(404).json({ error: 'Employee record not found' });
            }
        }
        if (!actualEmployeeId) {
            return res.status(400).json({ error: 'Employee ID is required' });
        }
        const today = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toTimeString().split(' ')[0];
        const currentDate = new Date();
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const existingAttendance = await (0, database_1.dbGet)('SELECT * FROM attendance WHERE employee_id = AND business_id = AND date = $3', [actualEmployeeId, businessId, today]);
        if (existingAttendance) {
            return res.status(400).json({ error: 'Already clocked in today' });
        }
        const workSchedule = await (0, database_1.dbGet)(`
      SELECT * FROM employee_work_schedules 
      WHERE employee_id = AND business_id = AND is_active = 1
        AND effective_from <= AND (effective_to IS NULL OR effective_to >= $4)
      ORDER BY effective_from DESC LIMIT 1
    `, [actualEmployeeId, businessId, today, today]);
        let expectedStartTime = '09:00:00';
        let attendanceType = 'regular';
        let lateMinutes = 0;
        if (workSchedule) {
            const dayMap = {
                0: { start: workSchedule.sunday_start, end: workSchedule.sunday_end },
                1: { start: workSchedule.monday_start, end: workSchedule.monday_end },
                2: { start: workSchedule.tuesday_start, end: workSchedule.tuesday_end },
                3: { start: workSchedule.wednesday_start, end: workSchedule.wednesday_end },
                4: { start: workSchedule.thursday_start, end: workSchedule.thursday_end },
                5: { start: workSchedule.friday_start, end: workSchedule.friday_end },
                6: { start: workSchedule.saturday_start, end: workSchedule.saturday_end }
            };
            const daySchedule = dayMap[dayOfWeek];
            if (daySchedule.start) {
                expectedStartTime = daySchedule.start;
            }
        }
        lateMinutes = calculateLateMinutes(currentTime, expectedStartTime);
        if (isWeekend) {
            attendanceType = 'weekend';
        }
        const result = await (0, database_1.dbRun)(`
      INSERT INTO attendance (
        employee_id, business_id, date, clock_in_time, entry_method, notes, 
        attendance_type, late_minutes, location_latitude, location_longitude, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'present')
    `, [actualEmployeeId, businessId, today, currentTime, entry_method, notes,
            attendanceType, lateMinutes, location_latitude, location_longitude]);
        const newAttendance = await (0, database_1.dbGet)(`
      SELECT 
        a.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = `, [result.lastID]);
        res.status(201).json(newAttendance);
    }
    catch (error) {
        console.error('Error clocking in:', error);
        res.status(500).json({ error: 'Failed to clock in' });
    }
});
router.post('/clock-out', async (req, res) => {
    try {
        const userType = req.user.userType;
        let businessId = req.user.userId;
        const { employee_id, break_start_time, break_end_time, notes } = req.body;
        let actualEmployeeId = employee_id;
        if (userType === 'employee') {
            actualEmployeeId = req.user.userId;
            businessId = req.user.businessId;
            const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE id = $1', [actualEmployeeId]);
            if (!employee) {
                return res.status(404).json({ error: 'Employee record not found' });
            }
        }
        if (!actualEmployeeId) {
            return res.status(400).json({ error: 'Employee ID is required' });
        }
        const today = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toTimeString().split(' ')[0];
        const currentDate = new Date();
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const attendance = await (0, database_1.dbGet)('SELECT * FROM attendance WHERE employee_id = AND business_id = AND date = $3', [actualEmployeeId, businessId, today]);
        if (!attendance) {
            return res.status(400).json({ error: 'No clock-in record found for today' });
        }
        if (attendance.clock_out_time) {
            return res.status(400).json({ error: 'Already clocked out today' });
        }
        const workSchedule = await (0, database_1.dbGet)(`
      SELECT * FROM employee_work_schedules 
      WHERE employee_id = AND business_id = AND is_active = 1
        AND effective_from <= AND (effective_to IS NULL OR effective_to >= $4)
      ORDER BY effective_from DESC LIMIT 1
    `, [actualEmployeeId, businessId, today, today]);
        let expectedEndTime = '17:00:00';
        if (workSchedule) {
            const dayMap = {
                0: { start: workSchedule.sunday_start, end: workSchedule.sunday_end },
                1: { start: workSchedule.monday_start, end: workSchedule.monday_end },
                2: { start: workSchedule.tuesday_start, end: workSchedule.tuesday_end },
                3: { start: workSchedule.wednesday_start, end: workSchedule.wednesday_end },
                4: { start: workSchedule.thursday_start, end: workSchedule.thursday_end },
                5: { start: workSchedule.friday_start, end: workSchedule.friday_end },
                6: { start: workSchedule.saturday_start, end: workSchedule.saturday_end }
            };
            const daySchedule = dayMap[dayOfWeek];
            if (daySchedule.end) {
                expectedEndTime = daySchedule.end;
            }
        }
        const totalHours = calculateWorkingHours(attendance.clock_in_time, currentTime, break_start_time, break_end_time);
        const earlyDepartureMinutes = calculateEarlyDepartureMinutes(currentTime, expectedEndTime);
        const overtimeHours = await calculateOvertime(businessId, totalHours, isWeekend, false);
        const finalStatus = await determineAttendanceStatus(actualEmployeeId, businessId, attendance.clock_in_time, currentTime, totalHours, attendance.late_minutes);
        await (0, database_1.dbRun)(`
      UPDATE attendance SET
        clock_out_time = $1,
        break_start_time = $2,
        break_end_time = $3,
        total_hours = $4,
        overtime_hours = $5,
        early_departure_minutes = $6,
        status = $7,
        notes = $8,
        updated_at = NOW()
      WHERE id = `, [currentTime, break_start_time, break_end_time, totalHours, overtimeHours,
            earlyDepartureMinutes, finalStatus, notes, attendance.id]);
        const updatedAttendance = await (0, database_1.dbGet)(`
      SELECT 
        a.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = `, [attendance.id]);
        res.json(updatedAttendance);
    }
    catch (error) {
        console.error('Error clocking out:', error);
        res.status(500).json({ error: 'Failed to clock out' });
    }
});
router.post('/', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { employee_id, date, clock_in_time, clock_out_time, break_start_time, break_end_time, attendance_type = 'regular', entry_method = 'manual', status = 'present', notes } = req.body;
        if (!employee_id || !date) {
            return res.status(400).json({ error: 'Employee ID and date are required' });
        }
        const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE id = AND business_id = $2', [employee_id, businessId]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const existingAttendance = await (0, database_1.dbGet)('SELECT id FROM attendance WHERE employee_id = AND date = $2', [employee_id, date]);
        if (existingAttendance) {
            return res.status(400).json({ error: 'Attendance record already exists for this date' });
        }
        let totalHours = 0;
        let overtimeHours = 0;
        let lateMinutes = 0;
        let earlyDepartureMinutes = 0;
        let finalStatus = status;
        if (clock_in_time && clock_out_time) {
            totalHours = calculateWorkingHours(clock_in_time, clock_out_time, break_start_time, break_end_time);
            const workSchedule = await (0, database_1.dbGet)(`
        SELECT * FROM employee_work_schedules 
        WHERE employee_id = AND business_id = AND is_active = 1
          AND effective_from <= AND (effective_to IS NULL OR effective_to >= $4)
        ORDER BY effective_from DESC LIMIT 1
      `, [employee_id, businessId, date, date]);
            if (workSchedule) {
                const inputDate = new Date(date);
                const dayOfWeek = inputDate.getDay();
                const dayMap = {
                    0: { start: workSchedule.sunday_start, end: workSchedule.sunday_end },
                    1: { start: workSchedule.monday_start, end: workSchedule.monday_end },
                    2: { start: workSchedule.tuesday_start, end: workSchedule.tuesday_end },
                    3: { start: workSchedule.wednesday_start, end: workSchedule.wednesday_end },
                    4: { start: workSchedule.thursday_start, end: workSchedule.thursday_end },
                    5: { start: workSchedule.friday_start, end: workSchedule.friday_end },
                    6: { start: workSchedule.saturday_start, end: workSchedule.saturday_end }
                };
                const daySchedule = dayMap[dayOfWeek];
                if (daySchedule.start) {
                    lateMinutes = calculateLateMinutes(clock_in_time, daySchedule.start);
                }
                if (daySchedule.end) {
                    earlyDepartureMinutes = calculateEarlyDepartureMinutes(clock_out_time, daySchedule.end);
                }
            }
            const inputDate = new Date(date);
            const isWeekend = inputDate.getDay() === 0 || inputDate.getDay() === 6;
            overtimeHours = await calculateOvertime(businessId, totalHours, isWeekend, false);
            finalStatus = await determineAttendanceStatus(employee_id, businessId, clock_in_time, clock_out_time, totalHours, lateMinutes);
        }
        const result = await (0, database_1.dbRun)(`
      INSERT INTO attendance (
        employee_id, business_id, date, clock_in_time, clock_out_time,
        break_start_time, break_end_time, total_hours, overtime_hours,
        late_minutes, early_departure_minutes, attendance_type, entry_method, status, notes
      ) VALUES ($5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING id
    `, [
            employee_id, businessId, date, clock_in_time, clock_out_time,
            break_start_time, break_end_time, totalHours, overtimeHours,
            lateMinutes, earlyDepartureMinutes, attendance_type, entry_method, finalStatus, notes
        ]);
        const newAttendance = await (0, database_1.dbGet)(`
      SELECT 
        a.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = `, [result.lastID]);
        res.status(201).json(newAttendance);
    }
    catch (error) {
        console.error('Error creating attendance record:', error);
        res.status(500).json({ error: 'Failed to create attendance record' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const { date, clock_in_time, clock_out_time, break_start_time, break_end_time, attendance_type, status, notes } = req.body;
        const existingAttendance = await (0, database_1.dbGet)('SELECT * FROM attendance WHERE id = AND business_id = $2', [id, businessId]);
        if (!existingAttendance) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }
        let totalHours = existingAttendance.total_hours;
        let overtimeHours = existingAttendance.overtime_hours;
        const finalClockIn = clock_in_time || existingAttendance.clock_in_time;
        const finalClockOut = clock_out_time || existingAttendance.clock_out_time;
        if (finalClockIn && finalClockOut) {
            totalHours = calculateWorkingHours(finalClockIn, finalClockOut, break_start_time || existingAttendance.break_start_time, break_end_time || existingAttendance.break_end_time);
            overtimeHours = totalHours > 8 ? totalHours - 8 : 0;
        }
        await (0, database_1.dbRun)(`
      UPDATE attendance SET
        date = $2, clock_in_time = $3, clock_out_time = $4, break_start_time = $5,
        break_end_time = $6, total_hours = $7, overtime_hours = $8,
        attendance_type = $9, status = $10, notes = $11, updated_at = NOW()
      WHERE id = AND business_id = `, [
            date || existingAttendance.date,
            finalClockIn,
            finalClockOut,
            break_start_time || existingAttendance.break_start_time,
            break_end_time || existingAttendance.break_end_time,
            totalHours,
            overtimeHours,
            attendance_type || existingAttendance.attendance_type,
            status || existingAttendance.status,
            notes || existingAttendance.notes,
            id,
            businessId
        ]);
        const updatedAttendance = await (0, database_1.dbGet)(`
      SELECT 
        a.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = `, [id]);
        res.json(updatedAttendance);
    }
    catch (error) {
        console.error('Error updating attendance record:', error);
        res.status(500).json({ error: 'Failed to update attendance record' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.userId;
        const attendance = await (0, database_1.dbGet)('SELECT id FROM attendance WHERE id = AND business_id = $2', [id, businessId]);
        if (!attendance) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }
        await (0, database_1.dbRun)('DELETE FROM attendance WHERE id = AND business_id = $19', [id, businessId]);
        res.json({ message: 'Attendance record deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting attendance record:', error);
        res.status(500).json({ error: 'Failed to delete attendance record' });
    }
});
router.get('/stats/monthly', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const { month, year, employee_id } = req.query;
        const currentDate = new Date();
        const targetMonth = (month || (currentDate.getMonth() + 1).toString());
        const targetYear = (year || currentDate.getFullYear().toString());
        let query = `
      SELECT 
        e.id as employee_id,
        e.first_name,
        e.last_name,
        e.employee_code,
        COUNT(a.id) as total_days,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
        COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) as half_days,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
        ROUND(SUM(a.total_hours), 2) as total_hours,
        ROUND(SUM(a.overtime_hours), 2) as total_overtime_hours
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id 
        AND strftime('%m', a.date) = AND strftime('%Y', a.date) = WHERE e.business_id = AND e.status = 'active'
    `;
        const params = [targetMonth.padStart(2, '0'), targetYear, businessId];
        if (employee_id) {
            query += ' AND e.id = $23';
            params.push(employee_id);
        }
        query += ' GROUP BY e.id ORDER BY e.first_name, e.last_name';
        const stats = await (0, database_1.dbAll)(query, params);
        res.json({
            month: parseInt(targetMonth),
            year: parseInt(targetYear),
            employees: stats
        });
    }
    catch (error) {
        console.error('Error fetching monthly attendance stats:', error);
        res.status(500).json({ error: 'Failed to fetch monthly attendance statistics' });
    }
});
router.get('/stats/summary', async (req, res) => {
    try {
        const userType = req.user.userType;
        let businessId;
        const { date_from, date_to } = req.query;
        if (userType === 'employee') {
            businessId = req.user.businessId;
        }
        else {
            businessId = req.user.userId;
        }
        const today = new Date().toISOString().split('T')[0];
        const defaultFrom = date_from || today;
        const defaultTo = date_to || today;
        let query = `
      SELECT 
        COUNT(DISTINCT a.employee_id) as employees_with_attendance,
        COUNT(a.id) as total_records,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
        ROUND(AVG(a.total_hours), 2) as avg_working_hours,
        ROUND(SUM(a.overtime_hours), 2) as total_overtime_hours
      FROM attendance a
      WHERE a.business_id = AND a.date BETWEEN ? AND `;
        const params = [businessId, defaultFrom, defaultTo];
        if (userType === 'employee') {
            const actualEmployeeId = req.user.userId;
            query += ' AND a.employee_id = $31';
            params.push(actualEmployeeId);
        }
        const summary = await (0, database_1.dbGet)(query, params);
        const { total_employees } = await (0, database_1.dbGet)('SELECT COUNT(*) as total_employees FROM employees WHERE business_id = AND status = "active"', [businessId]);
        res.json({
            ...summary,
            total_active_employees: total_employees,
            date_range: { from: defaultFrom, to: defaultTo }
        });
    }
    catch (error) {
        console.error('Error fetching attendance summary:', error);
        res.status(500).json({ error: 'Failed to fetch attendance summary' });
    }
});
exports.default = router;
