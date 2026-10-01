import { Pool } from 'pg';
import { Kysely, PostgresDialect, Generated } from 'kysely';
import { env } from '../config/env';

// Database Schema Interfaces for Kysely
export type CartStatus = 'open' | 'checked_out';

export interface ProductsTable {
  id: Generated<string>;
  name: string;
  price_cents: number;
  stock: number;
  is_active: boolean;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface CartsTable {
  id: Generated<string>;
  status: CartStatus;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface CartItemsTable {
  id: Generated<string>;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface Database {
  products: ProductsTable;
  carts: CartsTable;
  cart_items: CartItemsTable;
}

// PostgreSQL Connection Pool
export const pool = new Pool({
  host: env.DB.HOST,
  port: env.DB.PORT,
  user: env.DB.USER,
  password: env.DB.PASSWORD,
  database: env.DB.NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Kysely Type-Safe Query Builder
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
});

// Helper to verify connection health
export async function testDbConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    return false;
  }
}
