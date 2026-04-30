// ============================================================================
// API РАСПРОСТРАНЕНИЯ СОСТОЯНИЙ
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { propagateStates, PropagationResult } from '@/lib/propagate';

// ============================================================================
// POST - Запустить распространение состояний
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/propagate - Starting state propagation...');

    const result: PropagationResult = await propagateStates();

    console.log('Propagation completed:', result);

    return NextResponse.json({
      success: true,
      message: 'Распространение состояний завершено',
      data: result
    });
  } catch (error) {
    console.error('Error in propagate:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при распространении состояний' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Получить информацию о текущих статусах
// ============================================================================

export async function GET() {
  try {
    const { prisma } = await import('@/lib/prisma');

    const elements = await prisma.element.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        electricalStatus: true,
        operationalStatus: true
      }
    });

    const connections = await prisma.connection.findMany({
      select: {
        id: true,
        electricalStatus: true,
        operationalStatus: true
      }
    });

    const liveElements = elements.filter(e => e.electricalStatus === 'LIVE').length;
    const deadElements = elements.filter(e => e.electricalStatus === 'DEAD').length;
    const offElements = elements.filter(e => e.operationalStatus === 'OFF').length;
    const liveConnections = connections.filter(c => c.electricalStatus === 'LIVE').length;

    return NextResponse.json({
      success: true,
      data: {
        totalElements: elements.length,
        totalConnections: connections.length,
        liveElements,
        deadElements,
        offElements,
        liveConnections,
        deadConnections: connections.length - liveConnections
      }
    });
  } catch (error) {
    console.error('Error getting status info:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении информации о статусах' },
      { status: 500 }
    );
  }
}
