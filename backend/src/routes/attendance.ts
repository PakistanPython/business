import express from 'express';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Helper function to calculate working hours
const calculateWorkingHours = (clockIn: string, clockOut: string, breakStart: string, breakEnd: string): number => {
  if (!clockIn || !clockOut) return 0;

  const clockInTime = new Date(`1970-01-01T${clockIn}`);
  const clockOutTime = new Date(`1970-01-01T${clockOut}`);
  
  let totalMinutes = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60);
  
  // Subtract break time if provided
  if (breakStart && breakEnd) {
    const breakStartTime = new Date(`1970-01-01T${breakStart}`);
    const breakEndTime = new Date(`1970-01-01T${breakEnd}`);
    const breakMinutes = (breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60);
    totalMinutes -= breakMinutes;
  }
  
  return Math.max(0, totalMinutes / 60); // Convert to hours
};

// Helper function to calculate late minutes
const calculateLateMinutes = (clockInTime: string, expectedStartTime: string): number => {
  if (!clockInTime || !expectedStartTime) return 0;
  
  const actual = new Date(`1970-01-01T${clockInTime}`);
  const expected = new Date(`1970-01-01T${expectedStartTime}`);
  
  const diffMinutes = (actual.getTime() - expected.getTime()) / (1000 * 60);
  return Math.max(0, diffMinutes);
};

// Helper function to calculate early departure minutes
const calculateEarlyDepartureMinutes = (clockOutTime: string, expectedEndTime: string): number => {
  if (!clockOutTime || !expectedEndTime) return 0;
  
  const actual = new Date(`1970-01-01T${clockOutTime}`);
  const expected = new Date(`1970-01-01T${expectedEndTime}`);
  
  const diffMinutes = (expected.getTime() - actual.getTime()) / (1000 * 60);
  return Math.max(0, diffMinutes);
};

