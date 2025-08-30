import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const formatDate = (dateString) => {
  if (!dateString) return "";
  const [datePart, timePart] = String(dateString).split("T");
  const time = (timePart || "").split(".")[0] || "";
  return time ? `${datePart} ${time}` : datePart;
};
const formatDateNoTime = (dateString) => (String(dateString || "").split("T")[0] || "");

export const generatePDF = async (ips) => {
  const pdfDoc = await PDFDocument.create();

  // start with the first page
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  let { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 10;
  const margin = 50;
  let yOffset = height - margin;

  // --- brand colours + helpers ---
  const BRAND = {
    primary: rgb(0.12, 0.45, 0.83),   // deep blue
    accent:  rgb(0.00, 0.68, 0.52),   // teal
    light:   rgb(0.95, 0.97, 1.00),   // very light blue
    text:    rgb(0.10, 0.10, 0.12),   // near-black
    subtle:  rgb(0.55, 0.58, 0.60),   // muted grey
    stripe:  rgb(0.96, 0.96, 0.97)    // zebra row bg
  };

  const drawText = (text, fnt, size, x, y, color = BRAND.text, maxW = width - 2 * margin) => {
    const lines = String(text ?? "").split('\n');
    lines.forEach((line, i) => {
      page.drawText(line, {
        x,
        y: y - i * size * 1.2,
        size,
        font: fnt,
        color,
        maxWidth: maxW,
        lineHeight: size * 1.2
      });
    });
    return y - lines.length * size * 1.2;
  };

  const rightAlignedText = (text, size, xRight, y, fnt = font, color = BRAND.subtle) => {
    const w = fnt.widthOfTextAtSize(text, size);
    page.drawText(text, { x: xRight - w, y, size, font: fnt, color });
  };

  const ensureSpace = (needed = 40) => {
    if (yOffset - needed < margin) newPage();
  };

  const splitDateAndTime = (s) => {
    const str = String(s || "").trim();
    if (!str) return { d: "", t: "" };

    if (str.includes("T")) {
      const [d, tRaw] = str.split("T");
      return { d, t: (tRaw || "").split(".")[0] };
    }
    if (str.includes(" ")) {
      const firstSpace = str.indexOf(" ");
      const d = str.slice(0, firstSpace);
      const rest = str.slice(firstSpace + 1);
      return { d, t: rest.split(".")[0] };
    }
    return { d: str, t: "" };
  };

  const drawRibbon = (title) => {
    ensureSpace(34);
    // ribbon background
    page.drawRectangle({
      x: margin, y: yOffset - 20, width: width - margin * 2, height: 20,
      color: BRAND.primary, borderColor: BRAND.primary, borderWidth: 1,
    });
    page.drawText(title, {
      x: margin + 10, y: yOffset - 16, size: fontSize + 3,
      font: boldFont, color: BRAND.light,
    });
    yOffset -= 20;
  };

  // Clip text to column width with ellipsis
  const clipText = (text, maxWidth, fnt = font, size = fontSize) => {
    const t = String(text ?? "");
    if (fnt.widthOfTextAtSize(t, size) <= maxWidth) return t;
    let low = 0, high = t.length, mid, out = t;
    while (low <= high) {
      mid = Math.floor((low + high) / 2);
      const candidate = t.slice(0, mid) + "…";
      const w = fnt.widthOfTextAtSize(candidate, size);
      if (w <= maxWidth) {
        out = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return out;
  };

  // Table renderer with repeated headers and zebra rows
  const drawTable = (columns, rows, opts = {}) => {
    // If any column is datetime, slightly increase row height to fit two lines
    const hasDateTimeCol = columns.some(c => c.kind === 'datetime');
    const rowH = opts.rowHeight || (hasDateTimeCol ? 24 : 18);
    const headerH = opts.headerHeight || 22;
    const tableLeft = margin;
    const tableWidth = width - 2 * margin;
    const colXs = [];
    let x = tableLeft;

    // compute absolute widths from fractional definitions
    const totalFrac = columns.reduce((s, c) => s + c.w, 0);
    columns.forEach((col) => {
      const w = (col.w / totalFrac) * tableWidth;
      colXs.push({ x, w });
      x += w;
    });

    const drawHeader = () => {
      ensureSpace(headerH + 10);
      // header bg
      page.drawRectangle({
        x: tableLeft, y: yOffset - headerH, width: tableWidth, height: headerH - 2,
        color: BRAND.light, borderColor: BRAND.primary, borderWidth: 1
      });
      // header text
      columns.forEach((col, i) => {
        const colPad = 6;
        const cell = colXs[i];
        const clipped = clipText(col.title, cell.w - 2 * colPad, boldFont, fontSize);
        page.drawText(clipped, {
          x: cell.x + colPad, y: yOffset - headerH + 6, size: fontSize, font: boldFont, color: BRAND.primary
        });
      });
      yOffset -= headerH + 4;
    };

    const drawRow = (row, idx) => {
      ensureSpace(rowH + 2);
      // zebra
      if (idx % 2 === 0) {
        page.drawRectangle({ x: tableLeft, y: yOffset - rowH + 2, width: tableWidth, height: rowH, color: BRAND.stripe });
      }

      columns.forEach((col, i) => {
        const colPad = 6;
        const cell = colXs[i];
        const v = row[col.key];

        if (col.kind === 'datetime') {
          const { d, t } = splitDateAndTime(v);
          const dateSize = Math.max(8, fontSize - 2);
          const timeSize = Math.max(7, fontSize - 3);
          const colPad = 6;
          const cell = colXs[i];
          const maxW = cell.w - 2 * colPad;

          const dateClipped = clipText(d, maxW, font, dateSize);
          const timeClipped = clipText(t, maxW, font, timeSize);

          // Position relative to the row box so it stacks clearly
          const topInset = -2;                       // padding from top of row
          const dateBaseline = yOffset - topInset - dateSize;
          const timeBaseline = dateBaseline - (timeSize + 2);

          page.drawText(dateClipped, {
            x: cell.x + colPad,
            y: dateBaseline,
            size: dateSize, font, color: BRAND.text
          });

          if (t) {
            page.drawText(timeClipped, {
              x: cell.x + colPad,
              y: timeBaseline,
              size: timeSize, font, color: BRAND.text
            });
          }
        } else {
          const clipped = clipText(v ?? "", cell.w - 2 * colPad, font, fontSize);
          page.drawText(clipped, {
            x: cell.x + colPad, y: yOffset - rowH + 6, size: fontSize, font, color: BRAND.text
          });
        }
      });

      yOffset -= rowH;
    };

    // initial header
    drawHeader();

    // rows with header-repeat on page break
    rows.forEach((row, idx) => {
      if (yOffset - (rowH + 2) < margin) {
        newPage();
        drawHeader();
      }
      drawRow(row, idx);
    });

    // grid bottom line (subtle)
    page.drawRectangle({ x: tableLeft, y: yOffset + 2, width: tableWidth, height: 0.6, color: BRAND.light });
    yOffset -= 8;
  };

  // helper to start a new page
  const newPage = () => {
    page = pdfDoc.addPage([595.28, 841.89]);
    ({ width, height } = page.getSize());
    yOffset = height - margin;

    // running header on subsequent pages
    page.drawRectangle({ x: 0, y: height - 32, width, height: 32, color: rgb(1,1,1) });
    page.drawRectangle({ x: 0, y: height - 33, width, height: 1, color: BRAND.light });
    drawText('International Patient Summary', boldFont, 11, margin, height - 20, BRAND.primary);
    rightAlignedText(`${ips?.patient?.given ?? ''} ${ips?.patient?.name ?? ''}`, 10, width - margin, height - 20, font, BRAND.subtle);
    yOffset = height - margin - 36;
  };

  // --- header bar on first page ---
  page.drawRectangle({ x: 0, y: height - 70, width, height: 70, color: BRAND.primary });
  page.drawText('International Patient Summary', {
    x: margin, y: height - 46, size: 16, font: boldFont, color: rgb(1,1,1)
  });
  rightAlignedText(formatDate(new Date().toISOString()), 10, width - margin, height - 38, font, rgb(1,1,1));

  yOffset = height - margin - 70;

  // main title
  yOffset = drawText(`Patient Report`, boldFont, 18, margin, yOffset - 6, BRAND.text);
  yOffset -= 8;
  yOffset = drawText(`${ips?.patient?.given ?? ''} ${ips?.patient?.name ?? ''}`, boldFont, 14, margin, yOffset, BRAND.subtle);
  yOffset -= 12;

  // --- patient card ---
  ensureSpace(110);
  const cardH = 90;
  page.drawRectangle({
    x: margin, y: yOffset - cardH, width: width - margin * 2, height: cardH,
    color: rgb(1,1,1), borderColor: BRAND.primary, borderWidth: 1
  });

  const leftX = margin + 12;
  const leftVX = margin + 60;
  const rightX = margin + (width - 2 * margin) / 2 + 6;
  const rightVX = rightX + 80;
  let lineY = yOffset - 18;

  const label = (t, x, y) => drawText(t, boldFont, 10, x, y, BRAND.subtle);
  const val   = (t, x, y) => drawText(t, font, 11, x, y, BRAND.text);

  label('Name', leftX, lineY);               val(`${ips?.patient?.given ?? ''} ${ips?.patient?.name ?? ''}`, leftVX, lineY);
  label('DOB', leftX, lineY - 18);           val(`${formatDateNoTime(ips?.patient?.dob)}`, leftVX, lineY - 18);
  label('Gender', leftX, lineY - 36);        val(`${ips?.patient?.gender ?? ''}`, leftVX, lineY - 36);
  label('NATO id', leftX, lineY - 54);       val(`${ips?.patient?.identifier ?? ''}`, leftVX, lineY - 54);

  label('Country', rightX, lineY);           val(`${ips?.patient?.nation ?? ''}`, rightVX, lineY);
  label('Practitioner', rightX, lineY - 18); val(`${ips?.patient?.practitioner ?? ''}`, rightVX, lineY - 18);
  label('Organization', rightX, lineY - 36); val(`${ips?.patient?.organization ?? ''}`, rightVX, lineY - 36);
  label('National id', rightX, lineY - 54);  val(`${ips?.patient?.identifier2 ?? ''}`, rightVX, lineY - 54);

  yOffset -= cardH + 14;

  // Medications
  if ((ips?.medication ?? []).length) {
    drawRibbon('Medications');
    drawTable(
      [
        { key: 'name',   title: 'Name',   w: 0.30 },
        { key: 'code',   title: 'Code',   w: 0.14 },
        { key: 'system', title: 'System', w: 0.16 },
        { key: 'date',   title: 'Date',   w: 0.18, kind: 'datetime' }, 
        { key: 'dosage', title: 'Dosage', w: 0.22 },
      ],
      ips.medication.map(m => ({
        name: m.name || '',
        code: m.code || '',
        system: m.system || '',
        date: String(m.date || ''),
        dosage: m.dosage || ''
      })),
      { rowHeight: 18, headerHeight: 22 }
    );
  }

  // Allergies
  if ((ips?.allergies ?? []).length) {
    drawRibbon('Allergies');
    drawTable(
      [
        { key: 'name',        title: 'Name',        w: 0.32 },
        { key: 'code',        title: 'Code',        w: 0.16 },
        { key: 'system',      title: 'System',      w: 0.18 },
        { key: 'criticality', title: 'Criticality', w: 0.16 },
        { key: 'date',        title: 'Date',        w: 0.18, kind: 'datetime' }, 
      ],
      ips.allergies.map(a => ({
        name: a.name || '',
        code: a.code || '',
        system: a.system || '',
        criticality: a.criticality || '',
        date: String(a.date || ''),
      })),
      { rowHeight: 18, headerHeight: 22 }
    );
  }

  // Conditions
  if ((ips?.conditions ?? []).length) {
    drawRibbon('Conditions');
    drawTable(
      [
        { key: 'name',   title: 'Name',   w: 0.46 },
        { key: 'code',   title: 'Code',   w: 0.18 },
        { key: 'system', title: 'System', w: 0.18 },
        { key: 'date',   title: 'Date',   w: 0.18, kind: 'datetime' },
      ],
      ips.conditions.map(c => ({
        name: c.name || '',
        code: c.code || '',
        system: c.system || '',
        date: String(c.date || ''),
      })),
      { rowHeight: 18, headerHeight: 22 }
    );
  }

  // Observations
  if ((ips?.observations ?? []).length) {
    drawRibbon('Observations');
    drawTable(
      [
        { key: 'name',   title: 'Name',   w: 0.30 },
        { key: 'code',   title: 'Code',   w: 0.14 },
        { key: 'system', title: 'System', w: 0.16 },
        { key: 'date',   title: 'Date',   w: 0.18, kind: 'datetime' },
        { key: 'value',  title: 'Value',  w: 0.22 },
      ],
      ips.observations.map(o => ({
        name: o.name || '',
        code: o.code || '',
        system: o.system || '',
        date: String(o.date || ''),
        value: o.value || ''
      })),
      { rowHeight: 18, headerHeight: 22 }
    );
  }

  // Immunizations
  if ((ips?.immunizations ?? []).length) {
    drawRibbon('Immunizations');
    drawTable(
      [
        { key: 'name',   title: 'Name',   w: 0.44 },
        { key: 'date',   title: 'Date',   w: 0.18, kind: 'datetime' },
        { key: 'system', title: 'System', w: 0.20 },
        { key: 'code',   title: 'Code',   w: 0.18 },
      ],
      ips.immunizations.map(i => ({
        name: i.name || '',
        date: String(i.date || ''),
        system: i.system || '',
        code: i.code || ''
      })),
      { rowHeight: 18, headerHeight: 22 }
    );
  }

  // Procedures
  if ((ips?.procedures ?? []).length) {
    drawRibbon('Procedures');
    drawTable(
      [
        { key: 'name',   title: 'Name',   w: 0.46 },
        { key: 'date',   title: 'Date',   w: 0.18, kind: 'datetime' },
        { key: 'system', title: 'System', w: 0.18 },
        { key: 'code',   title: 'Code',   w: 0.18 },
      ],
      ips.procedures.map(p => ({
        name: p.name || '',
        date: String(p.date || ''),
        system: p.system || '',
        code: p.code || ''
      })),
      { rowHeight: 18, headerHeight: 22 }
    );
  }

  // --- page footer: page X of Y + timestamp ---
  const pages = pdfDoc.getPages();
  const total = pages.length;
  for (let i = 0; i < total; i++) {
    const p = pages[i];
    const { width: w } = p.getSize();
    const footY = 24;

    // thin divider line (use a 0.6pt rectangle)
    p.drawRectangle({ x: 40, y: 40, width: w - 80, height: 0.6, color: BRAND.subtle });

    const tag = `Page ${i + 1} of ${total}`;
    const ts  = `Generated ${formatDate(new Date().toISOString())}`;
    const fntSize = 9;

    const tagW = font.widthOfTextAtSize(tag, fntSize);
    p.drawText(tag, { x: (w - tagW) / 2, y: footY, size: fntSize, font, color: BRAND.subtle });

    const tsW = font.widthOfTextAtSize(ts, fntSize);
    p.drawText(ts, { x: w - 40 - tsW, y: footY, size: fntSize, font, color: BRAND.subtle });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const newWindow = window.open(url);

  setTimeout(() => {
    if (!newWindow) return;
    newWindow.document.title = `Patient_${ips?.patient?.given ?? ''}_${ips?.patient?.name ?? ''}_Report.pdf`;
    const dl = newWindow.document.createElement('a');
    dl.href = url;
    dl.download = `Patient_${ips?.patient?.given ?? ''}_${ips?.patient?.name ?? ''}_Report.pdf`;
    newWindow.document.body.appendChild(dl);
    setTimeout(() => dl.remove(), 1000);
  }, 500);
};
