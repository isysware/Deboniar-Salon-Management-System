import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { Invoice, Branch } from '@/types/salon';
import { formatCurrency } from '@/lib/formatters';

export const getCleanWhatsAppPhone = (rawPhone: string): string => {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('3')) return `92${digits}`;
  return digits;
};

export interface GeneratedReceipt {
  pdf: jsPDF;
  blob: Blob;
  file: File;
  dataUrl: string;
  fileName: string;
  imageBlob?: Blob;
}

/**
 * Captures the exact on-screen receipt DOM element (A to Z)
 * and turns it into a high-resolution, continuous-roll thermal POS PDF.
 */
export async function generateReceiptPdf(
  element: HTMLElement,
  invoiceNumber: string
): Promise<GeneratedReceipt> {
  const safeInvoiceNo = (invoiceNumber || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Receipt-${safeInvoiceNo}.pdf`;

  // Render element to high-res canvas (scale: 2 for sharp crisp text and lines)
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 800,
    onclone: (_clonedDoc, clonedEl) => {
      // Clean styling on clone so PDF has no scrollbars or clipped regions
      clonedEl.style.maxHeight = 'none';
      clonedEl.style.height = 'auto';
      clonedEl.style.overflow = 'visible';
      clonedEl.style.boxShadow = 'none';
      clonedEl.style.borderRadius = '0px';
      clonedEl.style.border = 'none';
      clonedEl.style.width = '380px';
      clonedEl.style.margin = '0 auto';
      clonedEl.style.padding = '16px';
      clonedEl.style.backgroundColor = '#ffffff';
    },
  });

  // Calculate 80mm thermal receipt dimensions in mm
  const pdfWidth = 80;
  const pdfHeight = Math.max(100, (canvas.height * pdfWidth) / canvas.width);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pdfWidth, pdfHeight],
    compress: true,
  });

  const imgData = canvas.toDataURL('image/png', 1.0);
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

  const blob = pdf.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });
  const dataUrl = URL.createObjectURL(blob);

  // Also extract PNG image blob if possible for clipboard copy
  let imageBlob: Blob | undefined;
  try {
    imageBlob = await new Promise<Blob | undefined>((resolve) => {
      canvas.toBlob((b) => resolve(b || undefined), 'image/png');
    });
  } catch {
    // Ignore canvas toBlob issues
  }

  return {
    pdf,
    blob,
    file,
    dataUrl,
    fileName,
    imageBlob,
  };
}

/**
 * Direct download of the receipt PDF to cashier's computer.
 */
export async function downloadReceiptPdf(
  element: HTMLElement,
  invoiceNumber: string
): Promise<string> {
  const generated = await generateReceiptPdf(element, invoiceNumber);
  generated.pdf.save(generated.fileName);
  return generated.fileName;
}

export interface ShareWhatsAppResult {
  sharedDirectly: boolean;
  downloaded: boolean;
  fileName: string;
  phone: string;
  file: File;
}

/**
 * Handles sharing the receipt PDF to customer WhatsApp:
 * 1. Generates the exact receipt PDF.
 * 2. Uses Web Share API if supported (directly sends PDF file to WhatsApp on mobile / tablets / modern Windows).
 * 3. On desktop browsers without Web Share file support:
 *    - Downloads the PDF file to cashier's PC.
 *    - Copies image of receipt to clipboard (if supported) so cashier can also press Ctrl+V in WhatsApp Web.
 *    - Opens WhatsApp chat directly with clean intro message.
 */
export async function shareReceiptPdfViaWhatsApp({
  element,
  invoice,
  branch,
  targetPhone,
}: {
  element: HTMLElement;
  invoice: Invoice;
  branch: Branch | null;
  targetPhone: string;
}): Promise<ShareWhatsAppResult> {
  const cleanPhone = getCleanWhatsAppPhone(targetPhone);
  if (!cleanPhone) {
    throw new Error('Please enter a valid customer WhatsApp number.');
  }

  const generated = await generateReceiptPdf(element, invoice.invoiceNumber);

  // Try Web Share API with file attachment (Mobile / Tablet / Modern desktop)
  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [generated.file] })
  ) {
    try {
      await navigator.share({
        files: [generated.file],
        title: `Receipt - ${invoice.invoiceNumber}`,
        text: `Here is your official receipt for Invoice #${invoice.invoiceNumber} from ${branch?.name || 'our salon'}.`,
      });
      return {
        sharedDirectly: true,
        downloaded: false,
        fileName: generated.fileName,
        phone: cleanPhone,
        file: generated.file,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled native share sheet
        return {
          sharedDirectly: false,
          downloaded: false,
          fileName: generated.fileName,
          phone: cleanPhone,
          file: generated.file,
        };
      }
      // Fall through to desktop download + open chat flow
    }
  }

  // Desktop flow:
  // 1. Download the PDF file directly to downloads folder
  generated.pdf.save(generated.fileName);

  // 2. Try copying image to clipboard for instant Ctrl+V pasting in WhatsApp Web
  if (generated.imageBlob && navigator.clipboard && (window as any).ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': generated.imageBlob }),
      ]);
    } catch {
      // Ignore clipboard write restrictions
    }
  }

  // 3. Prepare formatted intro message for WhatsApp chat
  const branchName = (branch?.name || 'SALON & SPA').toUpperCase();
  const summaryText = `*${branchName} — OFFICIAL RECEIPT*
Invoice No: *${invoice.invoiceNumber}*
Date: ${invoice.date}${invoice.time ? ` • ${invoice.time}` : ''}
Customer: ${invoice.clientName || 'Valued Customer'}
Total Amount: *${formatCurrency(invoice.total)}*
Amount Paid: *${formatCurrency(invoice.amountPaid)}*
Balance Due: *${formatCurrency(invoice.amountDue)}*
Status: *${invoice.status}*

📄 _Please find your official PDF Receipt attached above._
Thank you for visiting! We look forward to seeing you again.`;

  const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(summaryText)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  return {
    sharedDirectly: false,
    downloaded: true,
    fileName: generated.fileName,
    phone: cleanPhone,
    file: generated.file,
  };
}
