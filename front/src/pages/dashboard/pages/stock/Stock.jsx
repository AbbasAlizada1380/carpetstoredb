import { useState } from "react";
import Outgoing from "../Outgoing";
import ExistingStock from "../ExistingStock";
import IncomeManager from "./IncomeManager";
import CategoryReports from "./grouping/CategoryReports";
import CategoryManager from "./grouping/CategoryManager";   // adjust import path as needed
import TypeManager from "./grouping/TypeManager";        

const Stock = () => {
  const [activeTab, setActiveTab] = useState("incoming");

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-cyan-900 to-cyan-700 p-3 rounded-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">مدیریت موجودی انبار</h1>
                <p className="text-cyan-100 mt-1 text-sm md:text-base">مدیریت ورود، خروج و موجودی فعلی پلیت‌ها</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white text-sm font-medium">سیستم آنلاین</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* ورود پلیت */}
            <button
              className={`group flex-1 sm:flex-none flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-medium transition-all duration-300 ${
                activeTab === "incoming"
                  ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg shadow-cyan-100"
                  : "text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200"
              }`}
              onClick={() => setActiveTab("incoming")}
            >
              <div className={`p-2 rounded-lg ${activeTab === "incoming" ? "bg-white/20" : "bg-cyan-100"}`}>
                <svg className={`w-5 h-5 ${activeTab === "incoming" ? "text-white" : "text-cyan-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                </svg>
              </div>
              <span className="text-sm md:text-base">ورود پلیت</span>
            </button>

            {/* دسته‌بندی‌ها (Categories) */}
            <button
              className={`group flex-1 sm:flex-none flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-medium transition-all duration-300 ${
                activeTab === "categories"
                  ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg shadow-cyan-100"
                  : "text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200"
              }`}
              onClick={() => setActiveTab("categories")}
            >
              <div className={`p-2 rounded-lg ${activeTab === "categories" ? "bg-white/20" : "bg-cyan-100"}`}>
                <svg className={`w-5 h-5 ${activeTab === "categories" ? "text-white" : "text-cyan-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
              </div>
              <span className="text-sm md:text-base">دسته‌بندی‌ها</span>
            </button>

            {/* انواع (Types) */}
            <button
              className={`group flex-1 sm:flex-none flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-medium transition-all duration-300 ${
                activeTab === "types"
                  ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg shadow-cyan-100"
                  : "text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200"
              }`}
              onClick={() => setActiveTab("types")}
            >
              <div className={`p-2 rounded-lg ${activeTab === "types" ? "bg-white/20" : "bg-cyan-100"}`}>
                <svg className={`w-5 h-5 ${activeTab === "types" ? "text-white" : "text-cyan-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
              </div>
              <span className="text-sm md:text-base">انواع</span>
            </button>

            {/* موجودی فعلی */}
            <button
              className={`group flex-1 sm:flex-none flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-medium transition-all duration-300 ${
                activeTab === "existed"
                  ? "bg-gradient-to-r from-cyan-800 to-cyan-600 text-white shadow-lg shadow-green-100"
                  : "text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200"
              }`}
              onClick={() => setActiveTab("existed")}
            >
              <div className={`p-2 rounded-lg ${activeTab === "existed" ? "bg-white/20" : "bg-green-100"}`}>
                <svg className={`w-5 h-5 ${activeTab === "existed" ? "text-white" : "text-green-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <span className="text-sm md:text-base">موجودی فعلی</span>
            </button>

            {/* خروج پلیت (commented as in original) */}
            {/* <button ...>...</button> */}
          </div>

          {/* Tab Indicator Line */}
          <div className="mt-4 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
        </div>

        {/* Active Tab Content */}
        <div className="px-4 md:px-6 pb-6 md:pb-8">
          <div className="transition-all duration-500 ease-in-out">
            {activeTab === "incoming" && (
              <div className="animate-fadeIn">
                <IncomeManager />
              </div>
            )}
            {activeTab === "categories" && (
              <div className="animate-fadeIn">
                <CategoryManager />
              </div>
            )}
            {activeTab === "types" && (
              <div className="animate-fadeIn">
                <TypeManager />
              </div>
            )}
            {activeTab === "existed" && (
              <div className="animate-fadeIn">
                <CategoryReports />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stock;