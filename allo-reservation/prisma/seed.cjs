const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const w1 = await prisma.warehouse.upsert({
    where: { code: "EAST-01" },
    update: { name: "East Coast DC" },
    create: { code: "EAST-01", name: "East Coast DC" },
  });
  const w2 = await prisma.warehouse.upsert({
    where: { code: "WEST-01" },
    update: { name: "West Coast DC" },
    create: { code: "WEST-01", name: "West Coast DC" },
  });

  const p1 = await prisma.product.upsert({
    where: { sku: "ALLO-TSHIRT-BLK" },
    update: { name: "Allo Tee — Black" },
    create: { sku: "ALLO-TSHIRT-BLK", name: "Allo Tee — Black" },
  });
  const p2 = await prisma.product.upsert({
    where: { sku: "ALLO-MUG-WHT" },
    update: { name: "Allo Mug — White" },
    create: { sku: "ALLO-MUG-WHT", name: "Allo Mug — White" },
  });

  const rows = [
    { productId: p1.id, warehouseId: w1.id, totalUnits: 12, reservedUnits: 0 },
    { productId: p1.id, warehouseId: w2.id, totalUnits: 5, reservedUnits: 0 },
    { productId: p2.id, warehouseId: w1.id, totalUnits: 3, reservedUnits: 0 },
    { productId: p2.id, warehouseId: w2.id, totalUnits: 1, reservedUnits: 0 },
  ];

  for (const row of rows) {
    await prisma.inventory.upsert({
      where: {
        productId_warehouseId: {
          productId: row.productId,
          warehouseId: row.warehouseId,
        },
      },
      update: {
        totalUnits: row.totalUnits,
        reservedUnits: row.reservedUnits,
      },
      create: row,
    });
  }

  console.log("Seed complete:", { warehouses: [w1.code, w2.code], products: [p1.sku, p2.sku] });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
