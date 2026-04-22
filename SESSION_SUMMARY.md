# RVectrA Digital Twin — Session Summary

## Проект
- **Название**: network-digital-twin
- **Репозиторий**: https://github.com/gassit/RVectrA-Digital-Twin
- **Токен GitHub**: потребуется новый токен в новой сессии

## Технологический стек
- **Frontend**: Next.js 16 + React 19 + AntV G6 5
- **Database**: Prisma + SQLite
- **Styling**: Tailwind CSS 4
- **Runtime**: Bun

## Ключевые файлы
- `app/page.tsx` — главная страница
- `components/network/NetworkGraphInner.tsx` — визуализация G6
- `lib/services/state-propagation.service.ts` — BFS алгоритм
- `lib/services/avr.service.ts` — логика АВР
- `scripts/import-universal.ts` — импорт Excel
- `prisma/schema.prisma` — схема БД (20+ моделей)

## Что было сделано в этой сессии
1. Исправлен Web Worker postMessage error (порог 300 узлов)
2. Объединены 3 скрипта импорта в import-universal.ts
3. Удалён расчёт layout из backend (теперь на frontend G6)
4. Настроен Git remote на gassit/RVectrA-Digital-Twin
5. Создана документация:
   - RVectrA_Documentation.docx
   - RVectrA_Architecture.docx

## Документация
- `/home/z/my-project/download/RVectrA_Documentation.docx` — правила развертывания
- `/home/z/my-project/download/RVectrA_Architecture.docx` — архитектура проекта

## Web Worker
- Порог активации: 300 узлов
- При <300: layout в основном потоке
- При >=300: Web Worker
- Данные должны быть сериализуемы (без функций)

## Статусы
- `ElectricalStatus`: LIVE | DEAD (есть ли напряжение)
- `OperationalStatus`: ON | OFF (включен ли вручную)
- OFF блокирует прохождение LIVE downstream

## Git история
- Старый репозиторий `AlexanderUritsky/RVectrA` — удалён
- Истории расходились (76 локальных vs 69 origin коммитов)
- Force push выполнен 21.04.2026

## Известные проблемы
- БД в git истории (рекомендуется удалить через BFG)
- Нет авторизации в приложении
- Репозиторий публичный

## Команды для нового чата
```bash
# Клонирование
git clone https://github.com/gassit/RVectrA-Digital-Twin.git
cd RVectrA-Digital-Twin

# Установка
bun install

# Инициализация БД
bunx prisma generate
bunx prisma db push

# Запуск
bun run dev
```
