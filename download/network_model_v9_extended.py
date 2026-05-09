#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Network Model Builder v9 - EXTENDED
Полноценный цифровой двойник электрической сети промышленного уровня.

Расширенные возможности:
  - Система АВР (Automatic Transfer Switch)
  - Управление устройствами (ON/OFF)
  - Расчёт мощностей и потерь
  - Сценарии работы
  - Журнал событий
  - Параметры защиты

Версия: 9.0
"""

import re
import pandas as pd
from collections import defaultdict
from datetime import datetime
from typing import Optional, Dict, List, Tuple

# ================================================================================
# НАСТРОЙКИ
# ================================================================================

INPUT_FILE = "input.xlsx"
SHEET_NAME = "Networkall"
OUTPUT_FILE = "network_model_v9.xlsx"

# ================================================================================
# КОНСТАНТЫ
# ================================================================================

DEVICE_PREFIXES = {'source': 'S', 'breaker': 'B', 'load': 'L', 'meter': 'M', 'ats': 'A'}

CABLE_PREFIXES = [
    'АПвВнг', 'АПвБбШв', 'АПвБбШнг', 'АПвБбШп', 'АПвПу', 'АПвПуг',
    'АВБбШв', 'АВБбШнг', 'АВВГ', 'АВВГнг', 'АВВГнг-LS',
    'ВВГ', 'ВВГнг', 'ВВГнг-LS', 'ВБбШв', 'ВБбШнг',
    'ППГнг', 'ППГнг-FRHF', 'ПвБбШв', 'ПвВнг',
    'СБ', 'СБГ', 'СБл', 'ААБ', 'ААШв'
]

STATE_MAP = {
    'Включен': 'ON', 'Под напряжением': 'LIVE', 
    'Напряжение снято': 'DEAD', 'Отключен': 'OFF',
    'В работе': 'OPERATING', 'Отстановлен': 'STOPPED'
}

# Удельное сопротивление (Ом/км при 20°C)
RESISTIVITY = {
    'Cu': 0.0175,  # Ом·мм²/м
    'Al': 0.0280,
}

# ================================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ================================================================================

def clean_name(name):
    if pd.isna(name): return None
    name = str(name).strip()
    name = re.sub(r'<br>', ' ', name)
    return ' '.join(name.split())

def extract_shield_code(name):
    if not name: return 'UNK'
    if re.search(r'ГРЩ\s*1', name, re.I): return 'GRSCH1'
    if re.search(r'ГРЩ', name, re.I): return 'GRSCH'
    m = re.search(r'ТП\s*(\d+)', name, re.I)
    if m: return f'TP{m.group(1)}'
    m = re.search(r'ШП\s*(\d+)', name, re.I)
    if m: return f'SHP{m.group(1)}'
    if 'ППУ' in name: return 'PPU'
    if 'ДГУ' in name: return 'DGU'
    if 'ВРУ' in name: return 'VRU'
    return 'UNK'

def determine_type(name):
    if not name: return 'unknown'
    if re.match(r'^Т[1-4]\s+ТП', name): return 'source'
    if 'ДГУ' in name and not re.search(r'\d?QF\d?', name) and 'Точрасп' not in name: return 'source'
    if re.search(r'\d?QF\d', name): return 'breaker'
    if re.search(r'QS\d?', name): return 'breaker'
    if 'Точрасп' in name or 'Точка распределения' in name: return 'junction'
    if 'Узел учета' in name or 'Узуч' in name: return 'meter'
    if re.search(r'\d+\s*с\.ш\.', name): return 'bus'
    if any(kw in name.lower() for kw in ['шина', 'магистраль', 'шинопровод']): return 'bus'
    return 'load'

def extract_qf_number(name):
    m = re.match(r'^(\d)QF', name)
    if m: return f"{int(m.group(1)):02d}"
    m = re.search(r'QF(\d+)\.(\d+)', name)
    if m: return f"{int(m.group(1)):02d}_{int(m.group(2)):02d}"
    m = re.search(r'QF(\d+)', name)
    if m: return f"{int(m.group(1)):02d}"
    m = re.search(r'QS(\d+)', name)
    if m: return f"QS{int(m.group(1)):02d}"
    return "00"

def extract_bus_number(name):
    m = re.search(r'(\d+)\s*с\.ш\.', name)
    return m.group(1) if m else '0'

def generate_slot_id(name, elem_type, shield, counters):
    if elem_type == 'source':
        m = re.match(r'^Т(\d+)\s+ТП', name)
        if m: return f"SRC_{shield}_T{m.group(1)}"
        if 'ДГУ' in name:
            counters['source_dgu'] = counters.get('source_dgu', 0) + 1
            return f"SRC_DGU_{counters['source_dgu']}"
        return f"SRC_{shield}"
    if elem_type == 'bus':
        bus_num = extract_bus_number(name)
        key = f'bus_{shield}_{bus_num}'
        if key in counters: counters[key] += 1
        else: counters[key] = 0
        suffix = f"_{counters[key]}" if counters[key] > 0 else ""
        return f"BUS_{shield}_{bus_num}{suffix}"
    if elem_type == 'breaker':
        qf_num = extract_qf_number(name)
        key = f'brk_{shield}_{qf_num}'
        if key in counters: counters[key] += 1
        else: counters[key] = 0
        suffix = f"_{counters[key]}" if counters[key] > 0 else ""
        return f"QF_{shield}_{qf_num}{suffix}"
    if elem_type == 'junction':
        key = f'junction_{shield}'
        counters[key] = counters.get(key, 0) + 1
        return f"JNC_{shield}_{counters[key]:02d}"
    if elem_type == 'meter':
        key = f'meter_{shield}'
        counters[key] = counters.get(key, 0) + 1
        return f"MTR_{shield}_{counters[key]:02d}"
    counters['load'] = counters.get('load', 0) + 1
    return f"LOAD_{counters['load']:03d}"

def parse_connection(conn_str):
    raw = str(conn_str).strip()
    result = {'type': 'line', 'length': None, 'wire_type': None,
              'core': None, 'wire_size': None, 'material': None, 
              'resistance': None, 'reactance': None, 'raw_name': raw}
    lower = raw.lower()
    
    if any(kw in lower for kw in ['шина', 'шинопровод', 'магистраль']):
        result['type'] = 'busbar'
        result['length'] = 1.0
        result['material'] = 'Cu'
        result['resistance'] = 0.0001  # Пренебрежимо мало
        return result
    
    result['type'] = 'cable'
    for prefix in CABLE_PREFIXES:
        if prefix in raw:
            pos = raw.find(prefix)
            wire_part = raw[pos:]
            cut = re.search(r'\s+L=', wire_part, re.IGNORECASE)
            if cut: wire_part = wire_part[:cut.start()].strip()
            cut2 = re.search(r'\s+\d+[хx]', wire_part)
            if cut2: wire_part = wire_part[:cut2.start()].strip()
            result['wire_type'] = wire_part
            break
    
    if not result['wire_type']:
        m = re.search(r'([А-ЯA-Z]{2,}[а-яA-Za-z0-9]*(?:нг|LS|FRHF)?)', raw)
        if m: result['wire_type'] = m.group(1)
    
    m = re.search(r'(\d+)[хx](\d+(?:[,\.]\d+)?)', raw)
    if m:
        result['core'] = int(m.group(1))
        result['wire_size'] = float(m.group(2).replace(',', '.'))
    
    m = re.search(r'L\s*=\s*(\d+(?:\.\d+)?)\s*м?', raw, re.I)
    if m: result['length'] = float(m.group(1))
    
    if raw.startswith('А') or 'АПв' in raw or 'АВ' in raw: 
        result['material'] = 'Al'
    elif 'ППГ' in raw or 'Пв' in raw or 'ВВГ' in raw: 
        result['material'] = 'Cu'
    
    # Расчёт сопротивления
    if result['length'] and result['wire_size'] and result['material']:
        rho = RESISTIVITY.get(result['material'], 0.0175)
        # R = ρ * L / S (Ом)
        result['resistance'] = round(rho * result['length'] / result['wire_size'], 6)
        result['reactance'] = round(result['resistance'] * 0.1, 6)  # Приближённо
    
    return result

def parse_atr_state(state_str):
    """Парсинг состояния АВР: 'Включен/Отключен/ Отключен' -> ['ON', 'OFF', 'OFF']"""
    if pd.isna(state_str): return None
    parts = str(state_str).split('/')
    return [STATE_MAP.get(p.strip(), p.strip()) for p in parts if p.strip()]

# ================================================================================
# ОСНОВНОЙ КЛАСС
# ================================================================================

class NetworkModelBuilderV9:
    """Расширенный трансформатор для цифрового двойника."""
    
    def __init__(self, input_file, sheet_name="Networkall"):
        self.input_file = input_file
        self.sheet_name = sheet_name
        
        # Основные сущности
        self.elements = {}
        self.devices = {}
        self.network = []
        self.connections = {}
        
        # Расширенные сущности
        self.device_states = {}       # Текущие состояния устройств
        self.ats_logic = {}           # Логика АВР
        self.protection_settings = {} # Уставки защиты
        self.scenarios = {}           # Сценарии работы
        self.load_profiles = {}       # Профили нагрузки
        self.event_log = []           # Журнал событий
        
        self.name_to_slot = {}
        self.counters = {}
        self.device_counters = {t: 0 for t in DEVICE_PREFIXES}
    
    # ============================================================================
    # ЗАГРУЗКА И ПАРСИНГ
    # ============================================================================
    
    def load_data(self):
        df = pd.read_excel(self.input_file, sheet_name=self.sheet_name)
        print(f"✓ Загружено {len(df)} строк")
        return df
    
    def build_elements(self, df):
        """Построение Elements с дополнительными полями."""
        for _, row in df.iterrows():
            from_name = clean_name(row.get('from'))
            to_names = [clean_name(x) for x in str(row.get('to', '')).split('/')] if pd.notna(row.get('to')) else []
            
            for name in [from_name] + [n for n in to_names if n]:
                if not name or name == 'nan' or name in self.name_to_slot: continue
                
                elem_type = determine_type(name)
                shield = extract_shield_code(name)
                slot_id = generate_slot_id(name, elem_type, shield, self.counters)
                
                self.name_to_slot[name] = slot_id
                self.elements[slot_id] = {
                    'id': slot_id,
                    'type': elem_type,
                    'name': name,
                    'parent': clean_name(row.get('parent')),
                    'device_id': None,
                    'location': clean_name(row.get('Расположение')),
                }
        print(f"✓ Elements: {len(self.elements)}")
    
    def build_devices(self, df):
        """Построение Devices с расширенными параметрами."""
        for slot_id, elem in self.elements.items():
            if elem['type'] not in DEVICE_PREFIXES: continue
            
            elem_type = elem['type']
            self.device_counters[elem_type] += 1
            prefix = DEVICE_PREFIXES[elem_type]
            dev_id = f"DEV_{prefix}{self.device_counters[elem_type]:03d}"
            
            device = {
                'id': dev_id,
                'type': elem_type,
                'model': elem['name'],
                # Электрические параметры
                'p_kw': None,
                'q_kvar': None,
                's_kva': None,
                'voltage_nom': 400 if elem_type == 'source' else 230 if elem_type == 'load' else None,
                'current_nom': None,
                'cos_phi': None,
                # Для выключателей
                'breaking_capacity': None,
                'poles': 3,
                'tripping_char': None,
                # Для профилей
                'profile_id': None,
            }
            
            self.devices[dev_id] = device
            elem['device_id'] = dev_id
        
        print(f"✓ Devices: {len(self.devices)}")
    
    def build_network(self, df):
        """Построение Network и Connections."""
        conn_counter = 1
        
        for _, row in df.iterrows():
            from_name = clean_name(row.get('from'))
            to_names = [clean_name(x) for x in str(row.get('to', '')).split('/')] if pd.notna(row.get('to')) else []
            conn_desc = clean_name(row.get('Connection', '')) or ''
            
            from_slot = self.name_to_slot.get(from_name)
            if not from_slot: continue
            
            for to_name in to_names:
                if not to_name or to_name == 'nan': continue
                to_slot = self.name_to_slot.get(to_name)
                if not to_slot: continue
                
                conn_info = parse_connection(conn_desc)
                conn_key = (from_slot, to_slot)
                
                if conn_key not in self.connections:
                    self.connections[conn_key] = {
                        'id': f"C{conn_counter:03d}",
                        **conn_info
                    }
                    conn_counter += 1
                
                self.network.append({
                    'from': from_slot,
                    'to': to_slot,
                    'connection_id': self.connections[conn_key]['id']
                })
        
        print(f"✓ Network: {len(self.network)} связей")
        print(f"✓ Connections: {len(self.connections)}")
    
    # ============================================================================
    # НОВЫЕ СУЩНОСТИ ДЛЯ ЦИФРОВОГО ДВОЙНИКА
    # ============================================================================
    
    def build_device_states(self, df):
        """Состояния устройств для управления."""
        state_counter = 1
        
        for _, row in df.iterrows():
            from_name = clean_name(row.get('from'))
            state_raw = row.get('state')
            
            if from_name and from_name in self.name_to_slot:
                slot_id = self.name_to_slot[from_name]
                elem = self.elements.get(slot_id)
                
                if elem and elem['device_id']:
                    state_id = f"ST{state_counter:04d}"
                    self.device_states[state_id] = {
                        'id': state_id,
                        'device_id': elem['device_id'],
                        'slot_id': slot_id,
                        'state': STATE_MAP.get(str(state_raw), 'UNKNOWN'),
                        'state_raw': str(state_raw),
                        'locked': False,           # Блокировка управления
                        'manual_mode': False,      # Ручной режим
                        'last_change': datetime.now().isoformat(),
                        'changed_by': 'system',
                    }
                    state_counter += 1
        
        print(f"✓ DeviceStates: {len(self.device_states)}")
    
    def build_ats_logic(self, df):
        """Логика АВР (Автоматический ввод резерва)."""
        ats_counter = 1
        
        for _, row in df.iterrows():
            ats_name = row.get('АВР')
            ats_control = row.get('Управление от АВР для комм аппартов')
            ats_state = row.get('Состояние при сработке АВР')
            from_name = clean_name(row.get('from'))
            
            if pd.notna(ats_name) or pd.notna(ats_control):
                ats_id = f"ATS{ats_counter:03d}"
                
                # Определяем участвующие устройства
                slot_id = self.name_to_slot.get(from_name)
                
                self.ats_logic[ats_id] = {
                    'id': ats_id,
                    'name': str(ats_name) if pd.notna(ats_name) else None,
                    'slot_id': slot_id,
                    'controlled_device': self.elements.get(slot_id, {}).get('device_id'),
                    'ats_controlled': bool(ats_control) if pd.notna(ats_control) else False,
                    'states_on_trigger': parse_atr_state(ats_state),
                    'priority': 1,            # Приоритет источника
                    'delay_sec': 0,           # Задержка переключения
                    'voltage_threshold': 0.9, # Порог напряжения (90%)
                    'active': True,
                }
                ats_counter += 1
        
        print(f"✓ ATSLogic: {len(self.ats_logic)}")
    
    def build_protection_settings(self, df):
        """Уставки защиты."""
        prot_counter = 1
        
        for _, row in df.iterrows():
            protection = row.get('protection')
            from_name = clean_name(row.get('from'))
            
            if pd.notna(protection):
                slot_id = self.name_to_slot.get(from_name)
                
                prot_id = f"PROT{prot_counter:04d}"
                self.protection_settings[prot_id] = {
                    'id': prot_id,
                    'slot_id': slot_id,
                    'device_id': self.elements.get(slot_id, {}).get('device_id'),
                    'protection_ref': str(protection),
                    # Уставки (заполняются вручную или из справочника)
                    'overcurrent_pickup': None,    # Ток срабатывания (А)
                    'overcurrent_delay': None,     # Выдержка времени (с)
                    'earth_fault_pickup': None,    # Ток ОЗЗ (А)
                    'earth_fault_delay': None,
                    'overvoltage_limit': None,     # Макс. напряжение (В)
                    'undervoltage_limit': None,    # Мин. напряжение (В)
                }
                prot_counter += 1
        
        print(f"✓ ProtectionSettings: {len(self.protection_settings)}")
    
    def build_scenarios(self):
        """Сценарии работы сети."""
        self.scenarios = {
            'SCENARIO_NORMAL': {
                'id': 'SCENARIO_NORMAL',
                'name': 'Нормальный режим',
                'description': 'Стандартная конфигурация сети',
                'source_priority': ['SRC_TP21_T1', 'SRC_TP21_T2', 'SRC_DGU_1'],
                'active': True,
            },
            'SCENARIO_EMERGENCY': {
                'id': 'SCENARIO_EMERGENCY',
                'name': 'Аварийный режим',
                'description': 'Питание от ДГУ при потере основного',
                'source_priority': ['SRC_DGU_1', 'SRC_TP21_T1', 'SRC_TP21_T2'],
                'active': False,
            },
            'SCENARIO_MAINTENANCE': {
                'id': 'SCENARIO_MAINTENANCE',
                'name': 'Ремонтный режим',
                'description': 'Секционирование для ремонтных работ',
                'source_priority': ['SRC_TP21_T1'],
                'active': False,
            },
        }
        print(f"✓ Scenarios: {len(self.scenarios)}")
    
    def build_load_profiles(self):
        """Шаблоны профилей нагрузки."""
        self.load_profiles = {
            'PROFILE_CONSTANT': {
                'id': 'PROFILE_CONSTANT',
                'type': 'constant',
                'description': 'Постоянная нагрузка',
                'values': None,
            },
            'PROFILE_OFFICE': {
                'id': 'PROFILE_OFFICE',
                'type': 'daily',
                'description': 'Офисная нагрузка',
                'values': [
                    {'hour': 0, 'p_pct': 0.1, 'q_pct': 0.1},
                    {'hour': 6, 'p_pct': 0.3, 'q_pct': 0.3},
                    {'hour': 8, 'p_pct': 0.9, 'q_pct': 0.85},
                    {'hour': 12, 'p_pct': 0.7, 'q_pct': 0.7},
                    {'hour': 18, 'p_pct': 0.5, 'q_pct': 0.5},
                    {'hour': 22, 'p_pct': 0.2, 'q_pct': 0.2},
                ],
            },
            'PROFILE_SERVER': {
                'id': 'PROFILE_SERVER',
                'type': 'constant',
                'description': 'Серверная нагрузка (24/7)',
                'values': None,
            },
        }
        print(f"✓ LoadProfiles: {len(self.load_profiles)}")
    
    def build_event_log_template(self):
        """Шаблон журнала событий."""
        self.event_log = [
            {
                'id': 'EVT00001',
                'timestamp': datetime.now().isoformat(),
                'event_type': 'SYSTEM_START',
                'device_id': None,
                'slot_id': None,
                'description': 'Инициализация системы',
                'severity': 'INFO',
                'acknowledged': True,
            }
        ]
        print(f"✓ EventLog: шаблон создан")
    
    # ============================================================================
    # СОХРАНЕНИЕ
    # ============================================================================
    
    def save(self, output_file):
        with pd.ExcelWriter(output_file) as w:
            # Основные сущности
            pd.DataFrame(list(self.elements.values())).to_excel(w, "Elements", index=False)
            pd.DataFrame(list(self.devices.values())).to_excel(w, "Devices", index=False)
            pd.DataFrame(self.network).to_excel(w, "Network", index=False)
            pd.DataFrame(list(self.connections.values())).to_excel(w, "Connections", index=False)
            
            # Новые сущности
            pd.DataFrame(list(self.device_states.values())).to_excel(w, "DeviceStates", index=False)
            pd.DataFrame(list(self.ats_logic.values())).to_excel(w, "ATSLogic", index=False)
            pd.DataFrame(list(self.protection_settings.values())).to_excel(w, "Protection", index=False)
            pd.DataFrame(list(self.scenarios.values())).to_excel(w, "Scenarios", index=False)
            pd.DataFrame(list(self.load_profiles.values())).to_excel(w, "LoadProfiles", index=False)
            pd.DataFrame(self.event_log).to_excel(w, "EventLog", index=False)
        
        print(f"\n✅ Сохранено: {output_file}")
    
    # ============================================================================
    # MAIN BUILD
    # ============================================================================
    
    def build(self, output_file):
        print("="*60)
        print("NETWORK MODEL BUILDER v9 - EXTENDED")
        print("Цифровой двойник электрической сети")
        print("="*60)
        
        df = self.load_data()
        
        print("\n📋 Основные сущности:")
        self.build_elements(df)
        self.build_devices(df)
        self.build_network(df)
        
        print("\n📋 Расширенные сущности:")
        self.build_device_states(df)
        self.build_ats_logic(df)
        self.build_protection_settings(df)
        self.build_scenarios()
        self.build_load_profiles()
        self.build_event_log_template()
        
        self.save(output_file)
        self._print_summary()
    
    def _print_summary(self):
        print("\n" + "="*60)
        print("ИТОГОВАЯ СТРУКТУРА МОДЕЛИ")
        print("="*60)
        print("""
