'use strict';

const {
  Document, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle,
  Packer, ShadingType, VerticalAlign, TableLayoutType,
  Footer, PageNumber,
} = require('docx');

// ── Colour palette ────────────────────────────────────────────────
const C = {
  navyDark:  '0D2B4E',  // title block bg
  navy:      '1E3A5F',  // section header bg, outer borders
  navyMid:   '2B5278',  // sub-header text
  navyLight: 'D6E4F0',  // section header label cell bg
  rowEven:   'EEF4FA',  // alternating row
  rowOdd:    'FFFFFF',  // alternating row
  rowResult: 'E3F2E8',  // highlight: calculation result
  silver:    'C8D6E3',  // inner border
  white:     'FFFFFF',
  textMain:  '1A1A1A',
  textMuted: '555555',
  textLight: 'AAAAAA',
  warn:      'FFF3CD',  // disclaimer bg
  warnBorder:'C8972A',
};

// ── Border presets ────────────────────────────────────────────────
function outerBorder() {
  const b = { style: BorderStyle.SINGLE, size: 8, color: C.navy };
  return { top: b, bottom: b, left: b, right: b };
}
function innerBorder() {
  const b = { style: BorderStyle.SINGLE, size: 2, color: C.silver };
  return { top: b, bottom: b, left: b, right: b };
}
function noBorder() {
  const b = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: b, bottom: b, left: b, right: b };
}

// ── Empty spacer paragraph ────────────────────────────────────────
function spacer(pt = 120) {
  return new Paragraph({ children: [], spacing: { before: 0, after: pt } });
}

// ── Section heading row (full-width shaded label across table) ─────
function sectionHeaderRow(label, colSpan = 2) {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: colSpan,
        borders: outerBorder(),
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.navy },
        children: [new Paragraph({
          children: [new TextRun({
            text: label.toUpperCase(),
            bold: true, size: 22, color: C.white, font: 'Calibri',
          })],
          alignment: AlignmentType.LEFT,
          spacing: { before: 80, after: 80 },
          indent: { left: 100 },
        })],
      }),
    ],
  });
}

// ── Column header row for a table (label | value) ─────────────────
function columnHeaderRow(col1 = 'PARAMETER', col2 = 'VALUE') {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 38, type: WidthType.PERCENTAGE },
        borders: innerBorder(),
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.navyLight },
        children: [new Paragraph({
          children: [new TextRun({ text: col1, bold: true, size: 18, color: C.navyMid, font: 'Calibri' })],
          spacing: { before: 60, after: 60 },
          indent: { left: 80 },
        })],
      }),
      new TableCell({
        width: { size: 62, type: WidthType.PERCENTAGE },
        borders: innerBorder(),
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.navyLight },
        children: [new Paragraph({
          children: [new TextRun({ text: col2, bold: true, size: 18, color: C.navyMid, font: 'Calibri' })],
          spacing: { before: 60, after: 60 },
          indent: { left: 80 },
        })],
      }),
    ],
  });
}

// ── Data row (label | value) with optional highlight ──────────────
function dataRow(label, value, opts = {}) {
  const {
    index   = 0,
    bold    = false,
    highlight = false,
    labelColor,
    valueColor,
  } = opts;

  const fillLabel  = highlight ? C.rowResult : (index % 2 === 0 ? C.rowEven : C.rowOdd);
  const fillValue  = highlight ? C.rowResult : (index % 2 === 0 ? C.rowEven : C.rowOdd);

  return new TableRow({
    children: [
      new TableCell({
        width: { size: 38, type: WidthType.PERCENTAGE },
        borders: innerBorder(),
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: fillLabel },
        children: [new Paragraph({
          children: [new TextRun({
            text: String(label ?? ''),
            bold: true,
            size: 20,
            font: 'Calibri',
            color: labelColor || C.textMain,
          })],
          spacing: { before: 70, after: 70 },
          indent: { left: 100 },
        })],
      }),
      new TableCell({
        width: { size: 62, type: WidthType.PERCENTAGE },
        borders: innerBorder(),
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: fillValue },
        children: [new Paragraph({
          children: [new TextRun({
            text: String(value ?? '—'),
            bold,
            size: 20,
            font: 'Calibri',
            color: valueColor || C.textMain,
          })],
          spacing: { before: 70, after: 70 },
          indent: { left: 100 },
        })],
      }),
    ],
  });
}

