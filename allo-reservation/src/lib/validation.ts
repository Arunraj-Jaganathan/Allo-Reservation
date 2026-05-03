import { z } from "zod";

export const reserveBodySchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  qty: z.coerce.number().int().positive().max(1000),
});

export type ReserveBody = z.infer<typeof reserveBodySchema>;
