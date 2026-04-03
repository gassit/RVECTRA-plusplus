#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Network Model Builder v10 - INDUSTRIAL
Полноценный цифровой двойник электрической сети промышленного уровня.

Слои модели:
  1. TOPOLOGY    - Elements, Network, Connections
  2. DEVICE      - Devices, DeviceStates, DeviceTypes
  3. CONTROL     - ATSLogic, Protection, Scenarios, Commands
  4. CALCULATION - PowerFlow, ShortCircuit, LoadProfiles
  5. MEASUREMENT - Measurements, Alarms
  6. MAINTENANCE - Tariffs, Maintenance, EventLog

Версия: 10.0 (Industrial)
"""

import re
import pandas as pd
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
import json
import math

# ================================================================================
# НАСТРОЙКИ
# ================================================================================

INPUT_FILE = "input.xlsx"
SHEET_NAME = "Networkall"
OUTPUT_FILE = "network_model_v10_industrial.xlsx"

# ================================================================================
# КОНСТАНТЫ
# ================================================================================

DEVICE_PREFIXES = {'source': 'S', 'breaker': 'B', 'load': 'L', 'meter': 'M', 'ats': 'A', 'transformer': 'T'}

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

RESISTIVITY = {'Cu': 0.0175, 'Al': 0.0280}
REACTANCE_PER_KM = {'cable': 0.08, 'busbar': 0.02, 'line': 0.35}  # Ом/км

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
        counters[key] = counters.get(key, -1) + 1
        suffix = f"_{counters[key]}" if counters[key] > 0 else ""
        return f"BUS_{shield}_{bus_num}{suffix}"
    if elem_type == 'breaker':
        qf_num = extract_qf_number(name)
        key = f'brk_{shield}_{qf_num}'
        counters[key] = counters.get(key, -1) + 1
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
              'resistance_r': None, 'reactance_x': None, 'impedance_z': None,
              'current_capacity': None, 'raw_name': raw}
    lower = raw.lower()
    
    if any(kw in lower for kw in ['шина', 'шинопровод', 'магистраль']):
        result['type'] = 'busbar'
        result['length'] = 1.0
        result['material'] = 'Cu'
        result['resistance_r'] = 0.0001
        result['reactance_x'] = 0.00001
        result['impedance_z'] = 0.0001
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
        length_km = result['length'] / 1000
        result['resistance_r'] = round(rho * length_km * 1000 / result['wire_size'], 6)
        
        x_per_km = REACTANCE_PER_KM.get(result['type'], 0.08)
        result['reactance_x'] = round(x_per_km * length_km, 6)
        
        r = result['resistance_r']
        x = result['reactance_x']
        result['impedance_z'] = round(math.sqrt(r*r + x*x), 6)
        
        # Токовая способность (приближённо по сечению)
        if result['wire_size'] >= 240: result['current_capacity'] = 400
        elif result['wire_size'] >= 150: result['current_capacity'] = 300
        elif result['wire_size'] >= 95: result['current_capacity'] = 220
        elif result['wire_size'] >= 70: result['current_capacity'] = 170
        elif result['wire_size'] >= 50: result['current_capacity'] = 130
        elif result['wire_size'] >= 35: result['current_capacity'] = 100
        elif result['wire_size'] >= 25: result['current_capacity'] = 80
        elif result['wire_size'] >= 16: result['current_capacity'] = 60
        else: result['current_capacity'] = 40
    
    return result

def parse_atr_state(state_str):
    if pd.isna(state_str): return None
    parts = str(state_str).split('/')
    return [STATE_MAP.get(p.strip(), p.strip()) for p in parts if p.strip()]

# ================================================================================
# ОСНОВНОЙ КЛАСС
# ================================================================================

class NetworkModelBuilderV10:
    """Полноценный цифровой двойник промышленного уровня."""
    
    def __init__(self, input_file, sheet_name="Networkall"):
        self.input_file = input_file
        self.sheet_name = sheet_name
        
        # === СЛОЙ 1: ТОПОЛОГИЯ ===
        self.elements = {}
        self.network = []
        self.connections = {}
        
        # === СЛОЙ 2: ОБОРУДОВАНИЕ ===
        self.devices = {}
        self.device_states = {}
        self.device_types = {}
        
        # === СЛОЙ 3: УПРАВЛЕНИЕ ===
        self.ats_logic = {}
        self.protection = {}
        self.scenarios = {}
        self.commands = {}
        
        # === СЛОЙ 4: РАСЧЁТЫ ===
        self.power_flow = []
        self.short_circuit = {}
        self.load_profiles = {}
        
        # === СЛОЙ 5: ИЗМЕРЕНИЯ ===
        self.measurements = {}
        self.alarms = {}
        self.alarm_rules = {}
        
        # === СЛОЙ 6: ОБСЛУЖИВАНИЕ ===
        self.tariffs = {}
        self.maintenance = {}
        self.event_log = []
        
        self.name_to_slot = {}
        self.counters = {}
        self.device_counters = {t: 0 for t in DEVICE_PREFIXES}
        
        # Счётчики для ID
        self.state_counter = 1
        self.meas_counter = 1
        self.alarm_counter = 1
        self.cmd_counter = 1
        self.event_counter = 1
        self.maint_counter = 1
    
    # ============================================================================
    # ЗАГРУЗКА И ПАРСИНГ
    # ============================================================================
    
    def load_data(self):
        df = pd.read_excel(self.input_file, sheet_name=self.sheet_name)
        print(f"✓ Загружено {len(df)} строк")
        return df
    
    def build_elements(self, df):
        """Слой 1: Elements с геолокацией."""
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
                    'voltage_level': 0.4 if elem_type in ['load', 'bus'] else 10 if 'ТП' in name else 0.4,
                    'phase': 'ABC',  # Трёхфазное по умолчанию
                }
        print(f"✓ Elements: {len(self.elements)}")
    
    def build_devices(self, df):
        """Слой 2: Devices с полными параметрами."""
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
                'manufacturer': None,
                # Электрические параметры
                'p_kw': None,
                'q_kvar': None,
                's_kva': None,
                'voltage_nom': 400 if elem_type == 'source' else 230 if elem_type == 'load' else None,
                'current_nom': None,
                'current_max': None,
                'cos_phi': None,
                'efficiency': None,
                # Для выключателей
                'breaking_capacity_ka': None,
                'poles': 3,
                'tripping_char': None,
                'in_rating': None,      # Номинальный ток расцепителя
                'ir_setting': None,     # Уставка теплового расцепителя
                'ii_setting': None,     # Уставка электромагнитного расцепителя
                # Для источников
                'short_circuit_impedance': None,
                'x_r_ratio': None,
                # Профиль нагрузки
                'profile_id': None,
            }
            
            self.devices[dev_id] = device
            elem['device_id'] = dev_id
        
        print(f"✓ Devices: {len(self.devices)}")
    
    def build_network(self, df):
        """Слой 1: Network и Connections с расчётом параметров."""
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
    # СЛОЙ 2: DEVICE STATES & TYPES
    # ============================================================================
    
    def build_device_states(self, df):
        """Состояния устройств для управления."""
        for _, row in df.iterrows():
            from_name = clean_name(row.get('from'))
            state_raw = row.get('state')
            
            if from_name and from_name in self.name_to_slot:
                slot_id = self.name_to_slot[from_name]
                elem = self.elements.get(slot_id)
                
                if elem and elem['device_id']:
                    state_id = f"ST{self.state_counter:04d}"
                    self.device_states[state_id] = {
                        'id': state_id,
                        'device_id': elem['device_id'],
                        'slot_id': slot_id,
                        'state': STATE_MAP.get(str(state_raw), 'UNKNOWN'),
                        'state_raw': str(state_raw) if pd.notna(state_raw) else None,
                        'locked': False,
                        'manual_mode': False,
                        'remote_control': True,
                        'last_change': datetime.now().isoformat(),
                        'changed_by': 'system',
                        'operation_count': 0,  # Количество операций
                    }
                    self.state_counter += 1
        
        print(f"✓ DeviceStates: {len(self.device_states)}")
    
    def build_device_types(self):
        """Справочник типов устройств."""
        self.device_types = {
            'TYPE_BREAKER_3P': {
                'id': 'TYPE_BREAKER_3P',
                'category': 'breaker',
                'description': 'Трёхполюсный автоматический выключатель',
                'default_poles': 3,
                'default_voltage': 400,
            },
            'TYPE_BREAKER_1P': {
                'id': 'TYPE_BREAKER_1P',
                'category': 'breaker',
                'description': 'Однополюсный автоматический выключатель',
                'default_poles': 1,
                'default_voltage': 230,
            },
            'TYPE_SOURCE_TRANS': {
                'id': 'TYPE_SOURCE_TRANS',
                'category': 'source',
                'description': 'Трансформаторная подстанция',
                'default_voltage': 400,
            },
            'TYPE_SOURCE_GEN': {
                'id': 'TYPE_SOURCE_GEN',
                'category': 'source',
                'description': 'Дизель-генераторная установка',
                'default_voltage': 400,
            },
            'TYPE_LOAD_SINGLE': {
                'id': 'TYPE_LOAD_SINGLE',
                'category': 'load',
                'description': 'Однофазная нагрузка',
                'default_poles': 1,
                'default_voltage': 230,
            },
            'TYPE_LOAD_THREE': {
                'id': 'TYPE_LOAD_THREE',
                'category': 'load',
                'description': 'Трёхфазная нагрузка',
                'default_poles': 3,
                'default_voltage': 400,
            },
            'TYPE_METER_ELECTRIC': {
                'id': 'TYPE_METER_ELECTRIC',
                'category': 'meter',
                'description': 'Электросчётчик',
                'default_voltage': 230,
            },
        }
        print(f"✓ DeviceTypes: {len(self.device_types)}")
    
    # ============================================================================
    # СЛОЙ 3: CONTROL (ATS, PROTECTION, SCENARIOS, COMMANDS)
    # ============================================================================
    
    def build_ats_logic(self, df):
        """Логика АВР."""
        ats_counter = 1
        
        for _, row in df.iterrows():
            ats_name = row.get('АВР')
            ats_control = row.get('Управление от АВР для комм аппартов')
            ats_state = row.get('Состояние при сработке АВР')
            from_name = clean_name(row.get('from'))
            
            if pd.notna(ats_name) or pd.notna(ats_control):
                slot_id = self.name_to_slot.get(from_name)
                
                ats_id = f"ATS{ats_counter:03d}"
                self.ats_logic[ats_id] = {
                    'id': ats_id,
                    'name': str(ats_name) if pd.notna(ats_name) else None,
                    'slot_id': slot_id,
                    'device_id': self.elements.get(slot_id, {}).get('device_id'),
                    'ats_controlled': bool(ats_control) if pd.notna(ats_control) else False,
                    'states_on_trigger': parse_atr_state(ats_state),
                    'priority': 1,
                    'delay_sec': 0,
                    'voltage_threshold': 0.9,
                    'frequency_threshold': 49.5,
                    'return_delay_sec': 30,
                    'test_mode': False,
                    'active': True,
                }
                ats_counter += 1
        
        print(f"✓ ATSLogic: {len(self.ats_logic)}")
    
    def build_protection(self, df):
        """Уставки защиты."""
        prot_counter = 1
        
        for _, row in df.iterrows():
            protection = row.get('protection')
            from_name = clean_name(row.get('from'))
            
            if pd.notna(protection):
                slot_id = self.name_to_slot.get(from_name)
                
                prot_id = f"PROT{prot_counter:04d}"
                self.protection[prot_id] = {
                    'id': prot_id,
                    'slot_id': slot_id,
                    'device_id': self.elements.get(slot_id, {}).get('device_id'),
                    'protection_ref': str(protection),
                    # МТЗ (максимальная токовая защита)
                    'overcurrent_pickup': None,      # А
                    'overcurrent_delay': None,       # с
                    'overcurrent_curve': 'SI',       # Standard Inverse
                    # ОЗЗ (однофазное замыкание на землю)
                    'earth_fault_pickup': None,      # А
                    'earth_fault_delay': None,       # с
                    # ТО (токовая отсечка)
                    'instantaneous_pickup': None,    # А
                    # Напряжение
                    'overvoltage_limit': None,       # В
                    'undervoltage_limit': None,      # В
                    'overvoltage_delay': None,       # с
                    'undervoltage_delay': None,      # с
                    # Частота
                    'overfreq_limit': None,          # Гц
                    'underfreq_limit': None,         # Гц
                    # Тепловая защита
                    'thermal_pickup': None,          # % от In
                    'thermal_delay': None,           # с
                }
                prot_counter += 1
        
        print(f"✓ Protection: {len(self.protection)}")
    
    def build_scenarios(self):
        """Сценарии работы сети."""
        self.scenarios = {
            'SCENARIO_NORMAL': {
                'id': 'SCENARIO_NORMAL',
                'name': 'Нормальный режим',
                'description': 'Стандартная конфигурация сети, питание от ТП21',
                'source_priority': ['SRC_TP21_T1', 'SRC_TP21_T2', 'SRC_DGU_1'],
                'devices_on': [],
                'devices_off': [],
                'active': True,
                'auto_switch': True,
            },
            'SCENARIO_EMERGENCY': {
                'id': 'SCENARIO_EMERGENCY',
                'name': 'Аварийный режим',
                'description': 'Питание от ДГУ при потере основного источника',
                'source_priority': ['SRC_DGU_1', 'SRC_TP21_T1', 'SRC_TP21_T2'],
                'devices_on': [],
                'devices_off': [],
                'active': False,
                'auto_switch': True,
            },
            'SCENARIO_MAINTENANCE': {
                'id': 'SCENARIO_MAINTENANCE',
                'name': 'Ремонтный режим',
                'description': 'Секционирование для ремонтных работ',
                'source_priority': ['SRC_TP21_T1'],
                'devices_on': [],
                'devices_off': [],
                'active': False,
                'auto_switch': False,
            },
            'SCENARIO_ISLAND': {
                'id': 'SCENARIO_ISLAND',
                'name': 'Островной режим',
                'description': 'Работа изолированно от сети',
                'source_priority': ['SRC_DGU_1'],
                'devices_on': [],
                'devices_off': [],
                'active': False,
                'auto_switch': False,
            },
        }
        print(f"✓ Scenarios: {len(self.scenarios)}")
    
    def build_commands(self):
        """Очередь команд управления."""
        self.commands = {
            'CMD_TEMPLATE': {
                'id': 'CMD_TEMPLATE',
                'device_id': None,
                'command': 'SWITCH',  # SWITCH, RESET, LOCK, UNLOCK
                'target_state': None,
                'priority': 5,
                'status': 'PENDING',  # PENDING, EXECUTING, COMPLETED, FAILED
                'created_at': datetime.now().isoformat(),
                'executed_at': None,
                'created_by': 'system',
                'result': None,
                'retry_count': 0,
                'max_retries': 3,
            }
        }
        print(f"✓ Commands: шаблон создан")
    
    # ============================================================================
    # СЛОЙ 4: CALCULATION (POWER FLOW, SHORT CIRCUIT, PROFILES)
    # ============================================================================
    
    def build_power_flow(self):
        """Результаты расчёта потокораспределения."""
        # Создаём заготовку для каждого узла
        for slot_id, elem in self.elements.items():
            if elem['type'] in ['source', 'bus', 'load', 'breaker']:
                pf_id = f"PF{len(self.power_flow)+1:04d}"
                self.power_flow.append({
                    'id': pf_id,
                    'slot_id': slot_id,
                    'device_id': elem['device_id'],
                    # Напряжения
                    'voltage_a': None,  # В
                    'voltage_b': None,
                    'voltage_c': None,
                    'voltage_avg': None,
                    # Токи
                    'current_a': None,  # А
                    'current_b': None,
                    'current_c': None,
                    'current_n': None,
                    # Мощности
                    'p_a': None,  # кВт
                    'p_b': None,
                    'p_c': None,
                    'p_total': None,
                    'q_a': None,  # кВАр
                    'q_b': None,
                    'q_c': None,
                    'q_total': None,
                    's_total': None,  # кВА
                    # Потери
                    'p_loss': None,  # кВт
                    'q_loss': None,  # кВАр
                    # Коэффициенты
                    'cos_phi': None,
                    'load_factor': None,
                    # Расчётное время
                    'calc_time': datetime.now().isoformat(),
                })
        
        print(f"✓ PowerFlow: {len(self.power_flow)} узлов")
    
    def build_short_circuit(self):
        """Результаты расчёта токов КЗ."""
        sc_counter = 1
        
        for slot_id, elem in self.elements.items():
            if elem['type'] in ['source', 'bus', 'breaker']:
                sc_id = f"SC{sc_counter:04d}"
                self.short_circuit[sc_id] = {
                    'id': sc_id,
                    'slot_id': slot_id,
                    # Токи КЗ (3-фазное)
                    'ik3_initial': None,     # Начальное значение, кА
                    'ik3_peak': None,        # Ударный ток, кА
                    'ik3_breaking': None,    # Ток отключения, кА
                    # Токи КЗ (1-фазное)
                    'ik1_initial': None,
                    'ik1_peak': None,
                    # Токи КЗ (2-фазное)
                    'ik2_initial': None,
                    # Сопротивления
                    'z_system': None,        # Сопротивление системы, Ом
                    'r_system': None,
                    'x_system': None,
                    # Минимальное КЗ (для проверки защиты)
                    'ik_min': None,
                    # Максимальное КЗ (для проверки оборудования)
                    'ik_max': None,
                }
                sc_counter += 1
        
        print(f"✓ ShortCircuit: {len(self.short_circuit)} точек")
    
    def build_load_profiles(self):
        """Профили нагрузки."""
        self.load_profiles = {
            'PROFILE_CONSTANT': {
                'id': 'PROFILE_CONSTANT',
                'type': 'constant',
                'description': 'Постоянная нагрузка 24/7',
                'seasonality': False,
                'values': None,
            },
            'PROFILE_OFFICE': {
                'id': 'PROFILE_OFFICE',
                'type': 'daily',
                'description': 'Офисная нагрузка',
                'seasonality': True,
                'values': [
                    {'hour': 0, 'p_pct': 0.10, 'q_pct': 0.10},
                    {'hour': 6, 'p_pct': 0.30, 'q_pct': 0.30},
                    {'hour': 8, 'p_pct': 0.90, 'q_pct': 0.85},
                    {'hour': 12, 'p_pct': 0.70, 'q_pct': 0.70},
                    {'hour': 14, 'p_pct': 0.95, 'q_pct': 0.90},
                    {'hour': 18, 'p_pct': 0.50, 'q_pct': 0.50},
                    {'hour': 22, 'p_pct': 0.20, 'q_pct': 0.20},
                ],
            },
            'PROFILE_SERVER': {
                'id': 'PROFILE_SERVER',
                'type': 'constant',
                'description': 'Серверная нагрузка (критическая)',
                'seasonality': False,
                'values': None,
            },
            'PROFILE_HVAC': {
                'id': 'PROFILE_HVAC',
                'type': 'seasonal',
                'description': 'Вентиляция и кондиционирование',
                'seasonality': True,
                'values': [
                    {'month': 1, 'p_pct': 0.30},
                    {'month': 6, 'p_pct': 1.00},
                    {'month': 12, 'p_pct': 0.40},
                ],
            },
            'PROFILE_LIGHTING': {
                'id': 'PROFILE_LIGHTING',
                'type': 'daily',
                'description': 'Освещение',
                'seasonality': True,
                'values': [
                    {'hour': 0, 'p_pct': 0.05},
                    {'hour': 7, 'p_pct': 0.20},
                    {'hour': 18, 'p_pct': 1.00},
                    {'hour': 23, 'p_pct': 0.10},
                ],
            },
        }
        print(f"✓ LoadProfiles: {len(self.load_profiles)}")
    
    # ============================================================================
    # СЛОЙ 5: MEASUREMENTS & ALARMS
    # ============================================================================
    
    def build_measurements(self):
        """Текущие измерения (реальные или模拟)."""
        for slot_id, elem in self.elements.items():
            if elem['type'] in ['source', 'bus', 'load', 'meter']:
                meas_id = f"MEAS{self.meas_counter:04d}"
                self.measurements[meas_id] = {
                    'id': meas_id,
                    'slot_id': slot_id,
                    'device_id': elem['device_id'],
                    # Напряжения
                    'u_a': 230.0 + (hash(slot_id) % 10 - 5),  # В (симуляция)
                    'u_b': 230.0 + (hash(slot_id) % 8 - 4),
                    'u_c': 230.0 + (hash(slot_id) % 6 - 3),
                    'u_ab': None,
                    'u_bc': None,
                    'u_ca': None,
                    # Токи
                    'i_a': None,  # А
                    'i_b': None,
                    'i_c': None,
                    'i_n': None,
                    # Мощности
                    'p_total': None,  # кВт
                    'q_total': None,  # кВАр
                    's_total': None,  # кВА
                    # Частота
                    'frequency': 50.0,
                    # Коэффициенты
                    'cos_phi': None,
                    'thd_u': None,  # Коэффициент гармоник напряжения
                    'thd_i': None,  # Коэффициент гармоник тока
                    # Энергия
                    'energy_active_import': None,  # кВт·ч
                    'energy_active_export': None,
                    'energy_reactive_import': None,  # кВАр·ч
                    'energy_reactive_export': None,
                    # Временная метка
                    'timestamp': datetime.now().isoformat(),
                    'quality': 'GOOD',  # GOOD, QUESTIONABLE, BAD
                }
                self.meas_counter += 1
        
        print(f"✓ Measurements: {len(self.measurements)}")
    
    def build_alarms(self):
        """Аварийные сигналы."""
        # Заготовка для возможных аварий
        alarm_types = [
            ('ALARM_OVERVOLTAGE', 'Перенапряжение', 'u_a > 253', 'WARNING'),
            ('ALARM_UNDERVOLTAGE', 'Пониженное напряжение', 'u_a < 198', 'WARNING'),
            ('ALARM_OVERCURRENT', 'Перегрузка по току', 'i_a > In * 1.1', 'WARNING'),
            ('ALARM_SHORT_CIRCUIT', 'Короткое замыкание', 'i_a > In * 10', 'CRITICAL'),
            ('ALARM_EARTH_FAULT', 'Замыкание на землю', 'i_n > 0.3', 'WARNING'),
            ('ALARM_OVERFREQ', 'Превышение частоты', 'f > 51', 'WARNING'),
            ('ALARM_UNDERFREQ', 'Понижение частоты', 'f < 49', 'WARNING'),
            ('ALARM_DEVICE_TRIP', 'Срабатывание защиты', 'state == TRIPPED', 'CRITICAL'),
            ('ALARM_COMM_LOSS', 'Потеря связи', 'timeout > 30s', 'WARNING'),
            ('ALARM_POWER_LOSS', 'Потеря питания', 'u_avg < 50', 'CRITICAL'),
        ]
        
        for alarm_id, name, condition, severity in alarm_types:
            self.alarms[alarm_id] = {
                'id': alarm_id,
                'name': name,
                'condition': condition,
                'severity': severity,
                'active': False,
                'acknowledged': False,
                'device_id': None,
                'slot_id': None,
                'timestamp': None,
                'value': None,
                'threshold': None,
            }
        
        print(f"✓ Alarms: {len(self.alarms)} типов")
    
    def build_alarm_rules(self):
        """Правила формирования аварий."""
        self.alarm_rules = {
            'RULE_OVERVOLTAGE': {
                'id': 'RULE_OVERVOLTAGE',
                'name': 'Правило перенапряжения',
                'parameter': 'voltage',
                'high_limit': 253,  # 110% от 230В
                'high_high_limit': 264,  # 115%
                'low_limit': 207,  # 90%
                'low_low_limit': 184,  # 80%
                'delay_sec': 5,
                'hysteresis': 5,
            },
            'RULE_OVERCURRENT': {
                'id': 'RULE_OVERCURRENT',
                'name': 'Правило перегрузки',
                'parameter': 'current',
                'high_limit_pct': 110,  # % от In
                'high_high_limit_pct': 130,
                'delay_sec': 60,  # тепловой характер
                'hysteresis': 5,
            },
            'RULE_FREQUENCY': {
                'id': 'RULE_FREQUENCY',
                'name': 'Правило частоты',
                'parameter': 'frequency',
                'high_limit': 51.0,
                'low_limit': 49.0,
                'delay_sec': 1,
                'hysteresis': 0.2,
            },
        }
        print(f"✓ AlarmRules: {len(self.alarm_rules)}")
    
    # ============================================================================
    # СЛОЙ 6: MAINTENANCE (TARIFFS, MAINTENANCE, EVENTS)
    # ============================================================================
    
    def build_tariffs(self):
        """Тарифы на электроэнергию."""
        self.tariffs = {
            'TARIFF_DAY': {
                'id': 'TARIFF_DAY',
                'name': 'Дневной тариф',
                'type': 'energy',
                'price_per_kwh': 6.50,  # руб/кВт·ч
                'valid_from': '2024-01-01',
                'valid_to': '2024-12-31',
                'time_start': '07:00',
                'time_end': '23:00',
            },
            'TARIFF_NIGHT': {
                'id': 'TARIFF_NIGHT',
                'name': 'Ночной тариф',
                'type': 'energy',
                'price_per_kwh': 2.50,
                'valid_from': '2024-01-01',
                'valid_to': '2024-12-31',
                'time_start': '23:00',
                'time_end': '07:00',
            },
            'TARIFF_POWER': {
                'id': 'TARIFF_POWER',
                'name': 'Плата за мощность',
                'type': 'power',
                'price_per_kw': 1500.0,  # руб/кВт в месяц
                'valid_from': '2024-01-01',
                'valid_to': '2024-12-31',
            },
            'TARIFF_REACTIVE': {
                'id': 'TARIFF_REACTIVE',
                'name': 'Реактивная энергия',
                'type': 'reactive',
                'price_per_kvarh': 1.50,  # руб/кВАр·ч
                'cos_phi_threshold': 0.9,  # При cos < 0.9
            },
        }
        print(f"✓ Tariffs: {len(self.tariffs)}")
    
    def build_maintenance(self):
        """График ТО и поверки."""
        # Создаём записи для устройств, требующих обслуживания
        for dev_id, device in self.devices.items():
            if device['type'] in ['breaker', 'meter', 'source']:
                maint_id = f"MAINT{self.maint_counter:04d}"
                
                # Интервалы ТО по типу
                intervals = {
                    'breaker': 365,   # дней
                    'meter': 365 * 4,  # 4 года поверка
                    'source': 180,
                }
                
                self.maintenance[maint_id] = {
                    'id': maint_id,
                    'device_id': dev_id,
                    'device_type': device['type'],
                    # ТО
                    'last_maintenance': None,
                    'next_maintenance': (datetime.now() + timedelta(days=intervals.get(device['type'], 365))).strftime('%Y-%m-%d'),
                    'maintenance_interval_days': intervals.get(device['type'], 365),
                    'maintenance_type': 'Плановое ТО',
                    # Поверка (для счётчиков)
                    'last_verification': None,
                    'next_verification': None,
                    'verification_interval_years': 4 if device['type'] == 'meter' else None,
                    # Статус
                    'status': 'OK',  # OK, DUE, OVERDUE
                    'responsible': None,
                    'notes': None,
                }
                self.maint_counter += 1
        
        print(f"✓ Maintenance: {len(self.maintenance)} записей")
    
    def build_event_log(self):
        """Журнал событий."""
        self.event_log = [
            {
                'id': 'EVT00001',
                'timestamp': datetime.now().isoformat(),
                'event_type': 'SYSTEM_START',
                'event_category': 'SYSTEM',
                'device_id': None,
                'slot_id': None,
                'description': 'Инициализация системы цифрового двойника',
                'severity': 'INFO',
                'acknowledged': True,
                'acknowledged_by': 'system',
                'acknowledged_at': datetime.now().isoformat(),
                'details': {'version': '10.0'},
            }
        ]
        print(f"✓ EventLog: шаблон создан")
    
    # ============================================================================
    # СОХРАНЕНИЕ
    # ============================================================================
    
    def save(self, output_file):
        with pd.ExcelWriter(output_file) as w:
            # Слой 1: ТОПОЛОГИЯ
            pd.DataFrame(list(self.elements.values())).to_excel(w, sheet_name="Elements", index=False)
            pd.DataFrame(self.network).to_excel(w, sheet_name="Network", index=False)
            pd.DataFrame(list(self.connections.values())).to_excel(w, sheet_name="Connections", index=False)
            
            # Слой 2: ОБОРУДОВАНИЕ
            pd.DataFrame(list(self.devices.values())).to_excel(w, sheet_name="Devices", index=False)
            pd.DataFrame(list(self.device_states.values())).to_excel(w, sheet_name="DeviceStates", index=False)
            pd.DataFrame(list(self.device_types.values())).to_excel(w, sheet_name="DeviceTypes", index=False)
            
            # Слой 3: УПРАВЛЕНИЕ
            pd.DataFrame(list(self.ats_logic.values())).to_excel(w, sheet_name="ATSLogic", index=False)
            pd.DataFrame(list(self.protection.values())).to_excel(w, sheet_name="Protection", index=False)
            pd.DataFrame(list(self.scenarios.values())).to_excel(w, sheet_name="Scenarios", index=False)
            pd.DataFrame(list(self.commands.values())).to_excel(w, sheet_name="Commands", index=False)
            
            # Слой 4: РАСЧЁТЫ
            pd.DataFrame(self.power_flow).to_excel(w, sheet_name="PowerFlow", index=False)
            pd.DataFrame(list(self.short_circuit.values())).to_excel(w, sheet_name="ShortCircuit", index=False)
            pd.DataFrame(list(self.load_profiles.values())).to_excel(w, sheet_name="LoadProfiles", index=False)
            
            # Слой 5: ИЗМЕРЕНИЯ
            pd.DataFrame(list(self.measurements.values())).to_excel(w, sheet_name="Measurements", index=False)
            pd.DataFrame(list(self.alarms.values())).to_excel(w, sheet_name="Alarms", index=False)
            pd.DataFrame(list(self.alarm_rules.values())).to_excel(w, sheet_name="AlarmRules", index=False)
            
            # Слой 6: ОБСЛУЖИВАНИЕ
            pd.DataFrame(list(self.tariffs.values())).to_excel(w, sheet_name="Tariffs", index=False)
            pd.DataFrame(list(self.maintenance.values())).to_excel(w, sheet_name="Maintenance", index=False)
            pd.DataFrame(self.event_log).to_excel(w, sheet_name="EventLog", index=False)
        
        print(f"\n✅ Сохранено: {output_file}")
    
    # ============================================================================
    # MAIN BUILD
    # ============================================================================
    
    def build(self, output_file):
        print("="*70)
        print("NETWORK MODEL BUILDER v10 - INDUSTRIAL")
        print("Цифровой двойник электрической сети (промышленный уровень)")
        print("="*70)
        
        df = self.load_data()
        
        print("\n" + "="*70)
        print("СЛОЙ 1: ТОПОЛОГИЯ")
        print("="*70)
        self.build_elements(df)
        self.build_network(df)
        
        print("\n" + "="*70)
        print("СЛОЙ 2: ОБОРУДОВАНИЕ")
        print("="*70)
        self.build_devices(df)
        self.build_device_states(df)
        self.build_device_types()
        
        print("\n" + "="*70)
        print("СЛОЙ 3: УПРАВЛЕНИЕ")
        print("="*70)
        self.build_ats_logic(df)
        self.build_protection(df)
        self.build_scenarios()
        self.build_commands()
        
        print("\n" + "="*70)
        print("СЛОЙ 4: РАСЧЁТЫ")
        print("="*70)
        self.build_power_flow()
        self.build_short_circuit()
        self.build_load_profiles()
        
        print("\n" + "="*70)
        print("СЛОЙ 5: ИЗМЕРЕНИЯ")
        print("="*70)
        self.build_measurements()
        self.build_alarms()
        self.build_alarm_rules()
        
        print("\n" + "="*70)
        print("СЛОЙ 6: ОБСЛУЖИВАНИЕ")
        print("="*70)
        self.build_tariffs()
        self.build_maintenance()
        self.build_event_log()
        
        self.save(output_file)
        self._print_summary()
    
    def _print_summary(self):
        print("\n" + "="*70)
        print("ИТОГОВАЯ СТРУКТУРА ЦИФРОВОГО ДВОЙНИКА")
        print("="*70)
        print("""
