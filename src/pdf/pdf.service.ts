import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

@Injectable()
export class PdfService {
  private logoPath = path.join(process.cwd(), 'public/logo.jpeg');

  async generateAuditLogsPdf(
    logs: any[],
    res: Response,
    meta: { exportedBy: string; dateRange: string },
  ) {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      bufferPages: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs.pdf`);

    doc.pipe(res);

    this.addHeader(doc, meta);
    this.addTableHeader(doc);

    let y = doc.y;

    logs.forEach((log) => {
      const timestamp = new Date(log.createdAt).toLocaleString();
      const user = log.user
        ? `${log.user.name}\n(${log.user.email})`
        : 'System';
      const action = log.action.replace(/_/g, ' ');
      const entity = log.entityType.replace(/_/g, ' ');
      const device = this.detectDevice(log.userAgent);
      const ip = log.ipAddress || '-';
      const details = JSON.stringify(log.details, null, 2);

      // Calculate row height
      const detailsHeight = doc.heightOfString(details, { width: 120 });
      const userHeight = doc.heightOfString(user, { width: 80 });
      const rowHeight = Math.max(detailsHeight, userHeight, 30) + 15;

      if (y + rowHeight > 780) {
        doc.addPage();
        this.addTableHeader(doc);
        y = doc.y;
      }

      // Zebra striping
      doc
        .rect(40, y - 5, 515, rowHeight)
        .fill(y % 40 === 0 ? '#ffffff' : '#f9fafb');
      doc.fillColor('#1f2937').fontSize(7.5);

      doc.text(timestamp, 45, y, { width: 65 });
      doc.text(user, 115, y, { width: 80 });
      doc.text(action, 200, y, { width: 70 });
      doc.text(entity, 275, y, { width: 55 });
      doc.text(device, 335, y, { width: 45 });
      doc.text(ip, 385, y, { width: 45 });
      doc.font('Courier').fontSize(7).text(details, 435, y, { width: 115 });
      doc.font('Helvetica');

      y += rowHeight;
      doc
        .moveTo(40, y - 5)
        .lineTo(555, y - 5)
        .strokeColor('#e5e7eb')
        .stroke();
    });

    // Add footer
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .text(`Page ${i + 1} of ${pages.count}`, 40, doc.page.height - 40, {
          align: 'center',
        });
    }

    doc.end();
  }

  private addHeader(doc: InstanceType<typeof PDFDocument>, meta: any) {
    try {
      if (fs.existsSync(this.logoPath)) {
        doc.image(this.logoPath, 40, 40, { width: 30 });
      }
    } catch (e) {
      console.error('Failed to load logo for PDF:', e);
    }

    // Brand Name
    doc
      .fillColor('#4f46e5')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('Trackr', 80, 42);

    // Report Title
    doc
      .fillColor('#0f172a')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Audit Activity Report', 80, 62);

    // Metadata Section
    const infoY = 100;

    const rawDateRange: string[] = meta.dateRange.split(' ');
    const formattedDateRange = rawDateRange.map((text) => {
      return text.charAt(0).toUpperCase() + text.slice(1);
    });
    const formattedDateRangeString = formattedDateRange.join(' ');

    doc
      .fontSize(8)
      .fillColor('#64748b')
      .font('Helvetica')
      .text(`Exported By: ${meta.exportedBy}`, 40, infoY)
      .text(`Date Range: ${formattedDateRangeString}`, 40, infoY + 12)
      .text(`Generated On: ${new Date().toLocaleString()}`, 40, infoY + 24);

    // Horizontal Separator
    doc
      .moveTo(40, 145)
      .lineTo(555, 145)
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .stroke();

    doc.y = 160;
  }

  private addTableHeader(doc: InstanceType<typeof PDFDocument>) {
    const y = doc.y;
    doc.rect(40, y - 5, 515, 22).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');

    doc
      .text('Timestamp', 45, y)
      .text('Responsible', 115, y)
      .text('Action', 200, y)
      .text('Entity', 275, y)
      .text('Device', 335, y)
      .text('IP', 385, y)
      .text('Details (JSON)', 435, y);

    doc.moveDown(1.5);
    doc.font('Helvetica');
  }

  private detectDevice(userAgent: string): string {
    if (!userAgent) return '-';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Linux')) return 'Linux';
    return 'Other';
  }
}
