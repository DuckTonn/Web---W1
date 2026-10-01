import { pool } from '../db';

export interface ProductDto {
  id: string;
  name: string;
  price_cents: number;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class ProductService {
  public static async listActiveProducts(limit: number = 20, offset: number = 0): Promise<ProductDto[]> {
    const { rows } = await pool.query<{
      id: string;
      name: string;
      price_cents: number | string;
      stock: number | string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, price_cents, stock, is_active, created_at, updated_at
       FROM products
       WHERE is_active = TRUE
       ORDER BY created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      price_cents: Number(r.price_cents),
      stock: Number(r.stock),
      is_active: Boolean(r.is_active),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }
}
