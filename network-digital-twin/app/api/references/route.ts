import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cables = await prisma.cableReference.findMany({
      orderBy: { section: 'asc' }
    });
    
    const breakers = await prisma.breakerReference.findMany({
      orderBy: { ratedCurrent: 'asc' }
    });
    
    const transformers = await prisma.transformerReference.findMany({
      orderBy: { power: 'asc' }
    });

    return NextResponse.json({ cables, breakers, transformers });
  } catch (error) {
    console.error('Error fetching references:', error);
    return NextResponse.json({ error: 'Failed to fetch references' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body;

    let result;
    switch (type) {
      case 'cable':
        result = await prisma.cableReference.create({ data });
        break;
      case 'breaker':
        result = await prisma.breakerReference.create({ data });
        break;
      case 'transformer':
        result = await prisma.transformerReference.create({ data });
        break;
      default:
        return NextResponse.json({ error: 'Invalid reference type' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating reference:', error);
    return NextResponse.json({ error: 'Failed to create reference' }, { status: 500 });
  }
}
