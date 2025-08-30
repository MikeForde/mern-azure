import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const formatDate = (dateString) => {
  if (!dateString) return "";
  const [datePart, timePart] = dateString.split("T");
  const time = (timePart || "").split(".")[0] || "";
  return time ? `${datePart} ${time}` : datePart;
};

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
    stripe:  rgb(0.95, 0.95, 0.96)    // zebra row bg
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

  const drawRibbon = (title) => {
    ensureSpace(34);
    // ribbon background
    page.drawRectangle({
      x: margin, y: yOffset - 20, width: width - margin * 2, height: 24,
      color: BRAND.light, borderColor: BRAND.primary, borderWidth: 1,
    });
    page.drawText(title, {
      x: margin + 10, y: yOffset - 16, size: fontSize + 3,
      font: boldFont, color: BRAND.primary,
    });
    yOffset -= 34;
  };

  const drawBulletLine = (text) => {
    // a small bullet dot and the line text
    page.drawCircle({ x: margin + 4, y: yOffset - fontSize * 0.3, size: 2, color: BRAND.accent });
    yOffset = drawText(text, font, fontSize, margin + 12, yOffset - 6);
    return yOffset;
  };

  const drawZebraRow = (rowHeight) => {
    page.drawRectangle({
      x: margin, y: yOffset - rowHeight + 3,
      width: width - margin * 2, height: rowHeight,
      color: BRAND.stripe
    });
  };

  // helper to start a new page
  const newPage = () => {
    page = pdfDoc.addPage([595.28, 841.89]);
    ({ width, height } = page.getSize());
    yOffset = height - margin;

    // Optional: mini running header on subsequent pages
    page.drawRectangle({ x: 0, y: height - 32, width, height: 32, color: rgb(1,1,1) });
    page.drawRectangle({ x: 0, y: height - 33, width, height: 1, color: BRAND.light });
    drawText('International Patient Summary', boldFont, 11, margin, height - 20, BRAND.primary);
    rightAlignedText(`${ips.patient.given} ${ips.patient.name}`, 10, width - margin, height - 20, font, BRAND.subtle);
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
  yOffset = drawText(`${ips.patient.given} ${ips.patient.name}`, boldFont, 14, margin, yOffset, BRAND.subtle);
  yOffset -= 12;

  // --- patient card ---
  ensureSpace(110);
  const cardH = 90;
  page.drawRectangle({
    x: margin, y: yOffset - cardH, width: width - margin * 2, height: cardH,
    color: rgb(1,1,1), borderColor: BRAND.accent, borderWidth: 1
  });

  const leftX = margin + 12;
  const leftVX = margin + 60;
  const rightX = margin + (width - 2 * margin) / 2 + 6;
  const rightVX = rightX + 80;
  let lineY = yOffset - 18;

  const label = (t, x, y) => drawText(t, boldFont, 10, x, y, BRAND.subtle);
  const val   = (t, x, y) => drawText(t, font, 11, x, y, BRAND.text);

  label('Name', leftX, lineY);               val(`${ips?.patient?.given ?? ''} ${ips?.patient?.name ?? ''}`, leftVX, lineY);
  label('DOB', leftX, lineY - 18);           val(`${(ips?.patient?.dob ?? '').split("T")[0]}`, leftVX, lineY - 18);
  label('Gender', leftX, lineY - 36);        val(`${ips?.patient?.gender ?? ''}`, leftVX, lineY - 36);
  label('NATO id', leftX, lineY - 54);        val(`${ips?.patient?.identifier ?? ''}`, leftVX, lineY - 54);

  label('Country', rightX, lineY);           val(`${ips?.patient?.nation ?? ''}`, rightVX, lineY);
  label('Practitioner', rightX, lineY - 18); val(`${ips?.patient?.practitioner ?? ''}`, rightVX, lineY - 18);
  label('Organization', rightX, lineY - 36); val(`${ips?.patient?.organization ?? ''}`, rightVX, lineY - 36);
  label('National id', rightX, lineY - 54); val(`${ips?.patient?.identifier2 ?? ''}`, rightVX, lineY - 54);

  yOffset -= cardH + 14;

  // --- sections ---
  const sections = [
    { title: "Medications",   items: ips?.medication ?? [],   formatItem: (it,i) => `${i+1}. ${it.name} – ${formatDate(it.date)}${it.dosage ? `, ${it.dosage}` : ''}` },
    { title: "Allergies",     items: ips?.allergies ?? [],    formatItem: (it,i) => `${i+1}. ${it.name} – ${it.criticality ?? ''}${it.date ? `, ${String(it.date).split("T")[0]}` : ''}` },
    { title: "Conditions",    items: ips?.conditions ?? [],   formatItem: (it,i) => `${i+1}. ${it.name} – ${formatDate(it.date)}` },
    { title: "Observations",  items: ips?.observations ?? [], formatItem: (it,i) => `${i+1}. ${it.name} – ${formatDate(it.date)}${it.value ? ` = ${it.value}` : ''}` },
    { title: "Immunizations", items: ips?.immunizations ?? [],formatItem: (it,i) => `${i+1}. ${it.name} – ${String(it.date || '').split("T")[0]}${it.system ? ` (${it.system})` : ''}` },
    { title: "Procedures", items: ips?.procedures ?? [],formatItem: (it,i) => `${i+1}. ${it.name} – ${formatDate(it.date)}${it.system ? ` (${it.system})` : ''}` },
  ];

  sections.forEach(section => {
    if (!section.items.length) return; // skip empty sections
    drawRibbon(section.title);

    section.items.forEach((item, idx) => {
      // Estimate row height for single-line items; adjust if your content wraps a lot.
      const rowH = 16;
      ensureSpace(rowH + 8);

      if (idx % 2 === 0) {
        // zebra background for alternating rows
        drawZebraRow(rowH + 4);
      }

      const line = section.formatItem(item, idx);
      yOffset -= 2;
      drawBulletLine(line);
      yOffset -= 4;
    });

    yOffset -= 6;
  });

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
