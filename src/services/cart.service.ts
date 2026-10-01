import { pool } from '../db';
import { AppError } from '../utils/app-error';

export interface CartItemDto {
  product_id: string;
  name: string;
  unit_price_cents: number;
  quantity: number;
  item_total_cents: number;
}

export interface CartDto {
  id: string;
  status: 'open' | 'checked_out';
  items: CartItemDto[];
  subtotal_cents: number;
  created_at: string;
  updated_at: string;
}

export class CartService {
  /**
   * POST /carts: Create a new open cart
   */
  public static async createCart(): Promise<CartDto> {
    const { rows } = await pool.query<{
      id: string;
      status: 'open' | 'checked_out';
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO carts (status)
       VALUES ('open')
       RETURNING id, status, created_at, updated_at`
    );

    const cart = rows[0];
    return {
      id: cart.id,
      status: cart.status,
      items: [],
      subtotal_cents: 0,
      created_at: cart.created_at,
      updated_at: cart.updated_at,
    };
  }

  /**
   * GET /carts/{cartId}: Retrieve cart with items and server-calculated subtotal_cents
   */
  public static async getCartById(cartId: string): Promise<CartDto> {
    // 1. Check cart existence
    const { rows: cartRows } = await pool.query<{
      id: string;
      status: 'open' | 'checked_out';
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, status, created_at, updated_at
       FROM carts
       WHERE id = $1`,
      [cartId]
    );

    if (cartRows.length === 0) {
      throw new AppError(404, 'CART_NOT_FOUND', `Cart with ID ${cartId} not found`);
    }

    const cart = cartRows[0];

    // 2. Fetch items joined with product snapshot price
    const { rows: itemRows } = await pool.query<{
      product_id: string;
      name: string;
      unit_price_cents: number | string;
      quantity: number | string;
    }>(
      `SELECT ci.product_id, p.name, p.price_cents AS unit_price_cents, ci.quantity
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at ASC`,
      [cartId]
    );

    let subtotalCents = 0;
    const items: CartItemDto[] = itemRows.map((item) => {
      const unitPrice = Number(item.unit_price_cents) || 0;
      const qty = Number(item.quantity) || 0;
      const itemTotal = unitPrice * qty;
      subtotalCents += itemTotal;
      return {
        product_id: item.product_id,
        name: item.name,
        unit_price_cents: unitPrice,
        quantity: qty,
        item_total_cents: itemTotal,
      };
    });

    return {
      id: cart.id,
      status: cart.status,
      items,
      subtotal_cents: subtotalCents,
      created_at: cart.created_at,
      updated_at: cart.updated_at,
    };
  }

  /**
   * POST /carts/{cartId}/items: Add product item to cart
   * Checked in strict order (Slide 17):
   * a. Cart exists (404)
   * b. Cart status open (409 CART_CLOSED)
   * c. Product exists & is_active (422 PRODUCT_UNAVAILABLE)
   * d. Product already in cart (409 ITEM_ALREADY_IN_CART)
   * e. Stock availability (409 INSUFFICIENT_STOCK)
   */
  public static async addItem(cartId: string, productId: string, quantity: number): Promise<CartDto> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // a. Check cart existence
      const { rows: cartRows } = await client.query<{ id: string; status: 'open' | 'checked_out' }>(
        `SELECT id, status FROM carts WHERE id = $1 FOR UPDATE`,
        [cartId]
      );

      if (cartRows.length === 0) {
        throw new AppError(404, 'CART_NOT_FOUND', `Cart with ID ${cartId} not found`);
      }

      // b. Check cart status
      const cart = cartRows[0];
      if (cart.status === 'checked_out') {
        throw new AppError(409, 'CART_CLOSED', 'Cannot modify a closed cart');
      }

      // c. Check product existence and active state
      const { rows: productRows } = await client.query<{
        id: string;
        is_active: boolean;
        stock: number | string;
      }>(
        `SELECT id, is_active, stock FROM products WHERE id = $1`,
        [productId]
      );

      if (productRows.length === 0 || !productRows[0].is_active) {
        throw new AppError(422, 'PRODUCT_UNAVAILABLE', 'Product is inactive or does not exist');
      }

      const product = productRows[0];
      const currentStock = Number(product.stock);

