// ─────────────────────────────────────────────────────────────────────────────
//  Generador de archivos Excel (.xlsx) sin dependencias externas.
//  Un .xlsx es un ZIP con archivos XML; aquí se arma a mano con zlib de Node.
//
//  Uso:
//    const buffer = buildXlsx([
//      { name: 'Hoja 1',
//        columns: [{ header: 'Fecha', key: 'fecha', type: 'datetime', width: 20 }, ...],
//        rows: [{ fecha: '2026-10-12 08:30:00', ... }] },
//    ]);
//  Tipos de columna: 'text' (por defecto), 'number', 'integer', 'money', 'percent', 'datetime'
//  Opcional por hoja: totals: ['clave', ...] agrega una fila «Total» con la SUMA de esas columnas.
// ─────────────────────────────────────────────────────────────────────────────
import zlib from 'node:zlib';

// ── ZIP ──────────────────────────────────────────────────────────────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const deflated = zlib.deflateRawSync(raw);
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);       // versión
    local.writeUInt16LE(0x0800, 6);   // UTF-8
    local.writeUInt16LE(8, 8);        // deflate
    local.writeUInt32LE(0, 10);       // hora/fecha
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, deflated);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + deflated.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

// ── XML de la hoja de cálculo ───────────────────────────────────────────────
const esc = (s) =>
  String(s)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const colName = (i) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** 'YYYY-MM-DD HH:MM:SS' (hora local ya calculada) → número de fecha de Excel. */
function excelDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(value));
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  return ms / 86400000 + 25569;
}

// Índices de estilo definidos en STYLES_XML (cellXfs)
const STYLE = { text: 0, header: 1, datetime: 2, integer: 3, number: 4, money: 5, title: 6, total: 7, totalNum: 8, totalMoney: 9, percent: 10 };

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3">
<numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/>
<numFmt numFmtId="165" formatCode="#,##0"/>
<numFmt numFmtId="166" formatCode="&quot;$&quot; #,##0"/>
</numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><color rgb="FF1E3A8A"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8EFFF"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFE3E7EF"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="165" fontId="3" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="166" fontId="3" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function cell(ref, value, type) {
  if (value === null || value === undefined || value === '') return '';
  if (type === 'datetime') {
    const n = excelDate(value);
    if (n !== null) return `<c r="${ref}" s="${STYLE.datetime}"><v>${n}</v></c>`;
  }
  if (['number', 'integer', 'money', 'percent'].includes(type) && Number.isFinite(Number(value))) {
    return `<c r="${ref}" s="${STYLE[type]}"><v>${Number(value)}</v></c>`;
  }
  return `<c r="${ref}" s="${STYLE.text}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function sheetXml({ columns, rows, title, totals }) {
  const lines = [];
  let r = 1;
  if (title) {
    lines.push(`<row r="${r}"><c r="A${r}" s="${STYLE.title}" t="inlineStr"><is><t>${esc(title)}</t></is></c></row>`);
    r += 2; // fila en blanco después del título
  }
  const headerRow = r;
  lines.push(
    `<row r="${r}">${columns.map((c, i) => `<c r="${colName(i)}${r}" s="${STYLE.header}" t="inlineStr"><is><t>${esc(c.header)}</t></is></c>`).join('')}</row>`
  );
  for (const row of rows) {
    r++;
    lines.push(`<row r="${r}">${columns.map((c, i) => cell(`${colName(i)}${r}`, row[c.key], c.type)).join('')}</row>`);
  }
  const lastDataRow = r;
  // Fila de totales opcional: sheet.totals = ['clave1', 'clave2'] → SUMA de esas columnas
  if (totals?.length && rows.length) {
    r++;
    const cells = columns.map((c, i) => {
      const ref = `${colName(i)}${r}`;
      if (i === 0) return `<c r="${ref}" s="${STYLE.total}" t="inlineStr"><is><t>Total</t></is></c>`;
      if (!totals.includes(c.key)) return `<c r="${ref}" s="${STYLE.total}"/>`;
      const st = c.type === 'money' ? STYLE.totalMoney : STYLE.totalNum;
      return `<c r="${ref}" s="${st}"><f>SUM(${colName(i)}${headerRow + 1}:${colName(i)}${lastDataRow})</f></c>`;
    });
    lines.push(`<row r="${r}">${cells.join('')}</row>`);
  }
  const lastCol = colName(columns.length - 1);
  const cols = columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 15}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${lines.join('')}</sheetData>
${rows.length ? `<autoFilter ref="A${headerRow}:${lastCol}${lastDataRow}"/>` : ''}
</worksheet>`;
}

const safeSheetName = (name, i) => (String(name || `Hoja ${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Hoja ${i + 1}`);

/** Construye el archivo .xlsx y devuelve un Buffer. */
export function buildXlsx(sheets) {
  const names = sheets.map((s, i) => safeSheetName(s.name, i));
  const files = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`,
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
${sheets.some((s) => s.rows.length) ? `<definedNames>${sheets
        .map((s, i) => {
          if (!s.rows.length) return '';
          const h = s.title ? 3 : 1;
          return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(names[i])}'!$A$${h}:$${colName(s.columns.length - 1)}$${h + s.rows.length}</definedName>`;
        })
        .join('')}</definedNames>` : ''}
<calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { name: 'xl/styles.xml', data: STYLES_XML },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ];
  return zip(files);
}

/** Envía un .xlsx como descarga. */
export function sendXlsx(res, filename, sheets) {
  const buf = buildXlsx(sheets);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Content-Length', buf.length);
  res.end(buf);
}
