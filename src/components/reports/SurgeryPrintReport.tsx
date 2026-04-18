/**
 * SurgeryPrintReport.tsx — v2.0
 *
 * Schema fix: uses `productId` (was `itemId`) and `returnedQuantity`.
 * Net quantity displayed = quantity - returnedQuantity.
 *
 * Print/PDF: use window.print() — CSS @media print handles the rest.
 * For programmatic PDF, call exportSurgeryPdf() from surgeryPdfExport.ts.
 */

import { forwardRef } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

// Matches the SurgeryItem type from inventory.ts
interface SurgeryItemPrint {
  id?: string;
  productId: string;           // was itemId in v1
  itemName: string;
  quantity: number;
  returnedQuantity: number;           // new in v2
  sellingPrice: number;
  basePrice: number;
  sku?: string;
  batchNo?: string;
}

interface SurgeryPrint {
  id: string;
  date: Date | string;
  patientName: string;
  doctorName?: string;
  hospital?: string;
  type: string;
  notes?: string;
  items: SurgeryItemPrint[];
  totalSellingValue?: number;
}

interface Props {
  sale: SurgeryPrint;
  /** If true, hides price columns — use for patient copy */
  pricesHidden?: boolean;
}

const fmt = new Intl.NumberFormat('en-EG', { minimumFractionDigits: 0 });

