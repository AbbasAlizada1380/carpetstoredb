import { useState } from "react";
import SellManager from "./SellsManager";          // your existing sales bills component
import BuyerManagement from "../buyer/BuyerManagement";  // your existing buyer manager with sub‑tabs

const SalesAndCustomers = () => {
  const [activeTab, setActiveTab] = useState("sales");

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-cyan-900 to-cyan-700 p-3 rounded-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-xl">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 10h18M6 14h12M6 18h12M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  مدیریت فروش و مشتریان
                </h1>
                <p className="text-cyan-100 mt-1 text-sm md:text-base">
                  مدیریت فاکتورهای فروش و اطلاعات خریداران
                </p>
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
            {/* فروش (Sales) */}
            <button
              className={`group flex-1 sm:flex-none flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-medium transition-all duration-300 ${
                activeTab === "sales"
                  ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg shadow-cyan-100"
                  : "text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200"
              }`}
              onClick={() => setActiveTab("sales")}
            >
              <div
                className={`p-2 rounded-lg ${
                  activeTab === "sales" ? "bg-white/20" : "bg-cyan-100"
                }`}
              >
                <svg
                  className={`w-5 h-5 ${
                    activeTab === "sales" ? "text-white" : "text-cyan-600"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <span className="text-sm md:text-base">فروش</span>
            </button>

            {/* مشتریان (Customers) */}
            <button
              className={`group flex-1 sm:flex-none flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-medium transition-all duration-300 ${
                activeTab === "customers"
                  ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg shadow-cyan-100"
                  : "text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200"
              }`}
              onClick={() => setActiveTab("customers")}
            >
              <div
                className={`p-2 rounded-lg ${
                  activeTab === "customers" ? "bg-white/20" : "bg-blue-100"
                }`}
              >
                <svg
                  className={`w-5 h-5 ${
                    activeTab === "customers" ? "text-white" : "text-blue-600"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <span className="text-sm md:text-base">مشتریان</span>
            </button>
          </div>

          {/* Tab Indicator Line */}
          <div className="mt-4 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
        </div>

        {/* Active Tab Content */}
        <div className="px-4 md:px-6 pb-6 md:pb-8">
          <div className="transition-all duration-500 ease-in-out">
            {activeTab === "sales" && (
              <div className="animate-fadeIn">
                <SellManager />
              </div>
            )}
            {activeTab === "customers" && (
              <div className="animate-fadeIn">
                <BuyerManagement />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesAndCustomers;