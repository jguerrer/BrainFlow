import { prisma } from '../src/db/prisma.js';
import { seedIfEmpty } from '../src/db/seed.js';

seedIfEmpty()
  .then(() => {
    console.log('Database seeded.');
    return prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