      // d. Check if product already exists in cart
      const { rows: existingItemRows } = await client.query(
        `SELECT id FROM cart_items WHERE cart_id = $1 AND product_id = $2`,
        [cartId, productId]
      );

      if (existingItemRows.length > 0) {
        throw new AppError(409, 'ITEM_ALREADY_IN_CART', 'Product is already in the cart');
      }

      // e. Check inventory stock
      if (quantity > currentStock) {
        throw new AppError(
          409,
          'INSUFFICIENT_STOCK',
          `Requested quantity (${quantity}) exceeds available stock (${currentStock})`
        );
      }

      // Insert item into cart_items
      await client.query(
        `INSERT INTO cart_items (cart_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [cartId, productId, quantity]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getCartById(cartId);
  }

  /**
   * PATCH /carts/{cartId}/items/{productId}: Update item quantity in cart
   * Checked in order:
   * a. Cart exists (404) & open (409 CART_CLOSED)
   * b. Item exists in cart (404 ITEM_NOT_FOUND)
   * c. Product is active (422 PRODUCT_UNAVAILABLE)
   * d. Stock availability (409 INSUFFICIENT_STOCK)
   */
  public static async updateItem(cartId: string, productId: string, quantity: number): Promise<CartDto> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // a. Check cart existence & status
      const { rows: cartRows } = await client.query<{ id: string; status: 'open' | 'checked_out' }>(
        `SELECT id, status FROM carts WHERE id = $1 FOR UPDATE`,
        [cartId]
      );

      if (cartRows.length === 0) {
        throw new AppError(404, 'CART_NOT_FOUND', `Cart with ID ${cartId} not found`);
      }

      const cart = cartRows[0];
      if (cart.status === 'checked_out') {
        throw new AppError(409, 'CART_CLOSED', 'Cannot modify a closed cart');
      }

      // b. Check item existence in cart
      const { rows: itemRows } = await client.query<{ id: string; quantity: number | string }>(
        `SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2`,
        [cartId, productId]
      );

      if (itemRows.length === 0) {
        throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found in cart');
      }

      // c. Check product active state & stock
      const { rows: productRows } = await client.query<{
        id: string;
        is_active: boolean;
        stock: number | string;
      }>(
        `SELECT id, is_active, stock FROM products WHERE id = $1`,
        [productId]
      );

      if (productRows.length === 0 || !productRows[0].is_active) {
        throw new AppError(422, 'PRODUCT_UNAVAILABLE', 'Product is no longer available');
      }

      const product = productRows[0];
      const currentStock = Number(product.stock);

      // d. Check inventory stock
      if (quantity > currentStock) {
        throw new AppError(
          409,
          'INSUFFICIENT_STOCK',
          `Requested quantity (${quantity}) exceeds available stock (${currentStock})`
        );
      }

      // Update quantity
      await client.query(
        `UPDATE cart_items
         SET quantity = $1, updated_at = NOW()
         WHERE cart_id = $2 AND product_id = $3`,
        [quantity, cartId, productId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getCartById(cartId);
  }

  /**
   * DELETE /carts/{cartId}/items/{productId}: Remove item from cart
   * Checked in order:
   * a. Cart exists (404) & open (409 CART_CLOSED)
   * b. Item exists in cart (404 ITEM_NOT_FOUND)
   */
  public static async deleteItem(cartId: string, productId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // a. Check cart existence & status
      const { rows: cartRows } = await client.query<{ id: string; status: 'open' | 'checked_out' }>(
        `SELECT id, status FROM carts WHERE id = $1 FOR UPDATE`,
        [cartId]
      );

      if (cartRows.length === 0) {
        throw new AppError(404, 'CART_NOT_FOUND', `Cart with ID ${cartId} not found`);
      }

      const cart = cartRows[0];
      if (cart.status === 'checked_out') {
        throw new AppError(409, 'CART_CLOSED', 'Cannot modify a closed cart');
      }

      // b. Check item existence in cart
      const { rows: itemRows } = await client.query<{ id: string }>(
        `SELECT id FROM cart_items WHERE cart_id = $1 AND product_id = $2`,
        [cartId, productId]
      );

      if (itemRows.length === 0) {
        throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found in cart');
      }

      // Delete item
      await client.query(
        `DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2`,
        [cartId, productId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
