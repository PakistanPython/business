import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('work_schedules')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('employee_id', 'integer', (col) => col.references('employees.id').onDelete('cascade').notNull())
    .addColumn('day_of_week', 'integer', (col) => col.notNull()) // 0 for Sunday, 1 for Monday, etc.
    .addColumn('start_time', 'time', (col) => col.notNull())
    .addColumn('end_time', 'time', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('work_schedules').execute();
}
