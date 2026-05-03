import { prisma } from "@/lib/db";
import { releaseExpiredReservationsBatch } from "@/lib/reservations";

/** Lazy expiry before reads so listings stay accurate if cron is delayed. */
export async function getCatalog() {
  await releaseExpiredReservationsBatch(50);

  const products = await prisma.product.findMany({
    orderBy: { sku: "asc" },
    include: {
      inventories: {
        include: { warehouse: true },
        orderBy: { warehouse: { code: "asc" } },
      },
    },
  });

  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    warehouses: p.inventories.map((inv) => ({
      warehouseId: inv.warehouseId,
      warehouseCode: inv.warehouse.code,
      warehouseName: inv.warehouse.name,
      totalUnits: inv.totalUnits,
      reservedUnits: inv.reservedUnits,
      availableUnits: inv.totalUnits - inv.reservedUnits,
    })),
  }));
}

export type CatalogProduct = Awaited<ReturnType<typeof getCatalog>>[number];

export async function getWarehouses() {
  return prisma.warehouse.findMany({ orderBy: { code: "asc" } });
}
