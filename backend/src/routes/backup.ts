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

    const tablesRes = await client.query(`
      SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'
    `);
    const tables = tablesRes.rows.map(row => row.tablename);

    for (const table of tables) {
      if (table === 'users') continue; // Never include users table in backup

      const columnsRes = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);
      const columns = columnsRes.rows.map(row => row.column_name);

      if (columns.includes('business_id')) {
        const dataRes = await client.query(`SELECT * FROM ${table} WHERE business_id = $1`, [businessId]);
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
      const tableOrder = ['charity', 'categories', 'accounts', 'employees', 'loans', 'purchases', 'sales', 'expenses', 'income', 'charity_payments', 'loan_payments', 'user_preferences', 'work_schedules', 'attendance_rules', 'attendance', 'leaves'];

      const idMap: { [key: string]: { [key: number]: number } } = {};

      for (const table of tableOrder) {
        if (!backupData[table]) continue;
        idMap[table] = {};

        // Clear old data, but never touch the users table
        if (table !== 'users') {
            await client.query(`DELETE FROM ${table} WHERE business_id = $1`, [businessId]);
        }

        for (const row of backupData[table]) {
          const { id, ...rowData } = row;
          rowData.business_id = businessId;

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
