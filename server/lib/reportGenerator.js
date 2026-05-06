'use strict';

const {
  Document, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle,
  Packer, ShadingType, VerticalAlign,
  Footer, PageNumber,
} = require('docx');

// ── Page geometry (A4, margins 900 twips each side) ───────────────
// Usable width ≈ 11906 - 1800 = 10106 twips
const PAGE_W  = 10106;   // usable width in twips
const COL1    = Math.round(PAGE_W * 0.38);   // label column  ≈ 3840
const COL2    = PAGE_W - COL1;               // value column  ≈ 6266

// ── Colour palette ────────────────────────────────────────────────
const C = {
  navyDark:  '0D2B4E',
  navy:      '1E3A5F',
  navyMid:   '2B5278',
  navyLight: 'D6E4F0',
  rowEven:   'EEF4FA',
  rowOdd:    'FFFFFF',
  rowResult: 'E3F2E8',
  silver:    'C8D6E3',
  white:     'FFFFFF',
  textMain:  '1A1A1A',
  textMuted: '555555',
  textLight: '888888',
  warn:      'FFF3CD',
  warnBorder:'C8972A',
};

// ── Border helpers ─────────────────────────────────────────────────
const mkBorder = (color, size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: 'FFFFFF' });

function outerBorders(color = C.navy, size = 8) {
  const b = mkBorder(color, size);
  return { top: b, bottom: b, left: b, right: b };
}
function innerBorders() {
  const b = mkBorder(C.silver, 2);
  return { top: b, bottom: b, left: b, right: b };
}
function noBorders() {
  const n = noBorder();
  return { top: n, bottom: n, left: n, right: n };
}

// ── Spacer paragraph ──────────────────────────────────────────────
function spacer(pt = 120) {
  return new Paragraph({ children: [], spacing: { before: 0, after: pt } });
}

// ── Section heading row ───────────────────────────────────────────
function sectionHeaderRow(label) {
  return new TableRow({
    children: [new TableCell({
      columnSpan: 2,
      width: { size: PAGE_W, type: WidthType.DXA },
      borders: outerBorders(C.navy, 6),
      shading: { type: ShadingType.CLEAR, fill: C.navy, color: 'auto' },
      children: [new Paragraph({
        children: [new TextRun({
          text: label.toUpperCase(),
          bold: true, size: 22, color: C.white, font: 'Calibri',
        })],
        spacing: { before: 80, after: 80 },
        indent: { left: 100 },
      })],
    })],
  });
}

// ── Column header row ─────────────────────────────────────────────
function columnHeaderRow(col1 = 'PARAMETER', col2 = 'VALUE') {
  const cell = (text, w) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: innerBorders(),
    shading: { type: ShadingType.CLEAR, fill: C.navyLight, color: 'auto' },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 18, color: C.navyMid, font: 'Calibri' })],
      spacing: { before: 60, after: 60 },
      indent: { left: 80 },
    })],
  });
  return new TableRow({ children: [cell(col1, COL1), cell(col2, COL2)] });
}

// ── Data row ──────────────────────────────────────────────────────
function dataRow(label, value, opts = {}) {
  const { index = 0, bold = false, highlight = false } = opts;
  const fill = highlight ? C.rowResult : (index % 2 === 0 ? C.rowEven : C.rowOdd);

  const makeCell = (text, w, isValue) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: innerBorders(),
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
    children: [new Paragraph({
      children: [new TextRun({
        text: String(text ?? '—'),
        bold: isValue ? bold : true,
        size: 20,
        font: 'Calibri',
        color: C.textMain,
      })],
      spacing: { before: 70, after: 70 },
      indent: { left: 100 },
    })],
  });

  return new TableRow({ children: [makeCell(label, COL1, false), makeCell(value, COL2, true)] });
}

// ── Section table: header row + column headers + data rows ─────────
function sectionTable(heading, rows, opts = {}) {
  const { showColumnHeaders = true, highlight = [] } = opts;
  const tableRows = [sectionHeaderRow(heading)];
  if (showColumnHeaders) tableRows.push(columnHeaderRow());

  rows.forEach(([label, value], i) => {
    if (value == null || value === '') return;
    tableRows.push(dataRow(label, value, {
      index: i,
      highlight: highlight.includes(i),
      bold:      highlight.includes(i),
    }));
  });

  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [COL1, COL2],
    borders: outerBorders(C.navy, 8),
    rows: tableRows,
  });
}

