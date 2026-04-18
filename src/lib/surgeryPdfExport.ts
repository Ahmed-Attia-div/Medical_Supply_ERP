/**
 * surgeryPdfExport.ts
 *
 * Exports a surgery report as a PDF using the browser's native print dialog
 * with a hidden iframe — no external PDF library needed.
 *
 * Works with Arabic RTL and prints correctly in Chrome, Firefox, Edge, and
 * Safari (all support CSS @page and RTL print).
 *
 * Usage:
 *   import { printSurgeryReport } from '@/lib/surgeryPdfExport';
 *   await printSurgeryReport(surgeryData);
 */

import type { Surgery } from '@/types/inventory';

/** Render the surgery report HTML string for printing */
function buildPrintHtml(surgery: Surgery, pricesHidden = false): string {
    const netItems = surgery.items
        .map(item => ({
            ...item,
            netQty: item.quantity - (item.returnedQuantity ?? 0),
        }))
        .filter(i => i.netQty > 0);

    const grandTotal = netItems.reduce(
        (acc, item) => acc + item.sellingPrice * item.netQty,
        0,
    );

    const fmt = (n: number) =>
        new Intl.NumberFormat('en-EG', { minimumFractionDigits: 0 }).format(n);

    const reportDate = surgery.date instanceof Date
        ? surgery.date
        : new Date(surgery.date as string);

    const dateStr = reportDate.toLocaleDateString('ar-EG', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });

    const itemRows = netItems.map((item, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#f9f9f9'}">
      <td style="text-align:center;color:#999;font-size:11px;border-left:1px solid #eee;padding:8px">${idx + 1}</td>
      <td style="padding:8px;font-family:monospace;font-size:11px">${item.sku ?? item.productId.slice(-8).toUpperCase()}</td>
      <td style="padding:8px;font-size:13px;font-weight:600">
        ${item.itemName}
        ${item.returnedQuantity > 0 ? `<span style="font-size:10px;color:#d97706;font-weight:400">(مُعاد ${item.returnedQuantity})</span>` : ''}
      </td>
      <td style="text-align:center;font-size:16px;font-weight:700;padding:8px;border-right:1px solid #eee">${item.netQty}</td>
      ${pricesHidden ? '' : `
      <td style="text-align:right;padding:8px;border-right:1px solid #eee;direction:ltr;font-size:11px">${fmt(item.sellingPrice)} ج</td>
      <td style="text-align:right;padding:8px;border-right:1px solid #eee;direction:ltr;font-size:13px;font-weight:700;color:#1e3a8a">${fmt(item.sellingPrice * item.netQty)} ج</td>
      `}
    </tr>
  `).join('');

    const totalRow = pricesHidden ? '' : `
    <tfoot>
      <tr style="background:linear-gradient(to left,#1e3a8a,#1e40af);color:#fff">
        <td colspan="5" style="padding:10px;text-align:right;font-weight:700;font-size:14px">
          الإجمالي الكلي &nbsp;|&nbsp; <span style="font-size:11px;color:#bfdbfe;font-weight:400">Grand Total</span>
        </td>
        <td style="padding:10px;text-align:right;direction:ltr;border-right:1px solid #1e40af">
          <div style="font-size:22px;font-weight:900">${fmt(grandTotal)}</div>
          <div style="font-size:10px;color:#bfdbfe">جنيه مصري</div>
        </td>
      </tr>
    </tfoot>
  `;

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>تقرير عملية جراحية</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', 'Arial', sans-serif;
      color: #111;
      background: #fff;
      direction: rtl;
    }
    @page {
      size: A4 portrait;
      margin: 18mm 14mm;
    }
    .page { padding: 24px; max-width: 210mm; margin: auto; }
    table { border-collapse: collapse; width: 100%; border: 1px solid #e5e5e5; border-radius: 8px; overflow:hidden; }
    th   { font-size: 11px; padding: 8px 12px; color:#fff; background:#111; }
    td   { font-size: 12px; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
    .section-header {
      background:#111; color:#fff; padding:8px 16px;
      display:flex; justify-content:space-between; align-items:center;
    }
    .label { font-size:9px; color:#999; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px dashed #ddd; padding-bottom:2px; margin-bottom:4px; }
    .value { font-size:13px; font-weight:700; }
    .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px 32px; padding:16px; background:#fafafa; }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px">
    <div style="text-align:center;width:80px">
      <div style="width:60px;height:60px;background:linear-gradient(135deg,#1d4ed8,#1e3a8a);border-radius:10px;display:flex;align-items:center;justify-content:center;margin:0 auto 4px">
        <span style="color:#fff;font-size:28px;font-weight:900">Δ</span>
      </div>
      <p style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.08em;font-weight:700">Delta Medical</p>
    </div>
    <div style="text-align:center;flex:1;">
      <h1 style="font-size:22px;font-weight:900;letter-spacing:-0.5px">تقرير استهلاك عملية جراحية</h1>
      <h2 style="font-size:11px;color:#999;font-weight:400;text-transform:uppercase;letter-spacing:0.08em;margin-top:2px">Surgery Consumption Report</h2>
      <div style="margin-top:8px;display:inline-flex;align-items:center;gap:8px;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:999px;padding:4px 14px;font-size:11px">
        <span style="color:#999;font-weight:600;text-transform:uppercase">Ref.</span>
        <span style="font-family:monospace;font-weight:700" dir="ltr">${surgery.id.split('-').pop()?.toUpperCase()}</span>
      </div>
    </div>
    <div style="width:80px;text-align:center">
      <img src="/logo.png" alt="شعار" style="width:60px;height:60px;object-fit:contain;margin:auto" onerror="this.style.display='none'"/>
    </div>
  </div>

  <!-- Patient info -->
  <div style="border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;margin-bottom:16px">
    <div class="section-header">
      <span style="font-size:13px;font-weight:700">بيانات المريض والعملية</span>
      <span style="font-size:10px;color:#999;text-transform:uppercase">Patient & Procedure Details</span>
    </div>
    <div class="grid-2">
      <div><div class="label">اسم المريض | Patient Name</div><div class="value">${surgery.patientName}</div></div>
      <div><div class="label">تاريخ العملية | Date</div><div class="value" dir="ltr">${dateStr}</div></div>
      <div><div class="label">الطبيب الجراح | Surgeon</div><div class="value">${surgery.doctorName ?? '—'}</div></div>
      <div><div class="label">نوع العملية | Type</div><div class="value">${surgery.type}</div></div>
    </div>
  </div>

  <!-- Items table -->
  <div style="margin-bottom:16px">
    <h3 style="font-size:13px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px">
      <span style="width:20px;height:20px;background:#111;color:#fff;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:10px">1</span>
      المستلزمات المستخدمة
      <span style="font-size:11px;color:#999;font-weight:400;text-transform:uppercase">| Items Used</span>
    </h3>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:30px;border-left:1px solid #333">#</th>
          <th style="text-align:right;width:90px">كود الصنف</th>
          <th style="text-align:right">وصف الصنف</th>
          <th style="text-align:center;width:60px;border-right:1px solid #333">الكمية</th>
          ${pricesHidden ? '' : `
          <th style="text-align:right;width:90px;border-right:1px solid #333">سعر الوحدة</th>
          <th style="text-align:right;width:110px;border-right:1px solid #333">الإجمالي</th>
          `}
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      ${totalRow}
    </table>
  </div>

  <!-- Notes -->
  <div style="border:1px solid #e5e5e5;border-radius:8px;padding:12px;min-height:60px;margin-bottom:20px">
    <div style="font-size:11px;color:#999;margin-bottom:6px;display:flex;justify-content:space-between">
      <span style="font-weight:700;color:#444">ملاحظات</span>
      <span style="text-transform:uppercase;letter-spacing:0.05em">Notes</span>
    </div>
    ${surgery.notes
            ? `<p style="font-size:13px;color:#222">${surgery.notes}</p>`
            : '<div style="border-bottom:1px dashed #ddd;height:20px;margin-bottom:8px"></div><div style="border-bottom:1px dashed #ddd;height:20px"></div>'
        }
  </div>

  <!-- Signatures -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:24px">
    ${['توقيع الجراح|Surgeon Signature', 'توقيع أمين المخزن|Storekeeper Signature'].map(s => {
            const [ar, en] = s.split('|');
            return `
      <div style="text-align:center">
        <p style="font-size:13px;font-weight:700;margin-bottom:2px">${ar}</p>
        <p style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:16px">${en}</p>
        <div style="border-bottom:2px solid #111;height:48px;width:75%;margin:auto"></div>
      </div>`;
        }).join('')}
  </div>

  <!-- Footer -->
  <div style="margin-top:24px;padding-top:8px;border-top:1px solid #e5e5e5;display:flex;justify-content:space-between;font-size:9px;color:#aaa">
    <span>تم الإنشاء بواسطة <strong style="color:#888">Supply-Care ERP</strong></span>
    <span dir="ltr" style="font-family:monospace">${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
  </div>

</div>
</body>
</html>`;
}

/**
 * Opens the browser print dialog for a surgery report.
 * The browser can then save as PDF (Chrome/Edge native PDF print).
 */
export async function printSurgeryReport(
    surgery: Surgery,
    pricesHidden = false,
): Promise<void> {
    const html = buildPrintHtml(surgery, pricesHidden);

    return new Promise<void>(resolve => {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
        if (!doc) {
            document.body.removeChild(iframe);
            return resolve();
        }

        doc.open();
        doc.write(html);
        doc.close();

        iframe.onload = () => {
            try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            } finally {
                // Remove iframe after short delay (print dialog needs it)
                setTimeout(() => {
                    document.body.removeChild(iframe);
                    resolve();
                }, 1500);
            }
        };
    });
}
