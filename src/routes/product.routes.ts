import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { validateRequest } from '../middlewares/validate-request';
import { ProductsQuerySchema } from '../schemas';

const router = Router();

// GET /products?limit=20&offset=0
router.get(
  '/',
  validateRequest({ query: ProductsQuerySchema }),
  ProductController.listProducts
);

export default router;
