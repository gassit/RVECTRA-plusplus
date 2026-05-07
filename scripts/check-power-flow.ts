import { prisma } from '../src/lib/prisma';

async function main() {
  // Найти все элементы с КМ в названии или типа JUNCTION
  const junctions = await prisma.element.findMany({
    where: {
      OR: [
        { name: { contains: 'КМ' } },
        { name: { contains: 'Км' } },
        { type: { equals: 'junction' } },
        { type: { equals: 'junctionbox' } },
      ]
    },
    orderBy: { name: 'asc' }
  });

  console.log(`=== КМ/JUNCTION элементы (${junctions.length}) ===\n`);

  for (const j of junctions) {
    console.log(`${j.name}`);
    console.log(`  ID: ${j.id}`);
    console.log(`  Type: ${j.type}`);
    console.log(`  Status: ${j.operationalStatus}`);
    console.log(`  sumP: ${j.sumPInstalled || 0} / ${j.sumPCalculated || 0} кВт`);
    console.log();

    // Найти связи
    const incoming = await prisma.connection.findMany({
      where: { targetId: j.id },
      include: {
        Element_Connection_sourceIdToElement: {
          select: { name: true, type: true, sumPInstalled: true, sumPCalculated: true }
        }
      }
    });

    const outgoing = await prisma.connection.findMany({
      where: { sourceId: j.id },
      include: {
        Element_Connection_targetIdToElement: {
          select: { name: true, type: true, sumPInstalled: true, sumPCalculated: true }
        }
      }
    });

    console.log(`  ВХОДЯЩИЕ (${incoming.length}):`);
    for (const c of incoming) {
      const src = c.Element_Connection_sourceIdToElement;
      console.log(`    ← ${src?.name} [${src?.type}] P=${src?.sumPInstalled || 0}`);
    }

    console.log(`  ИСХОДЯЩИЕ (${outgoing.length}):`);
    for (const c of outgoing) {
      const tgt = c.Element_Connection_targetIdToElement;
      console.log(`    → ${tgt?.name} [${tgt?.type}] P=${tgt?.sumPInstalled || 0}`);
    }
    console.log();
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
