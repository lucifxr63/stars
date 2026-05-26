"""
Parser para archivos TOON de INAPI (formato RECORD_START/RECORD_END, encoding CP1252).
Maneja marcas (BRANDNAME, NIZACLASSES, etc.) y patentes (TITLE, IPC, etc.).
"""
from typing import Iterator
import re

FIELD_MAP = {
    # Identidad
    'APPLICATIONTYPE':         'application_type',
    'APPLICATIONSEQ':          'application_seq',
    'APPLICATIONSERIE':        'application_serie',
    'APPLICATIONNUMBER':       'application_number',
    'REGISTRATIONNUMBER':      'registration_number',
    # Clasificadores
    'NIZACLASSES':             'niza_classes',
    'VIENACLASSES':            'vienna_classes',
    'REGIONS':                 'regions',
    'IPC':                     'ipc_codes',
    # Partes
    'APPLICANTS':              'applicants',
    'REPRESENTATIVES':         'representatives',
    'INVENTORS':               'inventors',
    # Ubicaciones (marcas)
    'LOCATIONAPPLICANTS':      'location_applicants',
    'STATEAPPLICANTS':         'state_applicants',
    'LOCATIONREPRESENTATIVES': 'location_representatives',
    'STATEREPRESENTATIVES':    'state_representatives',
    # Ubicaciones (patentes — campos distintos, mismo destino)
    'APPLICANTREGION':         'state_applicants',
    'REPRESENTATIVEREGION':    'state_representatives',
    # País (patentes)
    'COUNTRY':                 'country',
    # Fechas
    'FILINGDATE':              'filing_date',
    'PUBLICATIONDATE':         'publication_date',
    'REGISTRATIONDATE':        'registration_date',
    'EXPIRATIONDATE':          'expiration_date',
    'PCTAPPLICATIONDATE':      'pct_application_date',
    'PCTPUBLICATIONDATE':      'pct_publication_date',
    # Descripción de la marca
    'BRANDNAME':               'brand_name',
    'TRANSLATION':             'translation',
    'LABELDESCRIPTION':        'label_description',
    'PROTECTIONDESCRIPTION':   'protection_description',
    'SIGNTYPE':                'sign_type',
    # Descripción de la patente
    'TITLE':                   'title',
    'PRIORITIES':              'priorities',
    # Comunes
    'TYPENAME':                'type_name',
    'SUBTYPENAME':             'subtype_name',
    'STATUS':                  'status',
    'IMAGE':                   'image_url',
    'LASTUPDATEDDATE':         'last_updated_date',
}

DATE_FIELDS   = {'filing_date', 'publication_date', 'registration_date',
                 'expiration_date', 'pct_application_date', 'pct_publication_date'}

ARRAY_FIELDS  = {'niza_classes', 'vienna_classes', 'regions', 'ipc_codes'}


def _parse_date(value: str) -> str | None:
    value = value.strip()
    if not value:
        return None
    return value.split(' ')[0]  # 'YYYY-MM-DD HH:MM:SS' → 'YYYY-MM-DD'


def _parse_array(value: str) -> list[str]:
    """'35 ,43' o 'E02D17/00; E02D29/02;' → ['35','43'] / ['E02D17/00','E02D29/02']"""
    sep = ';' if ';' in value else ','
    parts = [p.strip().rstrip(';,').strip() for p in value.split(sep)]
    return [p for p in parts if p]


def _clean_registration(value: str) -> str | None:
    """'863519.0' → '863519'  (INAPI exporta floats en campo int)"""
    value = value.strip()
    if not value:
        return None
    return value.rstrip('0').rstrip('.') if '.' in value else value


def stream_records(filepath: str) -> Iterator[dict]:
    """
    Lee el archivo TOON línea por línea (streaming, nunca carga todo en memoria).
    Emite un dict por registro con campos listos para insertar en inapi_records.
    """
    current: dict = {}
    inside = False

    with open(filepath, encoding='cp1252', errors='ignore') as f:
        for line in f:
            line = line.rstrip('\r\n')

            if line.strip() == 'RECORD_START':
                current = {}
                inside = True
                continue

            if line.strip() == 'RECORD_END':
                if current.get('application_number'):
                    yield current
                current = {}
                inside = False
                continue

            if not inside or ':' not in line:
                continue

            raw_key, _, raw_value = line.partition(':')
            key = raw_key.strip().upper().replace(' ', '')
            value = raw_value.strip()

            db_field = FIELD_MAP.get(key)
            if db_field is None:
                continue

            if db_field == 'registration_number':
                current[db_field] = _clean_registration(value)
            elif db_field in DATE_FIELDS:
                current[db_field] = _parse_date(value)
            elif db_field in ARRAY_FIELDS:
                current[db_field] = _parse_array(value) if value else []
            else:
                current[db_field] = value if value else None


def count_records(filepath: str) -> int:
    """Cuenta registros sin parsear campos (rápido, para estimaciones)."""
    count = 0
    with open(filepath, encoding='cp1252', errors='ignore') as f:
        for line in f:
            if line.strip() == 'RECORD_START':
                count += 1
    return count
