import { pool } from '../index';

export const SEED_DATA = {
  products: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Product A (Mechanical Keyboard)',
      price_cents: 10000,
      stock: 20,
      is_active: true,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Product B (Gaming Mouse)',
      price_cents: 25000,
      stock: 5,
      is_active: true,
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Product C (USB-C Hub)',
      price_cents: 50000,
      stock: 15,
      is_active: true,
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Product D (Headphones - Out of Stock)',
      price_cents: 12000,
      stock: 0, // stock = 0 to test 409 INSUFFICIENT_STOCK
      is_active: true,
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      name: 'Product E (Smart Watch - Discontinued)',
      price_cents: 30000,
      stock: 10,
      is_active: false, // is_active = false to test 422 PRODUCT_UNAVAILABLE
    },
  ],
  closedCart: {
    id: '99999999-9999-9999-9999-999999999999',
    status: 'checked_out' as const, // To test 409 CART_CLOSED
  },
};

export async function runSeeds(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🌱 [Seed] Starting database seeding...');
    await client.query('BEGIN');

    // 1. Seed products
    for (const p of SEED_DATA.products) {
      await client.query(
        `
        INSERT INTO products (id, name, price_cents, stock, is_active)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          price_cents = EXCLUDED.price_cents,
          stock = EXCLUDED.stock,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      `,
        [p.id, p.name, p.price_cents, p.stock, p.is_active]
      );
      console.log(`  ✓ Product seeded: ${p.name} (id: ${p.id}, stock: ${p.stock}, active: ${p.is_active})`);
    }

    // 2. Seed checked_out cart
    await client.query(
      `
      INSERT INTO carts (id, status)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW();
    `,
      [SEED_DATA.closedCart.id, SEED_DATA.closedCart.status]
    );
    console.log(`  ✓ Closed cart seeded (id: ${SEED_DATA.closedCart.id}, status: ${SEED_DATA.closedCart.status})`);

    await client.query('COMMIT');
    console.log('✨ [Seed] Database seeding completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [Seed] Error during seeding:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Allow direct execution: tsx src/db/seeds/seed.ts
if (require.main === module) {
  runSeeds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal seed error:', err);
      process.exit(1);
    });
}