// Helper function to determine attendance status based on rules
const determineAttendanceStatus = async (employeeId: number, businessId: number, clockInTime: string, clockOutTime: string, totalHours: number, lateMinutes: number) => {
  // Get active attendance rule
  const rule = await dbGet(`
    SELECT * FROM attendance_rules 
    WHERE business_id = $1 AND is_active = 1
    ORDER BY created_at DESC LIMIT 1
  `, [businessId]);
  
  if (!rule) {
    // Default behavior if no rules defined
    if (lateMinutes > 30) return 'late';
    if (totalHours < 4) return 'half_day';
    return 'present';
  }
  
  // Apply attendance rules
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

// Helper function to calculate overtime
const calculateOvertime = async (businessId: number, totalHours: number, isWeekend: boolean, isHoliday: boolean): Promise<number> => {
  const rule = await dbGet(`
    SELECT * FROM attendance_rules 
    WHERE business_id = $1 AND is_active = 1
    ORDER BY created_at DESC LIMIT 1
  `, [businessId]);
  
  if (!rule) return 0;
  
  const regularThreshold = rule.overtime_threshold / 60; // Convert minutes to hours
  
  // Weekend/Holiday overtime calculation
  if ((isWeekend && rule.weekend_overtime) || (isHoliday && rule.holiday_overtime)) {
    return totalHours; // All hours are overtime on weekends/holidays
  }
  
  // Regular overtime calculation
  return Math.max(0, totalHours - regularThreshold);
};

// GET /api/attendance - Get attendance records
router.get('/', async (req: Request, res: Response) => {
  try {
    const userType = req.user!.userType;
    let businessId: number;
    const { 
      employee_id, 
      date_from, 
      date_to, 
      status, 
      page = 1, 
      limit = 50,
      month,
      year 
    } = req.query;

    // Set businessId based on user type
    if (userType === 'employee') {
      businessId = req.user!.businessId!!; // Use businessId from token for employees
    } else {
      businessId = req.user!.userId!; // For admin/manager users
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
      WHERE e.business_id = $1`;
    const params: any[] = [businessId];
    let paramIndex = 2;

    // If employee user, only show their own attendance
    if (userType === 'employee') {
      const actualEmployeeId = req.user?.userId!; // For employee login, userId IS the employee ID
      query += ` AND a.employee_id = $${paramIndex++}`;
      params.push(actualEmployeeId);
    } else if (employee_id) {
      query += ` AND a.employee_id = $${paramIndex++}`;
      params.push(employee_id as string);
    }

    if (date_from && date_to) {
      query += ` AND a.date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(date_from as string, date_to as string);
    } else if (month && year) {
      query += ` AND to_char(a.date, 'MM') = $${paramIndex++} AND to_char(a.date, 'YYYY') = $${paramIndex++}`;
      params.push((month as string).padStart(2, '0'), year as string);
    }

    if (status && status !== 'all') {
      query += ` AND a.status = $${paramIndex++}`;
      params.push(status as string);
    }

    query += ' ORDER BY a.date DESC, a.check_in_time DESC';

    // Add pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit as string), offset);

    const attendanceRecords = await dbAll(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.business_id = $1`;
    const countParams : any[] = [businessId];
    let countParamIndex = 2;

    if (userType === 'employee') {
      const actualEmployeeId = req.user!.userId!; // For employee login, userId IS the employee ID
      countQuery += ` AND a.employee_id = $${countParamIndex++}`;
      countParams.push(actualEmployeeId);
    } else if (employee_id) {
      countQuery += ` AND a.employee_id = $${countParamIndex++}`;
      countParams.push(employee_id as string);
    }

    if (date_from && date_to) {
      countQuery += ` AND a.date BETWEEN $${countParamIndex++} AND $${countParamIndex++}`;
      countParams.push(date_from as string, date_to as string);
    } else if (month && year) {
      countQuery += ` AND to_char(a.date, 'MM') = $${countParamIndex++} AND to_char(a.date, 'YYYY') = $${countParamIndex++}`;
      countParams.push((month as string).padStart(2, '0'), year as string);
    }

    if (status && status !== 'all') {
      countQuery += ` AND a.status = $${countParamIndex++}`;
      countParams.push(status as string);
    }

    const { total } = await dbGet(countQuery, countParams);

    res.json({
      attendance : attendanceRecords,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// GET /api/attendance/today - Get today's attendance for an employee
router.get('/today', async (req: Request, res: Response) => {
  try {
    const userType = req.user!.userType;
    let businessId: number;
    let actualEmployeeId: number;
    const { employee_id } = req.query;

    // If employee user, get their own attendance
    if (userType === 'employee') {
      actualEmployeeId = req.user!.userId!; // For employee login, userId IS the employee ID
      businessId = req.user!.businessId!!;   // Use businessId from token
    } else {
      // For admin/manager users
      businessId = req.user!.userId!;
      actualEmployeeId = employee_id as any;
    }

    if (!actualEmployeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    const attendance = await dbGet(`
      SELECT 
        a.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.employee_id = $1 AND e.business_id = $2 AND a.date = $3`, [actualEmployeeId, businessId, today]);

    res.json(attendance || null);
  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s attendance' });
  }
});

// POST /api/attendance/clock-in - Clock in
router.post('/clock-in', async (req: Request, res: Response) => {
  try {
    const userType = req.user!.userType;
    let businessId = req.user!.userId;
    const { employee_id, entry_method = 'manual', notes, location_latitude, location_longitude } = req.body;

    let actualEmployeeId = employee_id;

    // If employee user, use their own employee ID and correct business ID
    if (userType === 'employee') {
      actualEmployeeId = req.user!.userId;
      businessId = req.user!.businessId!;
      
      // Verify the employee exists
      const employee = await dbGet('SELECT id FROM employees WHERE id = $1', [actualEmployeeId]);
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

    // Check if already clocked in today
    const existingAttendance = await dbGet(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [actualEmployeeId, today]
    );

    if (existingAttendance) {
      return res.status(400).json({ error: 'Already clocked in today' });
    }

    // Get employee's current work schedule for the current day
    const workSchedule = await dbGet(`
      SELECT start_time, end_time FROM work_schedules 
      WHERE employee_id = $1 AND day_of_week = $2
    `, [actualEmployeeId, dayOfWeek]);

    let expectedStartTime = '09:00:00';
    let attendanceType = 'regular';
    let lateMinutes = 0;

    if (workSchedule) {
      expectedStartTime = workSchedule.start_time;
    }

    // Calculate late minutes
    lateMinutes = calculateLateMinutes(currentTime, expectedStartTime);

    // Determine attendance type
    if (isWeekend) {
      attendanceType = 'weekend';
    }

    // Create attendance record
    const result = await dbRun(`
      INSERT INTO attendance (
        employee_id, date, check_in_time, status
      ) VALUES ($1, $2, $3, 'present')
    `, [actualEmployeeId, today, currentTimestamp]);

    // Fetch the created record
    const newAttendance = await dbGet(`
      SELECT 
        a.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = $1`, [result.lastID]);

    res.status(201).json(newAttendance);
  } catch (error) {
    console.error('Error clocking in:', error);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

// POST /api/attendance/clock-out - Clock out
router.post('/clock-out', async (req: Request, res: Response) => {
  try {
    const userType = req.user!.userType;
    let businessId = req.user!.userId;
    const { employee_id, break_start_time, break_end_time, notes } = req.body;

    let actualEmployeeId = employee_id;

    // If employee user, use their own employee ID and correct business ID
    if (userType === 'employee') {
      actualEmployeeId = req.user!.userId;
      businessId = req.user!.businessId!;
      
      // Verify the employee exists
      const employee = await dbGet('SELECT id FROM employees WHERE id = $1', [actualEmployeeId]);
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

    // Check if clocked in today
    const attendance = await dbGet(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [actualEmployeeId, today]
    );

    if (!attendance) {
      return res.status(400).json({ error: 'No clock-in record found for today' });
    }

    if (attendance.clock_out_time) {
      return res.status(400).json({ error: 'Already clocked out today' });
    }

    // Get employee's work schedule for expected end time
    const workSchedule = await dbGet(`
      SELECT start_time, end_time FROM work_schedules 
      WHERE employee_id = $1 AND day_of_week = $2
    `, [actualEmployeeId, dayOfWeek]);

    let expectedEndTime = '17:00:00';
    if (workSchedule) {
      expectedEndTime = workSchedule.end_time;
    }

    // Calculate working hours
    const totalHours = calculateWorkingHours(
      new Date(attendance.check_in_time).toTimeString().split(' ')[0],
      currentTime,
      break_start_time,
      break_end_time
    );

    // Calculate early departure minutes
    const earlyDepartureMinutes = calculateEarlyDepartureMinutes(currentTime, expectedEndTime);

    // Calculate overtime
    const overtimeHours = await calculateOvertime(businessId!, totalHours, isWeekend, false);

    // Determine final status
    const finalStatus = await determineAttendanceStatus(
      actualEmployeeId, businessId!, new Date(attendance.check_in_time).toTimeString().split(' ')[0], currentTime, totalHours, attendance.late_minutes
    );

    // Update attendance record
    await dbRun(`
      UPDATE attendance SET
        check_out_time = $1,
        status = $2,
        updated_at = NOW()
      WHERE id = $3`, [currentTimestamp, finalStatus, attendance.id]);

    // Fetch updated record
    const updatedAttendance = await dbGet(`
      SELECT 
        a.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = $1`, [attendance.id]);

    res.json(updatedAttendance);
  } catch (error) {
    console.error('Error clocking out:', error);
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

// POST /api/attendance - Add manual attendance entry
router.post('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const {
      employee_id,
      date,
      clock_in_time,
      clock_out_time,
      break_start_time,
      break_end_time,
      attendance_type = 'regular',
      entry_method = 'manual',
      status = 'present',
      notes
    } = req.body;

    // Validate required fields
    if (!employee_id || !date) {
      return res.status(400).json({ error: 'Employee ID and date are required' });
    }

    // Check if employee belongs to this business
    const employee = await dbGet(
      'SELECT id FROM employees WHERE id = $1 AND business_id = $2',
      [employee_id, businessId]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if attendance already exists for this date
    const existingAttendance = await dbGet(
      'SELECT id FROM attendance WHERE employee_id = $1 AND date = $2',
      [employee_id, date]
    );

    if (existingAttendance) {
      return res.status(400).json({ error: 'Attendance record already exists for this date' });
    }

    // Calculate working hours if both clock times are provided
    let totalHours = 0;
    let overtimeHours = 0;
    let lateMinutes = 0;
    let earlyDepartureMinutes = 0;
    let finalStatus = status;

    const checkInTimestamp = clock_in_time ? new Date(`${date}T${clock_in_time}`) : null;
    const checkOutTimestamp = clock_out_time ? new Date(`${date}T${clock_out_time}`) : null;

    if (clock_in_time && clock_out_time) {
      totalHours = calculateWorkingHours(clock_in_time, clock_out_time, break_start_time, break_end_time);
      
      // Get employee's work schedule for calculating lateness
      const inputDate = new Date(date);
      const dayOfWeek = inputDate.getDay();
      const workSchedule = await dbGet(`
        SELECT start_time, end_time FROM work_schedules 
        WHERE employee_id = $1 AND day_of_week = $2
      `, [employee_id, dayOfWeek]);

      if (workSchedule) {
        if (workSchedule.start_time) {
          lateMinutes = calculateLateMinutes(clock_in_time, workSchedule.start_time);
        }
        if (workSchedule.end_time) {
          earlyDepartureMinutes = calculateEarlyDepartureMinutes(clock_out_time, workSchedule.end_time);
        }
      }
      
      // Calculate overtime
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      overtimeHours = await calculateOvertime(businessId!, totalHours, isWeekend, false);
      
      // Determine final status
      finalStatus = await determineAttendanceStatus(
        employee_id, businessId!, clock_in_time, clock_out_time, totalHours, lateMinutes
      );
    }

    // Create attendance record
    const result = await dbRun(`
      INSERT INTO attendance (
        employee_id, date, check_in_time, check_out_time, status
      ) VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [
      employee_id, date, checkInTimestamp, checkOutTimestamp, finalStatus
    ]);

    // Fetch the created record
    const newAttendance = await dbGet(`
      SELECT 
        a.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = $1`, [result.lastID]);

    res.status(201).json(newAttendance);
  } catch (error) {
    console.error('Error creating attendance record:', error);
    res.status(500).json({ error: 'Failed to create attendance record' });
  }
});

// PUT /api/attendance/:id - Update attendance record
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.userId;
    const {
      date,
      clock_in_time,
      clock_out_time,
      break_start_time,
      break_end_time,
      attendance_type,
      status,
      notes
    } = req.body;

    // Check if attendance record exists and belongs to this business
    const existingAttendance = await dbGet(
      'SELECT * FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.id = $1 AND e.business_id = $2',
      [id, businessId]
    );

    if (!existingAttendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    // Calculate working hours if both clock times are provided
    let totalHours = 0;
    let overtimeHours = 0;

    const finalDate = date || new Date(existingAttendance.date).toISOString().split('T')[0];

    const finalClockInTimestamp = clock_in_time ? new Date(`${finalDate}T${clock_in_time}`) : existingAttendance.check_in_time;
    const finalClockOutTimestamp = clock_out_time ? new Date(`${finalDate}T${clock_out_time}`) : existingAttendance.check_out_time;

    const clockInForCalc = clock_in_time || (existingAttendance.check_in_time ? new Date(existingAttendance.check_in_time).toTimeString().split(' ')[0] : null);
    const clockOutForCalc = clock_out_time || (existingAttendance.check_out_time ? new Date(existingAttendance.check_out_time).toTimeString().split(' ')[0] : null);

    if (clockInForCalc && clockOutForCalc) {
      totalHours = calculateWorkingHours(
        clockInForCalc,
        clockOutForCalc,
        break_start_time || existingAttendance.break_start_time,
        break_end_time || existingAttendance.break_end_time
      );
      
      // Calculate overtime (assuming 8 hours is standard work day)
      overtimeHours = totalHours > 8 ? totalHours - 8  : 0;
    }

    // Update attendance record
    await dbRun(`
      UPDATE attendance SET
        date = $1, check_in_time = $2, check_out_time = $3, status = $4, updated_at = NOW()
      WHERE id = $5`, [
      finalDate,
      finalClockInTimestamp,
      finalClockOutTimestamp,
      status || existingAttendance.status,
      id
    ]);

    // Fetch updated record
    const updatedAttendance = await dbGet(`
      SELECT 
        a.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = $1`, [id]);

    res.json(updatedAttendance);
  } catch (error) {
    console.error('Error updating attendance record:', error);
    res.status(500).json({ error: 'Failed to update attendance record' });
  }
});

