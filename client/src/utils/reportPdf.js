import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatMoney } from './money';

const GREEN = [45, 90, 39]; // --primary-green
const MARGIN = 14;

// A summary value or table cell as text; `money` marks currency figures
export const formatCell = (value, money) => {
  if (value === null || value === undefined || value === '') return '—';
  return money ? formatMoney(value) : String(value);
};

// jsPDF's built-in fonts only cover basic Latin, so swap typographic dashes and dots
const pdfText = (s) => String(s).replace(/[–—]/g, '-').replace(/·/g, '|');

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Builds and downloads a PDF for any report shaped { summary, sections }
export const exportReportPdf = ({ report, data }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...GREEN);
  doc.text('DairyDan', MARGIN, 18);
  doc.setFontSize(13);
  doc.setTextColor(33);
  doc.text(pdfText(report.title), MARGIN, 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    pdfText(
      `Period ${report.date_from} to ${report.date_to} · generated ${new Date().toLocaleString()}` +
        (report.generated_by_name ? ` · requested by ${report.generated_by_name}` : '')
    ),
    MARGIN,
    32
  );

  autoTable(doc, {
    startY: 38,
    head: [['Summary', '']],
    body: data.summary.map((s) => [pdfText(s.label), pdfText(formatCell(s.value, s.money))]),
    theme: 'grid',
    headStyles: { fillColor: GREEN },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: 110
  });

  data.sections.forEach((section) => {
    let y = doc.lastAutoTable.finalY + 10;
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(33);
    doc.text(pdfText(section.title), MARGIN, y);

    const money = section.money || [];
    autoTable(doc, {
      startY: y + 3,
      head: [section.columns.map(pdfText)],
      body: section.rows.length
        ? section.rows.map((row) => row.map((v, i) => pdfText(formatCell(v, money.includes(i)))))
        : [[{ content: 'No entries in this period', colSpan: section.columns.length, styles: { textColor: 130 } }]],
      theme: 'striped',
      headStyles: { fillColor: GREEN },
      styles: { fontSize: 9 },
      columnStyles: Object.fromEntries(money.map((i) => [i, { halign: 'right' }])),
      // columnStyles only reach body cells; line money headings up with their figures
      didParseCell: (hook) => {
        if (hook.section === 'head' && money.includes(hook.column.index)) hook.cell.styles.halign = 'right';
      },
      margin: { left: MARGIN, right: MARGIN }
    });
  });

  // Page numbers once the page count is known
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Page ${i} of ${pages}`, doc.internal.pageSize.getWidth() - MARGIN, pageHeight - 8, { align: 'right' });
  }

  doc.save(`dairydan-${slug(report.title)}.pdf`);
};
