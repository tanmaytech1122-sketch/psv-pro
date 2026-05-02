'use strict';

const {
  Document, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType,
  BorderStyle, Packer, ShadingType,
} = require('docx');

// ── Helper builders ───────────────────────────────────────────────
function heading1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 120 },
  });
}

function heading2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
  });
}

function para(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 80 },
  });
}

function fieldRow(label, value) {
  const cellOpts = {
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left:   { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right:  { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
  };

  return new TableRow({
    children: [
      new TableCell({
        ...cellOpts,
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: 'F0F4F8' },
        children: [new Paragraph({
          children: [new TextRun({ text: label, bold: true, size: 20 })],
          spacing: { before: 60, after: 60 },
        })],
      }),
      new TableCell({
        ...cellOpts,
        width: { size: 65, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [new TextRun({ text: String(value ?? '—'), size: 20 })],
          spacing: { before: 60, after: 60 },
        })],
      }),
    ],
  });
}

function dataTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, value]) => fieldRow(label, value)),
  });
}

function divider() {
  return new Paragraph({
    border: { bottom: { color: 'CCCCCC', space: 1, value: 'single', size: 6 } },
    spacing: { after: 160 },
  });
}

// ── Main generator ────────────────────────────────────────────────
async function generateReport(data) {
  const {
    fluid       = 'Not specified',
    service     = 'PSV Sizing',
    phase       = 'gas',
    scenario    = 'Blocked outlet',
    P_set_barg,
    P_rel_barg,
    T_rel_C,
    W_kgh,
    MW,
    k,
    Z,
    assumptions,
    A_in2,
    orifice,
    orifice_size,
    utilisation_pct,
    notes,
    standard    = 'API 520 / API 521',
    preparedBy  = 'PSV Pro v4.0',
    date        = new Date().toLocaleDateString('en-GB'),
    toolResult  = {},
  } = data;

  const children = [
    // ── Title block ──────────────────────────────────────────────
    new Paragraph({
      children: [
        new TextRun({ text: 'PSV SIZING REPORT', bold: true, size: 36, color: '1E3A5F' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: service, size: 24, color: '444444', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    divider(),

    // ── Document info ────────────────────────────────────────────
    heading2('Document Information'),
    dataTable([
      ['Standard',     standard],
      ['Prepared By',  preparedBy],
      ['Date',         date],
      ['Service',      service],
      ['Phase',        phase.charAt(0).toUpperCase() + phase.slice(1)],
      ['Scenario',     scenario],
    ]),
    new Paragraph({ spacing: { after: 200 } }),

    // ── Process Conditions ───────────────────────────────────────
    heading2('Process Conditions'),
    dataTable([
      ['Fluid',                 fluid],
      ['Set Pressure',          P_set_barg != null ? `${P_set_barg} barg` : '—'],
      ['Relieving Pressure',    P_rel_barg != null ? `${P_rel_barg} barg` : '—'],
      ['Relieving Temperature', T_rel_C    != null ? `${T_rel_C} °C`     : '—'],
      ['Relief Flow Rate',      W_kgh      != null ? `${Number(W_kgh).toLocaleString()} kg/h` : '—'],
    ]),
    new Paragraph({ spacing: { after: 200 } }),

    // ── Fluid Properties ─────────────────────────────────────────
    heading2('Fluid Properties'),
    dataTable([
      ['Molecular Weight (MW)', MW != null ? `${MW} kg/kmol` : '—'],
      ['Cp/Cv Ratio (k)',       k  != null ? String(k)       : '—'],
      ['Compressibility (Z)',   Z  != null ? String(Z)       : '—'],
    ]),
    new Paragraph({ spacing: { after: 200 } }),

    // ── Calculation Results ──────────────────────────────────────
    heading2('Calculation Results'),
    dataTable([
      ['Required Orifice Area',  A_in2        != null ? `${Number(A_in2).toFixed(4)} in²  (${(Number(A_in2)*6.4516).toFixed(3)} cm²)` : '—'],
      ['Selected API 526 Orifice', orifice    || '—'],
      ['Orifice Designation',    orifice_size || '—'],
      ['Capacity Utilisation',   utilisation_pct != null ? `${utilisation_pct.toFixed(1)}%` : '—'],
      ...(toolResult.relieving_pressure_barg != null
        ? [['Relieving Pressure (calc)', `${toolResult.relieving_pressure_barg} barg`]]
        : []),
      ...(toolResult.flow_regime
        ? [['Flow Regime', toolResult.flow_regime]]
        : []),
      ...(toolResult.Kb != null
        ? [['Back Pressure Correction (Kb)', String(toolResult.Kb)]]
        : []),
      ...(toolResult.heat_input_kW != null
        ? [['Fire Heat Input', `${toolResult.heat_input_kW} kW  (${Number(toolResult.heat_input_BTUhr).toLocaleString()} BTU/h)`]]
        : []),
      ...(toolResult.wetted_area_ft2 != null
        ? [['Wetted Surface Area', `${toolResult.wetted_area_ft2} ft²`]]
        : []),
    ]),
    new Paragraph({ spacing: { after: 200 } }),
  ];

  // ── Assumptions ──────────────────────────────────────────────
  if (assumptions) {
    children.push(
      heading2('Assumptions'),
      para(assumptions),
      new Paragraph({ spacing: { after: 200 } }),
    );
  }

  // ── Notes ────────────────────────────────────────────────────
  if (notes && notes !== assumptions) {
    children.push(
      heading2('Notes'),
      para(notes),
      new Paragraph({ spacing: { after: 200 } }),
    );
  }

  // ── Footer disclaimer ─────────────────────────────────────────
  children.push(
    divider(),
    new Paragraph({
      children: [new TextRun({
        text: 'This report was generated by PSV Pro v4.0. All calculations follow API 520/521 standards. '
            + 'Results must be reviewed by a qualified engineer before use.',
        size: 18, color: '888888', italics: true,
      })],
      alignment: AlignmentType.CENTER,
    }),
  );

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          run: { bold: true, size: 28, color: '1E3A5F' },
          paragraph: { spacing: { before: 300, after: 120 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          run: { bold: true, size: 24, color: '2B5278' },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
      ],
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateReport };
