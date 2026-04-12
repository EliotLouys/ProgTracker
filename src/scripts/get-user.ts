import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst();
  console.log('ID_TROUVE:' + user?.id);
  await prisma.$disconnect();
}
main();
