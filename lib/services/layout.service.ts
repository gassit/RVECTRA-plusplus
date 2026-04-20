/**
 * Сервис размещения элементов на схеме
 * В данный момент правила построения удалены
 */

interface LayoutElement {
  id: string;
  elementId: string;
  name: string;
  type: string;
  parentId: string | null;
}

interface LayoutConnection {
  id: string;
  sourceId: string;
  targetId: string;
}

interface Position { x: number; y: number; }

interface EdgeOffset {
  connectionId: string;
  offset: number;
  controlPoints: Array<{ x: number; y: number }>;
}

interface LayoutResult {
  positions: Map<string, Position>;
  cabinetBounds: Map<string, { x: number; y: number; width: number; height: number; name: string }>;
  edgeOffsets: Map<string, EdgeOffset>;
}

export function calculateLayout(elements: LayoutElement[], connections: LayoutConnection[]): LayoutResult {
  const positions = new Map<string, Position>();
  const cabinetBounds = new Map<string, { x: number; y: number; width: number; height: number; name: string }>();
  const edgeOffsets = new Map<string, EdgeOffset>();

  console.log('[Layout] No layout rules defined');

  return { positions, cabinetBounds, edgeOffsets };
}

export async function saveLayoutPositions(positions: Map<string, Position>, prisma: any): Promise<number> {
  return 0;
}

export function getLayoutRules(): string {
  return 'Правила построения удалены';
}
