/**
 * Сервис АВР (Автоматический Ввод Резерва)
 * 
 * АВР - это контроллер, который:
 * 1. МОНИТОРИТ состояние элементов (входы) - LIVE/DEAD, ON/OFF
 * 2. УПРАВЛЯЕТ другими элементами (выходы) - включает/отключает
 * 
 * АВР НЕ находится в цепи питания, а работает параллельно схеме
 */

import { prisma } from '@/lib/prisma';

// Типы
type AVRMode = 'AUTO' | 'MANUAL' | 'OFF';
type AVRStatus = 'OK' | 'SWITCHING' | 'FAULT' | 'OFF';
type SignalType = 'ELECTRICAL' | 'OPERATIONAL';

interface AVRInputState {
  inputId: string;
  elementId: string;
  elementName: string;
  role: string;
  priority: number;
  signalType: SignalType;
  isLive: boolean;
  isOn: boolean;
}

interface AVRAction {
  outputId: string;
  elementId: string;
  elementName: string;
  fromState: string;
  toState: string;
}

/**
 * Обработка всех АВР - вызывается в propagateStates()
 */
export async function processAVRs(): Promise<{ processed: number; switchovers: number }> {
  console.log('[AVR] Начало обработки АВР...');

  const avrs = await prisma.aVR.findMany({
    where: { 
      mode: 'AUTO',
      status: { not: 'OFF' }
    },
    include: {
      inputs: {
        orderBy: { priority: 'asc' },
        include: { element: true }
      },
      outputs: {
        include: { element: true }
      }
    }
  });

  console.log(`[AVR] Найдено АВР в режиме AUTO: ${avrs.length}`);

  let switchovers = 0;

  for (const avr of avrs) {
    const result = await processSingleAVR(avr);
    if (result) switchovers++;
  }

  console.log(`[AVR] Обработано: ${avrs.length}, переключений: ${switchovers}`);

  return { processed: avrs.length, switchovers };
}

/**
 * Обработка одного АВР
 */
async function processSingleAVR(avr: any): Promise<boolean> {
  console.log(`[AVR] Обработка: ${avr.name}`);

  // 1. Определить состояние всех входов
  const inputStates: AVRInputState[] = avr.inputs.map((input: any) => {
    const el = input.element;
    const isLive = el.electricalStatus === 'LIVE';
    const isOn = el.operationalStatus === 'ON';

    return {
      inputId: input.id,
      elementId: input.elementId,
      elementName: el.name,
      role: input.role,
      priority: input.priority,
      signalType: input.signalType as SignalType,
      isLive: input.signalType === 'ELECTRICAL' ? isLive : isOn,
      isOn,
    };
  });

  // Логирование состояний входов
  for (const s of inputStates) {
    console.log(`[AVR]   ${s.role} (prio ${s.priority}): ${s.elementName} = ${s.isLive ? 'LIVE' : 'DEAD'}`);
  }

  // 2. Найти лучший доступный источник по приоритету
  const bestInput = inputStates
    .filter(s => s.isLive)
    .sort((a, b) => a.priority - b.priority)[0];

  if (!bestInput) {
    console.log(`[AVR]   ⚠️ Все источники DEAD`);
    // Все источники недоступны - отключить все выходы
    return await handleAllSourcesDead(avr);
  }

  console.log(`[AVR]   Лучший источник: ${bestInput.role} (${bestInput.elementName})`);

  // 3. Определить нужные действия
  const actions: AVRAction[] = [];

  for (const output of avr.outputs) {
    const shouldBeOn = output.elementId === bestInput.elementId;
    const currentState = output.element.operationalStatus;

    // Если элемент должен быть ON и он OFF
    if (shouldBeOn && currentState === 'OFF') {
      actions.push({
        outputId: output.id,
        elementId: output.elementId,
        elementName: output.element.name,
        fromState: 'OFF',
        toState: 'ON',
      });
    }
    // Если элемент должен быть OFF и он ON
    else if (!shouldBeOn && currentState === 'ON') {
      actions.push({
        outputId: output.id,
        elementId: output.elementId,
        elementName: output.element.name,
        fromState: 'ON',
        toState: 'OFF',
      });
    }
  }

  // 4. Если есть действия - выполнить переключение
  if (actions.length > 0) {
    console.log(`[AVR]   Переключение: ${actions.length} действий`);
    return await performSwitchover(avr, bestInput, actions);
  }

  return false;
}

