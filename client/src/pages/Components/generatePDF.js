import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const formatDate = (dateString) => {
  if (!dateString) return "";
  const [datePart, timePart] = String(dateString).split("T");
  const time = (timePart || "").split(".")[0] || "";
  return time ? `${datePart} ${time}` : datePart;
};
const formatDateNoTime = (dateString) => (String(dateString || "").split("T")[0] || "");

const toEpoch = (v) => {
  if (!v) return Infinity;                        // push missing dates to end
  const s = String(v).trim();
  const iso = s.includes("T") ? s : s.includes(" ") ? s.replace(" ", "T") : s;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Infinity : t;
};
const byOldest = (a, b) => toEpoch(a?.date) - toEpoch(b?.date);

export const generatePDF = async (ips) => {
  const pdfDoc = await PDFDocument.create();

  // first page
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  let { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const imgBytes = await fetch('/DMS icon.png').then(res => res.arrayBuffer());
  const dmsIcon = await pdfDoc.embedPng(imgBytes);

  const iconBlueBytes = await fetch('/DMS%20icon%20blue.png').then(r => r.arrayBuffer());
  const dmsIconBlue = await pdfDoc.embedPng(iconBlueBytes);

  const fontSize = 10;
  const margin = 50;
  let yOffset = height - margin;

  // --- brand colours - test and adjust (not sure about the teal!) ---
  const BRAND = {
    primary: rgb(0.12, 0.45, 0.83),   // deep blue
    accent: rgb(0.00, 0.68, 0.52),   // teal
    light: rgb(0.95, 0.97, 1.00),   // very light blue
    text: rgb(0.10, 0.10, 0.12),   // near-black
    subtle: rgb(0.55, 0.58, 0.60),   // muted grey
    stripe: rgb(0.96, 0.96, 0.97)    // zebra row bg - light but not too light
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
    // ribbon background for main sections e.g. Meds
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

  // We'll clip text to column width with ellipsis - mainly for code system and dosages but works for long drug names as usually clear
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

  // --- NEW: fit as much text as possible in one line (prefers breaking on spaces)
  const fitOneLine = (text, maxWidth, fnt = font, size = fontSize) => {
    const t = String(text ?? "");
    if (!t) return "";
    if (fnt.widthOfTextAtSize(t, size) <= maxWidth) return t;

    // binary search hard limit
    let low = 0, high = t.length, best = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const cand = t.slice(0, mid);
      if (fnt.widthOfTextAtSize(cand, size) <= maxWidth) { best = mid; low = mid + 1; }
      else { high = mid - 1; }
    }
    // try to break on last space within best slice
    const slice = t.slice(0, best);
    const lastSpace = slice.lastIndexOf(" ");
    return lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  };

  // --- NEW: layout text into up to two lines with a 2pt smaller font; ellipsis if still too long
  const twoLineLayout = (text, maxWidth, fnt = font, baseSize = fontSize) => {
    const smaller = Math.max(7, baseSize - 2);
    const t = String(text ?? "");
    if (!t) return { lines: [""], usedSize: baseSize, twoLine: false };

    // If it already fits on one line with base size, keep it single-line
    if (fnt.widthOfTextAtSize(t, baseSize) <= maxWidth) {
      return { lines: [t], usedSize: baseSize, twoLine: false };
    }

    // Switch to smaller size and try two lines
    const first = fitOneLine(t, maxWidth, fnt, smaller);
    const rest = t.slice(first.length).trimStart();
    if (!rest) return { lines: [first], usedSize: smaller, twoLine: false };

    let second = fitOneLine(rest, maxWidth, fnt, smaller);
    // If the remaining text still doesn't fit entirely, add ellipsis
    if (second.length < rest.length) {
      // ensure ellipsis fits
      while (second && fnt.widthOfTextAtSize(second + "…", smaller) > maxWidth) {
        second = second.slice(0, -1);
      }
      second = second ? second + "…" : "…";
    }

    return { lines: [first, second], usedSize: smaller, twoLine: true };
  };


  // Table renderer with repeated headers and zebra rows
  // --- CHANGED: table supports dynamic two-line cells (font -2) and datetime stacking
  const drawTable = (columns, rows, opts = {}) => {
    const headerH = opts.headerHeight || 22;
    const baseRowH = 18;  // single-line height
    const dblRowH = 24;  // enough for two lines (or datetime)

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
      page.drawRectangle({
        x: tableLeft, y: yOffset - headerH, width: tableWidth, height: headerH - 2,
        color: BRAND.light, borderColor: BRAND.primary, borderWidth: 1
      });
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

    const rowNeedsTwoLine = (row) => {
      // If any datetime column exists => two-line height anyway
      if (columns.some(c => c.kind === 'datetime')) return true;

      // Otherwise check if any non-datetime cell will require two lines at smaller font
      return columns.some((col, i) => {
        if (col.kind === 'datetime') return true;
        const colPad = 6;
        const cell = colXs[i];
        const v = row[col.key];
        const baseSize = (col.kind === 'small') ? Math.max(8, fontSize - 2) : fontSize;
        const layout = twoLineLayout(v ?? "", cell.w - 2 * colPad, font, baseSize);
        return layout.twoLine;
      });
    };

    const drawRow = (row, idx) => {
      const twoLine = rowNeedsTwoLine(row);
      const rowH = twoLine ? dblRowH : baseRowH;
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
          const maxW = cell.w - 2 * colPad;

          const dateClipped = clipText(d, maxW, font, dateSize);
          const timeClipped = clipText(t, maxW, font, timeSize);

          // stacked inside row
          const topInset = 0;
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
          // two-line auto layout for long text in non-datetime columns
          const baseSize = (col.kind === 'small') ? Math.max(8, fontSize - 2) : fontSize;
          const maxW = cell.w - 2 * colPad;
          const { lines, usedSize, twoLine: didWrap } = twoLineLayout(v ?? "", maxW, font, baseSize);

          if (didWrap || twoLine) {
            // draw up to two lines stacked
            const topInset = lines[1] ? -2 : 6;
            const firstBaseline = yOffset - topInset - usedSize;
            page.drawText(lines[0], {
              x: cell.x + colPad,
              y: firstBaseline,
              size: usedSize, font, color: BRAND.text
            });

            if (lines[1]) {
              const secondBaseline = firstBaseline - (usedSize + 2);
              page.drawText(lines[1], {
                x: cell.x + colPad,
                y: secondBaseline,
                size: usedSize, font, color: BRAND.text
              });
            }
          } else {
            // single-line
            page.drawText(lines?.[0] ?? String(v ?? ""), {
              x: cell.x + colPad,
              y: yOffset - rowH + 6,
              size: usedSize ?? baseSize, font, color: BRAND.text,
            });
          }
        }
      });

      yOffset -= rowH;
    };

    // initial header
    drawHeader();

    // rows with header-repeat on page break
    rows.forEach((row, idx) => {
      // anticipate per-row height
      const h = rowNeedsTwoLine(row) ? dblRowH : baseRowH;
      if (yOffset - (h + 2) < margin) {
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
    page.drawRectangle({ x: 0, y: height - 32, width, height: 32, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: 0, y: height - 33, width, height: 1, color: BRAND.light });

    // small blue icon
    const smallH = 18; // target height
    const scale = Math.min(smallH / dmsIconBlue.height, 1);
    const sW = dmsIconBlue.width * scale;
    const sH = dmsIconBlue.height * scale;
    page.drawImage(dmsIconBlue, {
      x: margin,
      y: height - 32 + (32 - sH) / 2, // vertically centered
      width: sW,
      height: sH,
    });

    // title text next to icon
    drawText('International Patient Summary', boldFont, 11, margin + sW + 8, height - 20, BRAND.primary);

    // patient name on the right
    rightAlignedText(
      `${ips?.patient?.given ?? ''} ${ips?.patient?.name ?? ''}`,
      10,
      width - margin,
      height - 20,
      font,
      BRAND.subtle
    );

    yOffset = height - margin - 36;
  };


  // --- header bar on first page ---
  page.drawRectangle({ x: 0, y: height - 70, width, height: 70, color: BRAND.primary });

  // draw DMS icon
  const iconDims = dmsIcon.scaleToFit(40, 40);  // adjust size as needed
  page.drawImage(dmsIcon, {
    x: margin,
    y: height - 55,  // a little padding from the top
    width: iconDims.width,
    height: iconDims.height,
  });

  // header title (aligned with icon if present)
  page.drawText('International Patient Summary', {
    x: margin + iconDims.width + 10,   // shift right of the icon
    y: height - 46,
    size: 16,
    font: boldFont,
    color: rgb(1, 1, 1)
  });

  // header timestamp on the right
  rightAlignedText(formatDate(new Date().toISOString()), 10, width - margin, height - 38, font, rgb(1, 1, 1));

  // content starts below the bar
  yOffset = height - margin - 70;

  // --- main title block below the bar (unchanged except it now starts at margin) ---
  yOffset = drawText(`Patient Report `, boldFont, 18, margin, yOffset - 6, BRAND.text);
  yOffset = drawText(`${ips?.packageUUID ?? ''}`, boldFont, 12, margin + 140, yOffset + 22, BRAND.text);
  yOffset -= 8;
  yOffset = drawText(`${ips?.patient?.given ?? ''} ${ips?.patient?.name ?? ''}`, boldFont, 14, margin, yOffset, BRAND.subtle);
  yOffset -= 12;

  // --- patient card ---
  ensureSpace(110);
  const cardH = 90;
  page.drawRectangle({
    x: margin, y: yOffset - cardH, width: width - margin * 2, height: cardH,
    color: rgb(1, 1, 1), borderColor: BRAND.primary, borderWidth: 1
  });

  const leftX = margin + 12;
  const leftVX = margin + 60;
  const rightX = margin + (width - 2 * margin) / 2 + 6;
  const rightVX = rightX + 80;
  let lineY = yOffset - 18;

  const label = (t, x, y) => drawText(t, boldFont, 10, x, y, BRAND.subtle);
  const val = (t, x, y) => drawText(t, font, 11, x, y, BRAND.text);

  label('Name', leftX, lineY); val(`${ips?.patient?.given ?? ''} ${ips?.patient?.name ?? ''}`, leftVX, lineY);
  label('DOB', leftX, lineY - 18); val(`${formatDateNoTime(ips?.patient?.dob)}`, leftVX, lineY - 18);
  label('Gender', leftX, lineY - 36); val(`${ips?.patient?.gender ?? ''}`, leftVX, lineY - 36);
  label('NATO id', leftX, lineY - 54); val(`${ips?.patient?.identifier ?? ''}`, leftVX, lineY - 54);

  label('Country', rightX, lineY); val(`${ips?.patient?.nation ?? ''}`, rightVX, lineY);
  label('Practitioner', rightX, lineY - 18); val(`${ips?.patient?.practitioner ?? ''}`, rightVX, lineY - 18);
  label('Organization', rightX, lineY - 36); val(`${ips?.patient?.organization ?? ''}`, rightVX, lineY - 36);
  label('National id', rightX, lineY - 54); val(`${ips?.patient?.identifier2 ?? ''}`, rightVX, lineY - 54);

  yOffset -= cardH + 14;

  // Medications
  if ((ips?.medication ?? []).length) {
    drawRibbon('Medications');
    drawTable(
      [
        { key: 'name', title: 'Name', w: 0.30 },
        { key: 'dosage', title: 'Dosage', w: 0.22, kind: 'small' },
        { key: 'code', title: 'Code', w: 0.14 },
        { key: 'system', title: 'System', w: 0.16, kind: 'small' },
        { key: 'date', title: 'Date', w: 0.10, kind: 'datetime' },
      ],
      ips.medication
        .slice()
        .sort(byOldest)
        .map(m => ({
          name: m.name || '',
          code: m.code || '',
          system: m.system || '',
          date: String(m.date || ''),
          dosage: m.dosage || ''
        }))
      ,
      { rowHeight: 18, headerHeight: 22 }
    );
  }

  // Allergies
  if ((ips?.allergies ?? []).length) {
    drawRibbon('Allergies');
    drawTable(
      [
        { key: 'name', title: 'Name', w: 0.32 },
        { key: 'criticality', title: 'Criticality', w: 0.16 },
        { key: 'code', title: 'Code', w: 0.16 },
        { key: 'system', title: 'System', w: 0.18, kind: 'small' },
        { key: 'date', title: 'Date', w: 0.18, kind: 'datetime' },
      ],
      ips.allergies
        .slice()
        .sort(byOldest)
        .map(a => ({
          name: a.name || '',
          code: a.code || '',
          system: a.system || '',
          criticality: a.criticality || '',
          date: String(a.date || ''),
        }))
      ,
      { rowHeight: 18, headerHeight: 22 }
    );
  }

  // Conditions
  if ((ips?.conditions ?? []).length) {
    drawRibbon('Conditions');
    drawTable(
      [
        { key: 'name', title: 'Name', w: 0.46 },
        { key: 'code', title: 'Code', w: 0.18 },
        { key: 'system', title: 'System', w: 0.18, kind: 'small' },
        { key: 'date', title: 'Date', w: 0.18, kind: 'datetime' },
      ],
      ips.conditions
        .slice()
        .sort(byOldest)
        .map(c => ({
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
        { key: 'name', title: 'Name', w: 0.30 },
        { key: 'value', title: 'Value', w: 0.22 },
        { key: 'code', title: 'Code', w: 0.14 },
        { key: 'system', title: 'System', w: 0.16, kind: 'small' },
        { key: 'date', title: 'Date', w: 0.18, kind: 'datetime' },
      ],
      ips.observations
        .slice()
        .sort(byOldest)
        .map(o => ({
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
        { key: 'name', title: 'Name', w: 0.44 },
        { key: 'date', title: 'Date', w: 0.18, kind: 'datetime' },
        { key: 'system', title: 'System', w: 0.20, kind: 'small' },
        { key: 'code', title: 'Code', w: 0.18 },
      ],
      ips.immunizations
        .slice()
        .sort(byOldest)
        .map(i => ({
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
        { key: 'name', title: 'Name', w: 0.46 },
        { key: 'system', title: 'System', w: 0.18, kind: 'small' },
        { key: 'code', title: 'Code', w: 0.18 },
        { key: 'date', title: 'Date', w: 0.18, kind: 'datetime' },
      ],
      ips.procedures
        .slice()
        .sort(byOldest)
        .map(p => ({
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

    const ipsuuid = ips?.packageUUID ? `IPS: ${ips.packageUUID}` : '';
    const tag = `Page ${i + 1} of ${total}`;
    const ts = `Generated ${formatDate(new Date().toISOString())}`;
    const fntSize = 9;

    p.drawText(ipsuuid, { x: 40, y: footY, size: fntSize, font, color: BRAND.subtle });

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
