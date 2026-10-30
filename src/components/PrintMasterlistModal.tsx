import React, { useState } from 'react';
import { BarangayName, EvacuationCenter, Household } from '../types';
import { Printer, X, Download, FileSpreadsheet, Check, ArrowLeft, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PrintMasterlistModalProps {
  barangay: BarangayName;
  households: Household[];
  centers: EvacuationCenter[];
  onClose: () => void;
}

export const PrintMasterlistModal: React.FC<PrintMasterlistModalProps> = ({
  barangay,
  households,
  centers,
  onClose,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [excelSuccess, setExcelSuccess] = useState(false);

  const totalMembers = households.reduce((sum, h) => sum + h.numberOfMembers, 0);
  const evacCount = households.filter((h) => h.status === 'EMERGENCY').length;
  const modCount = households.filter((h) => h.status === 'MODERATE').length;
  const safeCount = households.filter((h) => h.status === 'SAFE').length;

  // Generate and Download Official PDF Document
  const generateAndDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // 1. Header Banner
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'REPUBLIC OF THE PHILIPPINES • DISASTER RISK REDUCTION & MANAGEMENT COUNCIL',
      148.5,
      13,
      { align: 'center' }
    );

    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `BARANGAY ${barangay.toUpperCase()} DISASTER RESPONSE MASTERLIST`,
      148.5,
      20,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'Household Status, Evacuation Assignment & Vulnerability Assessment',
      148.5,
      25,
      { align: 'center' }
    );

    const dateStr = new Date().toLocaleDateString();
    const timeStr = new Date().toLocaleTimeString();
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Date Generated: ${dateStr} ${timeStr}   •   Total Records: ${households.length} Households (${totalMembers} Individuals)   •   Emergency: ${evacCount}   •   Moderate: ${modCount}   •   Safe: ${safeCount}`,
      148.5,
      30,
      { align: 'center' }
    );

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(14, 33, 283, 33);

    // 2. Table Data
    const tableHeaders = [
      [
        '#',
        'Household Head',
        'Contact',
        'Purok & Address',
        'Members',
        'Status Alert',
        'Evac Assignment',
        'Special Categories',
      ],
    ];

    const tableData =
      households.length > 0
        ? households.map((hh, idx) => {
            const center = centers.find((c) => c.id === hh.evacuationCenterId);
            const statusText =
              hh.status === 'EMERGENCY'
                ? 'EMERGENCY (Must Evacuate)'
                : hh.status === 'MODERATE'
                ? 'MODERATE (Assistance)'
                : 'SAFE AT HOME';

            return [
              String(idx + 1),
              hh.headOfFamily + (hh.houseNumber ? `\n(House #${hh.houseNumber})` : ''),
              hh.contactNumber || 'N/A',
              `${hh.purok} - ${hh.completeAddress}`,
              String(hh.numberOfMembers),
              statusText,
              center ? center.name : 'Unassigned',
              hh.specialNeeds.length > 0 ? hh.specialNeeds.join(', ') : 'None',
            ];
          })
        : [
            ['-', 'No registered households found', '-', `Barangay ${barangay}`, '0', 'N/A', 'Unassigned', 'None'],
          ];

    autoTable(doc, {
      head: tableHeaders,
      body: tableData,
      startY: 36,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [30, 41, 59],
        cellPadding: 2.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 42, fontStyle: 'bold' },
        2: { cellWidth: 28 },
        3: { cellWidth: 55 },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 38 },
        6: { cellWidth: 40 },
        7: { cellWidth: 40 },
      },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Barangay ${barangay} DRRM Official Operations Record • Page ${data.pageNumber} of ${pageCount}`,
          148.5,
          202,
          { align: 'center' }
        );
      },
    });

    // 3. Official Signatures
    // @ts-ignore
    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 165;
    const signatureY = finalY > 175 ? 185 : finalY;

    if (finalY > 180) {
      doc.addPage();
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('OFFICIAL VERIFICATION & SIGN-OFF', 148.5, 30, { align: 'center' });

      doc.setLineWidth(0.3);
      doc.line(30, 65, 110, 65);
      doc.text('DRRM Operations Officer', 70, 70, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Prepared & Verified', 70, 75, { align: 'center' });

      doc.line(180, 65, 260, 65);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('Punong Barangay / Incident Commander', 220, 70, { align: 'center' });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setLineWidth(0.3);
      doc.line(30, signatureY, 110, signatureY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('DRRM Operations Officer', 70, signatureY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Prepared & Verified', 70, signatureY + 8, { align: 'center' });

      doc.line(180, signatureY, 260, signatureY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Punong Barangay / Incident Commander', 220, signatureY + 4, { align: 'center' });
    }

    const fileDate = new Date().toISOString().slice(0, 10);
    doc.save(`Barangay_${barangay}_Disaster_Response_Masterlist_${fileDate}.pdf`);
  };

  // Primary Action: Print / Save PDF
  const handlePrintOrSavePDF = () => {
    setIsProcessing(true);
    try {
      // 1. Instantly generate & download the standalone vector PDF
      generateAndDownloadPDF();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);

      // 2. Also trigger system print dialog
      setTimeout(() => {
        try {
          window.print();
        } catch (e) {
          console.warn('System print failed or blocked by sandbox iframe:', e);
        }
      }, 300);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Export as formatted Excel (.xls) file
  const handleExportExcel = () => {
    const tableRows = households.map((hh, idx) => {
      const center = centers.find((c) => c.id === hh.evacuationCenterId);
      return `
        <tr>
          <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${hh.headOfFamily}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; mso-number-format:'\\@';">${hh.contactNumber || 'N/A'}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">${hh.purok} - ${hh.completeAddress}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${hh.numberOfMembers}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${hh.status}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">${center ? center.name : 'Unassigned'}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">${hh.specialNeeds.join(', ') || 'None'}</td>
        </tr>
      `;
    }).join('');

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11px; }
          th { background-color: #0f172a; color: #ffffff; padding: 8px; font-size: 11px; text-align: left; }
        </style>
      </head>
      <body>
        <h2>BARANGAY ${barangay.toUpperCase()} DISASTER RESPONSE MASTERLIST</h2>
        <p>Generated: ${new Date().toLocaleString()} | Total Households: ${households.length} (${totalMembers} Individuals)</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Household Head</th>
              <th>Contact Number</th>
              <th>Purok & Address</th>
              <th>Members</th>
              <th>Status Alert</th>
              <th>Evacuation Assignment</th>
              <th>Special Categories</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="8">No registered households</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `Barangay_${barangay}_Masterlist_${dateStr}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExcelSuccess(true);
    setTimeout(() => setExcelSuccess(false), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto select-none privacy-protected-data"
      onCopy={(e) => {
        e.preventDefault();
        if (e.clipboardData) e.clipboardData.clearData();
      }}
      onCut={(e) => {
        e.preventDefault();
        if (e.clipboardData) e.clipboardData.clearData();
      }}
      onPaste={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] select-none privacy-protected-data">
        {/* Modal Toolbar (hidden during print) */}
        <div className="print:hidden p-4 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <button
              type="button"
              onClick={onClose}
              className="mr-1 px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 active:bg-slate-600 text-slate-200 hover:text-white rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold border border-slate-600 shadow-xs cursor-pointer group"
              title="Back to Navigation Menu"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-300 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back</span>
            </button>
            <Printer className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="truncate">Official Household Masterlist - Barangay {barangay}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Excel Option */}
            <button
              type="button"
              id="btn-export-masterlist-excel"
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-slate-600 shadow-xs cursor-pointer"
              title="Export Masterlist to Excel spreadsheet (.xls)"
            >
              {excelSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Excel Saved!</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export Excel</span>
                </>
              )}
            </button>

            {/* Primary Action: Print / Save PDF */}
            <button
              type="button"
              id="btn-trigger-print"
              onClick={handlePrintOrSavePDF}
              disabled={isProcessing}
              className={`px-4 py-1.5 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-98 ${
                downloadSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-500 ring-2 ring-emerald-400/30'
                  : 'bg-blue-600 hover:bg-blue-500'
              }`}
              title="Save official PDF and open print dialog"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>PDF Saved & Printed!</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/80 rounded-lg transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 overflow-y-auto flex-1 text-slate-900 bg-white" id="printable-masterlist">
          {/* Header */}
          <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
              Republic of the Philippines • Disaster Risk Reduction & Management Council
            </div>
            <h1 className="text-xl font-black uppercase text-slate-900 mt-1">
              Barangay {barangay} Disaster Response Masterlist
            </h1>
            <p className="text-xs text-slate-600">
              Household Status, Evacuation Assignment & Vulnerability Assessment
            </p>
            <div className="mt-2 text-[11px] text-slate-500 font-mono flex items-center justify-center gap-4">
              <span>Date Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
              <span>•</span>
              <span>Total Records: {households.length} Households ({totalMembers} Individuals)</span>
            </div>
          </div>

          {/* Quick Summary Strip */}
          <div className="grid grid-cols-4 gap-2 mb-6 text-center text-xs">
            <div className="p-2 border border-slate-300 rounded bg-slate-50 font-medium">
              Total Households: <strong className="text-slate-900 text-sm block">{households.length}</strong>
            </div>
            <div className="p-2 border border-red-300 rounded bg-red-50 text-red-800 font-medium">
              🚨 Emergency / Must Evac: <strong className="text-red-700 text-sm block">{evacCount}</strong>
            </div>
            <div className="p-2 border border-amber-300 rounded bg-amber-50 text-amber-800 font-medium">
              ⚠️ Moderate / Assistance: <strong className="text-amber-700 text-sm block">{modCount}</strong>
            </div>
            <div className="p-2 border border-green-300 rounded bg-green-50 text-green-800 font-medium">
              ✅ Safe at Home: <strong className="text-green-700 text-sm block">{safeCount}</strong>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-800 bg-slate-100 font-bold text-slate-800">
                <th className="p-2 border-r border-slate-200">#</th>
                <th className="p-2 border-r border-slate-200">Household Head</th>
                <th className="p-2 border-r border-slate-200">Contact</th>
                <th className="p-2 border-r border-slate-200">Purok & Address</th>
                <th className="p-2 border-r border-slate-200 text-center">Members</th>
                <th className="p-2 border-r border-slate-200">Status Alert</th>
                <th className="p-2 border-r border-slate-200">Evac Assignment</th>
                <th className="p-2">Special Categories</th>
              </tr>
            </thead>
            <tbody>
              {households.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 bg-slate-50/50">
                    <p className="font-bold text-slate-700 text-xs">No registered households found for Barangay {barangay}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Register households via the command center dashboard to populate the masterlist.</p>
                  </td>
                </tr>
              ) : (
                households.map((hh, idx) => {
                  const center = centers.find((c) => c.id === hh.evacuationCenterId);
                  const statusBg =
                    hh.status === 'EMERGENCY'
                      ? 'bg-red-50 text-red-800 font-bold'
                      : hh.status === 'MODERATE'
                      ? 'bg-amber-50 text-amber-800 font-bold'
                      : 'bg-emerald-50 text-emerald-800 font-bold';

                  return (
                    <tr key={hh.id} className="border-b border-slate-200 hover:bg-slate-50/50">
                      <td className="p-2 text-slate-400 font-mono border-r border-slate-200">{idx + 1}</td>
                      <td className="p-2 font-bold text-slate-900 border-r border-slate-200">
                        {hh.headOfFamily}
                        {hh.houseNumber ? <span className="text-[10px] text-slate-500 block font-normal">House #{hh.houseNumber}</span> : null}
                      </td>
                      <td className="p-2 font-mono text-slate-700 border-r border-slate-200">{hh.contactNumber}</td>
                      <td className="p-2 text-slate-700 border-r border-slate-200">
                        <strong>{hh.purok}</strong> - {hh.completeAddress}
                      </td>
                      <td className="p-2 text-center font-bold border-r border-slate-200">{hh.numberOfMembers}</td>
                      <td className={`p-2 border-r border-slate-200 ${statusBg}`}>
                        {hh.status === 'EMERGENCY' ? '🔴 Must Evacuate' : hh.status === 'MODERATE' ? '🟡 Moderate Alert' : '🟢 Safe at Home'}
                      </td>
                      <td className="p-2 text-slate-700 border-r border-slate-200">
                        {center ? center.name : <span className="text-slate-400 italic">Unassigned</span>}
                      </td>
                      <td className="p-2 text-slate-700">
                        {hh.specialNeeds.length > 0 ? (
                          <span className="font-semibold text-slate-900">{hh.specialNeeds.join(', ')}</span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Signatures Footer */}
          <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
              <div className="font-bold text-slate-800">DRRM Operations Officer</div>
              <div className="text-slate-500">Prepared & Verified</div>
            </div>
            <div>
              <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
              <div className="font-bold text-slate-800">Punong Barangay / Incident Commander</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