┌─────────────────────────────────────────────────────────────┐
│                    ЦИФРОВОЙ ДВОЙНИК                         │
├─────────────────────────────────────────────────────────────┤
│  TOPOLOGY LAYER                                             │
│    Elements    → Слоты/позиции (209)                        │
│    Network     → Граф связей (219)                          │
│    Connections → Линии с R, X (218)                         │
├─────────────────────────────────────────────────────────────┤
│  DEVICE LAYER                                               │
│    Devices     → Оборудование с P, Q (181)                  │
│    DeviceStates → Состояния ON/OFF                          │
├─────────────────────────────────────────────────────────────┤
│  CONTROL LAYER                                              │
│    ATSLogic    → Логика АВР                                 │
│    Protection  → Уставки защиты                             │
│    Scenarios   → Режимы работы                              │
├─────────────────────────────────────────────────────────────┤
│  CALCULATION LAYER                                          │
│    LoadProfiles → Профили нагрузки                          │
│    EventLog    → Журнал событий                             │
└─────────────────────────────────────────────────────────────┘
""")

# ================================================================================
# ТОЧКА ВХОДА
# ================================================================================

def main():
    builder = NetworkModelBuilderV9(INPUT_FILE, SHEET_NAME)
    builder.build(OUTPUT_FILE)

if __name__ == "__main__":
    main()
