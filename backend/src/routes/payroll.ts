import express from 'express';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Helper function to calculate payroll based on attendance
const calculatePayroll = async (employeeId: number, payPeriodStart: string, payPeriodEnd: string) => {
  // Get employee details
  const employee = await dbGet(
    'SELECT * FROM employees WHERE id = ?',
    [employeeId]
  );

  if (!employee) {
    throw new Error('Employee not found');
  }

  // Get attendance records for the pay period
  const attendanceRecords = await dbAll(`
    SELECT * FROM attendance 
    WHERE employee_id = ? AND date BETWEEN ? AND ?
  `, [employeeId, payPeriodStart, payPeriodEnd]);

  // Calculate totals
  const totalWorkingDays = attendanceRecords.length;
  const totalPresentDays = attendanceRecords.filter(a => a.status === 'present').length;
  const totalOvertimeHours = attendanceRecords.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);
  const totalHours = attendanceRecords.reduce((sum, a) => sum + (a.total_hours || 0), 0);

  let basicSalary = 0;
  let overtimeAmount = 0;

  // Calculate basic salary based on salary type
  if (employee.salary_type === 'monthly') {
    // For monthly employees, calculate pro-rated salary based on present days
    const daysInMonth = new Date(new Date(payPeriodEnd).getFullYear(), new Date(payPeriodEnd).getMonth() + 1, 0).getDate();
    basicSalary = (employee.base_salary / daysInMonth) * totalPresentDays;
  } else if (employee.salary_type === 'daily') {
    basicSalary = (employee.daily_wage || employee.base_salary) * totalPresentDays;
  } else if (employee.salary_type === 'hourly') {
    basicSalary = (employee.hourly_rate || employee.base_salary) * totalHours;
  }

  // Calculate overtime
  if (employee.salary_type === 'hourly') {
    overtimeAmount = (employee.hourly_rate || employee.base_salary) * 1.5 * totalOvertimeHours;
  } else {
    // For monthly/daily employees, calculate overtime based on hourly rate
    const hourlyRate = employee.hourly_rate || (employee.base_salary / 160); // Assuming 160 hours per month
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

// GET /api/payroll - Get payroll records
router.get('/', async (req: Request, res: Response) => {
  try {
    const userType = req.user?.userType;
    let businessId = req.user?.userId;
    
    // For employees, business ID comes from the token
    if (userType === 'employee') {
      businessId = req.user?.businessId;
    }
    const { 
      employee_id, 
      status, 
      pay_period_start, 
      pay_period_end,
      page = 1, 
      limit = 20 
    } = req.query;

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
    const params: any[] = [businessId];

    // If employee user, only show their own payroll
    if (userType === 'employee') {
      // For employee login, req.user.userId is already the employee.id
      query += ' AND p.employee_id = ?';
      params.push(req.user?.userId);
    } else if (employee_id) {
      query += ' AND p.employee_id = ?';
      params.push(employee_id as string);
    }

    if (status && status !== 'all') {
      query += ' AND p.status = ?';
      params.push(status as string);
    }

    if (pay_period_start && pay_period_end) {
      query += ' AND p.pay_period_start >= ? AND p.pay_period_end <= ?';
      params.push(pay_period_start as string, pay_period_end as string);
    }

    query += ' ORDER BY p.pay_period_end DESC, p.created_at DESC';

    // Add pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit as string), offset);

    const payrollRecords = await dbAll(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.business_id = ?
    `;
    const countParams: any[] = [businessId];

    if (userType === 'employee') {
      const employee = await dbGet('SELECT id FROM employees WHERE user_id = ?', [req.user?.userId]);
      if (employee) {
        countQuery += ' AND p.employee_id = ?';
        countParams.push(employee.id);
      }
    } else if (employee_id) {
      countQuery += ' AND p.employee_id = ?';
      countParams.push(employee_id as string);
    }

    if (status && status !== 'all') {
      countQuery += ' AND p.status = ?';
      countParams.push(status as string);
    }

    if (pay_period_start && pay_period_end) {
      countQuery += ' AND p.pay_period_start >= ? AND p.pay_period_end <= ?';
      countParams.push(pay_period_start as string, pay_period_end as string);
    }

    const { total } = await dbGet(countQuery, countParams);

    res.json({
      payroll: payrollRecords,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({ error: 'Failed to fetch payroll records' });
  }
});

// GET /api/payroll/:id/payslip - Generate pay slip for payroll record
router.get('/:id/payslip', async (req: Request, res: Response) => {
  try {
    const payrollId = parseInt(req.params.id);
    if (isNaN(payrollId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payroll ID'
      });
    }

    // Get payroll record with employee details
    const payroll = await dbGet(`
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
    `, [payrollId, req.user!.userId]);

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    // Generate pay slip data
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
  } catch (error) {
    console.error('Generate payslip error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/payroll/:id - Get single payroll record
router.get('/:id', async (req: Request, res: Response) => {
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

    // If employee user, only allow viewing their own payroll
    if (userType === 'employee') {
      const employee = await dbGet('SELECT id FROM employees WHERE user_id = ?', [req.user?.userId]);
      if (employee) {
        query += ' AND p.employee_id = ?';
        params.push(employee.id);
      }
    }

    const payroll = await dbGet(query, params);

    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    res.json(payroll);
  } catch (error) {
    console.error('Error fetching payroll record:', error);
    res.status(500).json({ error: 'Failed to fetch payroll record' });
  }
});

// POST /api/payroll - Create new payroll record
router.post('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user?.userId;
    const {
      employee_id,
      pay_period_start,
      pay_period_end,
      bonus = 0,
      allowances = 0,
      tax_deduction = 0,
      insurance_deduction = 0,
      other_deductions = 0,
      payment_method,
      notes,
      auto_calculate = true
    } = req.body;

    // Validate required fields
    if (!employee_id || !pay_period_start || !pay_period_end) {
      return res.status(400).json({ 
        error: 'Employee ID, pay period start, and pay period end are required' 
      });
    }

    // Check if employee belongs to this business
    const employee = await dbGet(
      'SELECT * FROM employees WHERE id = ? AND business_id = ?',
      [employee_id, businessId]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if payroll already exists for this period
    const existingPayroll = await dbGet(
      'SELECT id FROM payroll WHERE employee_id = ? AND pay_period_start = ? AND pay_period_end = ?',
      [employee_id, pay_period_start, pay_period_end]
    );

    if (existingPayroll) {
      return res.status(400).json({ error: 'Payroll already exists for this period' });
    }

    let basicSalary = 0;
    let overtimeAmount = 0;
    let totalWorkingDays = 0;
    let totalPresentDays = 0;
    let totalOvertimeHours = 0;

    if (auto_calculate) {
      // Auto-calculate based on attendance
      const calculated = await calculatePayroll(employee_id, pay_period_start, pay_period_end);
      basicSalary = calculated.basicSalary;
      overtimeAmount = calculated.overtimeAmount;
      totalWorkingDays = calculated.totalWorkingDays;
      totalPresentDays = calculated.totalPresentDays;
      totalOvertimeHours = calculated.totalOvertimeHours;
    } else {
      // Use provided values
      basicSalary = req.body.basic_salary || 0;
      overtimeAmount = req.body.overtime_amount || 0;
      totalWorkingDays = req.body.total_working_days || 0;
      totalPresentDays = req.body.total_present_days || 0;
      totalOvertimeHours = req.body.total_overtime_hours || 0;
    }

    // Calculate totals
    const grossSalary = basicSalary + overtimeAmount + bonus + allowances;
    const totalDeductions = tax_deduction + insurance_deduction + other_deductions;
    const netSalary = grossSalary - totalDeductions;

    // Create payroll record
    const result = await dbRun(`
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

    // Fetch the created record
    const newPayroll = await dbGet(`
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
  } catch (error) {
    console.error('Error creating payroll record:', error);
    res.status(500).json({ error: 'Failed to create payroll record' });
  }
});

// PUT /api/payroll/:id - Update payroll record
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;
    const {
      basic_salary,
      overtime_amount,
      bonus,
      allowances,
      tax_deduction,
      insurance_deduction,
      other_deductions,
      total_working_days,
      total_present_days,
      total_overtime_hours,
      payment_method,
      notes
    } = req.body;

    // Check if payroll record exists and belongs to this business
    const existingPayroll = await dbGet(
      'SELECT * FROM payroll WHERE id = ? AND business_id = ?',
      [id, businessId]
    );

    if (!existingPayroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    // Don't allow updating if already paid
    if (existingPayroll.status === 'paid') {
      return res.status(400).json({ error: 'Cannot update payroll that has already been paid' });
    }

    // Use existing values if not provided
    const finalBasicSalary = basic_salary ?? existingPayroll.basic_salary;
    const finalOvertimeAmount = overtime_amount ?? existingPayroll.overtime_amount;
    const finalBonus = bonus ?? existingPayroll.bonus;
    const finalAllowances = allowances ?? existingPayroll.allowances;
    const finalTaxDeduction = tax_deduction ?? existingPayroll.tax_deduction;
    const finalInsuranceDeduction = insurance_deduction ?? existingPayroll.insurance_deduction;
    const finalOtherDeductions = other_deductions ?? existingPayroll.other_deductions;

    // Recalculate totals
    const grossSalary = finalBasicSalary + finalOvertimeAmount + finalBonus + finalAllowances;
    const totalDeductions = finalTaxDeduction + finalInsuranceDeduction + finalOtherDeductions;
    const netSalary = grossSalary - totalDeductions;

    // Update payroll record
    await dbRun(`
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

    // Fetch updated record
    const updatedPayroll = await dbGet(`
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
  } catch (error) {
    console.error('Error updating payroll record:', error);
    res.status(500).json({ error: 'Failed to update payroll record' });
  }
});

// PUT /api/payroll/:id/status - Update payroll status
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;
    const { status, payment_date } = req.body;

    // Validate status
    if (!['draft', 'approved', 'paid'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be draft, approved, or paid' });
    }

    // Check if payroll record exists and belongs to this business
    const payroll = await dbGet(
      'SELECT * FROM payroll WHERE id = ? AND business_id = ?',
      [id, businessId]
    );

    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    const updatePaymentDate = status === 'paid' ? (payment_date || new Date().toISOString().split('T')[0]) : null;

    // Update payroll status
    await dbRun(`
      UPDATE payroll SET
        status = ?, payment_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `, [status, updatePaymentDate, id, businessId]);

    // Fetch updated record
    const updatedPayroll = await dbGet(`
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
  } catch (error) {
    console.error('Error updating payroll status:', error);
    res.status(500).json({ error: 'Failed to update payroll status' });
  }
});

// DELETE /api/payroll/:id - Delete payroll record
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;

    // Check if payroll record exists and belongs to this business
    const payroll = await dbGet(
      'SELECT status FROM payroll WHERE id = ? AND business_id = ?',
      [id, businessId]
    );

    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    // Don't allow deleting if already paid
    if (payroll.status === 'paid') {
      return res.status(400).json({ error: 'Cannot delete payroll that has already been paid' });
    }

    // Delete payroll record
    await dbRun('DELETE FROM payroll WHERE id = ? AND business_id = ?', [id, businessId]);

    res.json({ message: 'Payroll record deleted successfully' });
  } catch (error) {
    console.error('Error deleting payroll record:', error);
    res.status(500).json({ error: 'Failed to delete payroll record' });
  }
});

// POST /api/payroll/bulk-create - Create payroll for multiple employees
router.post('/bulk-create', async (req: Request, res: Response) => {
  try {
    const businessId = req.user?.userId;
    const { pay_period_start, pay_period_end, employee_ids, auto_calculate = true } = req.body;

    // Validate required fields
    if (!pay_period_start || !pay_period_end || !employee_ids || !Array.isArray(employee_ids)) {
      return res.status(400).json({ 
        error: 'Pay period start, pay period end, and employee IDs array are required' 
      });
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const employeeId of employee_ids) {
      try {
        // Check if employee belongs to this business
        const employee = await dbGet(
          'SELECT * FROM employees WHERE id = ? AND business_id = ?',
          [employeeId, businessId]
        );

        if (!employee) {
          errors.push({ employeeId, error: 'Employee not found' });
          continue;
        }

        // Check if payroll already exists for this period
        const existingPayroll = await dbGet(
          'SELECT id FROM payroll WHERE employee_id = ? AND pay_period_start = ? AND pay_period_end = ?',
          [employeeId, pay_period_start, pay_period_end]
        );

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
          // Auto-calculate based on attendance
          const calculated = await calculatePayroll(employeeId, pay_period_start, pay_period_end);
          basicSalary = calculated.basicSalary;
          overtimeAmount = calculated.overtimeAmount;
          totalWorkingDays = calculated.totalWorkingDays;
          totalPresentDays = calculated.totalPresentDays;
          totalOvertimeHours = calculated.totalOvertimeHours;
        }

        // Calculate totals
        const grossSalary = basicSalary + overtimeAmount;
        const netSalary = grossSalary; // No deductions in bulk create

        // Create payroll record
        const result = await dbRun(`
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
      } catch (error) {
        errors.push({ employeeId, error: (error as Error).message });
      }
    }

    res.json({
      message: `Payroll created for ${results.length} employees`,
      results,
      errors
    });
  } catch (error) {
    console.error('Error creating bulk payroll:', error);
    res.status(500).json({ error: 'Failed to create bulk payroll' });
  }
});

// GET /api/payroll/stats/summary - Get payroll summary statistics
router.get('/stats/summary', async (req: Request, res: Response) => {
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
    const params: any[] = [businessId];

    if (pay_period_start && pay_period_end) {
      query += ' AND pay_period_start >= ? AND pay_period_end <= ?';
      params.push(pay_period_start as string, pay_period_end as string);
    }

    const summary = await dbGet(query, params);

    res.json(summary);
  } catch (error) {
    console.error('Error fetching payroll summary:', error);
    res.status(500).json({ error: 'Failed to fetch payroll summary' });
  }
});

export default router;
