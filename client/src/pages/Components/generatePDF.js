import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const formatDate = (dateString) => {
  if (!dateString) return "";
  const [datePart, timePart] = dateString.split("T");
  const time = timePart.split(".")[0];
  return `${datePart} ${time}`;
};

export const generatePDF = async (ips) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 10;
  const margin = 50;
  let yOffset = height - margin;

  // Modified drawText function to handle text wrapping
  const drawText = (text, font, size, x, y) => {
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      page.drawText(line, {
        x,
        y: y - (index * size * 1.2), // Adjust line height for wrapped text
        size,
        font,
        color: rgb(0, 0, 0),
        maxWidth: width - 2 * margin,
        lineHeight: size * 1.2, // Line height adjustment
      });
    });

    return y - (lines.length * size * 1.2); // Return the new yOffset after drawing text
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

  // Add patient details
  details.forEach(detail => {
    if (yOffset < margin) {
      yOffset = height - margin;
      pdfDoc.addPage();
    }
    drawText(detail, font, fontSize, margin, yOffset);
    yOffset -= 15;
  });

  yOffset -= 5;

  const sections = [
    { title: "Medications", items: ips.medication, formatItem: (item, index) => `${index + 1}. ${item.name} - Date: ${formatDate(item.date)} - Dosage: ${item.dosage}` },
    { title: "Allergies", items: ips.allergies, formatItem: (item, index) => `${index + 1}. ${item.name} - Criticality: ${item.criticality} - Date: ${item.date.split("T")[0]}` },
    { title: "Conditions", items: ips.conditions, formatItem: (item, index) => `${index + 1}. ${item.name} - Date: ${formatDate(item.date)}` },
    { title: "Observations", items: ips.observations, formatItem: (item, index) => `${index + 1}. ${item.name} - Date: ${formatDate(item.date)} - Value: ${item.value}` },
    { title: "Immunizations", items: ips.immunizations, formatItem: (item, index) => `${index + 1}. ${item.name} - Date: ${item.date.split("T")[0]} - System: ${item.system}` }
  ];

  // Adjust yOffset calculation when drawing text
  sections.forEach(section => {
    yOffset -= 15;
    if (yOffset < margin) {
      yOffset = height - margin;
      pdfDoc.addPage();
    }
    drawText(section.title, boldFont, fontSize + 2, margin, yOffset);
    yOffset -= 15;

    section.items.forEach((item, index) => {
      if (yOffset < margin) {
        yOffset = height - margin;
        pdfDoc.addPage();
      }
      const text = section.formatItem(item, index);
      yOffset = drawText(text, font, fontSize, margin, yOffset);
      yOffset -= 5; // Adjust spacing between items
    });
  });

  const pdfBytes = await pdfDoc.save();

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const newWindow = window.open(url);

  setTimeout(() => {
    newWindow.document.title = `Patient_${ips.patient.given}_${ips.patient.name}_Report.pdf`;
    const downloadLink = newWindow.document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `Patient_${ips.patient.given}_${ips.patient.name}_Report.pdf`;
    newWindow.document.body.appendChild(downloadLink);

    setTimeout(() => {
      downloadLink.parentNode.removeChild(downloadLink);
    }, 1000);
  }, 500);
};
