import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const conn = await prisma.connection.findUnique({
    where: { id: 'conn_1777531539936_4fzsw3jtg' },
    include: {
      Cable: true,
      Element_Connection_targetIdToElement: {
        include: {
          DeviceSlot: {
            include: {
              Device: {
                include: { Load: true }
              }
            }
          }
        }
      }
    }
  });
  
  if (conn) {
    console.log('Connection:', JSON.stringify(conn, null, 2));
  } else {
    console.log('Connection not found');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
