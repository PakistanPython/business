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
const calculateWorkingDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
    }
    return count;
};
router.get('/types', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const leaveTypes = await (0, database_1.dbAll)(`
      SELECT * FROM leave_types 
      WHERE business_id = ? AND is_active = 1
      ORDER BY name
    `, [businessId]);
        res.json(leaveTypes);
    }
    catch (error) {
        console.error('Error fetching leave types:', error);
        res.status(500).json({ error: 'Failed to fetch leave types' });
    }
});
router.post('/types', async (req, res) => {
    try {
        const businessId = req.user?.userId;
        const { name, description, max_days_per_year, max_days_per_month, carry_forward, is_paid, requires_approval, advance_notice_days, color } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Leave type name is required' });
        }
        const result = await (0, database_1.dbRun)(`
      INSERT INTO leave_types (
        business_id, name, description, max_days_per_year, max_days_per_month,
        carry_forward, is_paid, requires_approval, advance_notice_days, color
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
            businessId, name, description,
            max_days_per_year || 0, max_days_per_month || 0,
            carry_forward ? 1 : 0, is_paid ? 1 : 0, requires_approval ? 1 : 0,
            advance_notice_days || 1, color || '#3B82F6'
        ]);
        const newLeaveType = await (0, database_1.dbGet)('SELECT * FROM leave_types WHERE id = $1', [result.rows?.[0]?.id]);
        res.status(201).json(newLeaveType);
    }
    catch (error) {
        console.error('Error creating leave type:', error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            res.status(400).json({ error: 'Leave type with this name already exists' });
        }
        else {
            res.status(500).json({ error: 'Failed to create leave type' });
        }
    }
});
router.get('/entitlements', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const userType = req.user.userType;
        const { employee_id, year } = req.query;
        const currentYear = new Date().getFullYear();
        const targetYear = year ? parseInt(year) : currentYear;
        let query = `
      SELECT 
        le.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        lt.name as leave_type_name,
        lt.color as leave_type_color
      FROM employee_leave_entitlements le
      JOIN employees e ON le.employee_id = e.id
      JOIN leave_types lt ON le.leave_type_id = lt.id
      WHERE le.business_id = ? AND le.year = ? `;
        const params = [businessId, targetYear];
        if (userType === 'employee') {
            const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE user_id = $1', [req.user?.userId]);
            if (employee) {
                query += ' AND le.employee_id = ?';
                params.push(employee.id);
            }
        }
        else if (employee_id) {
            query += ' AND le.employee_id = ?';
            params.push(employee_id);
        }
        query += ' ORDER BY e.first_name, e.last_name, lt.name';
        const entitlements = await (0, database_1.dbAll)(query, params);
        res.json(entitlements);
    }
    catch (error) {
        console.error('Error fetching leave entitlements:', error);
        res.status(500).json({ error: 'Failed to fetch leave entitlements' });
    }
});
router.post('/entitlements', async (req, res) => {
    try {
        const businessId = req.user?.userId;
        const { employee_id, leave_type_id, year, total_days, carried_forward } = req.body;
        if (!employee_id || !leave_type_id || !year || total_days === undefined) {
            return res.status(400).json({
                error: 'Employee ID, leave type ID, year, and total days are required'
            });
        }
        const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE id = ? AND business_id = $2', [employee_id, businessId]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const existing = await (0, database_1.dbGet)('SELECT id FROM employee_leave_entitlements WHERE employee_id = ? AND leave_type_id = ? AND year = $3', [employee_id, leave_type_id, year]);
        if (existing) {
            await (0, database_1.dbRun)(`
        UPDATE employee_leave_entitlements SET
          total_days = ?, carried_forward = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [total_days, carried_forward || 0, existing.id]);
            const updated = await (0, database_1.dbGet)(`
        SELECT 
          le.*,
          e.first_name,
          e.last_name,
          e.employee_code,
          lt.name as leave_type_name
        FROM employee_leave_entitlements le
        JOIN employees e ON le.employee_id = e.id
        JOIN leave_types lt ON le.leave_type_id = lt.id
        WHERE le.id = ?
      `, [existing.id]);
            res.json(updated);
        }
        else {
            const result = await (0, database_1.dbRun)(`
        INSERT INTO employee_leave_entitlements (
          employee_id, leave_type_id, business_id, year, total_days, carried_forward
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [employee_id, leave_type_id, businessId, year, total_days, carried_forward || 0]);
            const newEntitlement = await (0, database_1.dbGet)(`
        SELECT 
          le.*,
          e.first_name,
          e.last_name,
          e.employee_code,
          lt.name as leave_type_name
        FROM employee_leave_entitlements le
        JOIN employees e ON le.employee_id = e.id
        JOIN leave_types lt ON le.leave_type_id = lt.id
        WHERE le.id = ?
      `, [result.rows?.[0]?.id]);
            res.status(201).json(newEntitlement);
        }
    }
    catch (error) {
        console.error('Error managing leave entitlement:', error);
        res.status(500).json({ error: 'Failed to manage leave entitlement' });
    }
});
router.get('/requests', async (req, res) => {
    try {
        const businessId = req.user.userId;
        const userType = req.user.userType;
        const { employee_id, status, start_date, end_date, page = 1, limit = 20 } = req.query;
        let query = `
      SELECT 
        lr.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        lt.name as leave_type_name,
        lt.color as leave_type_color,
        lt.is_paid,
        approver.full_name as approved_by_name
      FROM employee_leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users approver ON lr.approved_by = approver.id
      WHERE lr.business_id = ? `;
        const params = [businessId];
        if (userType === 'employee') {
            const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE user_id = $1', [req.user?.userId]);
            if (employee) {
                query += ' AND lr.employee_id = ?';
                params.push(employee.id);
            }
        }
        else if (employee_id) {
            query += ' AND lr.employee_id = ?';
            params.push(employee_id);
        }
        if (status && status !== 'all') {
            query += ' AND lr.status = ?';
            params.push(status);
        }
        if (start_date && end_date) {
            query += ' AND lr.start_date BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }
        query += ' ORDER BY lr.created_at DESC';
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET $2`;
        params.push(parseInt(limit), offset);
        const requests = await (0, database_1.dbAll)(query, params);
        let countQuery = `
      SELECT COUNT(*) as total
      FROM employee_leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.business_id = ? `;
        const countParams = [businessId];
        if (userType === 'employee') {
            const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE user_id = $1', [req.user?.userId]);
            if (employee) {
                countQuery += ' AND lr.employee_id = ?';
                countParams.push(employee.id);
            }
        }
        else if (employee_id) {
            countQuery += ' AND lr.employee_id = ?';
            countParams.push(employee_id);
        }
        if (status && status !== 'all') {
            countQuery += ' AND lr.status = ?';
            countParams.push(status);
        }
        if (start_date && end_date) {
            countQuery += ' AND lr.start_date BETWEEN ? AND ?';
            countParams.push(start_date, end_date);
        }
        const { total } = await (0, database_1.dbGet)(countQuery, countParams);
        res.json({
            requests,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ error: 'Failed to fetch leave requests' });
    }
});
router.post('/requests', async (req, res) => {
    try {
        const businessId = req.user?.userId;
        const userType = req.user?.userType;
        const { employee_id, leave_type_id, start_date, end_date, reason, emergency_contact, handover_notes } = req.body;
        let actualEmployeeId = employee_id;
        if (userType === 'employee') {
            const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE user_id = $1', [req.user?.userId]);
            if (!employee) {
                return res.status(404).json({ error: 'Employee record not found' });
            }
            actualEmployeeId = employee.id;
        }
        if (!actualEmployeeId || !leave_type_id || !start_date || !end_date || !reason) {
            return res.status(400).json({
                error: 'Employee ID, leave type, start date, end date, and reason are required'
            });
        }
        if (new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ error: 'Start date cannot be after end date' });
        }
        const totalDays = calculateWorkingDays(start_date, end_date);
        const currentYear = new Date(start_date).getFullYear();
        const entitlement = await (0, database_1.dbGet)(`
      SELECT * FROM employee_leave_entitlements 
      WHERE employee_id = ? AND leave_type_id = ? AND year = ? `, [actualEmployeeId, leave_type_id, currentYear]);
        if (entitlement && entitlement.remaining_days < totalDays) {
            return res.status(400).json({
                error: `Insufficient leave balance. Available: ${entitlement.remaining_days} days, Requested: ${totalDays} days`
            });
        }
        const overlapping = await (0, database_1.dbGet)(`
      SELECT id FROM employee_leave_requests 
      WHERE employee_id = ? AND status IN ('pending', 'approved')
        AND ((start_date <= ? AND end_date >= ?) OR (start_date <= ? AND end_date >= ?))
    `, [actualEmployeeId, start_date, start_date, end_date, end_date]);
        if (overlapping) {
            return res.status(400).json({ error: 'You have overlapping leave requests for these dates' });
        }
        const result = await (0, database_1.dbRun)(`
      INSERT INTO employee_leave_requests (
        employee_id, leave_type_id, business_id, start_date, end_date,
        total_days, reason, emergency_contact, handover_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
            actualEmployeeId, leave_type_id, businessId, start_date, end_date,
            totalDays, reason, emergency_contact, handover_notes
        ]);
        const newRequest = await (0, database_1.dbGet)(`
      SELECT 
        lr.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        lt.name as leave_type_name,
        lt.color as leave_type_color
      FROM employee_leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.id = ? `, [result.rows?.[0]?.id]);
        res.status(201).json(newRequest);
    }
    catch (error) {
        console.error('Error creating leave request:', error);
        res.status(500).json({ error: 'Failed to create leave request' });
    }
});
router.put('/requests/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const { action, rejection_reason } = req.body;
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Action must be approve or reject' });
        }
        const leaveRequest = await (0, database_1.dbGet)('SELECT * FROM employee_leave_requests WHERE id = ? AND business_id = $2', [id, businessId]);
        if (!leaveRequest) {
            return res.status(404).json({ error: 'Leave request not found' });
        }
        if (leaveRequest.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending requests can be approved or rejected' });
        }
        const status = action === 'approve' ? 'approved' : 'rejected';
        const approvedAt = action === "approve" ? new Date().toISOString() : null;
        await (0, database_1.dbRun)(`
      UPDATE employee_leave_requests SET
        status = $2, approved_by = $3, approved_at = $4, rejection_reason = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ? `, [status, req.user.userId, approvedAt, rejection_reason, id, businessId]);
        if (action === 'approve') {
            const currentYear = new Date(leaveRequest.start_date).getFullYear();
            await (0, database_1.dbRun)(`
        UPDATE employee_leave_entitlements SET
          used_days = used_days + $1, updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = ? AND leave_type_id = ? AND year = ? `, [leaveRequest.total_days, leaveRequest.employee_id, leaveRequest.leave_type_id, currentYear]);
        }
        const updatedRequest = await (0, database_1.dbGet)(`
      SELECT 
        lr.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        lt.name as leave_type_name,
        approver.full_name as approved_by_name
      FROM employee_leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users approver ON lr.approved_by = approver.id
      WHERE lr.id = ? `, [id]);
        res.json(updatedRequest);
    }
    catch (error) {
        console.error('Error approving/rejecting leave request:', error);
        res.status(500).json({ error: 'Failed to process leave request' });
    }
});
router.get('/balance/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const businessId = req.user.userId;
        const { year } = req.query;
        const currentYear = year ? parseInt(year) : new Date().getFullYear();
        const balances = await (0, database_1.dbAll)(`
      SELECT 
        le.*,
        lt.name as leave_type_name,
        lt.color as leave_type_color,
        lt.max_days_per_year,
        lt.max_days_per_month
      FROM employee_leave_entitlements le
      JOIN leave_types lt ON le.leave_type_id = lt.id
      WHERE le.employee_id = ? AND le.business_id = ? AND le.year = ? ORDER BY lt.name
    `, [employeeId, businessId, currentYear]);
        res.json(balances);
    }
    catch (error) {
        console.error('Error fetching leave balance:', error);
        res.status(500).json({ error: 'Failed to fetch leave balance' });
    }
});
exports.default = router;
