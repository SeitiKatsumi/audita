"""Import the supplied state reports, preserving original bytes in private storage."""
import hashlib
import json
from pathlib import Path
import re
import sys
from zipfile import ZipFile
import xml.etree.ElementTree as ET
from io import BytesIO


def build_reader(files, states):
    """Extract source text only; no AI summaries or inferred case associations."""
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    readers = {uf: {'version': 1, 'uf': uf, 'records': [], 'report': []} for uf in states}
    with ZipFile(BytesIO(files['jurisprudencia-base-geral.xlsx'][0])) as workbook:
        shared = []
        if 'xl/sharedStrings.xml' in workbook.namelist():
            shared = [''.join(t.itertext()) for t in ET.fromstring(workbook.read('xl/sharedStrings.xml'))]
        sheet = ET.fromstring(workbook.read('xl/worksheets/sheet1.xml'))
        rows = []
        for row in sheet.findall('s:sheetData/s:row', ns):
            cells = {}
            for cell in row.findall('s:c', ns):
                column = re.sub(r'\d', '', cell.attrib['r'])
                value = cell.findtext('s:v', default='', namespaces=ns)
                if cell.attrib.get('t') == 's':
                    value = shared[int(value)]
                elif cell.attrib.get('t') == 'inlineStr':
                    value = ''.join(t.text or '' for t in cell.findall('.//s:t', ns))
                cells[column] = value
            if any(cells.values()):
                rows.append((int(row.attrib['r']), cells))
        if [rows[0][1].get(c) for c in 'BCDEFG'] != ['Tribunal / Estado', 'Nº do processo', 'Recurso / decisão', 'Favorável', 'Observação', 'Valor indenizado']:
            raise ValueError('Unexpected workbook columns')
        for row, cells in rows[1:]:
            if cells.get('B') and not any(cells.get(c) for c in 'ACDEFG'):
                for reader in readers.values():
                    reader['sourceNote'] = cells['B']
                continue
            match = re.match(r'^TJ(DFT|[A-Z]{2})(?:\s|$)', cells.get('B', ''))
            if not match:
                raise ValueError('Unmapped workbook row')
            uf = 'DF' if match[1] == 'DFT' else match[1]
            if uf not in readers:
                raise ValueError('Unknown workbook state')
            readers[uf]['records'].append({'row': row, **{key: cells.get(col, '') for col, key in zip('BCDEFG', ['tribunal', 'process', 'decision', 'outcome', 'notes', 'amount'])}})
    word_ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    def paragraph(element):
        return ''.join('\n' if node.tag.endswith('}br') else '\t' if node.tag.endswith('}tab') else (node.text or '') if node.tag.endswith('}t') else '' for node in element.iter()).strip()
    for uf, reader in readers.items():
        name = f'jurisprudencia-{uf.lower()}.docx'
        reader['reportSource'] = files[name][1]
        with ZipFile(BytesIO(files[name][0])) as document:
            body = ET.fromstring(document.read('word/document.xml')).find('w:body', word_ns)
            for block in body:
                if block.tag.endswith('}p'):
                    text = paragraph(block)
                    if text:
                        reader['report'].append({'type': 'paragraph', 'text': text})
                elif block.tag.endswith('}tbl'):
                    table = [['\n'.join(paragraph(p) for p in cell.findall('w:p', word_ns)) for cell in row.findall('w:tc', word_ns)] for row in block.findall('w:tr', word_ns)]
                    reader['report'].append({'type': 'table', 'rows': table})
        if not reader['records'] or not reader['report']:
            raise ValueError('Empty reader content')
    return readers

source, destination = map(Path, sys.argv[1:3])
states = set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split())
files = {}
with ZipFile(source) as archive:
    for entry in archive.infolist():
        name = entry.filename
        if '/' in name or '\\' in name or entry.file_size > 10_000_000:
            raise ValueError('Unexpected archive entry')
        match = re.match(r'^TJ(DFT|[A-Z]{2}) — .+\.docx$', name)
        if match:
            uf = 'DF' if match[1] == 'DFT' else match[1]
            if uf not in states:
                raise ValueError('Unknown state')
            target = f'jurisprudencia-{uf.lower()}.docx'
        elif name == 'Base Geral Jurisprudencia Seguros Bancos.xlsx':
            target = 'jurisprudencia-base-geral.xlsx'
        else:
            raise ValueError('Unexpected document')
        if target in files:
            raise ValueError('Duplicate document')
        content = archive.read(entry)
        with ZipFile(BytesIO(content)) as office:
            if sum(part.file_size for part in office.infolist()) > 50_000_000:
                raise ValueError('Office document is too large')
            required = 'word/document.xml' if target.endswith('.docx') else 'xl/workbook.xml'
            ET.fromstring(office.read(required))
            if target.endswith('.xlsx'):
                ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                workbook = ET.fromstring(office.read(required))
                print('Workbook sheets:', [s.attrib['name'] for s in workbook.findall('s:sheets/s:sheet', ns)])
                print('Worksheet row counts:', {p: len(ET.fromstring(office.read(p)).findall('s:sheetData/s:row', ns)) for p in office.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+\.xml', p)})
        files[target] = (content, name)
expected = {f'jurisprudencia-{uf.lower()}.docx' for uf in states} | {'jurisprudencia-base-geral.xlsx'}
if set(files) != expected:
    raise ValueError('Incomplete corpus')
readers = build_reader(files, states)
destination.mkdir(parents=True, exist_ok=True)
if destination.is_symlink():
    raise ValueError('Destination must not be a symlink')
for target, (content, _) in files.items():
    path = destination / target
    if path.is_symlink():
        raise ValueError('Refusing to write through a symlink')
    if path.exists() and path.read_bytes() != content:
        raise ValueError('Refusing to replace a different document')
for target, (content, _) in files.items():
    (destination / target).write_bytes(content)
inventory = [{'file': target, 'original': original, 'sha256': hashlib.sha256(content).hexdigest()} for target, (content, original) in files.items()]
(destination / 'inventory.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding='utf-8')
for uf, reader in readers.items():
    target = destination / f'jurisprudencia-{uf.lower()}.json'
    if target.is_symlink():
        raise ValueError('Refusing to write through a symlink')
    temporary = target.with_suffix('.json.tmp')
    with temporary.open('x', encoding='utf-8') as output:
        json.dump(reader, output, ensure_ascii=False)
    temporary.replace(target)
print(f'Imported and verified {len(files)} original documents.')
print(f'Indexed {sum(len(reader["records"]) for reader in readers.values())} records for in-app reading.')
