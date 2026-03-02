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
    organization: {
      name: string;
      contactEmail: string;
      websiteUrl: string | null;
      logoUrl: string | null;
    },
    res: Response,
    meta: { exportedBy: string; dateRange: string },
  ) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        let orgLogoBuffer: Buffer | null = null;
        if (organization.logoUrl && organization.logoUrl.startsWith('http')) {
          try {
            const response = await fetch(organization.logoUrl);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              orgLogoBuffer = Buffer.from(arrayBuffer);
            }
          } catch (e) {
            console.error('Failed to fetch remote organization logo:', e);
          }
        }

        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          bufferPages: true,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=audit-logs.pdf`,
        );

        doc.pipe(res);

        this.addHeader(doc, organization, meta, orgLogoBuffer);
        this.addTableHeader(doc);

        if (logs.length === 0) {
          doc
            .moveDown(1)
            .fontSize(10)
            .fillColor('#64748b')
            .text('No audit logs found for the selected criteria.', {
              align: 'center',
            });
        } else {
          logs.forEach((log, index) => {
            const timestamp = new Date(log.createdAt).toLocaleString();
            const user = log.user
              ? `${log.user.name}\n(${log.user.email})`
              : 'System';
            const action = (log.action || '').replace(/_/g, ' ');
            const entity = (log.entityType || '').replace(/_/g, ' ');
            const device = this.detectDevice(log.userAgent);
            const ip = log.ipAddress || '-';
            const details = JSON.stringify(log.details || {}, null, 2);

            // Calculate row height
            const detailsHeight = doc.heightOfString(details, { width: 115 });
            const userHeight = doc.heightOfString(user, { width: 80 });
            const rowHeight = Math.max(detailsHeight, userHeight, 35) + 15;

            // Check for page overflow
            if (doc.y + rowHeight > 750) {
              doc.addPage();
              this.addTableHeader(doc);
            }

            const startY = doc.y;

            // Zebra striping
            doc.save();
            doc
              .rect(40, startY - 4, 515, rowHeight)
              .fill(index % 2 === 0 ? '#ffffff' : '#f8fbfc');
            doc.restore();

            // Text content
            doc.fillColor('#334155').fontSize(7);

            doc.text(timestamp, 45, startY, { width: 75 });

            // User section
            doc
              .fillColor('#1e293b')
              .font('Helvetica-Bold')
              .text(log.user?.name || 'System', 125, startY, { width: 90 });
            doc
              .fillColor('#64748b')
              .font('Helvetica')
              .fontSize(6)
              .text(log.user?.email || '', 125, startY + 9, { width: 90 });
            doc.fontSize(7);

            doc.text(action, 220, startY, { width: 80 });
            doc.text(entity, 305, startY, { width: 60 });

            // Device & IP
            doc.text(device, 370, startY, { width: 70 });
            doc
              .fillColor('#94a3b8')
              .fontSize(6)
              .text(ip, 370, startY + 9, { width: 70 });
            doc.fontSize(7).fillColor('#334155');

            // Details JSON
            doc
              .font('Courier')
              .fontSize(6)
              .text(details, 445, startY, { width: 105, lineBreak: true });

            doc.font('Helvetica');

            // Bottom border
            doc
              .moveTo(40, startY + rowHeight - 4)
              .lineTo(555, startY + rowHeight - 4)
              .strokeColor('#f1f5f9')
              .lineWidth(0.5)
              .stroke();

            doc.y = startY + rowHeight;
          });
        }

        // Add footer for all pages
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          doc
            .fontSize(8)
            .fillColor('#94a3b8')
            .text(`Page ${i + 1} of ${pages.count}`, 40, doc.page.height - 30, {
              align: 'center',
            });
        }

        doc.end();

        res.on('finish', () => {
          resolve();
        });

        res.on('error', (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private addHeader(
    doc: any,
    organization: any,
    meta: any,
    orgLogoBuffer: Buffer | null,
  ) {
    const leftX = 40;
    const rightAlignX = 400;
    const headerY = 40;

    // --- LEFT SIDE: ORGANIZATION & EXPORT DETAILS ---
    let textX = leftX;
    try {
      if (orgLogoBuffer) {
        doc.image(orgLogoBuffer, leftX, headerY, { cover: [20, 20] });
        textX += 28;
      } else if (
        organization.logoUrl &&
        !organization.logoUrl.startsWith('http') &&
        fs.existsSync(organization.logoUrl)
      ) {
        doc.image(organization.logoUrl, leftX, headerY, { cover: [20, 20] });
        textX += 28;
      }
    } catch (e) {
      console.error('Failed to render organization logo:', e);
    }

    doc
      .fillColor('#1e293b')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(organization.name || 'Audit Report', textX, headerY);

    doc
      .fillColor('#64748b')
      .fontSize(8)
      .font('Helvetica')
      .text(organization.websiteUrl || '', textX, headerY + 16)
      .text(organization.contactEmail || '', textX, headerY + 26);

    // Export Details (Left)
    doc
      .fillColor('#94a3b8')
      .fontSize(7)
      .text(`Exported By: ${meta.exportedBy}`, leftX, headerY + 44)
      .text(`Date Range: ${meta.dateRange}`, leftX, headerY + 54)
      .text(
        `Generated: ${new Date().toLocaleString('en-US', {
          timeZone: 'Asia/Kolkata',
        })}`,
        leftX,
        headerY + 64,
      );

    // --- RIGHT SIDE: TRACKR PLATFORM BRANDING ---
    try {
      if (fs.existsSync(this.logoPath)) {
        doc.image(this.logoPath, 533, headerY, { cover: [22, 22] });
      }
    } catch (e) {
      console.error('Failed to load platform logo:', e);
    }

    doc
      .fillColor('#4f46e5')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Trackr', rightAlignX, headerY + 30, {
        align: 'right',
      });

    doc
      .fillColor('#94a3b8')
      .fontSize(7.5)
      .font('Helvetica')
      .text('Platform Activity Tracking', rightAlignX, headerY + 50, {
        align: 'right',
      });

    // Separator
    doc
      .moveTo(40, 120)
      .lineTo(555, 120)
      .strokeColor('#f1f5f9')
      .lineWidth(0.5)
      .stroke();

    // Report Title
    doc
      .fillColor('#1e293b')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('Audit Activity Log', 40, 130);

    doc
      .moveTo(40, 150)
      .lineTo(555, 150)
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .stroke();

    doc.y = 165;
  }

  private addTableHeader(doc: any) {
    const y = doc.y;
    doc.save();
    doc.rect(40, y, 515, 22).fill('#4f46e5');
    doc.restore();

    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');

    doc.text('Timestamp', 45, y + 7, { width: 75 });
    doc.text('User / Responsible', 125, y + 7, { width: 90 });
    doc.text('Action', 220, y + 7, { width: 80 });
    doc.text('Entity', 305, y + 7, { width: 60 });
    doc.text('Device / IP', 370, y + 7, { width: 70 });
    doc.text('Details (JSON)', 445, y + 7);

    doc.y = y + 28;
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