// ── Title block ───────────────────────────────────────────────────
function buildTitleBlock(service, date, docRef) {
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [PAGE_W],
    borders: outerBorders(C.navyDark, 12),
    rows: [
      // Main title row
      new TableRow({
        children: [new TableCell({
          width: { size: PAGE_W, type: WidthType.DXA },
          borders: noBorders(),
          shading: { type: ShadingType.CLEAR, fill: C.navyDark, color: 'auto' },
          children: [new Paragraph({
            children: [new TextRun({
              text: 'PSV SIZING REPORT',
              bold: true, size: 52, color: C.white, font: 'Calibri',
            })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 60 },
          })],
        })],
      }),
      // Subtitle strip
      new TableRow({
        children: [new TableCell({
          width: { size: PAGE_W, type: WidthType.DXA },
          borders: noBorders(),
          shading: { type: ShadingType.CLEAR, fill: C.navy, color: 'auto' },
          children: [new Paragraph({
            children: [
              new TextRun({ text: service, italics: true, size: 24, color: 'A8C8E8', font: 'Calibri' }),
              new TextRun({ text: '     |     ', size: 22, color: '4A7090', font: 'Calibri' }),
              new TextRun({ text: `Generated: ${date}`, size: 22, color: 'A8C8E8', font: 'Calibri' }),
              ...(docRef ? [
                new TextRun({ text: '     |     ', size: 22, color: '4A7090', font: 'Calibri' }),
                new TextRun({ text: docRef, size: 22, color: 'A8C8E8', font: 'Calibri' }),
              ] : []),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 140 },
          })],
        })],
      }),
    ],
  });
}

// ── Disclaimer box ─────────────────────────────────────────────────
function buildDisclaimer() {
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [PAGE_W],
    borders: outerBorders(C.warnBorder, 6),
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: PAGE_W, type: WidthType.DXA },
        borders: noBorders(),
        shading: { type: ShadingType.CLEAR, fill: C.warn, color: 'auto' },
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'DISCLAIMER  ', bold: true, size: 19, font: 'Calibri', color: '7B5800' }),
            new TextRun({
              text: 'This report is generated by PSV Pro v4.0 for engineering reference only. '
                  + 'All calculations follow API 520 / API 521 methodology. '
                  + 'Results MUST be reviewed by a qualified process or mechanical engineer before implementation. '
                  + 'The author accepts no liability for errors or omissions.',
              size: 18, font: 'Calibri', color: '7B5800',
            }),
          ],
          spacing: { before: 100, after: 100 },
          indent: { left: 120, right: 120 },
        })],
      })],
    })],
  });
}

// ── Footer ─────────────────────────────────────────────────────────
function buildFooter(date) {
  return new Footer({
    children: [new Paragraph({
      children: [
        new TextRun({ text: `PSV Pro v4.0  |  ${date}  |  Page `, size: 16, color: C.textLight, font: 'Calibri' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.textLight, font: 'Calibri' }),
        new TextRun({ text: ' of ', size: 16, color: C.textLight, font: 'Calibri' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: C.textLight, font: 'Calibri' }),
        new TextRun({ text: '  |  FOR ENGINEERING REFERENCE ONLY', size: 16, color: C.textLight, font: 'Calibri' }),
      ],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.silver } },
    })],
  });
}