export const SurgeryPrintReport = forwardRef<HTMLDivElement, Props>(
  ({ sale, pricesHidden = false }, ref) => {

    const netItems = sale.items.map(item => ({
      ...item,
      netQty: item.quantity - (item.returnedQuantity ?? 0),
    })).filter(item => item.netQty > 0);   // skip fully-returned items

    const grandTotal = netItems.reduce(
      (acc, item) => acc + item.sellingPrice * item.netQty, 0,
    );

    const reportDate = sale.date instanceof Date ? sale.date : new Date(sale.date);

    return (
      <div
        ref={ref}
        dir="rtl"
        className="bg-white text-black p-6 w-[210mm] mx-auto shadow-lg print:shadow-none print:p-5"
        style={{ fontFamily: "'Cairo', 'Arial', sans-serif", minHeight: '297mm' }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b-2 border-gray-900 pb-3 mb-4">
          {/* Left logo placeholder */}
          <div className="w-20 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-700 to-blue-900 rounded-lg flex items-center justify-center mb-1 mx-auto">
              <span className="text-white text-2xl font-black">Δ</span>
            </div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-gray-500">
              Delta Medical
            </p>
          </div>

          {/* Center title */}
          <div className="flex-1 text-center px-4">
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              تقرير استهلاك عملية جراحية
            </h1>
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-0.5">
              Surgery Consumption Report
            </h2>
            <div className="mt-2 inline-flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
              <span className="text-[10px] uppercase text-gray-400 font-semibold">Ref.</span>
              <span className="font-mono text-xs font-bold text-gray-800" dir="ltr">
                {sale.id.split('-').pop()?.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Right logo slot */}
          <div className="w-20 text-center">
            <img
              src="/logo.png"
              alt="شعار الشركة"
              className="w-16 h-16 object-contain mx-auto"
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* ── Patient & Surgery Info ─────────────────────────── */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
          <div className="bg-gray-900 text-white px-4 py-2 flex justify-between items-center">
            <span className="text-sm font-bold">بيانات المريض والعملية</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400">
              Patient & Procedure Details
            </span>
          </div>
          <div className="p-4 bg-gray-50/40 grid grid-cols-2 gap-x-8 gap-y-3">
            {[
              { ar: 'اسم المريض', en: 'Patient Name', val: sale.patientName, ltr: false },
              { ar: 'تاريخ العملية', en: 'Procedure Date', val: format(reportDate, 'dd/MM/yyyy', { locale: ar }), ltr: true },
              { ar: 'الطبيب الجراح', en: 'Surgeon', val: sale.doctorName ?? '—', ltr: false },
              { ar: 'نوع العملية', en: 'Procedure Type', val: sale.type, ltr: false },
              { ar: 'المستشفى', en: 'Hospital', val: sale.hospital ?? '—', ltr: false },
            ].map(({ ar: arabic, en, val, ltr }) => (
              <div key={arabic} className="space-y-1">
                <label className="text-[9px] uppercase tracking-wide text-gray-400 border-b border-dashed border-gray-200 pb-0.5 block">
                  {arabic} | {en}
                </label>
                <div
                  className="font-semibold text-gray-900 text-sm px-1 text-right"
                  dir={ltr ? 'ltr' : 'rtl'}
                >
                  {val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Items Table ────────────────────────────────────── */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="bg-gray-900 text-white w-5 h-5 rounded flex items-center justify-center text-[10px]">
              1
            </span>
            <span>المستلزمات المستخدمة</span>
            <span className="text-xs font-normal text-gray-400 uppercase">| Items Used</span>
          </h3>

          <table className="w-full border-collapse rounded-lg overflow-hidden border border-gray-200">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="px-3 py-2 text-center w-8 text-[10px] font-medium border-l border-gray-700">#</th>
                <th className="px-3 py-2 text-right w-24">
                  <span className="text-xs font-bold block">كود الصنف</span>
                  <span className="text-[9px] text-gray-400 font-normal uppercase">Code</span>
                </th>
                <th className="px-3 py-2 text-center w-24">
                  <span className="text-xs font-bold block">رقم التشغيلية</span>
                  <span className="text-[9px] text-gray-400 font-normal uppercase">Batch No</span>
                </th>
                <th className="px-3 py-2 text-right">
                  <span className="text-xs font-bold block">وصف الصنف</span>
                  <span className="text-[9px] text-gray-400 font-normal uppercase">Description</span>
                </th>
                <th className="px-3 py-2 text-center w-16 border-r border-gray-700">
                  <span className="text-xs font-bold block">الكمية</span>
                  <span className="text-[9px] text-gray-400 font-normal uppercase">Qty</span>
                </th>
                {!pricesHidden && (
                  <>
                    <th className="px-3 py-2 text-right w-24 border-r border-gray-700">
                      <span className="text-xs font-bold block">سعر الوحدة</span>
                      <span className="text-[9px] text-gray-400 font-normal uppercase">Unit Price</span>
                    </th>
                    <th className="px-3 py-2 text-right w-28 border-r border-gray-700">
                      <span className="text-xs font-bold block">الإجمالي</span>
                      <span className="text-[9px] text-gray-400 font-normal uppercase">Total</span>
                    </th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {netItems.map((item, idx) => (
                <tr key={item.productId + idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2 text-center text-xs text-gray-400 border-l border-gray-100">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded" dir="ltr">
                      {item.sku ?? item.productId.slice(-8).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="font-mono text-[10px] text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200" dir="ltr">
                      {item.batchNo || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">
                    {item.itemName}
                    {item.returnedQuantity > 0 && (
                      <span className="mr-2 text-[10px] text-amber-600 font-normal">
                        (مُعاد {item.returnedQuantity})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center border-r border-gray-100">
                    <span className="text-base font-bold text-gray-900">{item.netQty}</span>
                  </td>
                  {!pricesHidden && (
                    <>
                      <td className="px-3 py-2 text-right border-r border-gray-100" dir="ltr">
                        <span className="text-xs font-medium text-gray-700">
                          {fmt.format(item.sellingPrice)} ج
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right border-r border-gray-100" dir="ltr">
                        <span className="text-sm font-bold text-blue-800">
                          {fmt.format(item.sellingPrice * item.netQty)} ج
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {/* Empty rows filler (min 3 rows) */}
              {netItems.length < 3 && [...Array(3 - netItems.length)].map((_, i) => (
                <tr key={`empty-${i}`} className="bg-white">
                  <td className="px-3 py-3 text-center text-gray-200 text-xs border-l border-gray-100">
                    {netItems.length + i + 1}
                  </td>
                  {[...Array(pricesHidden ? 4 : 6)].map((__, ci) => (
                    <td key={ci} className="px-3 py-3 border-r border-gray-100">
                      <div className="border-b border-dashed border-gray-200 h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>

            {!pricesHidden && (
              <tfoot>
                <tr className="bg-gradient-to-r from-blue-900 to-blue-800 text-white font-bold">
                  <td colSpan={6} className="px-3 py-2 text-right text-sm border-t-2 border-gray-900">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs uppercase tracking-wider text-blue-300">Grand Total</span>
                      <span>|</span>
                      <span>الإجمالي الكلي</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right border-t-2 border-gray-900 border-r border-blue-700" dir="ltr">
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-black">{fmt.format(grandTotal)}</span>
                      <span className="text-[10px] text-blue-200 font-normal">جنيه مصري</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── Notes ──────────────────────────────────────────── */}
        <div className="mb-5">
          <h3 className="text-xs font-bold text-gray-700 mb-1 flex justify-between">
            <span>ملاحظات إضافية</span>
            <span className="font-normal text-gray-400 uppercase text-[10px]">Additional Notes</span>
          </h3>
          <div className="border border-gray-200 rounded-lg p-3 min-h-[56px] bg-white">
            {sale.notes ? (
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{sale.notes}</p>
            ) : (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="border-b border-dashed border-gray-200 h-4" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Signature Lines ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-12 mt-4">
          {[
            { arabic: 'توقيع الجراح', english: 'Surgeon Signature', pre: sale.doctorName },
            { arabic: 'توقيع أمين المخزن', english: 'Storekeeper Signature', pre: undefined },
          ].map(({ arabic, english, pre }) => (
            <div key={arabic} className="text-center">
              <p className="font-bold text-sm text-gray-900 mb-0.5">{arabic}</p>
              <p className="text-[9px] uppercase text-gray-400 tracking-wider mb-4">{english}</p>
              <div className="border-b-2 border-gray-900 h-12 w-3/4 mx-auto relative flex items-end justify-center pb-1">
                {pre && (
                  <span className="text-xl text-blue-900 opacity-60 absolute -top-5 italic font-light">
                    {pre}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="mt-6 pt-2 border-t border-gray-200 flex justify-between items-center text-[9px] text-gray-400">
          <span>
            تم الإنشاء بواسطة{' '}
            <span className="font-bold text-gray-500">Supply-Care ERP</span>
          </span>
          <span dir="ltr" className="font-mono">
            {format(new Date(), 'dd/MM/yyyy HH:mm')}
          </span>
        </div>
      </div>
    );
  }
);

SurgeryPrintReport.displayName = 'SurgeryPrintReport';