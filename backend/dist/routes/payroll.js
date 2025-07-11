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
const calculatePayroll = async (employeeId, payPeriodStart, payPeriodEnd) => {
    const employee = await (0, database_1.dbGet)('SELECT * FROM employees WHERE id = ?', [employeeId]);
    if (!employee) {
        throw new Error('Employee not found');
    }
    const attendanceRecords = await (0, database_1.dbAll)(`
    SELECT * FROM attendance 
    WHERE employee_id = ? AND date BETWEEN ? AND ?
  `, [employeeId, payPeriodStart, payPeriodEnd]);
    const totalWorkingDays = attendanceRecords.length;
    const totalPresentDays = attendanceRecords.filter(a => a.status === 'present').length;
    const totalOvertimeHours = attendanceRecords.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);
    const totalHours = attendanceRecords.reduce((sum, a) => sum + (a.total_hours || 0), 0);
    let basicSalary = 0;
    let overtimeAmount = 0;
    if (employee.salary_type === 'monthly') {
        const daysInMonth = new Date(new Date(payPeriodEnd).getFullYear(), new Date(payPeriodEnd).getMonth() + 1, 0).getDate();
        basicSalary = (employee.base_salary / daysInMonth) * totalPresentDays;
    }
    else if (employee.salary_type === 'daily') {
        basicSalary = (employee.daily_wage || employee.base_salary) * totalPresentDays;
    }
    else if (employee.salary_type === 'hourly') {
        basicSalary = (employee.hourly_rate || employee.base_salary) * totalHours;
    }
    if (employee.salary_type === 'hourly') {
        overtimeAmount = (employee.hourly_rate || employee.base_salary) * 1.5 * totalOvertimeHours;
    }
    else {
        const hourlyRate = employee.hourly_rate || (employee.base_salary / 160);
        overtimeAmount = hourlyRate * 1.5 * totalOvertimeHours;
    }
    return {
        basicSalary: Math.round(basicSalary * 100) / 100,
        overtimeAmount: Math.round(overtimeAmount * 100) / 100,
        totalWorkingDays,
        totalPresentDays,
        totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100
    };
};
router.get('/', async (req, res) => {
    try {
        const userType = req.user?.userType;
        let businessId = req.user?.userId;
        if (userType === 'employee') {
            businessId = req.user?.businessId;
        }
        const { employee_id, status, pay_period_start, pay_period_end, page = 1, limit = 20 } = req.query;
        let query = `
      SELECT 
        p.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department,
        e.position
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.business_id = ?
    `;
        const params = [businessId];
        if (userType === 'employee') {
            query += ' AND p.employee_id = ?';
            params.push(req.user?.userId);
        }
        else if (employee_id) {
            query += ' AND p.employee_id = ?';
            params.push(employee_id);
        }
        if (status && status !== 'all') {
            query += ' AND p.status = ?';
            params.push(status);
        }
        if (pay_period_start && pay_period_end) {
            query += ' AND p.pay_period_start >= ? AND p.pay_period_end <= ?';
            params.push(pay_period_start, pay_period_end);
        }
        query += ' ORDER BY p.pay_period_end DESC, p.created_at DESC';
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);
        const payrollRecords = await (0, database_1.dbAll)(query, params);
        let countQuery = `
      SELECT COUNT(*) as total
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.business_id = ?
    `;
        const countParams = [businessId];
        if (userType === 'employee') {
            const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE user_id = ?', [req.user?.userId]);
            if (employee) {
                countQuery += ' AND p.employee_id = ?';
                countParams.push(employee.id);
            }
        }
        else if (employee_id) {
            countQuery += ' AND p.employee_id = ?';
            countParams.push(employee_id);
        }
        if (status && status !== 'all') {
            countQuery += ' AND p.status = ?';
            countParams.push(status);
        }
        if (pay_period_start && pay_period_end) {
            countQuery += ' AND p.pay_period_start >= ? AND p.pay_period_end <= ?';
            countParams.push(pay_period_start, pay_period_end);
        }
        const { total } = await (0, database_1.dbGet)(countQuery, countParams);
        res.json({
            payroll: payrollRecords,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching payroll:', error);
        res.status(500).json({ error: 'Failed to fetch payroll records' });
    }
});
router.get('/:id/payslip', async (req, res) => {
    try {
        const payrollId = parseInt(req.params.id);
        if (isNaN(payrollId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payroll ID'
            });
        }
        const payroll = await (0, database_1.dbGet)(`
      SELECT 
        p.*,
        (e.first_name || ' ' || e.last_name) as employee_name,
        e.employee_code,
        e.position,
        e.department,
        e.hire_date,
        u.business_name
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      JOIN users u ON p.business_id = u.id
      WHERE p.id = ? AND p.business_id = ?
    `, [payrollId, req.user.userId]);
        if (!payroll) {
            return res.status(404).json({
                success: false,
                message: 'Payroll record not found'
            });
        }
        const payslipData = {
            payroll_id: payroll.id,
            employee: {
                name: payroll.employee_name,
                employee_id: payroll.employee_code,
                position: payroll.position,
                department: payroll.department,
                join_date: payroll.hire_date
            },
            company: {
                name: payroll.business_name || 'Company Name'
            },
            pay_period: {
                start: payroll.pay_period_start,
                end: payroll.pay_period_end
            },
            earnings: {
                basic_salary: parseFloat(payroll.basic_salary),
                overtime_amount: parseFloat(payroll.overtime_amount || 0),
                bonus: parseFloat(payroll.bonus || 0),
                allowances: parseFloat(payroll.allowances || 0),
                total_earnings: parseFloat(payroll.gross_salary)
            },
            deductions: {
                tax_deduction: parseFloat(payroll.tax_deduction || 0),
                insurance_deduction: parseFloat(payroll.insurance_deduction || 0),
                other_deductions: parseFloat(payroll.other_deductions || 0),
                total_deductions: parseFloat(payroll.total_deductions)
            },
            summary: {
                gross_salary: parseFloat(payroll.gross_salary),
                total_deductions: parseFloat(payroll.total_deductions),
                net_salary: parseFloat(payroll.net_salary)
            },
            attendance: {
                total_working_days: payroll.total_working_days || 0,
                total_present_days: payroll.total_present_days || 0,
                total_overtime_hours: payroll.total_overtime_hours || 0
            },
            payment: {
                method: payroll.payment_method,
                status: payroll.status,
                generated_date: new Date().toISOString()
            },
            notes: payroll.notes
        };
        res.json({
            success: true,
            data: {
                payslip: payslipData
            }
        });
    }
    catch (error) {
        console.error('Generate payslip error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const userType = req.user?.userType;
        let query = `
      SELECT 
        p.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department,
        e.position,
        e.salary_type,
        e.base_salary
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.id = ? AND p.business_id = ?
    `;
        const params = [id, businessId];
        if (userType === 'employee') {
            const employee = await (0, database_1.dbGet)('SELECT id FROM employees WHERE user_id = ?', [req.user?.userId]);
            if (employee) {
                query += ' AND p.employee_id = ?';
                params.push(employee.id);
            }
        }
        const payroll = await (0, database_1.dbGet)(query, params);
        if (!payroll) {
            return res.status(404).json({ error: 'Payroll record not found' });
        }
        res.json(payroll);
    }
    catch (error) {
        console.error('Error fetching payroll record:', error);
        res.status(500).json({ error: 'Failed to fetch payroll record' });
    }
});
router.post('/', async (req, res) => {
    try {
        const businessId = req.user?.userId;
        const { employee_id, pay_period_start, pay_period_end, bonus = 0, allowances = 0, tax_deduction = 0, insurance_deduction = 0, other_deductions = 0, payment_method, notes, auto_calculate = true } = req.body;
        if (!employee_id || !pay_period_start || !pay_period_end) {
            return res.status(400).json({
                error: 'Employee ID, pay period start, and pay period end are required'
            });
        }
        const employee = await (0, database_1.dbGet)('SELECT * FROM employees WHERE id = ? AND business_id = ?', [employee_id, businessId]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const existingPayroll = await (0, database_1.dbGet)('SELECT id FROM payroll WHERE employee_id = ? AND pay_period_start = ? AND pay_period_end = ?', [employee_id, pay_period_start, pay_period_end]);
        if (existingPayroll) {
            return res.status(400).json({ error: 'Payroll already exists for this period' });
        }
        let basicSalary = 0;
        let overtimeAmount = 0;
        let totalWorkingDays = 0;
        let totalPresentDays = 0;
        let totalOvertimeHours = 0;
        if (auto_calculate) {
            const calculated = await calculatePayroll(employee_id, pay_period_start, pay_period_end);
            basicSalary = calculated.basicSalary;
            overtimeAmount = calculated.overtimeAmount;
            totalWorkingDays = calculated.totalWorkingDays;
            totalPresentDays = calculated.totalPresentDays;
            totalOvertimeHours = calculated.totalOvertimeHours;
        }
        else {
            basicSalary = req.body.basic_salary || 0;
            overtimeAmount = req.body.overtime_amount || 0;
            totalWorkingDays = req.body.total_working_days || 0;
            totalPresentDays = req.body.total_present_days || 0;
            totalOvertimeHours = req.body.total_overtime_hours || 0;
        }
        const grossSalary = basicSalary + overtimeAmount + bonus + allowances;
        const totalDeductions = tax_deduction + insurance_deduction + other_deductions;
        const netSalary = grossSalary - totalDeductions;
        const result = await (0, database_1.dbRun)(`
      INSERT INTO payroll (
        employee_id, business_id, pay_period_start, pay_period_end,
        basic_salary, overtime_amount, bonus, allowances,
        tax_deduction, insurance_deduction, other_deductions,
        total_working_days, total_present_days, total_overtime_hours,
        payment_method, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            employee_id, businessId, pay_period_start, pay_period_end,
            basicSalary, overtimeAmount, bonus, allowances,
            tax_deduction, insurance_deduction, other_deductions,
            totalWorkingDays, totalPresentDays, totalOvertimeHours,
            payment_method, notes
        ]);
        const newPayroll = await (0, database_1.dbGet)(`
      SELECT 
        p.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.id = ?
    `, [result.lastID]);
        res.status(201).json(newPayroll);
    }
    catch (error) {
        console.error('Error creating payroll record:', error);
        res.status(500).json({ error: 'Failed to create payroll record' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const { basic_salary, overtime_amount, bonus, allowances, tax_deduction, insurance_deduction, other_deductions, total_working_days, total_present_days, total_overtime_hours, payment_method, notes } = req.body;
        const existingPayroll = await (0, database_1.dbGet)('SELECT * FROM payroll WHERE id = ? AND business_id = ?', [id, businessId]);
        if (!existingPayroll) {
            return res.status(404).json({ error: 'Payroll record not found' });
        }
        if (existingPayroll.status === 'paid') {
            return res.status(400).json({ error: 'Cannot update payroll that has already been paid' });
        }
        const finalBasicSalary = basic_salary ?? existingPayroll.basic_salary;
        const finalOvertimeAmount = overtime_amount ?? existingPayroll.overtime_amount;
        const finalBonus = bonus ?? existingPayroll.bonus;
        const finalAllowances = allowances ?? existingPayroll.allowances;
        const finalTaxDeduction = tax_deduction ?? existingPayroll.tax_deduction;
        const finalInsuranceDeduction = insurance_deduction ?? existingPayroll.insurance_deduction;
        const finalOtherDeductions = other_deductions ?? existingPayroll.other_deductions;
        const grossSalary = finalBasicSalary + finalOvertimeAmount + finalBonus + finalAllowances;
        const totalDeductions = finalTaxDeduction + finalInsuranceDeduction + finalOtherDeductions;
        const netSalary = grossSalary - totalDeductions;
        await (0, database_1.dbRun)(`
      UPDATE payroll SET
        basic_salary = ?, overtime_amount = ?, bonus = ?, allowances = ?,
        gross_salary = ?, tax_deduction = ?, insurance_deduction = ?,
        other_deductions = ?, total_deductions = ?, net_salary = ?,
        total_working_days = ?, total_present_days = ?, total_overtime_hours = ?,
        payment_method = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `, [
            finalBasicSalary, finalOvertimeAmount, finalBonus, finalAllowances,
            grossSalary, finalTaxDeduction, finalInsuranceDeduction,
            finalOtherDeductions, totalDeductions, netSalary,
            total_working_days ?? existingPayroll.total_working_days,
            total_present_days ?? existingPayroll.total_present_days,
            total_overtime_hours ?? existingPayroll.total_overtime_hours,
            payment_method ?? existingPayroll.payment_method,
            notes ?? existingPayroll.notes,
            id, businessId
        ]);
        const updatedPayroll = await (0, database_1.dbGet)(`
      SELECT 
        p.*,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.id = ?
    `, [id]);
        res.json(updatedPayroll);
    }
    catch (error) {
        console.error('Error updating payroll record:', error);
        res.status(500).json({ error: 'Failed to update payroll record' });
    }
});
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const { status, payment_date } = req.body;
        if (!['draft', 'approved', 'paid'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be draft, approved, or paid' });
        }
        const payroll = await (0, database_1.dbGet)('SELECT * FROM payroll WHERE id = ? AND business_id = ?', [id, businessId]);
        if (!payroll) {
            return res.status(404).json({ error: 'Payroll record not found' });
        }
        const updatePaymentDate = status === 'paid' ? (payment_date || new Date().toISOString().split('T')[0]) : null;
        await (0, database_1.dbRun)(`
      UPDATE payroll SET
        status = ?, payment_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `, [status, updatePaymentDate, id, businessId]);
        const updatedPayroll = await (0, database_1.dbGet)(`
      SELECT 
        p.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.id = ?
    `, [id]);
        res.json(updatedPayroll);
    }
    catch (error) {
        console.error('Error updating payroll status:', error);
        res.status(500).json({ error: 'Failed to update payroll status' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const payroll = await (0, database_1.dbGet)('SELECT status FROM payroll WHERE id = ? AND business_id = ?', [id, businessId]);
        if (!payroll) {
            return res.status(404).json({ error: 'Payroll record not found' });
        }
        if (payroll.status === 'paid') {
            return res.status(400).json({ error: 'Cannot delete payroll that has already been paid' });
        }
        await (0, database_1.dbRun)('DELETE FROM payroll WHERE id = ? AND business_id = ?', [id, businessId]);
        res.json({ message: 'Payroll record deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting payroll record:', error);
        res.status(500).json({ error: 'Failed to delete payroll record' });
    }
});
router.post('/bulk-create', async (req, res) => {
    try {
        const businessId = req.user?.userId;
        const { pay_period_start, pay_period_end, employee_ids, auto_calculate = true } = req.body;
        if (!pay_period_start || !pay_period_end || !employee_ids || !Array.isArray(employee_ids)) {
            return res.status(400).json({
                error: 'Pay period start, pay period end, and employee IDs array are required'
            });
        }
        const results = [];
        const errors = [];
        for (const employeeId of employee_ids) {
            try {
                const employee = await (0, database_1.dbGet)('SELECT * FROM employees WHERE id = ? AND business_id = ?', [employeeId, businessId]);
                if (!employee) {
                    errors.push({ employeeId, error: 'Employee not found' });
                    continue;
                }
                const existingPayroll = await (0, database_1.dbGet)('SELECT id FROM payroll WHERE employee_id = ? AND pay_period_start = ? AND pay_period_end = ?', [employeeId, pay_period_start, pay_period_end]);
                if (existingPayroll) {
                    errors.push({ employeeId, error: 'Payroll already exists for this period' });
                    continue;
                }
                let basicSalary = 0;
                let overtimeAmount = 0;
                let totalWorkingDays = 0;
                let totalPresentDays = 0;
                let totalOvertimeHours = 0;
                if (auto_calculate) {
                    const calculated = await calculatePayroll(employeeId, pay_period_start, pay_period_end);
                    basicSalary = calculated.basicSalary;
                    overtimeAmount = calculated.overtimeAmount;
                    totalWorkingDays = calculated.totalWorkingDays;
                    totalPresentDays = calculated.totalPresentDays;
                    totalOvertimeHours = calculated.totalOvertimeHours;
                }
                const grossSalary = basicSalary + overtimeAmount;
                const netSalary = grossSalary;
                const result = await (0, database_1.dbRun)(`
          INSERT INTO payroll (
            employee_id, business_id, pay_period_start, pay_period_end,
            basic_salary, overtime_amount,
            total_working_days, total_present_days, total_overtime_hours
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
                    employeeId, businessId, pay_period_start, pay_period_end,
                    basicSalary, overtimeAmount,
                    totalWorkingDays, totalPresentDays, totalOvertimeHours
                ]);
                results.push({
                    employeeId,
                    payrollId: result.lastID,
                    basicSalary,
                    overtimeAmount,
                    grossSalary,
                    netSalary
                });
            }
            catch (error) {
                errors.push({ employeeId, error: error.message });
            }
        }
        res.json({
            message: `Payroll created for ${results.length} employees`,
            results,
            errors
        });
    }
    catch (error) {
        console.error('Error creating bulk payroll:', error);
        res.status(500).json({ error: 'Failed to create bulk payroll' });
    }
});
router.get('/stats/summary', async (req, res) => {
    try {
        const businessId = req.user?.userId;
        const { pay_period_start, pay_period_end } = req.query;
        let query = `
      SELECT 
        COUNT(*) as total_payrolls,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_payrolls,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_payrolls,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_payrolls,
        ROUND(SUM(gross_salary), 2) as total_gross_salary,
        ROUND(SUM(net_salary), 2) as total_net_salary,
        ROUND(SUM(total_deductions), 2) as total_deductions,
        ROUND(AVG(net_salary), 2) as avg_net_salary
      FROM payroll
      WHERE business_id = ?
    `;
        const params = [businessId];
        if (pay_period_start && pay_period_end) {
            query += ' AND pay_period_start >= ? AND pay_period_end <= ?';
            params.push(pay_period_start, pay_period_end);
        }
        const summary = await (0, database_1.dbGet)(query, params);
        res.json(summary);
    }
    catch (error) {
        console.error('Error fetching payroll summary:', error);
        res.status(500).json({ error: 'Failed to fetch payroll summary' });
    }
});
exports.default = router;
