import React, { useState, useEffect } from "react";
import CategoryReportsDownload from "../../report/CategoryReportsDownload";

const CategoryReports = () => {
  const [categories, setCategories] = useState([]);
  const [carpetTotalValue, setCarpetTotalValue] = useState(0);

  const [blanketStock, setBlanketStock] = useState([]);
  const [blanketTotalValue, setBlanketTotalValue] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const BASE_URL = import.meta.env.VITE_BASE_URL;

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const [carpetRes, blanketRes] = await Promise.all([
          fetch(`${BASE_URL}/category/reports`),
          fetch(`${BASE_URL}/bexist?limit=1000`),
        ]);

        if (!carpetRes.ok) throw new Error(`Carpet reports HTTP error! status: ${carpetRes.status}`);
        if (!blanketRes.ok) throw new Error(`Blanket stock HTTP error! status: ${blanketRes.status}`);

        const carpetData = await carpetRes.json();
        const blanketData = await blanketRes.json();

        // ─── Process Carpet Data ───
        if (carpetData && typeof carpetData === "object" && !Array.isArray(carpetData)) {
          setCategories(carpetData.categories || []);
          setCarpetTotalValue(carpetData.totalStockValue ?? 0);
        } else if (Array.isArray(carpetData)) {
          setCategories(carpetData);
          const computedTotal = carpetData.reduce(
            (sum, cat) => sum + (cat.summary?.totalStockValue || 0),
            0
          );
          setCarpetTotalValue(computedTotal);
        } else {
          setCategories([]);
          setCarpetTotalValue(0);
        }

        // ─── Process Blanket Stock Data ───
        const stockItems = blanketData?.data || [];
        setBlanketStock(stockItems);

        const totalBlanketValue = stockItems.reduce((sum, item) => {
          const qty = parseFloat(item.quantity) || 0;
          const price = parseFloat(item.unitPrice) || 0;
          return sum + qty * price;
        }, 0);
        setBlanketTotalValue(totalBlanketValue);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="mr-3 text-gray-600">در حال بارگذاری گزارش‌ها...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg max-w-lg mx-auto mt-8">
        <strong className="font-bold">خطا: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4 border-b pb-2">
        گزارش‌های موجودی
      </h1>

      {/* ─── Total Values (separate currencies) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧶</span>
            <span className="font-semibold text-gray-700">مجموع ارزش فرش‌ها:</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">
            {carpetTotalValue.toLocaleString()} دالر
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧵</span>
            <span className="font-semibold text-gray-700">مجموع ارزش کمپل‌ها:</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">
            {blanketTotalValue.toLocaleString()} افغانی
          </div>
        </div>
      </div>

      {/* ─── Carpet Section ─── */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4 flex items-center gap-3">
          <span>🧶</span> گزارش موجودی فرش‌ها
          <span className="text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            مجموع ارزش: {carpetTotalValue.toLocaleString()} دالر
          </span>
        </h2>

        {!categories.length ? (
          <p className="text-gray-500 text-center py-8">هیچ دسته‌بندی با رول فرش یافت نشد.</p>
        ) : (
          <div className="space-y-8">
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} currency="دالر" />
            ))}
          </div>
        )}
      </div>

      {/* ─── Blanket Section ─── */}
      <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-300">
        <h2 className="text-2xl font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4 flex items-center gap-3">
          <span>🧵</span> گزارش موجودی کمپل (بلنکت)
          <span className="text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            مجموع ارزش: {blanketTotalValue.toLocaleString()} افغانی
          </span>
        </h2>

        {!blanketStock.length ? (
          <p className="text-gray-500 text-center py-8">هیچ موجودی کمپل یافت نشد.</p>
        ) : (
          <div className="space-y-6">
            {blanketStock.map((item) => {
              const category = item.category;
              const qty = parseFloat(item.quantity) || 0;
              const price = parseFloat(item.unitPrice) || 0;
              const totalValue = qty * price;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 transition hover:shadow-lg"
                >
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 px-6 py-4 border-b flex justify-between items-center flex-wrap gap-2">
                    <h3 className="text-xl font-semibold text-gray-800">
                      {category?.name || `دسته ${item.categoryId}`}
                    </h3>
                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                      ارزش کل: {totalValue.toLocaleString()} افغانی
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 shadow-sm rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شناسه موجودی</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">دسته‌بندی</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تعداد (واحد)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">قیمت واحد (افغانی)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ارزش کل (افغانی)</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          <tr className="hover:bg-gray-50 transition">
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-900">{item.id}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{category?.name || item.categoryId}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{qty}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{price.toFixed(2)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold text-purple-700">
                              {totalValue.toLocaleString()} افغانی
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub‑component: Category Card (for carpet) ───
const CategoryCard = ({ category, currency }) => {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 transition hover:shadow-lg">
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-semibold text-gray-800">
          {category.name}
          {category.type && (
            <span className="mr-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {category.type.name}
            </span>
          )}
        </h2>
        <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
          ارزش رول‌ها: {category.summary?.totalStockValue?.toLocaleString() ?? 0} {currency}
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📦</span>
          <h3 className="text-xl font-medium text-gray-700">تعداد رول‌های فرش</h3>
          <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {category.summary?.totalExistingIncomes ?? 0}
          </span>
        </div>

        {!category.existingIncomes || category.existingIncomes.length === 0 ? (
          <p className="text-gray-400 italic">هیچ رول فرشی نیست.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 shadow-sm rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شناسه</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">طول (متر)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">عرض (متر)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">مساحت (متر مربع)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">قیمت واحد</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ارزش ({currency})</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">رنگ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">درجه</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شماره لات</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">شناسه مشتری</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاریخ ایجاد</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {category.existingIncomes.map((inc) => {
                  const area = parseFloat(inc.area) || 0;
                  const unitPrice = parseFloat(inc.unit_price) || 0;
                  const itemValue = area * unitPrice;
                  return (
                    <tr key={inc.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-900">{inc.id}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{inc.length}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{inc.width}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{inc.area}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{inc.unit_price}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold text-green-700">
                        {itemValue.toLocaleString()} {currency}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{inc.color}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{inc.degree}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-600">{inc.lotNumber}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{inc.customerId}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {new Date(inc.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryReports;