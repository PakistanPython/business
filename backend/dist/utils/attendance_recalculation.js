"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recalculateAllAttendanceStatuses = exports.recalculateAttendanceForEmployeeInRange = exports.recalculateAttendanceRecord = void 0;
const database_1 = require("../config/database");
const normalizeDateKey = (value) => {
    if (!value)
        return '';
    if (value instanceof Date) {
        return value.toISOString().split('T')[0];
    }
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        return raw.slice(0, 10);
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime()))
        return '';
    return parsed.toISOString().split('T')[0];
};
const toTimeString = (value) => {
    if (!value)
        return null;
    if (value instanceof Date) {
        return value.toTimeString().split(' ')[0];
    }
    const raw = String(value).trim();
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
        return raw.length === 5 ? `${raw}:00` : raw;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return parsed.toTimeString().split(' ')[0];
};
const calculateLateMinutes = (clockInTime, expectedStartTime) => {
    const actual = new Date(`1970-01-01T${clockInTime}`);
    const expected = new Date(`1970-01-01T${expectedStartTime}`);
    return Math.max(0, (actual.getTime() - expected.getTime()) / (1000 * 60));
};
const calculateScheduledHours = (startTime, endTime, breakDuration = 0) => {
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
const calculateWorkingHoursFromTimestamps = (checkInValue, checkOutValue) => {
    if (!checkInValue || !checkOutValue)
        return 0;
    const checkIn = new Date(String(checkInValue));
    const checkOut = new Date(String(checkOutValue));
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()))
        return 0;
    return Math.max(0, (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60));
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
        6: { start: 'saturday_start', end: 'saturday_end' },
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
const determineAttendanceStatus = async (businessId, totalHours, lateMinutes, clockOutTime, scheduleConfig) => {
    const rule = await (0, database_1.dbGet)(`
      SELECT *
      FROM attendance_rules
      WHERE business_id = $1 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
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
      SELECT *
      FROM attendance_rules
      WHERE business_id = $1 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `, [businessId]);
    if (!rule)
        return 0;
    const regularThreshold = (rule.overtime_threshold ?? 480) / 60;
    if ((isWeekend && rule.weekend_overtime) || (isHoliday && rule.holiday_overtime)) {
        return totalHours;
    }
    return Math.max(0, totalHours - regularThreshold);
};
const recalculateAttendanceRecord = async (attendance, businessId) => {
    if (!attendance?.id || !attendance?.employee_id || !attendance?.check_in_time || !attendance?.check_out_time) {
        return;
    }
    if (attendance.status === 'holiday') {
        return;
    }
    const dateKey = normalizeDateKey(attendance.date);
    if (!dateKey)
        return;
    const scheduleForDate = await getEmployeeScheduleForDate(attendance.employee_id, businessId, dateKey);
    const checkInTime = toTimeString(attendance.check_in_time);
    const checkOutTime = toTimeString(attendance.check_out_time);
    const totalHours = calculateWorkingHoursFromTimestamps(attendance.check_in_time, attendance.check_out_time);
    if (!checkInTime || !checkOutTime)
        return;
    const lateMinutes = scheduleForDate?.startTime ? calculateLateMinutes(checkInTime, scheduleForDate.startTime) : 0;
    const isWeekend = new Date(dateKey).getDay() === 0 || new Date(dateKey).getDay() === 6;
    const overtimeHours = await calculateOvertime(businessId, totalHours, isWeekend, false);
    const finalStatus = await determineAttendanceStatus(businessId, totalHours, lateMinutes, checkOutTime, scheduleForDate);
    await (0, database_1.dbRun)(`
      UPDATE attendance
      SET status = $1,
          total_hours = $2,
          overtime_hours = $3,
          updated_at = NOW()
      WHERE id = $4
    `, [finalStatus, totalHours, overtimeHours, attendance.id]);
};
exports.recalculateAttendanceRecord = recalculateAttendanceRecord;
const recalculateAttendanceForEmployeeInRange = async (employeeId, businessId, fromDate, toDate) => {
    const params = [employeeId, fromDate];
    let query = `
    SELECT id, employee_id, date, check_in_time, check_out_time, status
    FROM attendance
    WHERE employee_id = $1
      AND check_in_time IS NOT NULL
      AND check_out_time IS NOT NULL
      AND date >= $2
  `;
    if (toDate) {
        query += ' AND date <= $3';
        params.push(toDate);
    }
    query += ' ORDER BY date ASC';
    const records = await (0, database_1.dbAll)(query, params);
    for (const record of records) {
        await (0, exports.recalculateAttendanceRecord)(record, businessId);
    }
};
exports.recalculateAttendanceForEmployeeInRange = recalculateAttendanceForEmployeeInRange;
const recalculateAllAttendanceStatuses = async () => {
    const records = await (0, database_1.dbAll)(`
    SELECT a.id, a.employee_id, a.date, a.check_in_time, a.check_out_time, a.status, e.business_id
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE a.check_in_time IS NOT NULL
      AND a.check_out_time IS NOT NULL
    ORDER BY a.employee_id ASC, a.date ASC
  `);
    for (const record of records) {
        await (0, exports.recalculateAttendanceRecord)(record, Number(record.business_id));
    }
};
exports.recalculateAllAttendanceStatuses = recalculateAllAttendanceStatuses;
