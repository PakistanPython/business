import express from 'express';
import bcrypt from 'bcryptjs';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Generate unique employee code with collision handling
const generateEmployeeCode = async (businessId: number): Promise<string> => {
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Try up to 10 times to find a unique code
  for (let attempt = 0; attempt < 10; attempt++) {
    // Get the highest existing employee number for this year globally
    const result = await dbGet(
      'SELECT MAX(CAST(SUBSTR(employee_code, 6) AS INTEGER)) as max_number FROM employees WHERE employee_code LIKE $1',
      [`EMP${year}%`]
    );
    
    const nextNumber = ((result.max_number || 0) + 1 + attempt).toString().padStart(4, '0');
    const employeeCode = `EMP${year}${nextNumber}`;
    
    // Check if this code already exists
    const existing = await dbGet(
      'SELECT id FROM employees WHERE employee_code = $1',
      [employeeCode]
    );
    
    if (!existing) {
      return employeeCode;
    }
  }
  
  // If we can't find a unique code after 10 attempts, use timestamp-based approach
  const timestamp = Date.now().toString().slice(-4);
  return `EMP${year}${timestamp}`;
};

// GET /api/employees - Get all employees for a business
router.get('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const { status, department, search } = req.query;

    let query = `
      SELECT 
        e.*
      FROM employees e
      WHERE e.business_id = $1
    `;
    const params: any[] = [businessId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      query += ` AND e.status = $${paramIndex++}`;
      params.push(status);
    }

    if (department && department !== 'all') {
      query += ` AND e.department = $${paramIndex++}`;
      params.push(department);
    }

    if (search) {
      query += ` AND (e.first_name LIKE $${paramIndex} OR e.last_name LIKE $${paramIndex} OR e.employee_code LIKE $${paramIndex} OR e.email LIKE $${paramIndex})`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm);
      paramIndex++;
    }

    query += ' ORDER BY e.created_at DESC';

    const employees = await dbAll(query, params);
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// GET /api/employees/profile - Get current employee's profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.userId;

    const employee = await dbGet(`
      SELECT 
        e.*
      FROM employees e
      WHERE e.id = $1
    `, [employeeId]);

    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    res.status(500).json({ error: 'Failed to fetch employee profile' });
  }
});

// GET /api/employees/:id - Get single employee
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.userId;

    const employee = await dbGet(`
      SELECT 
        e.*
      FROM employees e
      WHERE e.id = $1 AND e.business_id = $2
    `, [id, businessId]);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// POST /api/employees - Create new employee
