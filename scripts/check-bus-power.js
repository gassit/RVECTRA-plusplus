/**
 * ============================================================================
 * ДИАГНОСТИКА BUS ЭЛЕМЕНТОВ (JavaScript версия)
 * ============================================================================
 *
 * Запуск: node scripts/check-bus-power.js
 *
 * Проверяет:
 * 1. Все BUS элементы и их статус (ON/OFF)
 * 2. Суммируют ли они мощности от нагрузок
 * 3. Пропускают ли мощность выше к источнику
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('ДИАГНОСТИКА BUS ЭЛЕМЕНТОВ');
  console.log('='.repeat(60));

  // =========================================================================
  // 1. ВСЕ BUS ЭЛЕМЕНТЫ
  // =========================================================================
  const buses = await prisma.$queryRaw`
    SELECT id, name, operationalStatus, sumPInstalled, sumPCalculated
    FROM Element
    WHERE type = 'bus'
    ORDER BY operationalStatus, name
  `;

  console.log('\n1. СПИСОК ВСЕХ BUS ЭЛЕМЕНТОВ:');
  console.log('-'.repeat(60));
  console.log('Статус  | Pуст   | Pрасч  | Имя');
  console.log('-'.repeat(60));

  let onCount = 0, offCount = 0, offWithZero = 0;

  for (const bus of buses) {
    const status = bus.operationalStatus || 'NULL';
    const pInst = (bus.sumPInstalled || 0).toFixed(0).padStart(6);
    const pCalc = (bus.sumPCalculated || 0).toFixed(1).padStart(7);
    const name = bus.name?.substring(0, 35) || 'no-name';

    const marker = bus.operationalStatus === 'OFF' && (bus.sumPCalculated || 0) === 0 ? ' ⚠️' : '';
    console.log(status.padEnd(7) + ' | ' + pInst + ' | ' + pCalc + ' | ' + name + marker);

    if (bus.operationalStatus === 'OFF') {
      offCount++;
      if ((bus.sumPCalculated || 0) === 0) offWithZero++;
    } else {
      onCount++;
    }
  }

  console.log('-'.repeat(60));
  console.log('Всего: ' + buses.length + ' (ON: ' + onCount + ', OFF: ' + offCount + ')');

  // =========================================================================
  // 2. ПРОВЕРКА BUS С OFF И НУЛЕВОЙ МОЩНОСТЬЮ
  // =========================================================================
  console.log('\n2. BUS С OFF И НУЛЕВОЙ МОЩНОСТЬЮ (потенциальная проблема):');
  console.log('-'.repeat(60));

  const problematicBuses = buses.filter(
    b => b.operationalStatus === 'OFF' && (b.sumPCalculated || 0) === 0
  );

  if (problematicBuses.length === 0) {
    console.log('✅ Нет проблемных BUS');
  } else {
    for (const bus of problematicBuses) {
      console.log('\n📍 ' + bus.name);

      // Исходящие связи (к детям/нагрузкам)
      const outgoing = await prisma.$queryRaw`
        SELECT e.name, e.type, e.sumPCalculated, e.operationalStatus
        FROM Connection c
        JOIN Element e ON c.targetId = e.id
        WHERE c.sourceId = ${bus.id}
        LIMIT 5
      `;

      console.log('   Исходящие связи (к нагрузкам):');
      if (outgoing.length === 0) {
        console.log('   ❌ НЕТ СВЯЗЕЙ - нет нагрузок');
      } else {
        for (const c of outgoing) {
          const cName = c.name?.substring(0, 25) || 'no-name';
          console.log('   -> ' + c.type + ' "' + cName + '" P=' + (c.sumPCalculated || 0) + ' [' + (c.operationalStatus || 'NULL') + ']');
        }
      }
    }
  }

  // =========================================================================
  // 3. ПРОВЕРКА ПРОХОЖДЕНИЯ МОЩНОСТИ ЧЕРЕЗ BUS
  // =========================================================================
  console.log('\n3. ПРОВЕРКА ПРОХОЖДЕНИЯ МОЩНОСТИ ЧЕРЕЗ BUS:');
  console.log('-'.repeat(60));

  // Находим BUS с нагрузками
  const busesWithLoads = await prisma.$queryRaw`
    SELECT
      bus.id, bus.name, bus.operationalStatus, bus.sumPCalculated,
      COUNT(DISTINCT load.id) as loadCount,
      SUM(l.powerP * COALESCE(l.usageFactor, 0.8)) as totalLoadPower
    FROM Element bus
    JOIN Connection c ON c.sourceId = bus.id
    JOIN Element load ON c.targetId = load.id AND load.type = 'load'
    LEFT JOIN DeviceSlot ds ON load.id = ds.elementId
    LEFT JOIN Device d ON ds.id = d.slotId
    LEFT JOIN Load l ON d.id = l.deviceId
    GROUP BY bus.id
  `;

  for (const bus of busesWithLoads) {
    const expectedPower = bus.totalLoadPower || 0;
    const actualPower = bus.sumPCalculated || 0;
    const diff = Math.abs(expectedPower - actualPower);

    const status = bus.operationalStatus || 'NULL';
    const isOk = diff < 1; // Допускаем погрешность 1 кВт

    console.log('\n📍 ' + (bus.name?.substring(0, 35) || 'no-name') + ' [' + status + ']');
    console.log('   Нагрузок: ' + bus.loadCount);
    console.log('   Ожидаемая Pрасч: ' + expectedPower.toFixed(1) + ' кВт');
    console.log('   Фактическая Pрасч: ' + actualPower.toFixed(1) + ' кВт');

    if (isOk) {
      console.log('   ✅ Мощность суммируется корректно');
    } else {
      console.log('   ⚠️ Разница: ' + diff.toFixed(1) + ' кВт');

      if (bus.operationalStatus === 'OFF') {
        console.log('   🔧 ПРОБЛЕМА: BUS имеет OFF - проверить логику PASS_THROUGH');
      }
    }

    // Проверяем передачу мощности выше
    const parentConns = await prisma.$queryRaw`
      SELECT e.name, e.type, e.sumPCalculated
      FROM Connection c
      JOIN Element e ON c.sourceId = e.id
      WHERE c.targetId = ${bus.id}
      LIMIT 3
    `;

    console.log('   Питание от (вышестоящие элементы):');
    for (const p of parentConns) {
      const parentPower = p.sumPCalculated || 0;
      const passes = parentPower >= actualPower * 0.9; // 90% должно проходить
      const marker = passes ? '✅' : '⚠️';
      const pName = p.name?.substring(0, 25) || 'no-name';
      console.log('   ' + marker + ' <- ' + p.type + ' "' + pName + '" P=' + parentPower.toFixed(1));
    }
  }

  // =========================================================================
  // 4. ИТОГ
  // =========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('ИТОГ:');
  console.log('='.repeat(60));

  if (offWithZero === 0) {
    console.log('✅ Все BUS с OFF корректно пропускают мощность');
  } else {
    console.log('⚠️ ' + offWithZero + ' BUS с OFF имеют нулевую мощность');
    console.log('   Возможные причины:');
    console.log('   1. Нет подключенных нагрузок');
    console.log('   2. Нагрузки имеют OFF статус');
    console.log('   3. Проблема в логике расчёта (PASS_THROUGH не работает)');
  }

  // Проверка кода
  console.log('\nПроверка кода расчёта мощности:');
  try {
    const fs = require('fs');
    const path = require('path');
    const powerFile = path.join(process.cwd(), 'src/lib/power.ts');

    if (fs.existsSync(powerFile)) {
      const content = fs.readFileSync(powerFile, 'utf-8');

      const hasPassThrough = content.includes('isPassThrough') ||
                             content.includes('PASS_THROUGH') ||
                             (content.includes("'bus'") && content.includes('junction'));

      if (hasPassThrough) {
        console.log('✅ PASS_THROUGH логика присутствует в коде');
      } else {
        console.log('❌ PASS_THROUGH логика НЕ НАЙДЕНА - нужно добавить!');
        console.log('\n   Добавьте в код расчёта:');
        console.log('   const isPassThrough = ["bus", "junction", "junctionbox"]');
        console.log('     .includes(childElement.type.toLowerCase());');
        console.log('   if (!isPassThrough && childElement.operationalStatus === "OFF") continue;');
      }
    } else {
      console.log('⚠️ Файл src/lib/power.ts не найден');
    }
  } catch (e) {
    console.log('⚠️ Не удалось проверить файл кода');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
