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
    'SELECT * FROM employees WHERE id = $1',
    [employeeId]
  );

  if (!employee) {
    throw new Error('Employee not found');
  }

  // Get attendance records for the pay period
  const attendanceRecords = await dbAll(`
    SELECT * FROM attendance 
    WHERE employee_id = $1 AND date BETWEEN $2 AND $3
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
    totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
  };
};

// GET /api/payroll - Get payroll records
router.get('/', async (req: Request, res: Response) => {
  try {
    const userType = req.user!.userType;
    let businessId = req.user!.userId;
    
    // For employees, business ID comes from the token
    if (userType === 'employee') {
      businessId = req.user!.businessId!;
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
      WHERE e.business_id = $1
    `;
    const params: any[] = [businessId];

    // If employee user, only show their own payroll
    if (userType === 'employee') {
      // For employee login, req.user!.userId is already the employee.id
      query += ` AND p.employee_id = $${params.length + 1}`;
      params.push(req.user?.userId);
    } else if (employee_id) {
      query += ` AND p.employee_id = $${params.length + 1}`;
      params.push(employee_id as string);
    }

    if (status && status !== 'all') {
      query += ` AND p.status = $${params.length + 1}`;
      params.push(status as string);
    }

    if (pay_period_start && pay_period_end) {
      query += ` AND p.pay_period_start >= $${params.length + 1} AND p.pay_period_end <= $${params.length + 2}`;
      params.push(pay_period_start as string, pay_period_end as string);
    }

    query += ' ORDER BY p.pay_period_end DESC, p.created_at DESC';

    // Add pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), offset);

    const payrollRecords = await dbAll(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE e.business_id = $1
    `;
    const countParams: any[] = [businessId];

    if (userType === 'employee') {
      const employee = await dbGet('SELECT id FROM employees WHERE user_id = $1', [req.user?.userId]);
      if (employee) {
        countQuery += ` AND p.employee_id = $${countParams.length + 1}`;
        countParams.push(employee.id);
      }
    } else if (employee_id) {
      countQuery += ` AND p.employee_id = $${countParams.length + 1}`;
      countParams.push(employee_id as string);
    }

    if (status && status !== 'all') {
      countQuery += ` AND p.status = $${countParams.length + 1}`;
      countParams.push(status as string);
    }

    if (pay_period_start && pay_period_end) {
      countQuery += ` AND p.pay_period_start >= $${countParams.length + 1} AND p.pay_period_end <= $${countParams.length + 2}`;
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

// GET /api/payroll/:id - Get single payroll record
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.userId;
    const userType = req.user!.userType;

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
      WHERE p.id = $1 AND e.business_id = $2
    `;
    const params = [id, businessId];

    // If employee user, only allow viewing their own payroll
    if (userType === 'employee') {
      const employee = await dbGet('SELECT id FROM employees WHERE user_id = $1', [req.user?.userId]);
      if (employee) {
        query += ` AND p.employee_id = $${params.length + 1}`;
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
      bonuses = 0,
      reimbursements = 0,
      tax_deduction = 0,
      insurance_deduction = 0,
      other_deductions = 0,
      pay_method,
      notes,
      auto_calculate = true,
    } = req.body;

    // Validate required fields
    if (!employee_id || !pay_period_start || !pay_period_end) {
      return res.status(400).json({ 
        error: 'Employee ID, pay period start, and pay period end are required' 
      });
    }

    // Check if employee belongs to this business
    const employee = await dbGet(
      'SELECT * FROM employees WHERE id = $1 AND business_id = $2',
      [employee_id, businessId]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if payroll already exists for this period
    const existingPayroll = await dbGet(
      'SELECT id FROM payroll WHERE employee_id = $1 AND pay_period_start = $2 AND pay_period_end = $3',
      [employee_id, pay_period_start, pay_period_end]
    );

    if (existingPayroll) {
      return res.status(400).json({ error: 'Payroll already exists for this period' });
    }

    // When auto_calculate is true, the frontend performs the calculation and sends the data.
    // When it's false, the user-entered data is sent.
    // In both cases, we trust the data in the request body.
    const {
      basic_salary: basicSalary = 0,
      overtime_amount: overtimeAmount = 0,
      total_working_days: totalWorkingDays = 0,
      total_present_days: totalPresentDays = 0,
      total_overtime_hours: totalOvertimeHours = 0,
    } = req.body;

    // Calculate totals
    const grossSalary = basicSalary + overtimeAmount + bonuses + reimbursements;
    const totalDeductions = tax_deduction + insurance_deduction + other_deductions;
    const netSalary = grossSalary - totalDeductions;

    // Create payroll record
    const result = await dbRun(`
      INSERT INTO payroll (
        employee_id, pay_period_start, pay_period_end,
        gross_salary, deductions, net_salary,
        total_working_days, total_present_days, total_overtime_hours,
        bonuses, reimbursements, pay_method, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft') RETURNING id
    `, [
      employee_id, pay_period_start, pay_period_end,
      grossSalary, totalDeductions, netSalary,
      totalWorkingDays, totalPresentDays, totalOvertimeHours,
      bonuses, reimbursements, pay_method, notes
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
      WHERE p.id = $1
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
      bonuses,
      reimbursements,
      tax_deduction,
      insurance_deduction,
      other_deductions,
      pay_method,
      notes,
    } = req.body;

    // Check if payroll record exists and belongs to this business
    const existingPayroll = await dbGet(
      'SELECT p.* FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.id = $1 AND e.business_id = $2',
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
    const finalBonuses = bonuses ?? existingPayroll.bonuses;
    const finalReimbursements = reimbursements ?? existingPayroll.reimbursements;
    const finalTaxDeduction = tax_deduction ?? existingPayroll.tax_deduction;
    const finalInsuranceDeduction = insurance_deduction ?? existingPayroll.insurance_deduction;
    const finalOtherDeductions = other_deductions ?? existingPayroll.other_deductions;

    // Recalculate totals
    const grossSalary = finalBasicSalary + finalOvertimeAmount + finalBonuses + finalReimbursements;
    const totalDeductions = finalTaxDeduction + finalInsuranceDeduction + finalOtherDeductions;
    const netSalary = grossSalary - totalDeductions;

    // Update payroll record
    await dbRun(`
      UPDATE payroll SET
        gross_salary = $1,
        deductions = $2,
        net_salary = $3,
        bonuses = $4,
        reimbursements = $5,
        pay_method = $6,
        notes = $7,
        updated_at = NOW()
      WHERE id = $8
    `, [
      grossSalary,
      totalDeductions,
      netSalary,
      finalBonuses,
      finalReimbursements,
      pay_method ?? existingPayroll.pay_method,
      notes ?? existingPayroll.notes,
      id,
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
      WHERE p.id = $1
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
      'SELECT p.* FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.id = $1 AND e.business_id = $2',
      [id, businessId]
    );

    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    const updatePaymentDate = status === 'paid' ? (payment_date || new Date().toISOString().split('T')[0]) : null;

    // Update payroll status
    await dbRun(`
      UPDATE payroll SET
        status = $1, updated_at = NOW()
      WHERE id = $2
    `, [status, id]);

    // Fetch updated record
    const updatedPayroll = await dbGet(`
      SELECT 
        p.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.id = $1
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
      'SELECT p.status FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.id = $1 AND e.business_id = $2',
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
    await dbRun('DELETE FROM payroll WHERE id = $1', [id]);

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
          'SELECT * FROM employees WHERE id = $1 AND business_id = $2',
          [employeeId, businessId]
        );

        if (!employee) {
          errors.push({ employeeId, error: 'Employee not found' });
          continue;
        }

        // Check if payroll already exists for this period
        const existingPayroll = await dbGet(
          'SELECT id FROM payroll WHERE employee_id = $1 AND pay_period_start = $2 AND pay_period_end = $3',
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
        const totalDeductions = 0; // No deductions in bulk create
        const netSalary = grossSalary - totalDeductions;

        // Create payroll record
        const result = await dbRun(`
          INSERT INTO payroll (
            employee_id, pay_period_start, pay_period_end,
            gross_salary, deductions, net_salary,
            total_working_days, total_present_days, total_overtime_hours,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft') RETURNING id
        `, [
          employeeId, pay_period_start, pay_period_end,
          grossSalary, totalDeductions, netSalary,
          totalWorkingDays, totalPresentDays, totalOvertimeHours,
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

// POST /api/payroll/calculate - Calculate payroll based on attendance
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { employee_id, pay_period_start, pay_period_end } = req.body;

    if (!employee_id || !pay_period_start || !pay_period_end) {
      return res.status(400).json({ error: 'Employee ID, pay period start, and pay period end are required' });
    }

    const calculated = await calculatePayroll(employee_id, pay_period_start, pay_period_end);
    res.json(calculated);
  } catch (error) {
    console.error('Error calculating payroll:', error);
    res.status(500).json({ error: 'Failed to calculate payroll' });
  }
});

// GET /api/payroll/stats/summary - Get payroll summary statistics
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const { pay_period_start, pay_period_end } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total_payrolls,
        COUNT(CASE WHEN p.status = 'draft' THEN 1 END) as draft_payrolls,
        COUNT(CASE WHEN p.status = 'approved' THEN 1 END) as approved_payrolls,
        COUNT(CASE WHEN p.status = 'paid' THEN 1 END) as paid_payrolls,
        COALESCE(ROUND(CAST(SUM(CASE WHEN p.status = 'paid' THEN gross_salary ELSE 0 END) AS numeric), 2), 0) as total_gross_salary,
        COALESCE(ROUND(CAST(SUM(CASE WHEN p.status = 'paid' THEN net_salary ELSE 0 END) AS numeric), 2), 0) as total_net_salary,
        COALESCE(ROUND(CAST(SUM(CASE WHEN p.status = 'paid' THEN deductions ELSE 0 END) AS numeric), 2), 0) as total_deductions,
        COALESCE(ROUND(CAST(AVG(CASE WHEN p.status = 'paid' THEN net_salary ELSE NULL END) AS numeric), 2), 0) as avg_net_salary
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE e.business_id = $1
    `;
    const params: any[] = [businessId];

    if (pay_period_start && pay_period_end) {
      query += ` AND p.pay_period_start >= $${params.length + 1} AND p.pay_period_end <= $${params.length + 2}`;
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
