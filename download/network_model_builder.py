#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Network Model Builder v8
Трансформатор человеко-читаемой таблицы энергосети в машинную модель.

Структура выходных данных:
  - Elements (слоты/позиции)
  - Devices (оборудование с P, Q, profile_id)
  - Network (граф связей)
  - Connections (линии с параметрами)
  - LoadProfiles (шаблон для будущих профилей)

Автор: Super Z
Версия: 8.0
"""

import re
import pandas as pd
from collections import defaultdict
from typing import Optional, Dict, List, Any

# ================================================================================
# НАСТРОЙКИ
# ================================================================================

INPUT_FILE = "input.xlsx"
SHEET_NAME = "Networkall"
OUTPUT_FILE = "network_model.xlsx"

# Маппинг состояний
STATE_MAP = {
    'Включен': 'ON',
    'Под напряжением': 'live',
    'Напряжение снято': 'dead',
    'Отключен': 'OFF',
    'В работе': 'OPERATING',
}

# Префиксы для Device ID по типу
DEVICE_PREFIXES = {
    'source': 'S',
    'breaker': 'B',
    'load': 'L',
    'meter': 'M',
}

# Префиксы кабелей для парсинга
CABLE_PREFIXES = [
    'АПвВнг', 'АПвБбШв', 'АПвБбШнг', 'АПвБбШп', 'АПвПу', 'АПвПуг',
    'АВБбШв', 'АВБбШнг', 'АВВГ', 'АВВГнг', 'АВВГнг-LS',
    'ВВГ', 'ВВГнг', 'ВВГнг-LS', 'ВБбШв', 'ВБбШнг',
    'ППГнг', 'ППГнг-FRHF', 'ПвБбШв', 'ПвВнг',
    'СБ', 'СБГ', 'СБл', 'ААБ', 'ААШв'
]

# ================================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ================================================================================

def clean_name(name: Optional[str]) -> Optional[str]:
    """Очистка названия от лишних пробелов и переносов строк."""
    if pd.isna(name):
        return None
    name = str(name).strip()
    name = re.sub(r'<br>', ' ', name)
    return ' '.join(name.split())


def extract_shield_code(name: str) -> str:
    """Извлечение кода щита/шкафа из названия."""
    if re.search(r'ГРЩ\s*1', name, re.I):
        return 'GRSCH1'
    if re.search(r'ГРЩ', name, re.I):
        return 'GRSCH'
    
    m = re.search(r'ТП\s*(\d+)', name, re.I)
    if m:
        return f'TP{m.group(1)}'
    
    m = re.search(r'ШП\s*(\d+)', name, re.I)
    if m:
        return f'SHP{m.group(1)}'
    
    if 'ППУ' in name:
        return 'PPU'
    if 'ДГУ' in name:
        return 'DGU'
    if 'ВРУ' in name:
        return 'VRU'
    if 'ЩР' in name:
        return 'SHR'
    
    return 'UNK'


def determine_type(name: str) -> str:
    """Определение типа элемента по названию."""
    if not name:
        return 'unknown'
    
    # Источники (трансформаторы)
    if re.match(r'^Т[1-4]\s+ТП', name):
        return 'source'
    
    # ДГУ как источник (но не выключатель ДГУ)
    if 'ДГУ' in name:
        if not re.search(r'\d?QF\d?', name) and 'Точрасп' not in name:
            return 'source'
    
    # Выключатели
    if re.search(r'\d?QF\d', name):
        return 'breaker'
    if re.search(r'QS\d?', name):
        return 'breaker'
    
    # Точки распределения
    if 'Точрасп' in name or 'Точка распределения' in name:
        return 'junction'
    
    # Узлы учета
    if 'Узел учета' in name or 'Узуч' in name:
        return 'meter'
    if 'счетчик' in name.lower() or 'Меркурий' in name or 'ART' in name:
        return 'meter'
    
    # Шины
    if re.search(r'\d+\s*с\.ш\.', name):
        return 'bus'
    if any(kw in name.lower() for kw in ['шина', 'магистраль', 'шинопровод']):
        return 'bus'
    
    return 'load'


def extract_qf_number(name: str) -> str:
    """Извлечение номера выключателя."""
    # 1QF, 2QF
    m = re.match(r'^(\d)QF', name)
    if m:
        return f"{int(m.group(1)):02d}"
    
    # QF1.2
    m = re.search(r'QF(\d+)\.(\d+)', name)
    if m:
        return f"{int(m.group(1)):02d}_{int(m.group(2)):02d}"
    
    # QF1
    m = re.search(r'QF(\d+)', name)
    if m:
        return f"{int(m.group(1)):02d}"
    
    # QS1
    m = re.search(r'QS(\d+)', name)
    if m:
        return f"QS{int(m.group(1)):02d}"
    
    return "00"


def extract_bus_number(name: str) -> str:
    """Извлечение номера секции шин."""
    m = re.search(r'(\d+)\s*с\.ш\.', name)
    return m.group(1) if m else '0'


def generate_slot_id(name: str, elem_type: str, shield: str, counters: dict) -> str:
    """Генерация стабильного slot ID."""
    
    if elem_type == 'source':
        m = re.match(r'^Т(\d+)\s+ТП', name)
        if m:
            return f"SRC_{shield}_T{m.group(1)}"
        if 'ДГУ' in name:
            counters['source_dgu'] = counters.get('source_dgu', 0) + 1
            return f"SRC_DGU_{counters['source_dgu']}"
        return f"SRC_{shield}"
    
    if elem_type == 'bus':
        bus_num = extract_bus_number(name)
        key = f'bus_{shield}_{bus_num}'
        if key in counters:
            counters[key] += 1
            return f"BUS_{shield}_{bus_num}_{counters[key]}"
        counters[key] = 0
        return f"BUS_{shield}_{bus_num}"
    
    if elem_type == 'breaker':
        qf_num = extract_qf_number(name)
        key = f'brk_{shield}_{qf_num}'
        if key in counters:
            counters[key] += 1
            return f"QF_{shield}_{qf_num}_{counters[key]}"
        counters[key] = 0
        return f"QF_{shield}_{qf_num}"
    
    if elem_type == 'junction':
        key = f'junction_{shield}'
        counters[key] = counters.get(key, 0) + 1
        return f"JNC_{shield}_{counters[key]:02d}"
    
    if elem_type == 'meter':
        key = f'meter_{shield}'
        counters[key] = counters.get(key, 0) + 1
        return f"MTR_{shield}_{counters[key]:02d}"
    
    # load
    counters['load'] = counters.get('load', 0) + 1
    return f"LOAD_{counters['load']:03d}"


# ================================================================================
# ПАРСИНГ СОЕДИНЕНИЙ
# ================================================================================

def parse_connection(conn_str: str) -> dict:
    """Парсинг описания соединения (кабель/шина)."""
    raw = str(conn_str).strip()
    
    result = {
        'type': 'line',
        'length': None,
        'wire_type': None,
        'core': None,
        'wire_size': None,
        'material': None,
        'raw_name': raw
    }
    
    lower = raw.lower()
    
    # Шины
    if any(kw in lower for kw in ['шина', 'шинопровод', 'магистраль']):
        result['type'] = 'busbar'
        result['length'] = 1.0
        result['material'] = 'Cu'
        return result
    
    result['type'] = 'cable'
    
    # Извлечение марки кабеля
    for prefix in CABLE_PREFIXES:
        if prefix in raw:
            pos = raw.find(prefix)
            wire_part = raw[pos:]
            
            # Обрезаем по L=
            cut = re.search(r'\s+L=', wire_part, re.IGNORECASE)
            if cut:
                wire_part = wire_part[:cut.start()].strip()
            
            # Обрезаем по сечению
            cut2 = re.search(r'\s+\d+[хx]', wire_part)
            if cut2:
                wire_part = wire_part[:cut2.start()].strip()
            
            result['wire_type'] = wire_part
            break
    
    # Fallback: ищем по шаблону
    if not result['wire_type']:
        m = re.search(r'([А-ЯA-Z]{2,}[а-яA-Za-z0-9]*(?:нг|LS|FRHF)?)', raw)
        if m:
            result['wire_type'] = m.group(1)
    
    # Количество жил и сечение: 4х240, 5х25
    m = re.search(r'(\d+)[хx](\d+(?:[,\.]\d+)?)', raw)
    if m:
        result['core'] = int(m.group(1))
        result['wire_size'] = m.group(2).replace(',', '.')
    
    # Длина: L=140 м
    m = re.search(r'L\s*=\s*(\d+(?:\.\d+)?)\s*м?', raw, re.I)
    if m:
        result['length'] = float(m.group(1))
    
    # Материал
    if raw.startswith('А') or 'АПв' in raw or 'АВ' in raw:
        result['material'] = 'Al'
    elif 'ППГ' in raw or 'Пв' in raw or 'ВВГ' in raw:
        result['material'] = 'Cu'
    
    return result


# ================================================================================
# ОСНОВНОЙ КЛАСС ТРАНСФОРМАТОРА
# ================================================================================

class NetworkModelBuilder:
    """Трансформатор человеко-читаемой таблицы в машинную модель."""
    
    def __init__(self, input_file: str, sheet_name: str = "Networkall"):
        self.input_file = input_file
        self.sheet_name = sheet_name
        
        self.elements: Dict[str, dict] = {}
        self.devices: Dict[str, dict] = {}
        self.network: List[dict] = []
        self.connections: Dict[tuple, dict] = {}
        
        self.name_to_slot: Dict[str, str] = {}
        self.counters: Dict[str, int] = {}
        self.device_counters: Dict[str, int] = {t: 0 for t in DEVICE_PREFIXES}
    
    def load_data(self) -> pd.DataFrame:
        """Загрузка исходных данных."""
        df = pd.read_excel(self.input_file, sheet_name=self.sheet_name)
        print(f"✓ Загружено {len(df)} строк из '{self.sheet_name}'")
        return df
    
    def build_elements(self, df: pd.DataFrame) -> None:
        """Построение Elements (слотов)."""
        for _, row in df.iterrows():
            from_name = clean_name(row.get('from'))
            to_raw = row.get('to', '')
            to_names = [clean_name(x) for x in str(to_raw).split('/')] if pd.notna(to_raw) else []
            
            all_names = [from_name] + [n for n in to_names if n]
            
            for name in all_names:
                if not name or name == 'nan' or name in self.name_to_slot:
                    continue
                
                elem_type = determine_type(name)
                shield = extract_shield_code(name)
                slot_id = generate_slot_id(name, elem_type, shield, self.counters)
                
                self.name_to_slot[name] = slot_id
                self.elements[slot_id] = {
                    'id': slot_id,
                    'type': elem_type,
                    'name': name,
                    'parent': None,
                    'device_id': None
                }
        
        print(f"✓ Elements: {len(self.elements)} слотов")
    
    def build_devices(self) -> None:
        """Построение Devices (оборудования)."""
        for slot_id, elem in self.elements.items():
            if elem['type'] not in DEVICE_PREFIXES:
                continue
            
            elem_type = elem['type']
            
            # Генерация Device ID
            self.device_counters[elem_type] += 1
            prefix = DEVICE_PREFIXES[elem_type]
            dev_id = f"DEV_{prefix}{self.device_counters[elem_type]:03d}"
            
            # Создание устройства
            device = {
                'id': dev_id,
                'type': elem_type,
                'model': elem['name'],
                # Электрические параметры (для нагрузок)
                'p_kw': None,
                'q_kvar': None,
                'voltage': None,
                'cos_phi': None,
                # Для выключателей
                'current_rated': None,
                'poles': None,
                'tripping_characteristic': None,
                'leakage_current': None,
                # Для профилей нагрузки
                'profile_id': None,
            }
            
            # Специфичные параметры
            if elem_type == 'source':
                device['voltage'] = 400  # 0.4 кВ
            elif elem_type == 'load':
                device['voltage'] = 230  # 230 В
            
            self.devices[dev_id] = device
            elem['device_id'] = dev_id
        
        print(f"✓ Devices: {len(self.devices)} устройств")
    
    def build_network(self, df: pd.DataFrame) -> None:
        """Построение Network (графа) и Connections."""
        conn_counter = 1
        
        for _, row in df.iterrows():
            from_name = clean_name(row.get('from'))
            to_raw = row.get('to', '')
            to_names = [clean_name(x) for x in str(to_raw).split('/')] if pd.notna(to_raw) else []
            conn_desc = clean_name(row.get('Connection', '')) or ''
            
            from_slot = self.name_to_slot.get(from_name)
            if not from_slot:
                continue
            
            for to_name in to_names:
                if not to_name or to_name == 'nan':
                    continue
                
                to_slot = self.name_to_slot.get(to_name)
                if not to_slot:
                    continue
                
                conn_info = parse_connection(conn_desc)
                conn_key = (from_slot, to_slot)
                
                if conn_key not in self.connections:
                    conn_id = f"C{conn_counter:03d}"
                    conn_counter += 1
                    self.connections[conn_key] = {
                        'id': conn_id,
                        'type': conn_info['type'],
                        'length': conn_info['length'],
                        'wire_type': conn_info['wire_type'],
                        'core': conn_info['core'],
                        'wire_size': conn_info['wire_size'],
                        'material': conn_info['material'],
                        'raw_name': conn_info['raw_name']
                    }
                
                self.network.append({
                    'from': from_slot,
                    'to': to_slot,
                    'connection_id': self.connections[conn_key]['id']
                })
        
        print(f"✓ Network: {len(self.network)} связей")
        print(f"✓ Connections: {len(self.connections)} соединений")
    
    def save(self, output_file: str) -> None:
        """Сохранение модели в Excel."""
        
        # Шаблон профилей нагрузки
        load_profiles = pd.DataFrame({
            'id': ['PROFILE_001', 'PROFILE_002'],
            'type': ['daily', 'constant'],
            'description': ['Суточный профиль нагрузки', 'Постоянная нагрузка']
        })
        
        with pd.ExcelWriter(output_file) as writer:
            pd.DataFrame(list(self.elements.values())).to_excel(
                writer, sheet_name="Elements", index=False
            )
            pd.DataFrame(list(self.devices.values())).to_excel(
                writer, sheet_name="Devices", index=False
            )
            pd.DataFrame(self.network).to_excel(
                writer, sheet_name="Network", index=False
            )
            pd.DataFrame(list(self.connections.values())).to_excel(
                writer, sheet_name="Connections", index=False
            )
            load_profiles.to_excel(
                writer, sheet_name="LoadProfiles", index=False
            )
        
        print(f"\n✅ Сохранено: {output_file}")
    
    def build(self, output_file: str) -> None:
        """Полный цикл построения модели."""
        print("="*60)
        print("NETWORK MODEL BUILDER v8")
        print("="*60)
        
        df = self.load_data()
        self.build_elements(df)
        self.build_devices()
        self.build_network(df)
        self.save(output_file)
        
        # Статистика
        self._print_stats()
    
    def _print_stats(self) -> None:
        """Вывод статистики."""
        print("\n" + "="*60)
        print("СТАТИСТИКА")
        print("="*60)
        
        type_counts = defaultdict(int)
        for e in self.elements.values():
            type_counts[e['type']] += 1
        
        print("\nElements по типам:")
        for t in ['source', 'bus', 'breaker', 'junction', 'meter', 'load']:
            print(f"  {t}: {type_counts[t]}")
        
        dev_type_counts = defaultdict(int)
        for d in self.devices.values():
            dev_type_counts[d['type']] += 1
        
        print("\nDevices по типам:")
        for t in ['source', 'breaker', 'load', 'meter']:
            prefix = DEVICE_PREFIXES[t]
            print(f"  {t}: {dev_type_counts[t]} (DEV_{prefix}xxx)")


# ================================================================================
# ТОЧКА ВХОДА
# ================================================================================

def main():
    """Главная функция."""
    builder = NetworkModelBuilder(INPUT_FILE, SHEET_NAME)
    builder.build(OUTPUT_FILE)


if __name__ == "__main__":
    main()
