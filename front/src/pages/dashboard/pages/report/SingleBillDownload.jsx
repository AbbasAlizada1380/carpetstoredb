import React, { useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment-jalaali";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import VazirmatnTTF from "../../../../../public/ttf/Vazirmatn.js";
import { FaFilePdf, FaFileExcel } from "react-icons/fa";

moment.locale("en");
const BASE_URL = import.meta.env.VITE_BASE_URL;

const SingleBillDownload = ({ billId, billNumber }) => {
  const [loading, setLoading] = useState(false);

  const fetchBill = async () => {
    const response = await axios.get(`${BASE_URL}/bill/${billId}`);
    return response.data.bill;
  };

  const handlePDFDownload = async () => {
    try {
      setLoading(true);
      const bill = await fetchBill();
      if (!bill) {
        alert("فاکتور یافت نشد");
        return;
      }

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      doc.setR2L(false);
      doc.addFileToVFS("Vazirmatn.ttf", VazirmatnTTF);
      doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
      doc.setFont("Vazirmatn");

      // Header
      doc.setFontSize(18);
      doc.text(`فاکتور فروش`, doc.internal.pageSize.getWidth() - 40, 40, { align: "right" });
      doc.setFontSize(14);
      doc.text(`شماره: ${bill.billNumber}`, doc.internal.pageSize.getWidth() - 40, 70, { align: "right" });

      // Customer and bill details
      const buyerName = bill.buyer?.fullname || "---";
      const billDate = moment(bill.date).format("YYYY/MM/DD");
      const statusText = bill.status === "paid" ? "پرداخت شده" : bill.status === "partial" ? "پرداخت جزئی" : "پرداخت نشده";

      doc.setFontSize(12);
      doc.text(`خریدار: ${buyerName}`, doc.internal.pageSize.getWidth() - 40, 100, { align: "right" });
      doc.text(`تاریخ: ${billDate}`, doc.internal.pageSize.getWidth() - 40, 120, { align: "right" });
      doc.text(`وضعیت: ${statusText}`, doc.internal.pageSize.getWidth() - 40, 140, { align: "right" });
      if (bill.notes) {
        doc.text(`یادداشت: ${bill.notes}`, doc.internal.pageSize.getWidth() - 40, 160, { align: "right" });
      }

      const sells = bill.sells || bill.sellRecords || [];
      if (sells.length === 0) {
        doc.text("هیچ قلم فروشی وجود ندارد.", doc.internal.pageSize.getWidth() - 40, 190, { align: "right" });
      } else {
        const headers = [["ردیف", "کد کالا", "طول (متر)", "مساحت (م²)", "قیمت واحد (؋)", "مبلغ کل (؋)"]];
        const body = sells.map((sell, idx) => [
          idx + 1,
          sell.income?.lotNumber || sell.incomeId || "---",
          sell.length,
          sell.area,
          sell.unit_price,
          sell.total,
        ]);

        autoTable(doc, {
          startY: 190,
          head: headers,
          body: body,
          theme: "grid",
          styles: { font: "Vazirmatn", fontSize: 10, halign: "center", valign: "middle" },
          headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: "normal" },
          margin: { left: 30, right: 30 },
        });

        const finalY = doc.lastAutoTable.finalY + 20;
        doc.setFontSize(12);
        doc.text(
          `جمع کل: ${bill.totalAmount} ؋`,
          doc.internal.pageSize.getWidth() - 40,
          finalY,
          { align: "right" }
        );
        doc.text(
          `پرداخت شده: ${bill.paidAmount} ؋`,
          doc.internal.pageSize.getWidth() - 40,
          finalY + 20,
          { align: "right" }
        );
        doc.text(
          `باقیمانده: ${bill.remainingAmount} ؋`,
          doc.internal.pageSize.getWidth() - 40,
          finalY + 40,
          { align: "right" }
        );
      }

      doc.save(`bill_${bill.billNumber}.pdf`);
    } catch (err) {
      console.error(err);
      alert("خطا در ایجاد PDF");
    } finally {
      setLoading(false);
    }
  };

  const handleExcelDownload = async () => {
    try {
      setLoading(true);
      const bill = await fetchBill();
      if (!bill) {
        alert("فاکتور یافت نشد");
        return;
      }

      const workbook = XLSX.utils.book_new();
      const sells = bill.sells || bill.sellRecords || [];

      const summaryData = [
        ["فاکتور فروش"],
        ["شماره فاکتور", bill.billNumber],
        ["خریدار", bill.buyer?.fullname || "---"],
        ["تاریخ", moment(bill.date).format("YYYY/MM/DD")],
        ["وضعیت", bill.status === "paid" ? "پرداخت شده" : bill.status === "partial" ? "پرداخت جزئی" : "پرداخت نشده"],
        ["یادداشت", bill.notes || "---"],
        [],
        ["ردیف", "کد کالا", "طول (متر)", "مساحت (م²)", "قیمت واحد (؋)", "مبلغ کل (؋)"],
      ];

      sells.forEach((sell, idx) => {
        summaryData.push([
          idx + 1,
          sell.income?.lotNumber || sell.incomeId || "---",
          sell.length,
          sell.area,
          sell.unit_price,
          sell.total,
        ]);
      });

      summaryData.push([], ["جمع کل", "", "", "", "", bill.totalAmount]);
      summaryData.push(["پرداخت شده", "", "", "", "", bill.paidAmount]);
      summaryData.push(["باقیمانده", "", "", "", "", bill.remainingAmount]);

      const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
      worksheet["!cols"] = [{ wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(workbook, worksheet, "فاکتور");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `bill_${bill.billNumber}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("خطا در ایجاد Excel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handlePDFDownload}
        disabled={loading}
        className="text-red-600 hover:text-red-800 transition"
        title="دانلود PDF فاکتور"
      >
        <FaFilePdf className="h-5 w-5" />
      </button>
      <button
        onClick={handleExcelDownload}
        disabled={loading}
        className="text-green-600 hover:text-green-800 transition"
        title="دانلود Excel فاکتور"
      >
        <FaFileExcel className="h-5 w-5" />
      </button>
    </div>
  );
};

export default SingleBillDownload;