/**
 * Обработка ситуации когда все источники недоступны
 */
async function handleAllSourcesDead(avr: any): Promise<boolean> {
  const actions: AVRAction[] = [];

  for (const output of avr.outputs) {
    if (output.element.operationalStatus === 'ON') {
      actions.push({
        outputId: output.id,
        elementId: output.elementId,
        elementName: output.element.name,
        fromState: 'ON',
        toState: 'OFF',
      });
    }
  }

  if (actions.length > 0) {
    console.log(`[AVR]   Отключение всех выходов: ${actions.length}`);
    return await performSwitchover(avr, null, actions, 'ALL_SOURCES_LOST');
  }

  return false;
}

/**
 * Выполнить переключение АВР
 */
async function performSwitchover(
  avr: any,
  activeInput: AVRInputState | null,
  actions: AVRAction[],
  reason: string = 'SOURCE_CHANGE'
): Promise<boolean> {
  const startTime = Date.now();

  // 1. Установить статус "переключение"
  await prisma.aVR.update({
    where: { id: avr.id },
    data: { status: 'SWITCHING' }
  });

  // 2. Задержка переключения
  const delayMs = (avr.switchoverDelay || 0.5) * 1000;
  if (delayMs > 0) {
    await sleep(delayMs);
  }

  // 3. Выполнить действия
  const executedActions: any[] = [];

  for (const action of actions) {
    try {
      await prisma.element.update({
        where: { id: action.elementId },
        data: { 
          operationalStatus: action.toState,
          updatedAt: new Date()
        }
      });

      // Обновить статус выхода
      await prisma.aVROutput.update({
        where: { id: action.outputId },
        data: { isActive: action.toState === 'ON' }
      });

      executedActions.push({
        elementId: action.elementId,
        elementName: action.elementName,
        fromState: action.fromState,
        toState: action.toState,
      });

      console.log(`[AVR]     ${action.elementName}: ${action.fromState} → ${action.toState}`);
    } catch (e) {
      console.error(`[AVR]     Ошибка: ${action.elementName}`, e);
    }
  }

  // 4. Обновить статус АВР
  await prisma.aVR.update({
    where: { id: avr.id },
    data: { 
      status: 'OK',
      updatedAt: new Date()
    }
  });

  // 5. Записать в историю
  const duration = Date.now() - startTime;
  await prisma.aVRSwitchover.create({
    data: {
      id: `sw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      avrId: avr.id,
      triggerElement: activeInput?.elementName || null,
      triggerReason: reason,
      actions: JSON.stringify(executedActions),
      delay: duration / 1000,
      success: true,
    }
  });

  console.log(`[AVR]   Переключение завершено за ${duration}мс`);

  return true;
}

/**
 * Получить информацию об АВР
 */
export async function getAVRInfo(avrId: string) {
  return prisma.aVR.findUnique({
    where: { id: avrId },
    include: {
      inputs: {
        orderBy: { priority: 'asc' },
        include: { element: true }
      },
      outputs: {
        include: { element: true }
      }
    }
  });
}

/**
 * Получить все АВР
 */
export async function getAllAVRs() {
  return prisma.aVR.findMany({
    include: {
      inputs: {
        orderBy: { priority: 'asc' },
        include: { element: true }
      },
      outputs: {
        include: { element: true }
      },
      _count: {
        select: { switchovers: true }
      }
    }
  });
}

/**
 * Изменить режим АВР
 */
export async function setAVRMode(avrId: string, mode: AVRMode): Promise<boolean> {
  try {
    await prisma.aVR.update({
      where: { id: avrId },
      data: { mode }
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Получить историю переключений АВР
 */
export async function getAVRHistory(avrId: string, limit: number = 50) {
  return prisma.aVRSwitchover.findMany({
    where: { avrId },
    orderBy: { timestamp: 'desc' },
    take: limit
  });
}

// Утилита
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
