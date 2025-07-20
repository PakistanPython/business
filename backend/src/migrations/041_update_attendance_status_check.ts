import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attendance')
    .dropConstraint('attendance_status_check')
    .execute();

  await db.schema
    .alterTable('attendance')
    .addCheckConstraint(
      'attendance_status_check',
      sql`status IN ('present', 'absent', 'late', 'holiday', 'half_day')`
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attendance')
    .dropConstraint('attendance_status_check')
    .execute();

  await db.schema
    .alterTable('attendance')
    .addCheckConstraint(
      'attendance_status_check',
      sql`status IN ('present', 'absent', 'late', 'holiday')`
    )
    .execute();
}