router.post('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const createdByUserId = req.user!.userId;
    const {
      first_name,
      last_name,
      email,
      password,
      phone,
      address,
      hire_date,
      employment_type,
      salary_type,
      base_salary,
      daily_wage,
      hourly_rate,
      department,
      position,
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !email || !password || !hire_date || !base_salary) {
      return res.status(400).json({ 
        error: 'Required fields: first_name, last_name, email, password, hire_date, base_salary' 
      });
    }

    // Check if email already exists
    const existingEmployee = await dbGet('SELECT id FROM employees WHERE email = $1', [email]);
    if (existingEmployee) {
      return res.status(400).json({ error: 'Employee with this email already exists' });
    }

    // Generate employee code
    const employee_code = await generateEmployeeCode(businessId!);
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create employee record
    const result = await dbRun(`
      INSERT INTO employees (
        business_id, employee_code, first_name, last_name, email, password_hash, phone, address,
        hire_date, employment_type, salary_type, base_salary, daily_wage, hourly_rate,
        department, position, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id
    `, [
      businessId, employee_code, first_name, last_name, email, hashedPassword, phone, address,
      hire_date, employment_type || 'full_time', salary_type || 'monthly',
      base_salary, daily_wage, hourly_rate, department, position, createdByUserId
    ]);

    // Fetch the created employee
    const newEmployee = await dbGet(`
      SELECT *
      FROM employees
      WHERE id = $1
    `, [result.lastID]);

    res.status(201).json({ employee: newEmployee });
  } catch (error: any) {
    console.error('Error creating employee:', error);
    
    // Handle specific SQLITE constraint errors
    if (error.code === 'SQLITE_CONSTRAINT') {
      if (error.message.includes('employee_code')) {
        return res.status(409).json({ 
          error: 'Employee code conflict detected. Please try again.',
          message: 'A unique employee code could not be generated. This may happen with concurrent requests.'
        });
      }
      if (error.message.includes('email')) {
        return res.status(400).json({ 
          error: 'Email already exists',
          message: 'An employee with this email address already exists.'
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to create employee',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// PUT /api/employees/:id - Update employee
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;
    
    const {
      first_name,
      last_name,
      email,
      phone,
      address,
      employment_type,
      salary_type,
      base_salary,
      daily_wage,
      hourly_rate,
      department,
      position,
      status
    } = req.body;

    // Check if employee exists and belongs to this business
    const existingEmployee = await dbGet(
      'SELECT * FROM employees WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );

    if (!existingEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if email is being changed and already exists
    if (email && email !== existingEmployee.email) {
      const emailExists = await dbGet(
        'SELECT id FROM employees WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (emailExists) {
        return res.status(400).json({ error: 'Employee with this email already exists' });
      }
    }

    // Update employee record
    await dbRun(`
      UPDATE employees SET
        first_name = $1, last_name = $2, email = $3, phone = $4, address = $5,
        employment_type = $6, salary_type = $7, base_salary = $8, daily_wage = $9,
        hourly_rate = $10, department = $11, position = $12, status = $13,
        updated_at = NOW()
      WHERE id = $14 AND business_id = $15
    `, [
      first_name || existingEmployee.first_name,
      last_name || existingEmployee.last_name,
      email || existingEmployee.email,
      phone || existingEmployee.phone,
      address || existingEmployee.address,
      employment_type || existingEmployee.employment_type,
      salary_type || existingEmployee.salary_type,
      base_salary || existingEmployee.base_salary,
      daily_wage || existingEmployee.daily_wage,
      hourly_rate || existingEmployee.hourly_rate,
      department || existingEmployee.department,
      position || existingEmployee.position,
      status || existingEmployee.status,
      id,
      businessId
    ]);

    // Fetch updated employee
    const updatedEmployee = await dbGet(`
      SELECT 
        e.*
      FROM employees e
      WHERE e.id = $16
    `, [id]);

    res.json(updatedEmployee);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// DELETE /api/employees/:id - Delete employee
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;

    // Check if employee exists and belongs to this business
    const employee = await dbGet(
      'SELECT id FROM employees WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Delete employee record (this will cascade to attendance, payroll, etc.)
    await dbRun('DELETE FROM employees WHERE id = $1 AND business_id = $2', [id, businessId]);

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// GET /api/employees/stats/overview - Get employee statistics
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;

    const stats = await dbGet(`
      SELECT 
        COUNT(*) as total_employees,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_employees,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_employees,
        COUNT(CASE WHEN employment_type = 'full_time' THEN 1 END) as full_time_employees,
        COUNT(CASE WHEN employment_type = 'part_time' THEN 1 END) as part_time_employees,
        COUNT(CASE WHEN employment_type = 'contract' THEN 1 END) as contract_employees
      FROM employees 
      WHERE business_id = $1
    `, [businessId]);

    // Get department breakdown
    const departments = await dbAll(`
      SELECT 
        department,
        COUNT(*) as count
      FROM employees 
      WHERE business_id = $1 AND department IS NOT NULL
      GROUP BY department
      ORDER BY count DESC
    `, [businessId]);

    res.json({
      ...stats,
      departments
    });
  } catch (error) {
    console.error('Error fetching employee stats:', error);
    res.status(500).json({ error: 'Failed to fetch employee statistics' });
  }
});

// POST /api/employees/:id/reset-password - Reset employee password
router.post('/:id/reset-password', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;
    const { password } = req.body;

    // Check if employee exists and belongs to this business
    const employee = await dbGet(
      'SELECT id FROM employees WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Generate new temporary password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    await dbRun(
      'UPDATE employees SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, id]
    );

    res.json({
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