// ── Main generator ─────────────────────────────────────────────────
async function generateReport(data) {
  console.log('[report] incoming data keys:', Object.keys(data));
  console.log('[report] key values:', {
    service:         data.service,
    fluid:           data.fluid,
    phase:           data.phase,
    P_set_barg:      data.P_set_barg,
    T_rel_C:         data.T_rel_C,
    W_kgh:           data.W_kgh,
    A_in2:           data.A_in2,
    orifice:         data.orifice,
    orifice_area_in2: data.orifice_area_in2,
    utilisation_pct: data.utilisation_pct,
  });

  const {
    fluid            = 'Not specified',
    service          = 'PSV Sizing',
    phase            = 'gas',
    scenario         = 'Blocked outlet',
    P_set_barg,
    P_rel_barg,
    T_rel_C,
    W_kgh,
    MW,
    k,
    Z,
    A_in2,
    orifice,
    orifice_area_in2,
    orifice_size,
    utilisation_pct,
    assumptions,
    notes,
    standard         = 'API 520 / API 521',
    preparedBy       = 'PSV Pro v4.0 AI Engineering Agent',
    docRef,
    date             = new Date().toLocaleDateString('en-GB'),
    toolResult       = {},
  } = data;

  // ── Derived display strings ───────────────────────────────────────
  const fmt = (v, unit = '') => v != null ? `${v}${unit}` : '—';
  const fmtArea = (v) => v != null
    ? `${Number(v).toFixed(4)} in²   (${(Number(v) * 6.4516).toFixed(3)} cm²)`
    : '—';

  const phaseLabel  = { gas:'Gas / Vapour', steam:'Steam', liquid:'Liquid',
                        fire:'Fire Case', twophase:'Two-Phase' }[phase] || phase;
  const utilStatus  = utilisation_pct != null
    ? (Number(utilisation_pct) > 100 ? 'OVERSIZE — Select Larger Orifice'
    : Number(utilisation_pct) > 90   ? `${Number(utilisation_pct).toFixed(1)}%  (High — Verify With Supplier)`
    :                                   `${Number(utilisation_pct).toFixed(1)}%  (Acceptable)`)
    : '—';

  const relievingP = toolResult.relieving_pressure_barg != null
    ? `${toolResult.relieving_pressure_barg} barg`
    : P_rel_barg != null ? `${P_rel_barg} barg` : '—';

  // ── Assemble document children ────────────────────────────────────
  const children = [];

  // Title
  children.push(buildTitleBlock(service, date, docRef));
  children.push(spacer(240));

  // Section 1 — Document Information
  children.push(sectionTable('1.0  Document Information', [
    ['Standard / Code',       standard],
    ['Prepared By',           preparedBy],
    ['Report Date',           date],
    ['Service / Fluid',       service],
    ['Relief Scenario',       scenario],
    ['Document Reference',    docRef || 'N/A'],
  ]));
  children.push(spacer(240));

  // Section 2 — Process Conditions
  const processRows = [
    ['Fluid / Medium',        fluid || service],
    ['Phase',                 phaseLabel],
    ['Set Pressure',          fmt(P_set_barg, ' barg')],
    ['Relieving Pressure',    relievingP],
    ['Relieving Temperature', fmt(T_rel_C, ' °C')],
    ['Required Relief Flow',  W_kgh != null ? `${Number(W_kgh).toLocaleString()} kg/h` : '—'],
  ];
  if (toolResult.flow_regime)
    processRows.push(['Flow Regime', toolResult.flow_regime]);
  if (toolResult.heat_input_kW != null)
    processRows.push(['Fire Heat Input', `${toolResult.heat_input_kW} kW`]);
  if (toolResult.wetted_area_ft2 != null)
    processRows.push(['Wetted Surface Area', `${toolResult.wetted_area_ft2} ft²`]);

  children.push(sectionTable('2.0  Process Conditions', processRows));
  children.push(spacer(240));

  // Section 3 — Calculation Results
  children.push(sectionTable('3.0  Calculation Results  (API 520 / API 526)', [
    ['Required Orifice Area',          fmtArea(A_in2)],
    ['Selected API 526 Orifice',       orifice || '—'],
    ['Selected Orifice Area',          fmtArea(orifice_area_in2)],
    ['Orifice Size (inlet × outlet)',  orifice_size || '—'],
    ['Capacity Utilisation',           utilStatus],
    ['Back Pressure Correction (Kb)',  toolResult.Kb != null ? String(toolResult.Kb) : '1.000'],
    ['Discharge Coefficient (Kd)',     toolResult.Kd != null ? String(toolResult.Kd) : '0.975'],
  ], { highlight: [1, 4] }));
  children.push(spacer(240));

  // Section 4 — Design Assumptions
  const assumRows = [
    ['Molecular Weight (MW)',         MW  != null ? `${MW} kg/kmol` : '—'],
    ['Cp/Cv Ratio (k)',               k   != null ? String(k) : '—'],
    ['Compressibility Factor (Z)',    Z   != null ? String(Z) : '—'],
    ['Overpressure Allowance',        '10% of set pressure (single device, API 520 §3.2)'],
    ['Valve Type',                    toolResult.inputs_used?.valve_type || 'Conventional'],
    ['Additional Notes',              notes || assumptions || 'None'],
  ];
  children.push(sectionTable('4.0  Design Assumptions', assumRows));
  children.push(spacer(240));

  // Section 5 — Sign-Off
  children.push(sectionTable('5.0  Verification & Sign-Off', [
    ['Calculated By',  ''],
    ['Reviewed By',    ''],
    ['Approved By',    ''],
    ['Revision',       'Rev 0'],
    ['Status',         'ISSUED FOR REVIEW'],
  ], { showColumnHeaders: false }));
  children.push(spacer(240));

  // Disclaimer
  children.push(buildDisclaimer());

  // ── Build Document ────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20, color: C.textMain } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 900, right: 900 },
        },
      },
      footers: { default: buildFooter(date) },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  console.log(`[report] generated ${buffer.length} bytes`);
  return buffer;
}

module.exports = { generateReport };
