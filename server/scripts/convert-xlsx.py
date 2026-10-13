#!/usr/bin/env python3
"""Convert the three PM-SETU dummy workbooks into JSON the Node seed reads.

Usage: python3 server/scripts/convert-xlsx.py [downloads_dir]
Writes server/data/delhi/*.json. Re-run whenever the workbooks change.
Requires: pip install openpyxl
"""
import json, os, sys, datetime
import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads')
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'delhi')
os.makedirs(OUT, exist_ok=True)

FILES = {
    'plan': 'PM SETU DUMMY DATA EXCEL.xlsx',
    'registry': 'Dummmy registry.xlsx',
    'mapping': 'Dummy mapping.xlsx',
    'companion': 'Student_Companion_Dummy KB.xlsx',   # Student Companion knowledge base (title + description rows precede the header)
}

def cell(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()[:10]
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, float):
        return round(v, 6)
    return v

def sheet_rows(ws):
    rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
    if not rows:
        return []
    # Header = first row with 4+ filled cells (KB sheets carry a title and a description row first).
    h = next((i for i, r in enumerate(rows) if sum(c is not None for c in r) >= 4), 0)
    hdr = [str(c).strip() if c is not None else f'col{i}' for i, c in enumerate(rows[h])]
    out = []
    for r in rows[h + 1:]:
        d = {hdr[i]: cell(r[i]) for i in range(len(hdr)) if i < len(r)}
        out.append(d)
    return out

def dump(name, wb, sheets=None):
    data = {}
    for ws in wb.worksheets:
        if sheets and ws.title not in sheets:
            continue
        if ws.title == 'Read Me':
            continue
        data[ws.title] = sheet_rows(ws)
    path = os.path.join(OUT, f'{name}.json')
    with open(path, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f'{name}: ' + ', '.join(f'{k}={len(v)}' for k, v in data.items()))

for key, fname in FILES.items():
    p = os.path.join(SRC, fname)
    if not os.path.exists(p):
        print('missing', p); sys.exit(1)
    wb = openpyxl.load_workbook(p, data_only=True)
    dump(key, wb)
print('written to', os.path.abspath(OUT))
