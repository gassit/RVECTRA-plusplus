import { prisma } from '../lib/prisma';

async function main() {
  const elements = await prisma.element.count();
  const devices = await prisma.device.count();
  const loads = await prisma.load.count();
  const transformers = await prisma.transformer.count();
  
  console.log('Elements:', elements);
  console.log('Devices:', devices);
  console.log('Loads:', loads);
  console.log('Transformers:', transformers);
  
  if (loads > 0) {
    const loadSamples = await prisma.load.findMany({ take: 3 });
    console.log('Load samples:', JSON.stringify(loadSamples, null, 2));
  }
  
  if (transformers > 0) {
    const transSamples = await prisma.transformer.findMany({ take: 3 });
    console.log('Transformer samples:', JSON.stringify(transSamples, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
