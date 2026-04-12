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
const getBusinessIdFromRequest = (req) => {
    return req.user.userType === 'employee' ? req.user.businessId : req.user.userId;
};
const isEmployeeUser = (req) => req.user.userType === 'employee';
const formatDateOnly = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
(async () => {
    try {
        await (0, database_1.dbRun)(`
      CREATE TABLE IF NOT EXISTS leave_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        max_days_per_year INTEGER,
        max_days_per_month INTEGER,
        leave_limit_period TEXT DEFAULT 'year' CHECK (leave_limit_period IN ('month', 'year')),
        is_paid BOOLEAN DEFAULT true,
        business_id INTEGER,
        FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
        await (0, database_1.dbRun)(`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS max_days_per_month INTEGER`);
        await (0, database_1.dbRun)(`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS leave_limit_period TEXT DEFAULT 'year'`);
        const leaveTypes = await (0, database_1.dbAll)('SELECT * FROM leave_types');
        if (leaveTypes.length === 0) {
            await (0, database_1.dbRun)(`
        INSERT INTO leave_types (name, description, max_days_per_year, max_days_per_month, leave_limit_period, is_paid) VALUES
        ('Annual Leave', 'Annual paid leave', 20, NULL, 'year', true),
        ('Sick Leave', 'Leave for sickness', 10, NULL, 'year', true),
        ('Unpaid Leave', 'Unpaid leave', 30, NULL, 'year', false)
      `);
        }
    }
    catch (error) {
        console.error('Error initializing leave types:', error);
    }
})();
router.get('/types', async (req, res) => {
    try {
        const businessId = getBusinessIdFromRequest(req);
        const leaveTypes = await (0, database_1.dbAll)('SELECT * FROM leave_types WHERE business_id = $1 OR business_id IS NULL', [businessId]);
        res.json(leaveTypes);
    }
    catch (error) {
        console.error('Error fetching leave types:', error);
        res.status(500).json({ error: 'Failed to fetch leave types' });
    }
});
router.post('/types', async (req, res) => {
    try {
        const businessId = getBusinessIdFromRequest(req);
        const { name, description, max_days_per_year, max_days_per_month, leave_limit_period = 'year', is_paid, } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Leave type name is required' });
        }
        const existingType = await (0, database_1.dbGet)('SELECT id FROM leave_types WHERE name = $1 AND (business_id = $2 OR business_id IS NULL)', [name, businessId]);
        if (existingType) {
            return res.status(409).json({ error: 'Leave type with this name already exists' });
        }
        const period = leave_limit_period === 'month' ? 'month' : 'year';
        const yearlyLimit = period === 'year' ? Number(max_days_per_year || 0) : null;
        const monthlyLimit = period === 'month' ? Number(max_days_per_month || 0) : null;
        if ((period === 'year' && (!yearlyLimit || yearlyLimit <= 0)) || (period === 'month' && (!monthlyLimit || monthlyLimit <= 0))) {
            return res.status(400).json({ error: `Please provide a valid max days per ${period}` });
        }
        const result = await (0, database_1.dbRun)(`INSERT INTO leave_types
        (name, description, max_days_per_year, max_days_per_month, leave_limit_period, is_paid, business_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, [name, description, yearlyLimit, monthlyLimit, period, is_paid, businessId]);
        const newLeaveType = await (0, database_1.dbGet)('SELECT * FROM leave_types WHERE id = $1', [result.lastID]);
        res.status(201).json(newLeaveType);
    }
    catch (error) {
        console.error('Error creating leave type:', error);
        res.status(500).json({ error: 'Failed to create leave type' });
    }
});
router.put('/types/:id', async (req, res) => {
    try {
        const businessId = getBusinessIdFromRequest(req);
        const { id } = req.params;
        const { name, description, max_days_per_year, max_days_per_month, leave_limit_period = 'year', is_paid, } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Leave type name is required' });
        }
        const leaveType = await (0, database_1.dbGet)('SELECT id, business_id FROM leave_types WHERE id = $1', [id]);
        if (!leaveType) {
            return res.status(404).json({ error: 'Leave type not found.' });
        }
        if (leaveType.business_id !== null && leaveType.business_id !== businessId) {
            return res.status(403).json({ error: 'You do not have permission to edit this leave type.' });
        }
        const period = leave_limit_period === 'month' ? 'month' : 'year';
        const yearlyLimit = period === 'year' ? Number(max_days_per_year || 0) : null;
        const monthlyLimit = period === 'month' ? Number(max_days_per_month || 0) : null;
        if ((period === 'year' && (!yearlyLimit || yearlyLimit <= 0)) || (period === 'month' && (!monthlyLimit || monthlyLimit <= 0))) {
            return res.status(400).json({ error: `Please provide a valid max days per ${period}` });
        }
        const result = await (0, database_1.dbRun)(`UPDATE leave_types
       SET name = $1,
           description = $2,
           max_days_per_year = $3,
           max_days_per_month = $4,
           leave_limit_period = $5,
           is_paid = $6,
           business_id = $7
       WHERE id = $8`, [name, description, yearlyLimit, monthlyLimit, period, is_paid, businessId, id]);
        const updatedLeaveType = await (0, database_1.dbGet)('SELECT * FROM leave_types WHERE id = $1', [id]);
        res.json(updatedLeaveType);
    }
    catch (error) {
        console.error('Error updating leave type:', error);
        res.status(500).json({ error: 'Failed to update leave type' });
    }
});
router.delete('/types/:id', async (req, res) => {
    try {
        const businessId = getBusinessIdFromRequest(req);
        const { id } = req.params;
        const leaveType = await (0, database_1.dbGet)('SELECT id, business_id FROM leave_types WHERE id = $1', [id]);
        if (!leaveType) {
            return res.status(404).json({ error: 'Leave type not found.' });
        }
        if (leaveType.business_id !== null && leaveType.business_id !== businessId) {
            return res.status(403).json({ error: 'You do not have permission to delete this leave type.' });
        }
        await (0, database_1.dbRun)('DELETE FROM leave_types WHERE id = $1', [id]);
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting leave type:', error);
        res.status(500).json({ error: 'Failed to delete leave type' });
    }
});
router.get('/summary', async (req, res) => {
    try {
        const businessId = getBusinessIdFromRequest(req);
        const requestedEmployeeId = req.query.employee_id ? Number(req.query.employee_id) : null;
        const employeeId = isEmployeeUser(req) ? req.user.userId : requestedEmployeeId;
        if (!employeeId || !Number.isFinite(employeeId) || employeeId <= 0) {
            return res.status(400).json({ error: 'employee_id is required' });
        }
        const employee = await (0, database_1.dbGet)('SELECT id, first_name, last_name, hire_date FROM employees WHERE id = $1 AND business_id = $2', [employeeId, businessId]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const leaveTypesRaw = await (0, database_1.dbAll)(`SELECT *
       FROM leave_types
       WHERE business_id = $1 OR business_id IS NULL
       ORDER BY business_id DESC NULLS LAST, id DESC`, [businessId]);
        const leaveTypesByName = new Map();
        for (const lt of leaveTypesRaw) {
            if (!leaveTypesByName.has(lt.name))
                leaveTypesByName.set(lt.name, lt);
        }
        const leaveTypes = Array.from(leaveTypesByName.values());
        const leaves = await (0, database_1.dbAll)(`SELECT leave_type, start_date, end_date, status
       FROM leaves
       WHERE employee_id = $1 AND status = 'approved'`, [employeeId]);
        const now = new Date();
        const hireDate = new Date(employee.hire_date);
        const safeHireDate = Number.isNaN(hireDate.getTime()) ? now : hireDate;
        const msPerDay = 24 * 60 * 60 * 1000;
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);
        const endOfCurrentYear = new Date(now.getFullYear(), 11, 31);
        const overlapDays = (startA, endA, startB, endB) => {
            const start = new Date(Math.max(startA.getTime(), startB.getTime()));
            const end = new Date(Math.min(endA.getTime(), endB.getTime()));
            if (end < start)
                return 0;
            return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
        };
        const getCompletedMonthsSince = (start, end) => {
            let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
            if (end.getDate() < start.getDate())
                months -= 1;
            return Math.max(0, months);
        };
        const getCompletedYearsSince = (start, end) => {
            let years = end.getFullYear() - start.getFullYear();
            const anniversaryPassed = end.getMonth() > start.getMonth() ||
                (end.getMonth() === start.getMonth() && end.getDate() >= start.getDate());
            if (!anniversaryPassed)
                years -= 1;
            return Math.max(0, years);
        };
        const completedMonthsSinceHire = getCompletedMonthsSince(safeHireDate, now);
        const completedYearsSinceHire = getCompletedYearsSince(safeHireDate, now);
        const monthPeriodsAccrued = Math.max(0, completedMonthsSinceHire - 2);
        const yearPeriodsAccrued = completedYearsSinceHire;
        const summary = leaveTypes.map((leaveType) => {
            const period = leaveType.leave_limit_period === 'month' ? 'month' : 'year';
            const limitPerPeriod = period === 'month'
                ? Number(leaveType.max_days_per_month || 0)
                : Number(leaveType.max_days_per_year || 0);
            const accruedPeriods = period === 'month'
                ? Math.max(0, monthPeriodsAccrued)
                : Math.max(0, yearPeriodsAccrued);
            const accruedTotal = limitPerPeriod > 0 ? limitPerPeriod * accruedPeriods : 0;
            const matchedLeaves = leaves.filter((l) => l.leave_type === leaveType.name);
            const usedTotal = matchedLeaves.reduce((sum, leave) => {
                const leaveStart = new Date(leave.start_date);
                const leaveEnd = new Date(leave.end_date);
                if (Number.isNaN(leaveStart.getTime()) || Number.isNaN(leaveEnd.getTime()))
                    return sum;
                return sum + overlapDays(leaveStart, leaveEnd, safeHireDate, now);
            }, 0);
            const usedCurrentPeriod = matchedLeaves.reduce((sum, leave) => {
                const leaveStart = new Date(leave.start_date);
                const leaveEnd = new Date(leave.end_date);
                if (Number.isNaN(leaveStart.getTime()) || Number.isNaN(leaveEnd.getTime()))
                    return sum;
                if (period === 'month') {
                    return sum + overlapDays(leaveStart, leaveEnd, startOfCurrentMonth, endOfCurrentMonth);
                }
                return sum + overlapDays(leaveStart, leaveEnd, startOfCurrentYear, endOfCurrentYear);
            }, 0);
            return {
                leave_type: leaveType.name,
                description: leaveType.description,
                is_paid: !!leaveType.is_paid,
                leave_limit_period: period,
                limit_per_period: limitPerPeriod,
                accrued_periods: accruedPeriods,
                accrued_total: accruedTotal,
                used_total: usedTotal,
                used_current_period: usedCurrentPeriod,
                remaining_total: Math.max(0, accruedTotal - usedTotal),
            };
        });
        res.json({
            employee: {
                id: employee.id,
                name: `${employee.first_name} ${employee.last_name}`,
                hire_date: employee.hire_date,
            },
            as_of: now.toISOString(),
            summary,
        });
    }
    catch (error) {
        console.error('Error fetching leave summary:', error);
        res.status(500).json({ error: 'Failed to fetch leave summary' });
    }
});
router.get('/', async (req, res) => {
    try {
        const businessId = getBusinessIdFromRequest(req);
        const { employee_id } = req.query;
        let query = `
      SELECT 
        l.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      WHERE e.business_id = $1
    `;
        const params = [businessId];
        let paramIndex = 2;
        if (isEmployeeUser(req)) {
            query += ` AND l.employee_id = $${paramIndex++}`;
            params.push(req.user.userId);
        }
        if (employee_id) {
            query += ` AND l.employee_id = $${paramIndex++}`;
            params.push(employee_id);
        }
        query += ' ORDER BY l.start_date DESC';
        const leaves = await (0, database_1.dbAll)(query, params);
        res.json(leaves);
    }
    catch (error) {
        console.error('Error fetching leaves:', error);
        res.status(500).json({ error: 'Failed to fetch leaves' });
    }
});
router.post('/', async (req, res) => {
    try {
        const businessId = getBusinessIdFromRequest(req);
        const { employee_id, start_date, end_date, leave_type, status } = req.body;
        const targetEmployeeId = isEmployeeUser(req) ? req.user.userId : employee_id;
        if (!targetEmployeeId || !start_date || !end_date || !leave_type) {
            return res.status(400).json({
                error: 'Employee ID, start date, end date and leave type are required'
            });
        }
        const requestStart = new Date(start_date);
        const requestEnd = new Date(end_date);
        if (Number.isNaN(requestStart.getTime()) || Number.isNaN(requestEnd.getTime()) || requestEnd < requestStart) {
            return res.status(400).json({ error: 'Invalid leave date range' });
        }
        const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE id = $1 AND business_id = $2', [targetEmployeeId, businessId]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const leaveTypeConfig = await (0, database_1.dbGet)(`SELECT id, name, leave_limit_period, max_days_per_year, max_days_per_month
       FROM leave_types
       WHERE name = $1 AND (business_id = $2 OR business_id IS NULL)
       ORDER BY business_id DESC NULLS LAST
       LIMIT 1`, [leave_type, businessId]);
        if (leaveTypeConfig) {
            const msPerDay = 24 * 60 * 60 * 1000;
            const requestedDays = Math.floor((requestEnd.getTime() - requestStart.getTime()) / msPerDay) + 1;
            const period = leaveTypeConfig.leave_limit_period === 'month' ? 'month' : 'year';
            const limit = period === 'month'
                ? Number(leaveTypeConfig.max_days_per_month || 0)
                : Number(leaveTypeConfig.max_days_per_year || 0);
            if (limit > 0) {
                const year = requestStart.getFullYear();
                const month = requestStart.getMonth();
                const periodStart = period === 'month'
                    ? new Date(year, month, 1)
                    : new Date(year, 0, 1);
                const periodEnd = period === 'month'
                    ? new Date(year, month + 1, 0)
                    : new Date(year, 11, 31);
                const fmt = (d) => {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                };
                const overlappingLeaves = await (0, database_1.dbAll)(`SELECT start_date, end_date
           FROM leaves
           WHERE employee_id = $1
             AND leave_type = $2
             AND status IN ('approved', 'pending')
             AND start_date <= $3
             AND end_date >= $4`, [targetEmployeeId, leave_type, fmt(periodEnd), fmt(periodStart)]);
                const overlapDaysInPeriod = (startA, endA, startB, endB) => {
                    const start = new Date(Math.max(startA.getTime(), startB.getTime()));
                    const end = new Date(Math.min(endA.getTime(), endB.getTime()));
                    if (end < start)
                        return 0;
                    return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
                };
                const alreadyUsed = overlappingLeaves.reduce((sum, row) => {
                    const rowStart = new Date(row.start_date);
                    const rowEnd = new Date(row.end_date);
                    if (Number.isNaN(rowStart.getTime()) || Number.isNaN(rowEnd.getTime()))
                        return sum;
                    return sum + overlapDaysInPeriod(rowStart, rowEnd, periodStart, periodEnd);
                }, 0);
                const requestedInPeriod = overlapDaysInPeriod(requestStart, requestEnd, periodStart, periodEnd);
                const totalAfterRequest = alreadyUsed + requestedInPeriod;
                if (requestedInPeriod <= 0) {
                    return res.status(400).json({
                        error: `Selected leave range does not fall within configured ${period} period window.`,
                    });
                }
                if (totalAfterRequest > limit) {
                    return res.status(400).json({
                        error: `Leave limit exceeded: this leave type allows ${limit} day(s) per ${period}. Already used ${alreadyUsed}, requested ${requestedInPeriod}.`,
                    });
                }
            }
        }
        const result = await (0, database_1.dbRun)(`
      INSERT INTO leaves (
        employee_id, start_date, end_date, leave_type, status
      ) VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [
            targetEmployeeId, start_date, end_date, leave_type, status || 'pending'
        ]);
        const newLeave = await (0, database_1.dbGet)(`
      SELECT 
        l.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      WHERE l.id = $1
    `, [result.lastID]);
        res.status(201).json(newLeave);
    }
    catch (error) {
        console.error('Error creating leave:', error);
        res.status(500).json({ error: 'Failed to create leave' });
    }
});
router.put('/:id/status', async (req, res) => {
    try {
        if (isEmployeeUser(req)) {
            return res.status(403).json({ error: 'Employees cannot approve or reject leave requests' });
        }
        const businessId = getBusinessIdFromRequest(req);
        const { id } = req.params;
        const { status } = req.body;
        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Allowed: approved, rejected, pending' });
        }
        const leave = await (0, database_1.dbGet)(`SELECT l.*, e.business_id, e.first_name, e.last_name, e.employee_code
       FROM leaves l
       JOIN employees e ON l.employee_id = e.id
       WHERE l.id = $1 AND e.business_id = $2`, [id, businessId]);
        if (!leave) {
            return res.status(404).json({ error: 'Leave request not found' });
        }
        if (status === 'approved') {
            const leaveTypeConfig = await (0, database_1.dbGet)(`SELECT leave_limit_period, max_days_per_year, max_days_per_month
         FROM leave_types
         WHERE name = $1 AND (business_id = $2 OR business_id IS NULL)
         ORDER BY business_id DESC NULLS LAST
         LIMIT 1`, [leave.leave_type, businessId]);
            if (leaveTypeConfig) {
                const requestStart = new Date(leave.start_date);
                const requestEnd = new Date(leave.end_date);
                const msPerDay = 24 * 60 * 60 * 1000;
                const period = leaveTypeConfig.leave_limit_period === 'month' ? 'month' : 'year';
                const limit = period === 'month'
                    ? Number(leaveTypeConfig.max_days_per_month || 0)
                    : Number(leaveTypeConfig.max_days_per_year || 0);
                if (limit > 0 && !Number.isNaN(requestStart.getTime()) && !Number.isNaN(requestEnd.getTime())) {
                    const year = requestStart.getFullYear();
                    const month = requestStart.getMonth();
                    const periodStart = period === 'month' ? new Date(year, month, 1) : new Date(year, 0, 1);
                    const periodEnd = period === 'month' ? new Date(year, month + 1, 0) : new Date(year, 11, 31);
                    const overlapDays = (startA, endA, startB, endB) => {
                        const start = new Date(Math.max(startA.getTime(), startB.getTime()));
                        const end = new Date(Math.min(endA.getTime(), endB.getTime()));
                        if (end < start)
                            return 0;
                        return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
                    };
                    const approvedInPeriod = await (0, database_1.dbAll)(`SELECT start_date, end_date
             FROM leaves
             WHERE employee_id = $1
               AND leave_type = $2
               AND status = 'approved'
               AND id <> $3
               AND start_date <= $4
               AND end_date >= $5`, [leave.employee_id, leave.leave_type, id, formatDateOnly(periodEnd), formatDateOnly(periodStart)]);
                    const alreadyUsed = approvedInPeriod.reduce((sum, row) => {
                        const rowStart = new Date(row.start_date);
                        const rowEnd = new Date(row.end_date);
                        if (Number.isNaN(rowStart.getTime()) || Number.isNaN(rowEnd.getTime()))
                            return sum;
                        return sum + overlapDays(rowStart, rowEnd, periodStart, periodEnd);
                    }, 0);
                    const requestedInPeriod = overlapDays(requestStart, requestEnd, periodStart, periodEnd);
                    if (alreadyUsed + requestedInPeriod > limit) {
                        return res.status(400).json({
                            error: `Cannot approve. Leave limit exceeded for ${period}: allowed ${limit}, already approved ${alreadyUsed}, requested ${requestedInPeriod}.`
                        });
                    }
                }
            }
        }
        await (0, database_1.dbRun)(`UPDATE leaves
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`, [status, id]);
        if (status === 'approved') {
            const leaveStart = new Date(leave.start_date);
            const leaveEnd = new Date(leave.end_date);
            if (!Number.isNaN(leaveStart.getTime()) && !Number.isNaN(leaveEnd.getTime())) {
                for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
                    const dateKey = formatDateOnly(d);
                    const existingAttendance = await (0, database_1.dbGet)('SELECT id FROM attendance WHERE employee_id = $1 AND date::date = $2', [leave.employee_id, dateKey]);
                    const leaveNote = `Approved leave (${leave.leave_type})`;
                    if (existingAttendance) {
                        await (0, database_1.dbRun)(`UPDATE attendance
               SET status = 'absent',
                   notes = $1,
                   updated_at = NOW()
               WHERE id = $2`, [leaveNote, existingAttendance.id]);
                    }
                    else {
                        await (0, database_1.dbRun)(`INSERT INTO attendance
                (employee_id, date, status, total_hours, overtime_hours, notes)
               VALUES ($1, $2, 'absent', 0, 0, $3)`, [leave.employee_id, dateKey, leaveNote]);
                    }
                }
            }
        }
        const updated = await (0, database_1.dbGet)(`SELECT l.*, e.first_name, e.last_name, e.employee_code
       FROM leaves l
       JOIN employees e ON l.employee_id = e.id
       WHERE l.id = $1`, [id]);
        res.json(updated);
    }
    catch (error) {
        console.error('Error updating leave request status:', error);
        res.status(500).json({ error: 'Failed to update leave request status' });
    }
});
exports.default = router;
