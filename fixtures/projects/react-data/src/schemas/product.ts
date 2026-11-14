import { z } from './mini-zod.ts';

export const ProductSchema = z.object({
  title: z.string().min(),
  price: z.number(),
  inStock: z.boolean(),
});
