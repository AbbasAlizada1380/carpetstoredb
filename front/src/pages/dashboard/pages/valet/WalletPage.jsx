import { useState } from "react";
import { FaWallet, FaUserTie, FaExchangeAlt } from "react-icons/fa";
import HoldersPage from "./HoldersPage";
import ValetsPage from "./ValetsPage";

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState("holders"); // "holders" | "valets"
  const [refreshKey, setRefreshKey] = useState(0);

  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6 space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/20 rounded-xl">
            <FaWallet className="text-primary text-lg" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              مدیریت کیف‌ها
            </h1>
            <p className="text-xs text-gray-500">
              سهام داران و تراکنش‌های مالی
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-2">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Holders tab */}
          <button
            onClick={() => setActiveTab("holders")}
            className={`group flex-1 flex items-center justify-center gap-3 px-5 py-3 rounded-xl font-medium transition-all ${
              activeTab === "holders"
                ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-sm"
                : "text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <div
              className={`p-2 rounded-lg ${
                activeTab === "holders" ? "bg-white/20" : "bg-primary/10"
              }`}
            >
              <FaUserTie
                className={`text-sm ${
                  activeTab === "holders" ? "text-white" : "text-primary"
                }`}
              />
            </div>
            <span>سهام داران </span>
          </button>

          {/* Valets tab */}
          <button
            onClick={() => setActiveTab("valets")}
            className={`group flex-1 flex items-center justify-center gap-3 px-5 py-3 rounded-xl font-medium transition-all ${
              activeTab === "valets"
                ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-sm"
                : "text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <div
              className={`p-2 rounded-lg ${
                activeTab === "valets" ? "bg-white/20" : "bg-emerald-100"
              }`}
            >
              <FaExchangeAlt
                className={`text-sm ${
                  activeTab === "valets" ? "text-white" : "text-emerald-600"
                }`}
              />
            </div>
            <span>تراکنش‌ها</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="animate-fadeIn">
        {activeTab === "holders" && (
          <HoldersPage refreshKey={refreshKey} onChanged={bump} />
        )}
        {activeTab === "valets" && (
          <ValetsPage refreshKey={refreshKey} onChanged={bump} />
        )}
      </div>
    </div>
  );
}