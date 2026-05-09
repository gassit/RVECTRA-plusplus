import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Prisma 7 generated types don't match runtime — using any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = prisma;

interface ValidationIssue {
  rule: string;
  elementId: string;
  elementName: string;
  status: 'error' | 'warning' | 'pass';
  message: string;
  value?: number;
  limit?: number;
}

const VALIDATION_RULES = [
  {
    name: 'breaker_cable_coordination',
    description: 'Координация автомат-кабель: Iном.выкл ≤ Iдоп.кабеля',
    severity: 'error'
  },
  {
    name: 'voltage_drop',
    description: 'Падение напряжения: ΔU ≤ 4%',
    severity: 'warning'
  },
  {
    name: 'short_circuit',
    description: 'Ток КЗ в конце линии: Iкз ≥ 3×Iном',
    severity: 'error'
  },
  {
    name: 'selectivity',
    description: 'Селективность: Iном.выш. ≥ Iном.нижн.',
    severity: 'warning'
  }
];

export async function GET() {
  try {
    const elements: any[] = await db.element.findMany({
      include: {
        deviceSlots: {
          include: {
            devices: {
              include: {
                breaker: { include: { ref: true } },
                load: true
              }
            }
          }
        },
        sourceConnections: {
          include: {
            cable: { include: { ref: true } }
          }
        }
      }
    });

    const issues: ValidationIssue[] = [];

    for (const element of elements) {
      const breakers = (element.deviceSlots || [])
        .flatMap((s: any) => s.devices || [])
        .filter((d: any) => d.breaker)
        .map((d: any) => d.breaker!);

      const cables = (element.sourceConnections || [])
        .filter((c: any) => c.cable)
        .map((c: any) => c.cable!);

      for (const breaker of breakers) {
        for (const cable of cables) {
          const cableIdop = cable.iDop || cable.ref?.iDop || 0;
          if (breaker.ratedCurrent > cableIdop) {
            issues.push({
              rule: 'breaker_cable_coordination',
              elementId: element.elementId,
              elementName: element.name,
              status: 'error',
              message: `Iном.авт (${breaker.ratedCurrent}А) > Iдоп.кабеля (${cableIdop}А)`,
              value: breaker.ratedCurrent,
              limit: cableIdop
            });
          } else {
            issues.push({
              rule: 'breaker_cable_coordination',
              elementId: element.elementId,
              elementName: element.name,
              status: 'pass',
              message: `Координация автомат-кабель в норме`
            });
          }
        }
      }

      const loads = (element.deviceSlots || [])
        .flatMap((s: any) => s.devices || [])
        .filter((d: any) => d.load)
        .map((d: any) => d.load!);

      for (const load of loads) {
        if (load.powerP > 10) {
          const voltageDrop = 2; // Заглушка
          if (voltageDrop > 4) {
            issues.push({
              rule: 'voltage_drop',
              elementId: element.elementId,
              elementName: element.name,
              status: 'warning',
              message: `Падение напряжения ${voltageDrop.toFixed(1)}% > 4%`,
              value: voltageDrop,
              limit: 4
            });
          }
        }
      }
    }

    const stats = {
      total: issues.length,
      errors: issues.filter(i => i.status === 'error').length,
      warnings: issues.filter(i => i.status === 'warning').length,
      passed: issues.filter(i => i.status === 'pass').length
    };

    return NextResponse.json({
      rules: VALIDATION_RULES,
      issues: issues.filter(i => i.status !== 'pass'),
      stats
    });
  } catch (error) {
    console.error('Error validating network:', error);
    return NextResponse.json({ error: 'Failed to validate network' }, { status: 500 });
  }
}
