import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const formatDate = (dateString) => {
  if (!dateString) return "";
  const [datePart, timePart] = dateString.split("T");
  const time = timePart.split(".")[0];
  return `${datePart} ${time}`;
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

  // drawText now closes over the current `page`
  const drawText = (text, font, size, x, y) => {
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      page.drawText(line, {
        x,
        y: y - i * size * 1.2,
        size,
        font,
        color: rgb(0, 0, 0),
        maxWidth: width - 2 * margin,
        lineHeight: size * 1.2
      });
    });
    return y - lines.length * size * 1.2;
  };

  // helper to start a new page
  const newPage = () => {
    page = pdfDoc.addPage([595.28, 841.89]);
    ({ width, height } = page.getSize());
    yOffset = height - margin;
  };

  // Add title
  drawText(`Patient Report: ${ips.patient.given} ${ips.patient.name}`, boldFont, 12, margin, yOffset);
  yOffset -= 20;

  const details = [
    `Name: ${ips.patient.name}`,
    `Given Name: ${ips.patient.given}`,
    `DOB: ${ips.patient.dob.split("T")[0]}`,
    `Gender: ${ips.patient.gender}`,
    `Country: ${ips.patient.nation}`,
    `Practitioner: ${ips.patient.practitioner}`,
    `Organization: ${ips.patient.organization}`
  ];

  // Patient details
  details.forEach(detail => {
    if (yOffset < margin) newPage();
    drawText(detail, font, fontSize, margin, yOffset);
    yOffset -= 15;
  });

  yOffset -= 5;

  const sections = [
    { title: "Medications",    items: ips.medication,   formatItem: (it,i) => `${i+1}. ${it.name} – ${formatDate(it.date)}, ${it.dosage}` },
    { title: "Allergies",      items: ips.allergies,    formatItem: (it,i) => `${i+1}. ${it.name} – ${it.criticality}, ${it.date.split("T")[0]}` },
    { title: "Conditions",     items: ips.conditions,   formatItem: (it,i) => `${i+1}. ${it.name} – ${formatDate(it.date)}` },
    { title: "Observations",   items: ips.observations, formatItem: (it,i) => `${i+1}. ${it.name} – ${formatDate(it.date)} = ${it.value}` },
    { title: "Immunizations",  items: ips.immunizations,formatItem: (it,i) => `${i+1}. ${it.name} – ${it.date.split("T")[0]} (${it.system})` },
  ];

  sections.forEach(section => {
    if (yOffset < margin) newPage();
    drawText(section.title, boldFont, fontSize + 2, margin, yOffset);
    yOffset -= 15;

    section.items.forEach((item, idx) => {
      if (yOffset < margin) newPage();
      const line = section.formatItem(item, idx);
      yOffset = drawText(line, font, fontSize, margin, yOffset) - 5;
    });
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const newWindow = window.open(url);

  setTimeout(() => {
    newWindow.document.title = `Patient_${ips.patient.given}_${ips.patient.name}_Report.pdf`;
    const dl = newWindow.document.createElement('a');
    dl.href = url;
    dl.download = `Patient_${ips.patient.given}_${ips.patient.name}_Report.pdf`;
    newWindow.document.body.appendChild(dl);
    setTimeout(() => dl.remove(), 1000);
  }, 500);
};
