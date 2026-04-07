import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Test API called');
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
}