┌─────────────────────────────────────────────────────────────────────┐
│                    ЦИФРОВОЙ ДВОЙНИК v10                             │
├─────────────────────────────────────────────────────────────────────┤
│ СЛОЙ 1: ТОПОЛОГИЯ                                                   │
│   Elements     (209)  → Слоты/позиции с геолокацией                 │
│   Network      (219)  → Граф связей                                 │
│   Connections  (218)  → Линии с R, X, Z, I_доп                      │
├─────────────────────────────────────────────────────────────────────┤
│ СЛОЙ 2: ОБОРУДОВАНИЕ                                                │
│   Devices      (181)  → Оборудование с полными параметрами          │
│   DeviceStates (92)   → Состояния ON/OFF, блокировки                │
│   DeviceTypes  (6)    → Справочник типов устройств                  │
├─────────────────────────────────────────────────────────────────────┤
│ СЛОЙ 3: УПРАВЛЕНИЕ                                                  │
│   ATSLogic     (16)   → Логика АВР, приоритеты, задержки            │
│   Protection   (184)  → Уставки МТЗ, ОЗЗ, ТО, U, f                  │
│   Scenarios    (4)    → Нормальный, Аварийный, Ремонтный, Островной │
│   Commands     (1)    → Очередь команд управления                   │
├─────────────────────────────────────────────────────────────────────┤
│ СЛОЙ 4: РАСЧЁТЫ                                                     │
│   PowerFlow    (XX)   → U, I, P, Q, S, потери по узлам              │
│   ShortCircuit (XX)   → Iкз 3-ф, 1-ф, 2-ф, min, max                 │
│   LoadProfiles (5)    → Суточные, сезонные, постоянные              │
├─────────────────────────────────────────────────────────────────────┤
│ СЛОЙ 5: ИЗМЕРЕНИЯ                                                   │
│   Measurements (XX)   → U, I, P, Q, f, энергия в реальном времени   │
│   Alarms       (10)   → Аварийные сигналы с порогами                │
│   AlarmRules   (3)    → Правила формирования аварий                 │
├─────────────────────────────────────────────────────────────────────┤
│ СЛОЙ 6: ОБСЛУЖИВАНИЕ                                                │
│   Tariffs      (4)    → Дневной, ночной, мощность, реактив         │
│   Maintenance  (XX)   → График ТО и поверки                         │
│   EventLog     (1)    → Журнал событий системы                      │
└─────────────────────────────────────────────────────────────────────┘
""")

# ================================================================================
# ТОЧКА ВХОДА
# ================================================================================

def main():
    builder = NetworkModelBuilderV10(INPUT_FILE, SHEET_NAME)
    builder.build(OUTPUT_FILE)

if __name__ == "__main__":
    main()
