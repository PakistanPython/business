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
const calculateScheduledHours = (startTime, endTime, breakDuration = 0) => {
    if (!startTime || !endTime)
        return 0;
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    return Math.max(0, (diffMinutes - breakDuration) / 60);
};
const CLOCK_OUT_GRACE_MINUTES = 30;
const timeToMinutes = (timeValue) => {
    const [hours = '0', minutes = '0', seconds = '0'] = String(timeValue).split(':');
    return (Number(hours) * 60) + Number(minutes) + Math.floor(Number(seconds) / 60);
};
const hasMetExpectedClockOutTime = (clockOutTime, expectedEndTime, allowedEarlyMinutes = CLOCK_OUT_GRACE_MINUTES) => {
    return timeToMinutes(clockOutTime) >= (timeToMinutes(expectedEndTime) - Math.max(0, allowedEarlyMinutes));
};
const getEmployeeScheduleForDate = async (employeeId, businessId, targetDate) => {
    const schedule = await (0, database_1.dbGet)(`
      SELECT *
      FROM employee_work_schedules
      WHERE employee_id = $1
        AND business_id = $2
        AND is_active = true
        AND effective_from <= $3
        AND (effective_to IS NULL OR effective_to >= $3)
      ORDER BY effective_from DESC
      LIMIT 1
    `, [employeeId, businessId, targetDate]);
    if (!schedule)
        return null;
    const dayOfWeek = new Date(targetDate).getDay();
    const dayKeyMap = {
        0: { start: 'sunday_start', end: 'sunday_end' },
        1: { start: 'monday_start', end: 'monday_end' },
        2: { start: 'tuesday_start', end: 'tuesday_end' },
        3: { start: 'wednesday_start', end: 'wednesday_end' },
        4: { start: 'thursday_start', end: 'thursday_end' },
        5: { start: 'friday_start', end: 'friday_end' },
        6: { start: 'saturday_start', end: 'saturday_end' }
    };
    const dayKeys = dayKeyMap[dayOfWeek];
    const startTime = schedule[dayKeys.start] || null;
    const endTime = schedule[dayKeys.end] || null;
    const breakDuration = Number(schedule.break_duration || 0);
    return {
        startTime,
        endTime,
        breakDuration,
        expectedHours: startTime && endTime ? calculateScheduledHours(startTime, endTime, breakDuration) : 0,
        lateComeThresholdMinutes: schedule.late_come_threshold_minutes != null ? Number(schedule.late_come_threshold_minutes) : null,
        halfDayHours: schedule.half_day_hours != null ? Number(schedule.half_day_hours) : null,
    };
};
const hasApprovedLeaveOnDate = async (employeeId, targetDate) => {
    const leave = await (0, database_1.dbGet)(`
      SELECT id
      FROM leaves
      WHERE employee_id = $1
        AND status = 'approved'
        AND $2 BETWEEN start_date AND end_date
      LIMIT 1
    `, [employeeId, targetDate]);
    return !!leave;
};
const calculateEarlyDepartureMinutes = (clockOutTime, expectedEndTime) => {
    if (!clockOutTime || !expectedEndTime)
        return 0;
    const actual = new Date(`1970-01-01T${clockOutTime}`);
    const expected = new Date(`1970-01-01T${expectedEndTime}`);
    const diffMinutes = (expected.getTime() - actual.getTime()) / (1000 * 60);
    return Math.max(0, diffMinutes);
};
const determineAttendanceStatus = async (businessId, totalHours, lateMinutes, clockOutTime, scheduleConfig) => {
    const rule = await (0, database_1.dbGet)(`
    SELECT * FROM attendance_rules 
    WHERE business_id = $1 AND is_active = true
    ORDER BY created_at DESC LIMIT 1
  `, [businessId]);
    if (!rule) {
        const lateGracePeriod = scheduleConfig?.lateComeThresholdMinutes ?? 30;
        const halfDayThresholdHours = scheduleConfig?.halfDayHours ?? 4;
        const isLate = lateMinutes > lateGracePeriod;
        const hasMetScheduleTime = scheduleConfig?.endTime && clockOutTime
            ? hasMetExpectedClockOutTime(clockOutTime, scheduleConfig.endTime)
            : true;
        if (totalHours <= 0)
            return 'absent';
        if (!hasMetScheduleTime)
            return totalHours >= halfDayThresholdHours ? 'half_day' : 'absent';
        return isLate ? 'late' : 'present';
    }
    const lateGracePeriod = scheduleConfig?.lateComeThresholdMinutes ?? rule.late_grace_period ?? 15;
    const halfDayThresholdHours = scheduleConfig?.halfDayHours ?? ((rule.half_day_threshold ?? 240) / 60);
    const isLate = lateMinutes > lateGracePeriod;
    const hasMetScheduleTime = scheduleConfig?.endTime && clockOutTime
        ? hasMetExpectedClockOutTime(clockOutTime, scheduleConfig.endTime)
        : true;
    if (totalHours <= 0)
        return 'absent';
    if (!hasMetScheduleTime)
        return totalHours >= halfDayThresholdHours ? 'half_day' : 'absent';
    return isLate ? 'late' : 'present';
};
const calculateOvertime = async (businessId, totalHours, isWeekend, isHoliday) => {
    const rule = await (0, database_1.dbGet)(`
    SELECT * FROM attendance_rules 
    WHERE business_id = $1 AND is_active = true
    ORDER BY created_at DESC LIMIT 1
  `, [businessId]);
    if (!rule)
        return 0;
    const regularThreshold = (rule.overtime_threshold ?? 480) / 60;
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
        a.id,
        a.employee_id,
        a.date,
        a.check_in_time AS clock_in_time,
        a.check_out_time AS clock_out_time,
        a.total_hours,
        a.overtime_hours,
        a.status,
        a.notes,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department,
        e.position
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.business_id = $1`;
        const params = [businessId];
        let paramIndex = 2;
        if (userType === 'employee') {
            const actualEmployeeId = req.user?.userId;
            query += ` AND a.employee_id = $${paramIndex++}`;
            params.push(actualEmployeeId);
        }
        else if (employee_id) {
            query += ` AND a.employee_id = $${paramIndex++}`;
            params.push(employee_id);
        }
        if (date_from && date_to) {
            query += ` AND a.date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
            params.push(date_from, date_to);
        }
        else if (month && year) {
            query += ` AND to_char(a.date, 'MM') = $${paramIndex++} AND to_char(a.date, 'YYYY') = $${paramIndex++}`;
            params.push(month.padStart(2, '0'), year);
        }
        if (status && status !== 'all') {
            query += ` AND a.status = $${paramIndex++}`;
            params.push(status);
        }
        query += ' ORDER BY a.date DESC, a.check_in_time DESC';
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), offset);
        const attendanceRecords = await (0, database_1.dbAll)(query, params);
        let countQuery = `
      SELECT COUNT(*) as total
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.business_id = $1`;
        const countParams = [businessId];
        let countParamIndex = 2;
        if (userType === 'employee') {
            const actualEmployeeId = req.user.userId;
            countQuery += ` AND a.employee_id = $${countParamIndex++}`;
            countParams.push(actualEmployeeId);
        }
        else if (employee_id) {
            countQuery += ` AND a.employee_id = $${countParamIndex++}`;
            countParams.push(employee_id);
        }
        if (date_from && date_to) {
            countQuery += ` AND a.date BETWEEN $${countParamIndex++} AND $${countParamIndex++}`;
            countParams.push(date_from, date_to);
        }
        else if (month && year) {
            countQuery += ` AND to_char(a.date, 'MM') = $${countParamIndex++} AND to_char(a.date, 'YYYY') = $${countParamIndex++}`;
            countParams.push(month.padStart(2, '0'), year);
        }
        if (status && status !== 'all') {
            countQuery += ` AND a.status = $${countParamIndex++}`;
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
        a.id,
        a.employee_id,
        a.date,
        a.check_in_time AS clock_in_time,
        a.check_out_time AS clock_out_time,
        a.total_hours,
        a.overtime_hours,
        a.status,
        a.notes,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.employee_id = $1 AND e.business_id = $2 AND a.date::date = $3`, [actualEmployeeId, businessId, today]);
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
        const currentTimestamp = new Date();
        const currentTime = currentTimestamp.toTimeString().split(' ')[0];
        const dayOfWeek = currentTimestamp.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const onLeaveToday = await hasApprovedLeaveOnDate(actualEmployeeId, today);
        if (onLeaveToday) {
            return res.status(400).json({ error: 'Employee is on approved leave for today' });
        }
        const existingAttendance = await (0, database_1.dbGet)('SELECT * FROM attendance WHERE employee_id = $1 AND date::date = $2', [actualEmployeeId, today]);
        if (existingAttendance) {
            return res.status(400).json({ error: 'Already clocked in today' });
        }
        const scheduleForDate = await getEmployeeScheduleForDate(actualEmployeeId, businessId, today);
        if (!isWeekend && (!scheduleForDate || !scheduleForDate.startTime || !scheduleForDate.endTime)) {
            return res.status(400).json({
                error: 'No active work schedule found for this employee today'
            });
        }
        const lateMinutes = scheduleForDate?.startTime
            ? calculateLateMinutes(currentTime, scheduleForDate.startTime)
            : 0;
        const activeRule = await (0, database_1.dbGet)(`SELECT late_grace_period FROM attendance_rules WHERE business_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`, [businessId]);
        const lateGracePeriod = scheduleForDate?.lateComeThresholdMinutes ?? activeRule?.late_grace_period ?? 15;
        const initialStatus = lateMinutes > lateGracePeriod ? 'late' : 'present';
        const result = await (0, database_1.dbRun)(`
      INSERT INTO attendance (
        employee_id, date, check_in_time, status
      ) VALUES ($1, $2, $3, $4) RETURNING id
    `, [actualEmployeeId, today, currentTimestamp, initialStatus]);
        const newAttendance = await (0, database_1.dbGet)(`
      SELECT 
        a.id,
        a.employee_id,
        a.date,
        a.check_in_time AS clock_in_time,
        a.check_out_time AS clock_out_time,
        a.total_hours,
        a.overtime_hours,
        a.status,
        a.notes,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = $1`, [result.lastID]);
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
        const currentTimestamp = new Date();
        const currentTime = currentTimestamp.toTimeString().split(' ')[0];
        const dayOfWeek = currentTimestamp.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const attendance = await (0, database_1.dbGet)('SELECT * FROM attendance WHERE employee_id = $1 AND date::date = $2', [actualEmployeeId, today]);
        if (!attendance) {
            return res.status(400).json({ error: 'No clock-in record found for today' });
        }
        if (attendance.check_out_time) {
            return res.status(400).json({ error: 'Already clocked out today' });
        }
        const scheduleForDate = await getEmployeeScheduleForDate(actualEmployeeId, businessId, today);
        const totalHours = calculateWorkingHours(new Date(attendance.check_in_time).toTimeString().split(' ')[0], currentTime, break_start_time, break_end_time);
        const overtimeHours = await calculateOvertime(businessId, totalHours, isWeekend, false);
        const clockInForStatus = new Date(attendance.check_in_time).toTimeString().split(' ')[0];
        const lateMinutes = scheduleForDate?.startTime
            ? calculateLateMinutes(clockInForStatus, scheduleForDate.startTime)
            : 0;
        let finalStatus = await determineAttendanceStatus(businessId, totalHours, lateMinutes, currentTime, scheduleForDate);
        if (attendance.status === 'late' && finalStatus === 'present') {
            finalStatus = 'late';
        }
        await (0, database_1.dbRun)(`
      UPDATE attendance SET
        check_out_time = $1,
        status = $2,
        total_hours = $3,
        overtime_hours = $4,
        updated_at = NOW()
      WHERE id = $5`, [currentTimestamp, finalStatus, totalHours, overtimeHours, attendance.id]);
        const updatedAttendance = await (0, database_1.dbGet)(`
      SELECT 
        a.id,
        a.employee_id,
        a.date,
        a.check_in_time AS clock_in_time,
        a.check_out_time AS clock_out_time,
        a.total_hours,
        a.overtime_hours,
        a.status,
        a.notes,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = $1`, [attendance.id]);
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
        const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE id = $1 AND business_id = $2', [employee_id, businessId]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const existingAttendance = await (0, database_1.dbGet)('SELECT id FROM attendance WHERE employee_id = $1 AND date::date = $2', [employee_id, date]);
        if (existingAttendance) {
            return res.status(400).json({ error: 'Attendance record already exists for this date' });
        }
        const onLeaveOnDate = await hasApprovedLeaveOnDate(employee_id, date);
        if (onLeaveOnDate && status !== 'absent' && status !== 'holiday') {
            return res.status(400).json({
                error: 'Employee is on approved leave for this date. Mark as absent/holiday or remove leave approval first.'
            });
        }
        let totalHours = 0;
        let overtimeHours = 0;
        let lateMinutes = 0;
        let finalStatus = status;
        const checkInTimestamp = clock_in_time ? new Date(`${date}T${clock_in_time}`) : null;
        const checkOutTimestamp = clock_out_time ? new Date(`${date}T${clock_out_time}`) : null;
        const shouldAutoDetermineStatus = !status || status === 'present';
        if (clock_in_time && clock_out_time && shouldAutoDetermineStatus) {
            totalHours = calculateWorkingHours(clock_in_time, clock_out_time, break_start_time, break_end_time);
            const inputDate = new Date(date);
            const dayOfWeek = inputDate.getDay();
            const scheduleForDate = await getEmployeeScheduleForDate(employee_id, businessId, date);
            if (scheduleForDate?.startTime) {
                lateMinutes = calculateLateMinutes(clock_in_time, scheduleForDate.startTime);
            }
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            if (!isWeekend && (!scheduleForDate || !scheduleForDate.startTime || !scheduleForDate.endTime)) {
                return res.status(400).json({
                    error: 'No active work schedule found for this employee on selected date'
                });
            }
            overtimeHours = await calculateOvertime(businessId, totalHours, isWeekend, false);
            finalStatus = await determineAttendanceStatus(businessId, totalHours, lateMinutes, clock_out_time, scheduleForDate);
        }
        if (status && ['present', 'late', 'half_day', 'absent', 'holiday'].includes(status)) {
            finalStatus = status;
        }
        const result = await (0, database_1.dbRun)(`
      INSERT INTO attendance (
        employee_id, date, check_in_time, check_out_time, status, total_hours, overtime_hours
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [
            employee_id, date, checkInTimestamp, checkOutTimestamp, finalStatus, totalHours, overtimeHours
        ]);
        const newAttendance = await (0, database_1.dbGet)(`
      SELECT 
        a.id,
        a.employee_id,
        a.date,
        a.check_in_time AS clock_in_time,
        a.check_out_time AS clock_out_time,
        a.total_hours,
        a.overtime_hours,
        a.status,
        a.notes,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = $1`, [result.lastID]);
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
        const existingAttendance = await (0, database_1.dbGet)('SELECT * FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.id = $1 AND e.business_id = $2', [id, businessId]);
        if (!existingAttendance) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }
        const employeeIdForRecord = existingAttendance.employee_id;
        let totalHours = existingAttendance.total_hours;
        let overtimeHours = existingAttendance.overtime_hours;
        let finalStatus = status || existingAttendance.status;
        const finalDate = date || new Date(existingAttendance.date).toISOString().split('T')[0];
        const finalClockInTimestamp = clock_in_time ? new Date(`${finalDate}T${clock_in_time}`) : existingAttendance.check_in_time;
        const finalClockOutTimestamp = clock_out_time ? new Date(`${finalDate}T${clock_out_time}`) : existingAttendance.check_out_time;
        const clockInForCalc = clock_in_time || (existingAttendance.check_in_time ? new Date(existingAttendance.check_in_time).toTimeString().split(' ')[0] : null);
        const clockOutForCalc = clock_out_time || (existingAttendance.check_out_time ? new Date(existingAttendance.check_out_time).toTimeString().split(' ')[0] : null);
        if (clockInForCalc && clockOutForCalc) {
            const scheduleForDate = await getEmployeeScheduleForDate(employeeIdForRecord, businessId, finalDate);
            totalHours = calculateWorkingHours(clockInForCalc, clockOutForCalc, break_start_time || existingAttendance.break_start_time, break_end_time || existingAttendance.break_end_time);
            const inputDate = new Date(finalDate);
            const dayOfWeek = inputDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            if (!isWeekend && (!scheduleForDate || !scheduleForDate.startTime || !scheduleForDate.endTime)) {
                return res.status(400).json({ error: 'No active work schedule found for this employee on selected date' });
            }
            const lateMinutes = scheduleForDate?.startTime
                ? calculateLateMinutes(clockInForCalc, scheduleForDate.startTime)
                : 0;
            overtimeHours = await calculateOvertime(businessId, totalHours, isWeekend, false);
            finalStatus = await determineAttendanceStatus(businessId, totalHours, lateMinutes, clockOutForCalc, scheduleForDate);
        }
        if (status && ['present', 'late', 'half_day', 'absent', 'holiday'].includes(status)) {
            finalStatus = status;
        }
        const onLeaveOnDate = await hasApprovedLeaveOnDate(employeeIdForRecord, finalDate);
        if (onLeaveOnDate && finalStatus !== 'absent' && finalStatus !== 'holiday') {
            return res.status(400).json({
                error: 'Employee is on approved leave for this date. Mark as absent/holiday or remove leave approval first.'
            });
        }
        await (0, database_1.dbRun)(`
      UPDATE attendance SET
        date = $1, check_in_time = $2, check_out_time = $3, status = $4, total_hours = $5, overtime_hours = $6, notes = $7, updated_at = NOW()
      WHERE id = $8`, [
            finalDate,
            finalClockInTimestamp,
            finalClockOutTimestamp,
            finalStatus,
            totalHours,
            overtimeHours,
            notes ?? existingAttendance.notes,
            id
        ]);
        const updatedAttendance = await (0, database_1.dbGet)(`
      SELECT 
        a.id,
        a.employee_id,
        a.date,
        a.check_in_time AS clock_in_time,
        a.check_out_time AS clock_out_time,
        a.total_hours,
        a.overtime_hours,
        a.status,
        a.notes,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = $1`, [id]);
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
        const attendance = await (0, database_1.dbGet)('SELECT id FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.id = $1 AND e.business_id = $2', [id, businessId]);
        if (!attendance) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }
        await (0, database_1.dbRun)('DELETE FROM attendance WHERE id = $1', [id]);
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
        AND to_char(a.date, 'MM') = $1 AND to_char(a.date, 'YYYY') = $2
      WHERE e.business_id = $3 AND e.status = 'active'
    `;
        const params = [targetMonth.padStart(2, '0'), targetYear, businessId];
        if (employee_id) {
            query += ' AND e.id = $4';
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
        COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) as half_day_count,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
        ROUND(AVG(a.total_hours), 2) as avg_working_hours,
        ROUND(SUM(a.overtime_hours), 2) as total_overtime_hours
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.business_id = $1 AND a.date BETWEEN $2 AND $3`;
        const params = [businessId, defaultFrom, defaultTo];
        let summaryParamIndex = 4;
        if (userType === 'employee') {
            const actualEmployeeId = req.user.userId;
            query += ` AND a.employee_id = $${summaryParamIndex++}`;
            params.push(actualEmployeeId);
        }
        const summary = await (0, database_1.dbGet)(query, params);
        const { total_employees } = await (0, database_1.dbGet)('SELECT COUNT(*) as total_employees FROM employees WHERE business_id = $1 AND status = \'active\'', [businessId]);
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
