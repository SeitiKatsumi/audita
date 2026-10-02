"""Isolated import check with fictional OOXML; no customer data or providers."""
from io import BytesIO
from pathlib import Path
import json
import subprocess
import sys
from tempfile import TemporaryDirectory
from zipfile import ZipFile
from xml.sax.saxutils import escape

script = Path(__file__).resolve().parents[1] / 'scripts/import-jurisprudence.py'
states = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split()


def office(parts):
    output = BytesIO()
    with ZipFile(output, 'w') as archive:
        for name, text in parts.items():
            archive.writestr(name, text)
    return output.getvalue()


def row(number, values):
    return '<row r="%s">%s</row>' % (number, ''.join(f'<c r="{column}{number}" t="inlineStr"><is><t>{escape(value)}</t></is></c>' for column, value in zip('ABCDEFG', values)))


with TemporaryDirectory(prefix='audita-reader-test-') as temporary:
    root = Path(temporary)
    source = root / 'source.zip'
    header = row(1, ['Ordem TJ', 'Tribunal / Estado', 'Nº do processo', 'Recurso / decisão', 'Favorável', 'Observação', 'Valor indenizado'])
    data = ''.join(row(i + 2, [str(i + 1), 'TJDFT — DF' if uf == 'DF' else f'TJ{uf} — Estado', f'FICTICIO-{uf}', '<script>Seguro fictício</script>', 'Favorável', '', 'Não informado']) for i, uf in enumerate(states))
    sheet = f'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{header}{data}</sheetData></worksheet>'
    with ZipFile(source, 'w') as archive:
        archive.writestr('Base Geral Jurisprudencia Seguros Bancos.xlsx', office({'xl/workbook.xml': '<workbook/>', 'xl/worksheets/sheet1.xml': sheet}))
        for uf in states:
            tribunal = 'TJDFT' if uf == 'DF' else f'TJ{uf}'
            document = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Relatório fictício</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Coluna</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>'
            archive.writestr(f'{tribunal} — exemplo.docx', office({'word/document.xml': document}))
    output = root / 'private'
    subprocess.run([sys.executable, str(script), str(source), str(output)], check=True, capture_output=True)
    assert len(list(output.glob('jurisprudencia-??.json'))) == 27
    content = json.loads((output / 'jurisprudencia-ac.json').read_text(encoding='utf-8'))
    assert content['records'][0]['decision'] == '<script>Seguro fictício</script>'
    assert content['records'][0]['notes'] == ''
    assert content['records'][0]['row'] == 2
    assert content['report'] == [{'type': 'paragraph', 'text': 'Relatório fictício'}, {'type': 'table', 'rows': [['Coluna']]}]
    subprocess.run([sys.executable, str(script), str(source), str(output)], check=True, capture_output=True)
    # Reject a traversing entry before publishing anything.
    with ZipFile(source, 'a') as archive:
        archive.writestr('../secret.docx', 'untrusted')
    assert subprocess.run([sys.executable, str(script), str(source), str(root / 'rejected')], capture_output=True).returncode != 0
    assert not (root / 'rejected').exists()
print('Fictional reader import, repeatability and path validation passed.')