// ── Build a full section table: header + column labels + rows ──────
function sectionTable(sectionLabel, rows, opts = {}) {
  const { showColumnHeaders = true, highlight = [] } = opts;
  const tableRows = [sectionHeaderRow(sectionLabel)];
  if (showColumnHeaders) tableRows.push(columnHeaderRow('PARAMETER', 'VALUE'));

  rows.forEach(([label, value], i) => {
    tableRows.push(dataRow(label, value, {
      index: i,
      highlight: highlight.includes(i),
      bold: highlight.includes(i),
    }));
  });

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: outerBorder(),
    rows: tableRows,
  });
}

// ── Title block: dark banner ───────────────────────────────────────
function buildTitleBlock(service, date, docRef) {
  // Outer navy-background table (1 col x 2 rows)
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 12, color: C.navyDark },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: C.navyDark },
      left:   { style: BorderStyle.SINGLE, size: 12, color: C.navyDark },
      right:  { style: BorderStyle.SINGLE, size: 12, color: C.navyDark },
    },
    rows: [
      // Row 1: main title
      new TableRow({
        children: [
          new TableCell({
            borders: noBorder(),
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.navyDark },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'PSV SIZING REPORT', bold: true, size: 52, color: C.white, font: 'Calibri' }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 160, after: 40 },
              }),
            ],
          }),
        ],
      }),
      // Row 2: subtitle strip
      new TableRow({
        children: [
          new TableCell({
            borders: noBorder(),
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.navy },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: service, italics: true, size: 24, color: 'A8C8E8', font: 'Calibri' }),
                  new TextRun({ text: '   |   ', size: 22, color: '6699BB', font: 'Calibri' }),
                  new TextRun({ text: date, size: 22, color: 'A8C8E8', font: 'Calibri' }),
                  ...(docRef ? [
                    new TextRun({ text: '   |   ', size: 22, color: '6699BB', font: 'Calibri' }),
                    new TextRun({ text: docRef, size: 22, color: 'A8C8E8', font: 'Calibri' }),
                  ] : []),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 120 },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ── Assumptions section as table with assumption items ────────────
function buildAssumptionsTable(items) {
  const header = sectionHeaderRow('4.0  Assumptions & Design Basis');
  const colHdr = columnHeaderRow('ASSUMPTION', 'VALUE / COMMENT');

  const rows = items
    .filter(([, v]) => v != null && v !== '' && v !== '—')
    .map(([label, value], i) => dataRow(label, value, { index: i }));

  if (!rows.length) return null;

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: outerBorder(),
    rows: [header, colHdr, ...rows],
  });
}

// ── Disclaimer box ─────────────────────────────────────────────────
function buildDisclaimer() {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 6, color: C.warnBorder },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: C.warnBorder },
      left:   { style: BorderStyle.SINGLE, size: 6, color: C.warnBorder },
      right:  { style: BorderStyle.SINGLE, size: 6, color: C.warnBorder },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorder(),
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.warn },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: '⚠  DISCLAIMER  ', bold: true, size: 20, font: 'Calibri', color: '7B5800' }),
                  new TextRun({
                    text: 'This report is generated by PSV Pro v4.0 for engineering reference purposes only. '
                        + 'All calculations are based on API 520 / API 521 methodologies. '
                        + 'Results MUST be reviewed and verified by a qualified process or mechanical engineer '
                        + 'before implementation. The software author accepts no liability for errors or omissions.',
                    size: 18, font: 'Calibri', color: '7B5800',
                  }),
                ],
                alignment: AlignmentType.LEFT,
                spacing: { before: 100, after: 100 },
                indent: { left: 120, right: 120 },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ── Footer ─────────────────────────────────────────────────────────
function buildFooter(date) {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: `PSV Pro v4.0  |  Generated: ${date}  |  Page `, size: 16, color: C.textLight, font: 'Calibri' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.textLight, font: 'Calibri' }),
          new TextRun({ text: ' of ', size: 16, color: C.textLight, font: 'Calibri' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: C.textLight, font: 'Calibri' }),
          new TextRun({ text: '  |  ENGINEERING DOCUMENT — NOT FOR CONSTRUCTION WITHOUT AUTHORISATION', size: 16, color: C.textLight, font: 'Calibri' }),
        ],
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.silver } },
      }),
    ],
  });
}

