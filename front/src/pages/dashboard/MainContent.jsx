import Dashboard from "./pages/dashboard";
import Report from "./pages/reports";
import AddUser from "./pages/AddUser";
import Stock from "./pages/stock/Stock.jsx";
import ExpenseManager from "./pages/expense/ExpenseManages";
import StaffManager from "./pages/StaffManager";
import SalaryManagement from "./pages/SalaryManagement";
import SellManager from "./pages/Sales/SellsManager.jsx";
import IncomeManager from "./pages/stock/IncomeManager.jsx";
import CustomersManager from "./pages/CustomersManager.jsx";
import BuyerManagement from "./pages/buyer/BuyerManagement.jsx";
import PayManager from "./pages/finance/PayManager.jsx";
import ReceiptManager from "./pages/finance/ReceiptManager.jsx";
import OtherIncomeManager from "./pages/finance/OtherIncomeManager.jsx";
const MainContent = ({ activeComponent }) => {
  const renderContent = () => {
    switch (activeComponent) {
      case "dashboard":
        return <Dashboard />;
      case "SalaryManagement":
        return <SalaryManagement />;
      case "customer":
        return <CustomersManager />
      case "pay":
        return <PayManager />
      case "receipt":
        return <ReceiptManager />
      case "buyer":
        return <BuyerManagement />;
      case "user managements":
        return <UserManagement />;
      case "report":
        return <Report />;
      case "Salaries":
        return <Salaries />;
      case "StaffManager":
        return <StaffManager />;
      case "Stock":
        return <Stock />;
      case "ExpenseManager":
        return <ExpenseManager />;
      case "otherincome":
        return <OtherIncomeManager />;
      case "sells":
        return <SellManager />;
      case "AddUser":
        return <AddUser />;

      default:
        return <Dashboard />;
    }
  };

  return <div className="min-h-[90vh]">{renderContent()}</div>;
};

export default MainContent;
