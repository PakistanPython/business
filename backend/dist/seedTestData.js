"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedTestData = void 0;
const database_sqlite_1 = require("./config/database_sqlite");
const testInvoices = [
    {
        business_id: 1,
        customer_name: 'Acme Corporation',
        customer_email: 'billing@acme.com',
        customer_phone: '(555) 123-4567',
        customer_address: '123 Business Ave, Suite 100, New York, NY 10001',
        invoice_number: 'INV-202507-0001',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: 2500.00,
        payment_terms: 'Net 30',
        description: 'Website development and design services',
        notes: 'Initial project phase - payment due within 30 days',
        status: 'pending'
    },
    {
        business_id: 1,
        customer_name: 'Small Business Inc',
        customer_email: 'admin@smallbiz.com',
        customer_phone: '(555) 987-6543',
        customer_address: '789 Small St, Boston, MA 02101',
        invoice_number: 'INV-202507-0002',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: 750.00,
        payment_terms: 'Net 15',
        description: 'Logo design services',
        notes: 'Rush job - quick payment expected',
        status: 'pending'
    },
    {
        business_id: 1,
        customer_name: 'Enterprise Solutions Ltd',
        customer_email: 'finance@enterprise.com',
        customer_phone: '(555) 555-0199',
        customer_address: '456 Corporate Blvd, Chicago, IL 60601',
        invoice_number: 'INV-202507-0003',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: 8500.00,
        payment_terms: 'Net 60',
        description: 'Custom software development - Phase 1',
        notes: 'Large project with milestone payments',
        status: 'pending'
    },
    {
        business_id: 1,
        customer_name: 'Late Payer Corp',
        customer_email: 'accounting@latepayer.com',
        customer_phone: '(555) 111-2222',
        customer_address: '999 Delay Dr, Slowtown, ST 12345',
        invoice_number: 'INV-202506-0015',
        invoice_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        due_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: 1200.00,
        payment_terms: 'Net 30',
        description: 'Monthly consulting services',
        notes: 'Follow up required - payment overdue',
        status: 'overdue'
    },
    {
        business_id: 1,
        customer_name: 'TechStart Innovations',
        customer_email: 'billing@techstart.com',
        customer_phone: '(555) 777-8888',
        customer_address: '321 Innovation Way, Silicon Valley, CA 94000',
        invoice_number: 'INV-202507-0004',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: 4200.00,
        payment_terms: 'Net 30',
        description: 'SEO optimization and content marketing',
        notes: 'Monthly retainer - ongoing project',
        status: 'pending'
    }
];
const testPayments = [
    {
        business_id: 1,
        record_type: 'receivable',
        record_id: 2,
        payment_date: new Date().toISOString().split('T')[0],
        amount: 750.00,
        payment_method: 'Check',
        reference_number: 'CHK-001234',
        notes: 'Payment received via mail'
    },
    {
        business_id: 1,
        record_type: 'receivable',
        record_id: 3,
        payment_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: 3000.00,
        payment_method: 'Bank Transfer',
        reference_number: 'TXN-567890',
        notes: 'First milestone payment'
    },
    {
        business_id: 1,
        record_type: 'receivable',
        record_id: 3,
        payment_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: 2500.00,
        payment_method: 'Bank Transfer',
        reference_number: 'TXN-567891',
        notes: 'Second milestone payment'
    }
];
const seedTestData = async () => {
    try {
        console.log('🌱 Seeding test data for accounts receivable...');
        for (const invoice of testInvoices) {
            await (0, database_sqlite_1.dbRun)(`
        INSERT INTO accounts_receivable (
          business_id, customer_name, customer_email, customer_phone, customer_address,
          invoice_number, invoice_date, due_date, amount, balance_amount, status,
          payment_terms, description, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                invoice.business_id, invoice.customer_name, invoice.customer_email,
                invoice.customer_phone, invoice.customer_address, invoice.invoice_number,
                invoice.invoice_date, invoice.due_date, invoice.amount, invoice.amount,
                invoice.status, invoice.payment_terms, invoice.description, invoice.notes
            ]);
        }
        for (const payment of testPayments) {
            await (0, database_sqlite_1.dbRun)(`
        INSERT INTO payment_records (
          business_id, record_type, record_id, payment_date, amount,
          payment_method, reference_number, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                payment.business_id, payment.record_type, payment.record_id,
                payment.payment_date, payment.amount, payment.payment_method,
                payment.reference_number, payment.notes
            ]);
        }
        await (0, database_sqlite_1.dbRun)(`
      UPDATE accounts_receivable 
      SET paid_amount = 750.00, status = 'paid'
      WHERE id = 2
    `);
        await (0, database_sqlite_1.dbRun)(`
      UPDATE accounts_receivable 
      SET paid_amount = 5500.00, status = 'partial'
      WHERE id = 3
    `);
        console.log('✅ Test data seeded successfully!');
        console.log('📊 Created:');
        console.log('   - 5 test invoices');
        console.log('   - 3 test payments');
        console.log('   - 1 paid invoice');
        console.log('   - 1 partially paid invoice');
        console.log('   - 1 overdue invoice');
    }
    catch (error) {
        console.error('❌ Error seeding test data:', error);
    }
};
exports.seedTestData = seedTestData;
