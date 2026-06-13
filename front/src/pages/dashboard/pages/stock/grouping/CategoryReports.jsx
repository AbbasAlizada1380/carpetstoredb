import React, { useState, useEffect } from "react";
import CategoryReportsDownload from "../../report/CategoryReportsDownload";

const CategoryReports = () => {
  const [categories, setCategories] = useState([]);
  const [totalStockValue, setTotalStockValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const BASE_URL = import.meta.env.VITE_BASE_URL;

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch(`${BASE_URL}/category/reports`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        // Handle both new (object) and old (array) response formats
        if (data && typeof data === "object" && !Array.isArray(data)) {
          // New format: { categories: [...], totalStockValue: number }
          setCategories(data.categories || []);
          setTotalStockValue(data.totalStockValue ?? 0);
        } else if (Array.isArray(data)) {
          // Old format (backward compatibility): plain array
          setCategories(data);
          // Compute total stock value from categories (fallback)
          const computedTotal = data.reduce(
            (sum, cat) => sum + (cat.summary?.totalStockValue || 0),
            0
          );
          setTotalStockValue(computedTotal);
        } else {
          setCategories([]);
          setTotalStockValue(0);
        }
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

  if (!categories.length) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg mx-4">
        <p className="text-gray-500 text-lg">هیچ دسته‌بندی با درآمد موجود یافت نشد.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4 border-b pb-2">
        دسته‌بندی‌های دارای درآمد موجود
      </h1>

      {/* نمایش کل ارزش کالاهای موجود در انبار */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏷️</span>
          <span className="font-semibold text-gray-700">کل ارزش کالاهای موجود در انبار:</span>
        </div>
        <div className="text-2xl font-bold text-blue-700">
          {totalStockValue.toLocaleString()} دالر
        </div>
      </div>

      <CategoryReportsDownload />

      <div className="space-y-8 mt-6">
        {categories.map((category) => (
          <div
            key={category.id}
            className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 transition hover:shadow-lg"
          >
            {/* سربرگ دسته */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h2 className="text-2xl font-semibold text-gray-800">
                  {category.name}
                  {category.type && (
                    <span className="mr-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {category.type.name}
                    </span>
                  )}
                </h2>
                {/* نمایش ارزش موجودی این دسته */}
                <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                  ارزش موجودی: {category.summary?.totalStockValue?.toLocaleString() ?? 0} دالر
                </div>
              </div>
            </div>

            {/* بدنه */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📦</span>
                <h3 className="text-xl font-medium text-gray-700">درآمدهای موجود</h3>
                <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {category.summary?.totalExistingIncomes ?? 0}
                </span>
              </div>

              {!category.existingIncomes || category.existingIncomes.length === 0 ? (
                <p className="text-gray-400 italic">هیچ درآمد موجودی نیست.</p>
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
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ارزش (قیمت واحد × مساحت)</th>
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
                              {itemValue.toLocaleString()} دالر
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
        ))}
      </div>
    </div>
  );
};

export default CategoryReports;