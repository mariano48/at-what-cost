import 'dotenv/config';
import { faker } from '@faker-js/faker';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TOTAL_PRODUCTS = 10_000;
const BATCH_SIZE = 1_000;

function buildProduct(index: number) {
  return {
    sku: `SKU-${String(index).padStart(6, '0')}`,
    name: faker.commerce.productName(),
    price: Number(faker.commerce.price({ min: 5, max: 500 })),
  };
}

async function seed(): Promise<void> {
  const existing = await prisma.product.count();
  if (existing > 0) {
    console.log(
      `Skipping seed — ${existing} products already exist. Run "prisma migrate reset" to start fresh.`,
    );
    return;
  }

  console.log(`Seeding ${TOTAL_PRODUCTS} products in batches of ${BATCH_SIZE}...`);

  for (let start = 0; start < TOTAL_PRODUCTS; start += BATCH_SIZE) {
    const batch = Array.from({ length: BATCH_SIZE }, (_, i) => buildProduct(start + i + 1));
    await prisma.product.createMany({ data: batch });
    console.log(`  seeded ${Math.min(start + BATCH_SIZE, TOTAL_PRODUCTS)}/${TOTAL_PRODUCTS}`);
  }

  console.log('Seed complete.');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
