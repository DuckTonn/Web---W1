import { Router } from 'express';
import { CartController } from '../controllers/cart.controller';
import { validateRequest } from '../middlewares/validate-request';
import {
  CartIdParamSchema,
  CartItemParamsSchema,
  AddItemBodySchema,
  UpdateItemBodySchema,
} from '../schemas';

const router = Router();

// POST /carts - Create new empty cart
router.post('/', CartController.createCart);

// GET /carts/:cartId - Get cart by ID with items and subtotal
router.get(
  '/:cartId',
  validateRequest({ params: CartIdParamSchema }),
  CartController.getCart
);

// POST /carts/:cartId/items - Add product to cart
router.post(
  '/:cartId/items',
  validateRequest({
    params: CartIdParamSchema,
    body: AddItemBodySchema,
  }),
  CartController.addItem
);

// PATCH /carts/:cartId/items/:productId - Update item quantity
router.patch(
  '/:cartId/items/:productId',
  validateRequest({
    params: CartItemParamsSchema,
    body: UpdateItemBodySchema,
  }),
  CartController.updateItem
);

// DELETE /carts/:cartId/items/:productId - Remove item from cart
router.delete(
  '/:cartId/items/:productId',
  validateRequest({
    params: CartItemParamsSchema,
  }),
  CartController.deleteItem
);

export default router;
