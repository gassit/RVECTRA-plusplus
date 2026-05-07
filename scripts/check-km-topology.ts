import { prisma } from '../src/lib/prisma';

async function main() {
  // Топология КМ1
  console.log('=== ТОПОЛОГИЯ КМ1 ППУ-п ===\n');

  const km1 = await prisma.element.findFirst({
    where: { name: 'КМ1 ППУ-п' }
  });

  if (km1) {
    // Входящие связи
    const incoming = await prisma.connection.findMany({
      where: { targetId: km1.id },
      include: {
        Element_Connection_sourceIdToElement: {
          select: { id: true, name: true, type: true, sumPInstalled: true }
        }
      }
    });

    console.log('ВХОДЯЩИЕ связи (питание):');
    for (const c of incoming) {
      const src = c.Element_Connection_sourceIdToElement;
      console.log(`  ← ${src?.name} [${src?.type}] P=${src?.sumPInstalled || 0}`);
    }

    // Исходящие связи
    const outgoing = await prisma.connection.findMany({
      where: { sourceId: km1.id },
      include: {
        Element_Connection_targetIdToElement: {
          select: { id: true, name: true, type: true, sumPInstalled: true }
        }
      }
    });

    console.log('\nИСХОДЯЩИЕ связи (потребители):');
    if (outgoing.length === 0) {
      console.log('  НЕТ — это конечная нагрузка!');
    } else {
      for (const c of outgoing) {
        const tgt = c.Element_Connection_targetIdToElement;
        console.log(`  → ${tgt?.name} [${tgt?.type}] P=${tgt?.sumPInstalled || 0}`);
      }
    }
  }

  // Топология КМ2
  console.log('\n\n=== ТОПОЛОГИЯ КМ2 ППУ-п ===\n');

  const km2 = await prisma.element.findFirst({
    where: { name: 'КМ2 ППУ-п' }
  });

  if (km2) {
    const incoming = await prisma.connection.findMany({
      where: { targetId: km2.id },
      include: {
        Element_Connection_sourceIdToElement: {
          select: { id: true, name: true, type: true, sumPInstalled: true }
        }
      }
    });

    console.log('ВХОДЯЩИЕ связи (питание):');
    for (const c of incoming) {
      const src = c.Element_Connection_sourceIdToElement;
      console.log(`  ← ${src?.name} [${src?.type}] P=${src?.sumPInstalled || 0}`);
    }

    const outgoing = await prisma.connection.findMany({
      where: { sourceId: km2.id },
      include: {
        Element_Connection_targetIdToElement: {
          select: { id: true, name: true, type: true, sumPInstalled: true }
        }
      }
    });

    console.log('\nИСХОДЯЩИЕ связи (потребители):');
    if (outgoing.length === 0) {
      console.log('  НЕТ — это конечная нагрузка!');
    } else {
      for (const c of outgoing) {
        const tgt = c.Element_Connection_targetIdToElement;
        console.log(`  → ${tgt?.name} [${tgt?.type}] P=${tgt?.sumPInstalled || 0}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
