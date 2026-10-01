import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import {
  registry,
  ProductsQuerySchema,
  CartIdParamSchema,
  CartItemParamsSchema,
  AddItemBodySchema,
  UpdateItemBodySchema,
  ProductListResponseSchema,
  CartResponseSchema,
  ErrorResponseSchema,
} from '../schemas';

// Common reusable response definitions
const commonErrorResponses = {
  400: {
    description: 'Validation Error (Invalid query/param/body, extra fields, or type mismatch)',
    content: {
      'application/json': {
        schema: ErrorResponseSchema,
        example: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
          details: [
            { field: 'quantity', issue: 'Number must be greater than or equal to 1' },
          ],
        },
      },
    },
  },
  500: {
    description: 'Internal Server Error (Database down, unexpected exception)',
    content: {
      'application/json': {
        schema: ErrorResponseSchema,
        example: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
        },
      },
    },
  },
};

// ==========================================
// 1. GET /products
// ==========================================
registry.registerPath({
  method: 'get',
  path: '/products',
  tags: ['Products'],
  summary: 'List active products for sale',
  description: 'Returns a paginated list of active products (is_active = true). Inactive products are filtered out.',
  request: {
    query: ProductsQuerySchema,
  },
  responses: {
    200: {
      description: 'Successfully retrieved active products',
      content: {
        'application/json': {
          schema: ProductListResponseSchema,
          example: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              name: 'Product A (Mechanical Keyboard)',
              price_cents: 10000,
              stock: 20,
              is_active: true,
              created_at: '2026-10-01T03:00:00.000Z',
              updated_at: '2026-10-01T03:00:00.000Z',
            },
            {
              id: '22222222-2222-2222-2222-222222222222',
              name: 'Product B (Gaming Mouse)',
              price_cents: 25000,
              stock: 5,
              is_active: true,
              created_at: '2026-10-01T03:00:00.000Z',
              updated_at: '2026-10-01T03:00:00.000Z',
            },
          ],
        },
      },
    },
    ...commonErrorResponses,
  },
});

// ==========================================
// 2. POST /carts
// ==========================================
registry.registerPath({
  method: 'post',
  path: '/carts',
  tags: ['Carts'],
  summary: 'Create a new empty cart',
  description: 'Initializes a new open cart and returns its Location header and representation.',
  responses: {
    201: {
      description: 'Cart successfully created',
      headers: {
        Location: {
          description: 'Relative URL to the newly created cart',
          schema: { type: 'string', example: '/carts/e394017d-2b47-4f40-8b1b-9f4a56c0b987' },
        },
      },
      content: {
        'application/json': {
          schema: CartResponseSchema,
          example: {
            id: 'e394017d-2b47-4f40-8b1b-9f4a56c0b987',
            status: 'open',
            items: [],
            subtotal_cents: 0,
            created_at: '2026-10-01T03:00:00.000Z',
            updated_at: '2026-10-01T03:00:00.000Z',
          },
        },
      },
    },
    500: commonErrorResponses[500],
  },
});

// ==========================================
// 3. GET /carts/{cartId}
// ==========================================
registry.registerPath({
  method: 'get',
  path: '/carts/{cartId}',
  tags: ['Carts'],
  summary: 'Get cart details with items and subtotal',
  description: 'Fetches cart status, list of items with unit prices snapshot, and server-computed subtotal_cents.',
  request: {
    params: CartIdParamSchema,
  },
  responses: {
    200: {
      description: 'Successfully retrieved cart details',
      content: {
        'application/json': {
          schema: CartResponseSchema,
          example: {
            id: 'e394017d-2b47-4f40-8b1b-9f4a56c0b987',
            status: 'open',
            items: [
              {
                product_id: '11111111-1111-1111-1111-111111111111',
                name: 'Product A (Mechanical Keyboard)',
                unit_price_cents: 10000,
                quantity: 2,
                item_total_cents: 20000,
              },
            ],
            subtotal_cents: 20000,
            created_at: '2026-10-01T03:00:00.000Z',
            updated_at: '2026-10-01T03:00:00.000Z',
          },
        },
      },
    },
    400: commonErrorResponses[400],
    404: {
      description: 'Cart not found in database',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          example: {
            code: 'CART_NOT_FOUND',
            message: 'Cart with ID 00000000-0000-0000-0000-000000000000 not found',
            request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
          },
        },
      },
    },
    500: commonErrorResponses[500],
  },
});

