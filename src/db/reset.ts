import { pool } from './index';
import { runMigrations } from './migrate';
import { runSeeds } from './seeds/seed';

export async function resetDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🧹 [Reset] Dropping all tables and types...');
    await client.query(`
      DROP TABLE IF EXISTS cart_items CASCADE;
      DROP TABLE IF EXISTS carts CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS _migrations CASCADE;
      DROP TYPE IF EXISTS cart_status CASCADE;
    `);
    console.log('✅ [Reset] Existing tables and types dropped.');
  } finally {
    client.release();
  }

  // 1. Run migrations to rebuild schema
  await runMigrations();

  // 2. Run seeds to populate test data
  await runSeeds();

  console.log('🚀 [Reset] Database successfully reset and seeded.');
}

// Allow direct execution: tsx src/db/reset.ts
if (require.main === module) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal reset error:', err);
      process.exit(1);
    });
}
