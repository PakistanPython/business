"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_sqlite_1 = require("../config/database_sqlite");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
const generateEmployeeCode = async (businessId) => {
    const year = new Date().getFullYear().toString().slice(-2);
    for (let attempt = 0; attempt < 10; attempt++) {
        const result = await (0, database_sqlite_1.dbGet)('SELECT MAX(CAST(SUBSTR(employee_code, 6) AS INTEGER)) as max_number FROM employees WHERE employee_code LIKE ?', [`EMP${year}%`]);
        const nextNumber = ((result.max_number || 0) + 1 + attempt).toString().padStart(4, '0');
        const employeeCode = `EMP${year}${nextNumber}`;
        const existing = await (0, database_sqlite_1.dbGet)('SELECT id FROM employees WHERE employee_code = ?', [employeeCode]);
        if (!existing) {
            return employeeCode;
        }
    }
    const timestamp = Date.now().toString().slice(-4);
    return `EMP${year}${timestamp}`;
};
router.get('/', async (req, res) => {
    try {
        const businessId = req.user?.userId;
        const { status, department, search } = req.query;
        let query = `
      SELECT 
        e.*
      FROM employees e
      WHERE e.business_id = ?
    `;
        const params = [businessId];
        if (status && status !== 'all') {
            query += ' AND e.status = ?';
            params.push(status);
        }
        if (department && department !== 'all') {
            query += ' AND e.department = ?';
            params.push(department);
        }
        if (search) {
            query += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ? OR e.email LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        query += ' ORDER BY e.created_at DESC';
        const employees = await (0, database_sqlite_1.dbAll)(query, params);
        res.json(employees);
    }
    catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
});
router.get('/profile', async (req, res) => {
    try {
        const employeeId = req.user?.userId;
        const employee = await (0, database_sqlite_1.dbGet)(`
      SELECT 
        e.*
      FROM employees e
      WHERE e.id = ?
    `, [employeeId]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee profile not found' });
        }
        res.json(employee);
    }
    catch (error) {
        console.error('Error fetching employee profile:', error);
        res.status(500).json({ error: 'Failed to fetch employee profile' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const employee = await (0, database_sqlite_1.dbGet)(`
      SELECT 
        e.*
      FROM employees e
      WHERE e.id = ? AND e.business_id = ?
    `, [id, businessId]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json(employee);
    }
    catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({ error: 'Failed to fetch employee' });
    }
});
router.post('/', async (req, res) => {
    try {
        const businessId = req.user?.userId;
        const createdByUserId = req.user?.userId;
        const { first_name, last_name, email, password, phone, address, hire_date, employment_type, salary_type, base_salary, daily_wage, hourly_rate, department, position, } = req.body;
        if (!first_name || !last_name || !email || !password || !hire_date || !base_salary) {
            return res.status(400).json({
                error: 'Required fields: first_name, last_name, email, password, hire_date, base_salary'
            });
        }
        const existingEmployee = await (0, database_sqlite_1.dbGet)('SELECT id FROM employees WHERE email = ?', [email]);
        if (existingEmployee) {
            return res.status(400).json({ error: 'Employee with this email already exists' });
        }
        const employee_code = await generateEmployeeCode(businessId);
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const result = await (0, database_sqlite_1.dbRun)(`
      INSERT INTO employees (
        business_id, employee_code, first_name, last_name, email, password_hash, phone, address,
        hire_date, employment_type, salary_type, base_salary, daily_wage, hourly_rate,
        department, position, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            businessId, employee_code, first_name, last_name, email, hashedPassword, phone, address,
            hire_date, employment_type || 'full_time', salary_type || 'monthly',
            base_salary, daily_wage, hourly_rate, department, position, createdByUserId
        ]);
        const newEmployee = await (0, database_sqlite_1.dbGet)(`
      SELECT *
      FROM employees
      WHERE id = ?
    `, [result.lastID]);
        res.status(201).json({ employee: newEmployee });
    }
    catch (error) {
        console.error('Error creating employee:', error);
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
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const { first_name, last_name, email, phone, address, employment_type, salary_type, base_salary, daily_wage, hourly_rate, department, position, status } = req.body;
        const existingEmployee = await (0, database_sqlite_1.dbGet)('SELECT * FROM employees WHERE id = ? AND business_id = ?', [id, businessId]);
        if (!existingEmployee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        if (email && email !== existingEmployee.email) {
            const emailExists = await (0, database_sqlite_1.dbGet)('SELECT id FROM employees WHERE email = ? AND id != ?', [email, id]);
            if (emailExists) {
                return res.status(400).json({ error: 'Employee with this email already exists' });
            }
        }
        await (0, database_sqlite_1.dbRun)(`
      UPDATE employees SET
        first_name = ?, last_name = ?, email = ?, phone = ?, address = ?,
        employment_type = ?, salary_type = ?, base_salary = ?, daily_wage = ?,
        hourly_rate = ?, department = ?, position = ?, status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
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
        const updatedEmployee = await (0, database_sqlite_1.dbGet)(`
      SELECT 
        e.*
      FROM employees e
      WHERE e.id = ?
    `, [id]);
        res.json(updatedEmployee);
    }
    catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ error: 'Failed to update employee' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const employee = await (0, database_sqlite_1.dbGet)('SELECT id FROM employees WHERE id = ? AND business_id = ?', [id, businessId]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        await (0, database_sqlite_1.dbRun)('DELETE FROM employees WHERE id = ? AND business_id = ?', [id, businessId]);
        res.json({ message: 'Employee deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: 'Failed to delete employee' });
    }
});
router.get('/stats/overview', async (req, res) => {
    try {
        const businessId = req.user?.userId;
        const stats = await (0, database_sqlite_1.dbGet)(`
      SELECT 
        COUNT(*) as total_employees,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_employees,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_employees,
        COUNT(CASE WHEN employment_type = 'full_time' THEN 1 END) as full_time_employees,
        COUNT(CASE WHEN employment_type = 'part_time' THEN 1 END) as part_time_employees,
        COUNT(CASE WHEN employment_type = 'contract' THEN 1 END) as contract_employees
      FROM employees 
      WHERE business_id = ?
    `, [businessId]);
        const departments = await (0, database_sqlite_1.dbAll)(`
      SELECT 
        department,
        COUNT(*) as count
      FROM employees 
      WHERE business_id = ? AND department IS NOT NULL
      GROUP BY department
      ORDER BY count DESC
    `, [businessId]);
        res.json({
            ...stats,
            departments
        });
    }
    catch (error) {
        console.error('Error fetching employee stats:', error);
        res.status(500).json({ error: 'Failed to fetch employee statistics' });
    }
});
router.post('/:id/reset-password', async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user?.userId;
        const { password } = req.body;
        const employee = await (0, database_sqlite_1.dbGet)('SELECT id FROM employees WHERE id = ? AND business_id = ?', [id, businessId]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        await (0, database_sqlite_1.dbRun)('UPDATE employees SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedPassword, id]);
        res.json({
            message: 'Password reset successfully'
        });
    }
    catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});
exports.default = router;
