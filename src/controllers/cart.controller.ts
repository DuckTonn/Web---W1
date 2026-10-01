import { Request, Response, NextFunction } from 'express';
import { CartService } from '../services/cart.service';

export class CartController {
  public static async createCart(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cart = await CartService.createCart();
      res.setHeader('Location', `/carts/${cart.id}`);
      res.status(201).json(cart);
    } catch (error) {
      next(error);
    }
  }

  public static async getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cartId } = req.params;
      const cart = await CartService.getCartById(cartId);
      res.status(200).json(cart);
    } catch (error) {
      next(error);
    }
  }

  public static async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cartId } = req.params;
      const { product_id, quantity } = req.body;
      const cart = await CartService.addItem(cartId, product_id, quantity);
      res.status(201).json(cart);
    } catch (error) {
      next(error);
    }
  }

  public static async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cartId, productId } = req.params;
      const { quantity } = req.body;
      const cart = await CartService.updateItem(cartId, productId, quantity);
      res.status(200).json(cart);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cartId, productId } = req.params;
      await CartService.deleteItem(cartId, productId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
