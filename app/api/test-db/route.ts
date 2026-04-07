import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('Testing Prisma connection...');
    const count = await prisma.element.count();
    console.log('Element count:', count);
    return NextResponse.json({ status: 'ok', elementCount: count });
  } catch (error) {
    console.error('Prisma error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
