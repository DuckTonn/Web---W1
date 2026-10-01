import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// 1. Extend Zod with OpenAPI methods (.openapi())
extendZodWithOpenApi(z);

// 2. Export shared OpenAPIRegistry
export const registry = new OpenAPIRegistry();

// Standard PostgreSQL UUID format (32 hex digits separated by hyphens)
export const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// ==========================================
// ERROR RESPONSE SCHEMAS
// ==========================================

export const ErrorDetailSchema = registry.register(
  'ErrorDetail',
  z.object({
    field: z.string().openapi({ description: 'Target parameter or body field that failed validation', example: 'quantity' }),
    issue: z.string().openapi({ description: 'Human-readable explanation of validation failure', example: 'Number must be greater than or equal to 1' }),
  })
);

export const ErrorResponseSchema = registry.register(
  'ErrorResponse',
  z.object({
    code: z.string().openapi({ description: 'Standard machine-readable error code', example: 'VALIDATION_ERROR' }),
    message: z.string().openapi({ description: 'Human-readable error description', example: 'Validation failed' }),
    request_id: z.string().openapi({ description: 'Traceability request UUID', example: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10' }),
    details: z.array(ErrorDetailSchema).optional().openapi({
      description: 'Optional array of granular field issues',
      example: [{ field: 'quantity', issue: 'Number must be greater than or equal to 1' }],
    }),
  })
);

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ==========================================
// REQUEST SCHEMAS (Query, Params, Body)
// ==========================================

// Query params for GET /products
export const ProductsQuerySchema = registry.register(
  'ProductsQuery',
  z.object({
    limit: z.coerce
      .number()
      .int('limit must be an integer')
      .min(1, 'limit must be at least 1')
      .max(50, 'limit must not exceed 50')
      .default(20)
      .openapi({
        description: 'Maximum number of items to return (1-50)',
        example: 20,
        default: 20,
      }),
    offset: z.coerce
      .number()
      .int('offset must be an integer')
      .min(0, 'offset must be greater than or equal to 0')
      .default(0)
      .openapi({
        description: 'Number of items to skip for pagination',
        example: 0,
        default: 0,
      }),
  })
);

export type ProductsQuery = z.infer<typeof ProductsQuerySchema>;

// URL params: cartId
export const CartIdParamSchema = registry.register(
  'CartIdParam',
  z.object({
    cartId: z.string().regex(UUID_REGEX, 'Invalid cart ID format, must be UUID v4').openapi({
      description: 'UUID v4 identifier of the cart',
      format: 'uuid',
      example: '99999999-9999-9999-9999-999999999999',
    }),
  })
);

export type CartIdParam = z.infer<typeof CartIdParamSchema>;

// URL params: productId
export const ProductIdParamSchema = registry.register(
  'ProductIdParam',
  z.object({
    productId: z.string().regex(UUID_REGEX, 'Invalid product ID format, must be UUID').openapi({
      description: 'UUID identifier of the product',
      format: 'uuid',
      example: '11111111-1111-1111-1111-111111111111',
    }),
  })
);

export type ProductIdParam = z.infer<typeof ProductIdParamSchema>;

// URL params: cartId and productId
export const CartItemParamsSchema = registry.register(
  'CartItemParams',
  z.object({
    cartId: z.string().regex(UUID_REGEX, 'Invalid cart ID format, must be UUID v4').openapi({
      description: 'UUID v4 identifier of the cart',
      format: 'uuid',
      example: '99999999-9999-9999-9999-999999999999',
    }),
    productId: z.string().regex(UUID_REGEX, 'Invalid product ID format, must be UUID').openapi({
      description: 'UUID identifier of the product',
      format: 'uuid',
      example: '11111111-1111-1111-1111-111111111111',
    }),
  })
);

export type CartItemParams = z.infer<typeof CartItemParamsSchema>;

// Body for POST /carts/{cartId}/items
// STRICT mode: disallows additional unrecognized properties
export const AddItemBodySchema = registry.register(
  'AddItemBody',
  z
    .object({
      product_id: z.string().regex(UUID_REGEX, 'product_id must be a valid UUID').openapi({
        description: 'UUID of the product to add',
        format: 'uuid',
        example: '11111111-1111-1111-1111-111111111111',
      }),
      quantity: z
        .number()
        .int('quantity must be an integer')
        .min(1, 'Number must be greater than or equal to 1')
        .max(10, 'Number must be less than or equal to 10')
        .openapi({
          description: 'Quantity to add to the cart (1 to 10)',
          example: 2,
        }),
    })
    .strict()
);

export type AddItemBody = z.infer<typeof AddItemBodySchema>;

// Body for PATCH /carts/{cartId}/items/{productId}
// STRICT mode: disallows additional unrecognized properties
export const UpdateItemBodySchema = registry.register(
  'UpdateItemBody',
  z
    .object({
      quantity: z
        .number()
        .int('quantity must be an integer')
        .min(1, 'Number must be greater than or equal to 1')
        .max(10, 'Number must be less than or equal to 10')
        .openapi({
          description: 'New quantity for the item (1 to 10)',
          example: 3,
        }),
    })
    .strict()
);

export type UpdateItemBody = z.infer<typeof UpdateItemBodySchema>;

// ==========================================
// RESPONSE SCHEMAS
// ==========================================

export const ProductSchema = registry.register(
  'Product',
  z.object({
    id: z.string().regex(UUID_REGEX).openapi({ format: 'uuid', example: '11111111-1111-1111-1111-111111111111' }),
    name: z.string().openapi({ example: 'Product A (Mechanical Keyboard)' }),
    price_cents: z.number().int().min(0).openapi({ example: 10000, description: 'Price in integer cents' }),
    stock: z.number().int().min(0).openapi({ example: 20, description: 'Available inventory units' }),
    is_active: z.boolean().openapi({ example: true, description: 'Sales status flag' }),
    created_at: z.string().openapi({ example: '2026-10-01T03:00:00.000Z' }),
    updated_at: z.string().openapi({ example: '2026-10-01T03:00:00.000Z' }),
  })
);

export const ProductListResponseSchema = registry.register(
  'ProductListResponse',
  z.array(ProductSchema)
);

export const CartItemSchema = registry.register(
  'CartItem',
  z.object({
    product_id: z.string().regex(UUID_REGEX).openapi({ format: 'uuid', example: '11111111-1111-1111-1111-111111111111' }),
    name: z.string().openapi({ example: 'Product A (Mechanical Keyboard)' }),
    unit_price_cents: z.number().int().min(0).openapi({ example: 10000, description: 'Snapshot unit price at query time' }),
    quantity: z.number().int().min(1).max(10).openapi({ example: 2 }),
    item_total_cents: z.number().int().min(0).openapi({ example: 20000, description: 'unit_price_cents * quantity' }),
  })
);

export const CartResponseSchema = registry.register(
  'CartResponse',
  z.object({
    id: z.string().regex(UUID_REGEX).openapi({ format: 'uuid', example: 'e394017d-2b47-4f40-8b1b-9f4a56c0b987' }),
    status: z.enum(['open', 'checked_out']).openapi({ example: 'open' }),
    items: z.array(CartItemSchema).openapi({ description: 'List of items in the cart', example: [] }),
    subtotal_cents: z.number().int().min(0).openapi({ example: 20000, description: 'Sum of all item total cents computed strictly on server' }),
    created_at: z.string().openapi({ example: '2026-10-01T03:00:00.000Z' }),
    updated_at: z.string().openapi({ example: '2026-10-01T03:00:00.000Z' }),
  })
);

export type Product = z.infer<typeof ProductSchema>;
export type CartItem = z.infer<typeof CartItemSchema>;
export type CartResponse = z.infer<typeof CartResponseSchema>;