// DELETE /api/attendance/:id - Delete attendance record
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.userId;

    // Check if attendance record exists and belongs to this business
    const attendance = await dbGet(
      'SELECT id FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.id = $1 AND e.business_id = $2',
      [id, businessId]
    );

    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    // Delete attendance record
    await dbRun('DELETE FROM attendance WHERE id = $1', [id]);

    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Error deleting attendance record:', error);
    res.status(500).json({ error: 'Failed to delete attendance record' });
  }
});

// GET /api/attendance/stats/monthly - Get monthly attendance statistics
router.get('/stats/monthly', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const { month, year, employee_id } = req.query;

    const currentDate = new Date();
    const targetMonth = (month || (currentDate.getMonth() + 1).toString()) as string;
    const targetYear = (year || currentDate.getFullYear().toString()) as string;

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
        ROUND(SUM(EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time)) / 3600), 2) as total_hours,
        ROUND(SUM(GREATEST(0, (EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time)) / 3600) - 8)), 2) as total_overtime_hours
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id 
        AND to_char(a.date, 'MM') = $1 AND to_char(a.date, 'YYYY') = $2
      WHERE e.business_id = $3 AND e.status = 'active'
    `;
    
    const params: any[] = [targetMonth.padStart(2, '0'), targetYear, businessId];

    if (employee_id) {
      query += ' AND e.id = $4';
      params.push(employee_id as string);
    }

    query += ' GROUP BY e.id ORDER BY e.first_name, e.last_name';

    const stats = await dbAll(query, params);

    res.json({
      month: parseInt(targetMonth as string),
      year: parseInt(targetYear as string),
      employees: stats
    });
  } catch (error) {
    console.error('Error fetching monthly attendance stats:', error);
    res.status(500).json({ error: 'Failed to fetch monthly attendance statistics' });
  }
});

// GET /api/attendance/stats/summary - Get attendance summary
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const userType = req.user!.userType;
    let businessId: number;
    const { date_from, date_to } = req.query;

    // Set businessId based on user type
    if (userType === 'employee') {
      businessId = req.user!.businessId!!; // Use businessId from token for employees
    } else {
      businessId = req.user!.userId!; // For admin/manager users
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
        ROUND(AVG(EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time)) / 3600), 2) as avg_working_hours,
        ROUND(SUM(GREATEST(0, (EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time)) / 3600) - 8)), 2) as total_overtime_hours
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.business_id = $1 AND a.date BETWEEN $2 AND $3`;
    
    const params: any[] = [businessId, defaultFrom, defaultTo];
    let summaryParamIndex = 4;

    // If employee user, only show their own stats
    if (userType === 'employee') {
      const actualEmployeeId = req.user!.userId!; // For employee login, userId IS the employee ID
      query += ` AND a.employee_id = $${summaryParamIndex++}`;
      params.push(actualEmployeeId);
    }

    const summary = await dbGet(query, params);

    // Get total active employees
    const { total_employees } = await dbGet(
      'SELECT COUNT(*) as total_employees FROM employees WHERE business_id = $1 AND status = \'active\'',
      [businessId]
    );

    res.json({
      ...summary,
      total_active_employees : total_employees,
      date_range: { from: defaultFrom, to: defaultTo }
    });
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

export default router;