// ── Main generator ────────────────────────────────────────────────
async function generateReport(data) {
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

  // ── Derived values ───────────────────────────────────────────────
  const areaIn2Display  = A_in2 != null
    ? `${Number(A_in2).toFixed(4)} in²   (${(Number(A_in2) * 6.4516).toFixed(3)} cm²)`
    : '—';

  const orificeAreaDisp = orifice_area_in2 != null
    ? `${Number(orifice_area_in2).toFixed(4)} in²   (${(Number(orifice_area_in2) * 6.4516).toFixed(3)} cm²)`
    : '—';

  const utilDisp = utilisation_pct != null
    ? `${Number(utilisation_pct).toFixed(1)}%`
    : '—';

  const phaseLabel = (phase || 'gas').charAt(0).toUpperCase() + (phase || 'gas').slice(1);

  // ── Default assumptions if none provided ────────────────────────
  const assumptionItems = [
    ['Molecular Weight (MW)',          MW != null ? `${MW} kg/kmol` : '—'],
    ['Cp/Cv Ratio (k)',                k  != null ? String(k) : '—'],
    ['Compressibility Factor (Z)',     Z  != null ? String(Z) : '—'],
    ['Discharge Coefficient (Kd)',     toolResult.Kd != null ? String(toolResult.Kd) : '0.975 (API 520 default)'],
    ['Back Pressure Correction (Kb)',  toolResult.Kb != null ? String(toolResult.Kb) : '1.0 (assumed conventional valve)'],
    ['Overpressure Allowance',         '10% of set pressure (single device, API 520 §3.2)'],
    ['Relieving Temperature',          T_rel_C != null ? `${T_rel_C} °C (as specified)` : 'Design temperature'],
    ['Additional Notes',               notes || assumptions || 'None'],
  ];

  // ── Build document ───────────────────────────────────────────────
  const children = [];

  // 1. Title block
  children.push(buildTitleBlock(service, date, docRef));
  children.push(spacer(200));

  // 2. Section 1 — Document Information
  children.push(sectionTable('1.0  Document Information', [
    ['Standard',            standard],
    ['Prepared By',         preparedBy],
    ['Report Date',         date],
    ['Service Description', service],
    ['Relief Scenario',     scenario],
    ['Document Reference',  docRef || 'N/A'],
  ]));
  children.push(spacer(200));

  // 3. Section 2 — Process Conditions
  children.push(sectionTable('2.0  Process Conditions', [
    ['Fluid / Medium',          fluid],
    ['Phase',                   phaseLabel],
    ['Set Pressure',            P_set_barg  != null ? `${P_set_barg} barg` : '—'],
    ['Relieving Pressure',      toolResult.relieving_pressure_barg != null
                                  ? `${toolResult.relieving_pressure_barg} barg`
                                  : P_rel_barg != null ? `${P_rel_barg} barg` : '—'],
    ['Relieving Temperature',   T_rel_C     != null ? `${T_rel_C} °C`   : '—'],
    ['Required Relief Flow',    W_kgh       != null ? `${Number(W_kgh).toLocaleString()} kg/h` : '—'],
    ...(toolResult.flow_regime
      ? [['Flow Regime', toolResult.flow_regime]]
      : []),
    ...(toolResult.heat_input_kW != null
      ? [['Fire Heat Input', `${toolResult.heat_input_kW.toLocaleString()} kW   (${Number(toolResult.heat_input_BTUhr || 0).toLocaleString()} BTU/h)`]]
      : []),
    ...(toolResult.wetted_area_ft2 != null
      ? [['Wetted Surface Area', `${toolResult.wetted_area_ft2} ft²`]]
      : []),
  ]));
  children.push(spacer(200));

  // 4. Section 3 — Calculation Results (highlight key rows)
  const resultRows = [
    ['Required Orifice Area',       areaIn2Display],
    ['Selected API 526 Orifice',    orifice || '—'],
    ['Selected Orifice Area',       orificeAreaDisp],
    ['Orifice Size (inlet × outlet)', orifice_size || '—'],
    ['Capacity Utilisation',        utilDisp],
    ...(toolResult.Kb != null
      ? [['Back Pressure Correction (Kb)', String(toolResult.Kb)]]
      : []),
  ];

  // Highlight rows 1 and 4 (orifice selection + utilisation)
  children.push(sectionTable('3.0  Calculation Results  (API 520)', resultRows, {
    highlight: [1, 4],
  }));
  children.push(spacer(200));

  // 5. Section 4 — Assumptions
  const assumTable = buildAssumptionsTable(assumptionItems);
  if (assumTable) {
    children.push(assumTable);
    children.push(spacer(200));
  }

  // 6. Section 5 — Disclaimer
  children.push(sectionTable('5.0  Verification & Sign-Off', [
    ['Calculated By',    ''],
    ['Reviewed By',      ''],
    ['Approved By',      ''],
    ['Revision',         'Rev 0'],
    ['Status',           'ISSUED FOR REVIEW'],
  ], { showColumnHeaders: false }));
  children.push(spacer(200));

  children.push(buildDisclaimer());

  // ── Assemble document ────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20, color: C.textMain },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 900, right: 900 }, // ~1.25 cm margins
        },
      },
      footers: { default: buildFooter(date) },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateReport };
