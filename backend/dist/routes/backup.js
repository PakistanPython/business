"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const archiver_1 = __importDefault(require("archiver"));
const unzipper_1 = __importDefault(require("unzipper"));
const pg_1 = require("pg");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const router = express_1.default.Router();
const upload = (0, multer_1.default)({ dest: os_1.default.tmpdir() });
const getClient = () => {
    return new pg_1.Client({
        connectionString: process.env.POSTGRES_URL_NON_POOLING,
    });
};
router.get('/download', auth_1.authenticateToken, async (req, res) => {
    const tempDir = os_1.default.tmpdir();
    const backupPath = path_1.default.join(tempDir, `backup-${new Date().toISOString().split('T')[0]}.json`);
    const zipPath = path_1.default.join(tempDir, `backup-${new Date().toISOString().split('T')[0]}.zip`);
    const client = getClient();
    const businessId = req.user.businessId || req.user.userId;
    try {
        await client.connect();
        const backupData = {};
        const employeesRes = await client.query('SELECT id FROM employees WHERE business_id = $1', [businessId]);
        const employeeIds = employeesRes.rows.map(row => row.id);
        const businessTablesRes = await client.query(`
        SELECT table_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND column_name = 'business_id'
    `);
        for (const row of businessTablesRes.rows) {
            const table = row.table_name;
            if (table === 'users')
                continue;
            const dataRes = await client.query(`SELECT * FROM ${table} WHERE business_id = $1`, [businessId]);
            if (dataRes.rows.length > 0) {
                backupData[table] = dataRes.rows;
            }
        }
        if (employeeIds.length > 0) {
            const employeeTablesRes = await client.query(`
            SELECT table_name FROM information_schema.columns 
            WHERE table_schema = 'public' AND column_name = 'employee_id'
        `);
            for (const row of employeeTablesRes.rows) {
                const table = row.table_name;
                if (backupData[table])
                    continue;
                const dataRes = await client.query(`SELECT * FROM ${table} WHERE employee_id = ANY($1::int[])`, [employeeIds]);
                if (dataRes.rows.length > 0) {
                    backupData[table] = dataRes.rows;
                }
            }
        }
        fs_1.default.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        const output = fs_1.default.createWriteStream(zipPath);
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        output.on('close', () => {
            res.download(zipPath, (err) => {
                if (err)
                    console.error('Download failed:', err);
                fs_1.default.unlinkSync(backupPath);
                fs_1.default.unlinkSync(zipPath);
            });
        });
        archive.on('error', (err) => {
            throw err;
        });
        archive.pipe(output);
        archive.file(backupPath, { name: 'database.json' });
        archive.finalize();
    }
    catch (error) {
        console.error('Backup failed:', error);
        res.status(500).json({ success: false, message: 'Backup failed' });
    }
    finally {
        await client.end();
    }
});
router.post('/upload', auth_1.authenticateToken, upload.single('backup'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const zipPath = req.file.path;
    const extractedPath = path_1.default.join(os_1.default.tmpdir(), 'database.json');
    const client = getClient();
    const businessId = req.user.businessId || req.user.userId;
    const restoreDatabase = async () => {
        try {
            await client.connect();
            await client.query('BEGIN');
            const backupData = JSON.parse(fs_1.default.readFileSync(extractedPath, 'utf8'));
            const tableOrder = [
                'charity', 'categories', 'accounts', 'employees', 'loans', 'purchases', 'sales', 'expenses', 'income',
                'accounts_receivable', 'accounts_payable', 'payroll', 'charity_payments', 'loan_payments', 'user_preferences',
                'work_schedules', 'attendance_rules', 'attendance', 'leaves'
            ];
            const idMap = {};
            const employeesRes = await client.query('SELECT id FROM employees WHERE business_id = $1', [businessId]);
            const employeeIds = employeesRes.rows.map(row => row.id);
            for (const table of tableOrder) {
                if (!backupData[table])
                    continue;
                idMap[table] = {};
                const columnsRes = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
        `, [table]);
                const tableColumns = columnsRes.rows.map(row => row.column_name);
                if (tableColumns.includes('business_id')) {
                    await client.query(`DELETE FROM ${table} WHERE business_id = $1`, [businessId]);
                }
                else if (tableColumns.includes('employee_id') && employeeIds.length > 0) {
                    await client.query(`DELETE FROM ${table} WHERE employee_id = ANY($1::int[])`, [employeeIds]);
                }
                for (const row of backupData[table]) {
                    const { id, ...rowData } = row;
                    if (tableColumns.includes('business_id')) {
                        rowData.business_id = businessId;
                    }
                    if (table === 'employees') {
                        if (rowData.employee_code) {
                            rowData.employee_code = `${rowData.employee_code}_${Date.now()}`;
                        }
                        if (rowData.email) {
                            const [user, domain] = rowData.email.split('@');
                            rowData.email = `${user}_${Date.now()}@${domain}`;
                        }
                    }
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
                    const insertRes = await client.query(`INSERT INTO ${table} (${columns}) VALUES (${valuePlaceholders}) RETURNING id`, values);
                    idMap[table][id] = insertRes.rows[0].id;
                }
            }
            await client.query('COMMIT');
            res.json({ success: true, message: 'Database restored successfully' });
        }
        catch (err) {
            await client.query('ROLLBACK');
            console.error('Restore failed:', err);
            res.status(500).json({ success: false, message: 'Restore failed' });
        }
        finally {
            await client.end();
            if (fs_1.default.existsSync(zipPath))
                fs_1.default.unlinkSync(zipPath);
            if (fs_1.default.existsSync(extractedPath))
                fs_1.default.unlinkSync(extractedPath);
        }
    };
    fs_1.default.createReadStream(zipPath)
        .pipe(unzipper_1.default.Parse())
        .on('entry', function (entry) {
        if (entry.path === "database.json") {
            entry.pipe(fs_1.default.createWriteStream(extractedPath))
                .on('finish', restoreDatabase)
                .on('error', (err) => {
                console.error('Error writing extracted file:', err);
                res.status(500).json({ success: false, message: 'Failed to write backup file' });
            });
        }
        else {
            entry.autodrain();
        }
    })
        .on('error', (err) => {
        console.error('Unzip failed:', err);
        res.status(500).json({ success: false, message: 'Failed to extract backup file' });
    });
});
exports.default = router;