// ==========================================
// 4. POST /carts/{cartId}/items
// ==========================================
registry.registerPath({
  method: 'post',
  path: '/carts/{cartId}/items',
  tags: ['Cart Items'],
  summary: 'Add a product to cart',
  description: 'Adds product_id and quantity (1..10) to cart. Validates cart state, active product, inventory stock, and duplicates.',
  request: {
    params: CartIdParamSchema,
    body: {
      description: 'Product ID and quantity to add (strict mode - rejects extra fields)',
      content: {
        'application/json': {
          schema: AddItemBodySchema,
          example: {
            product_id: '11111111-1111-1111-1111-111111111111',
            quantity: 2,
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Item successfully added to cart',
      content: {
        'application/json': {
          schema: CartResponseSchema,
          example: {
            id: 'e394017d-2b47-4f40-8b1b-9f4a56c0b987',
            status: 'open',
            items: [
              {
                product_id: '11111111-1111-1111-1111-111111111111',
                name: 'Product A (Mechanical Keyboard)',
                unit_price_cents: 10000,
                quantity: 2,
                item_total_cents: 20000,
              },
            ],
            subtotal_cents: 20000,
            created_at: '2026-10-01T03:00:00.000Z',
            updated_at: '2026-10-01T03:00:00.000Z',
          },
        },
      },
    },
    400: commonErrorResponses[400],
    404: {
      description: 'Cart not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          example: {
            code: 'CART_NOT_FOUND',
            message: 'Cart not found',
            request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
          },
        },
      },
    },
    409: {
      description: 'Conflict / Business rule violation',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          examples: {
            CartClosed: {
              summary: 'Cart is already closed/checked out',
              value: {
                code: 'CART_CLOSED',
                message: 'Cannot modify a closed cart',
                request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
              },
            },
            ItemAlreadyInCart: {
              summary: 'Product already in cart',
              value: {
                code: 'ITEM_ALREADY_IN_CART',
                message: 'Product is already in the cart. Use PATCH to update quantity.',
                request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
              },
            },
            InsufficientStock: {
              summary: 'Requested quantity exceeds available inventory stock',
              value: {
                code: 'INSUFFICIENT_STOCK',
                message: 'Requested quantity exceeds available stock',
                request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
              },
            },
          },
        },
      },
    },
    422: {
      description: 'Product unavailable or inactive',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          example: {
            code: 'PRODUCT_UNAVAILABLE',
            message: 'Product does not exist or is discontinued',
            request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
          },
        },
      },
    },
    500: commonErrorResponses[500],
  },
});

// ==========================================
// 5. PATCH /carts/{cartId}/items/{productId}
// ==========================================
registry.registerPath({
  method: 'patch',
  path: '/carts/{cartId}/items/{productId}',
  tags: ['Cart Items'],
  summary: 'Update item quantity in cart',
  description: 'Updates the quantity of a specific item in an open cart. Validates stock availability.',
  request: {
    params: CartItemParamsSchema,
    body: {
      description: 'New quantity (1..10)',
      content: {
        'application/json': {
          schema: UpdateItemBodySchema,
          example: {
            quantity: 3,
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Item quantity successfully updated',
      content: {
        'application/json': {
          schema: CartResponseSchema,
          example: {
            id: 'e394017d-2b47-4f40-8b1b-9f4a56c0b987',
            status: 'open',
            items: [
              {
                product_id: '11111111-1111-1111-1111-111111111111',
                name: 'Product A (Mechanical Keyboard)',
                unit_price_cents: 10000,
                quantity: 3,
                item_total_cents: 30000,
              },
            ],
            subtotal_cents: 30000,
            created_at: '2026-10-01T03:00:00.000Z',
            updated_at: '2026-10-01T03:00:00.000Z',
          },
        },
      },
    },
    400: commonErrorResponses[400],
    404: {
      description: 'Cart or Item not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          examples: {
            CartNotFound: {
              summary: 'Cart not found',
              value: {
                code: 'CART_NOT_FOUND',
                message: 'Cart not found',
                request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
              },
            },
            ItemNotFound: {
              summary: 'Item not in cart',
              value: {
                code: 'ITEM_NOT_FOUND',
                message: 'Item not found in cart',
                request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
              },
            },
          },
        },
      },
    },
    409: {
      description: 'Conflict / Business rule violation',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          examples: {
            CartClosed: {
              summary: 'Cart is closed',
              value: {
                code: 'CART_CLOSED',
                message: 'Cannot modify a closed cart',
                request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
              },
            },
            InsufficientStock: {
              summary: 'Requested quantity exceeds stock',
              value: {
                code: 'INSUFFICIENT_STOCK',
                message: 'Requested quantity exceeds available stock',
                request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
              },
            },
          },
        },
      },
    },
    422: {
      description: 'Product unavailable or inactive',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          example: {
            code: 'PRODUCT_UNAVAILABLE',
            message: 'Product is no longer available',
            request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
          },
        },
      },
    },
    500: commonErrorResponses[500],
  },
});

// ==========================================
// 6. DELETE /carts/{cartId}/items/{productId}
// ==========================================
registry.registerPath({
  method: 'delete',
  path: '/carts/{cartId}/items/{productId}',
  tags: ['Cart Items'],
  summary: 'Remove an item from cart',
  description: 'Deletes a product item from an open cart. Returns 204 No Content with an empty body.',
  request: {
    params: CartItemParamsSchema,
  },
  responses: {
    204: {
      description: 'Item successfully deleted. Response body is completely empty.',
    },
    400: commonErrorResponses[400],
    404: {
      description: 'Cart or Item not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          examples: {
            CartNotFound: {
              summary: 'Cart not found',
              value: {
                code: 'CART_NOT_FOUND',
                message: 'Cart not found',
                request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
              },
            },
            ItemNotFound: {
              summary: 'Item not in cart',
              value: {
                code: 'ITEM_NOT_FOUND',
                message: 'Item not found in cart',
                request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
              },
            },
          },
        },
      },
    },
    409: {
      description: 'Conflict / Business rule violation',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          example: {
            code: 'CART_CLOSED',
            message: 'Cannot modify a closed cart',
            request_id: 'a5e8f492-9132-4720-bfd8-1c4b92b67f10',
          },
        },
      },
    },
    500: commonErrorResponses[500],
  },
});

// Generator OpenAPI 3.1 Document
export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Cart RESTful API',
      version: '1.0.0',
      description:
        'Production-grade RESTful API built with Node.js, Express, TypeScript, Zod, and PostgreSQL. Demonstrates Single Source of Truth contracts, boundary validation, structured logging, and robust error handling.',
      contact: {
        name: 'Backend Engineering Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local Development Server',
      },
    ],
  });
}

export const openApiDocument = buildOpenApiDocument();
