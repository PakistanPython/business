import express from 'express';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';
import fs from 'fs';
import archiver from 'archiver';
import unzipper from 'unzipper';
import { Client } from 'pg';
import path from 'path';
import os from 'os';

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

const getClient = () => {
  return new Client({
    connectionString: process.env.POSTGRES_URL_NON_POOLING,
  });
};

// Download database backup
router.get('/download', authenticateToken, async (req, res) => {
  const tempDir = os.tmpdir();
  const backupPath = path.join(tempDir, `backup-${new Date().toISOString().split('T')[0]}.json`);
  const zipPath = path.join(tempDir, `backup-${new Date().toISOString().split('T')[0]}.zip`);
  const client = getClient();
  const businessId = req.user!.businessId || req.user!.userId;

  try {
    await client.connect();
    const backupData: { [key: string]: any[] } = {};

    // Get all employees for the business to handle indirect relations
    const employeesRes = await client.query('SELECT id FROM employees WHERE business_id = $1', [businessId]);
    const employeeIds = employeesRes.rows.map(row => row.id);

    // Get all tables with a direct business_id
    const businessTablesRes = await client.query(`
        SELECT table_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND column_name = 'business_id'
    `);
    for (const row of businessTablesRes.rows) {
        const table = row.table_name;
        if (table === 'users') continue;
        const dataRes = await client.query(`SELECT * FROM ${table} WHERE business_id = $1`, [businessId]);
        if (dataRes.rows.length > 0) {
            backupData[table] = dataRes.rows;
        }
    }

    // Get all tables with an indirect employee_id link
    if (employeeIds.length > 0) {
        const employeeTablesRes = await client.query(`
            SELECT table_name FROM information_schema.columns 
            WHERE table_schema = 'public' AND column_name = 'employee_id'
        `);
        for (const row of employeeTablesRes.rows) {
            const table = row.table_name;
            // Skip tables that are already backed up via business_id
            if (backupData[table]) continue;
            const dataRes = await client.query(`SELECT * FROM ${table} WHERE employee_id = ANY($1::int[])`, [employeeIds]);
            if (dataRes.rows.length > 0) {
                backupData[table] = dataRes.rows;
            }
        }
    }

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.download(zipPath, (err) => {
        if (err) console.error('Download failed:', err);
        fs.unlinkSync(backupPath);
        fs.unlinkSync(zipPath);
      });
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);
    archive.file(backupPath, { name: 'database.json' });
    archive.finalize();

  } catch (error) {
    console.error('Backup failed:', error);
    res.status(500).json({ success: false, message: 'Backup failed' });
  } finally {
    await client.end();
  }
});

// Upload database backup
router.post('/upload', authenticateToken, upload.single('backup'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const zipPath = req.file.path;
  const extractedPath = path.join(os.tmpdir(), 'database.json');
  const client = getClient();
  const businessId = req.user!.businessId || req.user!.userId;

  const restoreDatabase = async () => {
    try {
      await client.connect();
      await client.query('BEGIN');

      const backupData = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));
      const tableOrder = [
        // Core data
        'charity', 'categories', 'accounts', 'employees', 'loans', 'purchases', 'sales', 'expenses', 'income',
        // Dependent data
        'accounts_receivable', 'accounts_payable', 'payroll', 'charity_payments', 'loan_payments', 'user_preferences',
        // Attendance & Scheduling
        'work_schedules', 'attendance_rules', 'attendance', 'leaves'
      ];

      const idMap: { [key: string]: { [key: number]: number } } = {};

      // First, get all employees for the business to handle indirect relations
      const employeesRes = await client.query('SELECT id FROM employees WHERE business_id = $1', [businessId]);
      const employeeIds = employeesRes.rows.map(row => row.id);

      for (const table of tableOrder) {
        if (!backupData[table]) continue;
        idMap[table] = {};

        // Clear old data
        const columnsRes = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
        `, [table]);
        const tableColumns = columnsRes.rows.map(row => row.column_name);

        if (tableColumns.includes('business_id')) {
          await client.query(`DELETE FROM ${table} WHERE business_id = $1`, [businessId]);
        } else if (tableColumns.includes('employee_id') && employeeIds.length > 0) {
          await client.query(`DELETE FROM ${table} WHERE employee_id = ANY($1::int[])`, [employeeIds]);
        }

        for (const row of backupData[table]) {
          const { id, ...rowData } = row;
          
          // Only set business_id if the column exists
          if (tableColumns.includes('business_id')) {
            rowData.business_id = businessId;
          }

          // Regenerate unique employee fields to avoid conflicts
          if (table === 'employees') {
            if (rowData.employee_code) {
              rowData.employee_code = `${rowData.employee_code}_${Date.now()}`;
            }
            if (rowData.email) {
              const [user, domain] = rowData.email.split('@');
              rowData.email = `${user}_${Date.now()}@${domain}`;
            }
          }

          // Remap foreign keys
          for (const key in rowData) {
            if (key.endsWith('_id') && key !== 'business_id') {
              const parentTable = key.replace(/_id$/, '');
              if (idMap[parentTable] && idMap[parentTable][rowData[key]]) {
                rowData[key] = idMap[parentTable][rowData[key]];
              }
            }
          }

          const columns = Object.keys(rowData).map(col => `"${col}"`).join(', ');
          const values = Object.values(rowData);
          const valuePlaceholders = values.map((_, i) => `$${i + 1}`).join(', ');

          const insertRes = await client.query(
            `INSERT INTO ${table} (${columns}) VALUES (${valuePlaceholders}) RETURNING id`,
            values
          );
          idMap[table][id] = insertRes.rows[0].id;
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, message: 'Database restored successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Restore failed:', err);
      res.status(500).json({ success: false, message: 'Restore failed' });
    } finally {
      await client.end();
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      if (fs.existsSync(extractedPath)) fs.unlinkSync(extractedPath);
    }
  };

  fs.createReadStream(zipPath)
    .pipe(unzipper.Parse())
    .on('entry', function (entry) {
      if (entry.path === "database.json") {
        entry.pipe(fs.createWriteStream(extractedPath))
          .on('finish', restoreDatabase)
          .on('error', (err) => {
            console.error('Error writing extracted file:', err);
            res.status(500).json({ success: false, message: 'Failed to write backup file' });
          });
      } else {
        entry.autodrain();
      }
    })
    .on('error', (err) => {
      console.error('Unzip failed:', err);
      res.status(500).json({ success: false, message: 'Failed to extract backup file' });
    });
});

export default router;
