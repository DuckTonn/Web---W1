import fs from 'fs';
import path from 'path';
import { pool } from './index';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🔄 [Migration] Starting database migration...');

    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Read migration files from src/db/migrations
    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.warn(`⚠️ [Migration] Directory not found: ${migrationsDir}`);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    // 3. Get already applied migrations
    const { rows: appliedRows } = await client.query<{ name: string }>(
      'SELECT name FROM _migrations'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    // 4. Run pending migrations in transaction
    for (const file of files) {
      if (!appliedSet.has(file)) {
        console.log(`⏳ [Migration] Applying: ${file}...`);
        const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

        await client.query('BEGIN');
        try {
          await client.query(sqlContent);
          await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`✅ [Migration] Successfully applied: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`❌ [Migration] Failed to apply ${file}:`, err);
          throw err;
        }
      } else {
        console.log(`⏩ [Migration] Already applied: ${file}`);
      }
    }

    console.log('✨ [Migration] All migrations completed successfully.');
  } finally {
    client.release();
  }
}

// Allow direct execution: tsx src/db/migrate.ts
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal migration error:', err);
      process.exit(1);
    });
}
