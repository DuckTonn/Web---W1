import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';

export class ProductController {
  public static async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = typeof req.query.limit === 'number' ? req.query.limit : parseInt(String(req.query.limit || 20), 10);
      const offset = typeof req.query.offset === 'number' ? req.query.offset : parseInt(String(req.query.offset || 0), 10);

      const products = await ProductService.listActiveProducts(limit, offset);
      res.status(200).json(products);
    } catch (error) {
      next(error);
    }
  }
}
