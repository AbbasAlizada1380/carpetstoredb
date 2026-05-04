import Dashboard from "./pages/dashboard";
import Report from "./pages/reports";
import AddUser from "./pages/AddUser";
import Stock from "./pages/Stock";
import ExpenseManager from "./pages/expense/ExpenseManages";
import StaffManager from "./pages/StaffManager";
import SalaryManagement from "./pages/SalaryManagement";
import TakingMoneyManager from "./pages/TakingMoneyManager";
import CompanyStock from "./pages/CompanyStock";
import TypeManager from "./pages/grouping/TypeManager";
import CategoryManager from "./pages/grouping/CategoryManager";
import SellManager from "./pages/stock/SellsManager.jsx";
import IncomeManager from "./pages/stock/IncomeManager.jsx";
const MainContent = ({ activeComponent }) => {
  const renderContent = () => {
    switch (activeComponent) {
      case "dashboard":
        return <Dashboard />;
      case "SalaryManagement":
        return <SalaryManagement />;
      case "CategoryManager":
        return <CategoryManager />;
      case "CompanyStock":
        return <CompanyStock />
      case "Money":
        return <TakingMoneyManager />;
      case "user managements":
        return <UserManagement />;
      case "report":
        return <Report />;
      case "Salaries":
        return <Salaries />;
      case "StaffManager":
        return <StaffManager />;
      case "Stock":
        return <IncomeManager />;
      case "ExpenseManager":
        return <ExpenseManager />;
      case "sells":
        return <SellManager />;
      case "type":
        return <TypeManager />;
      case "AddUser":
        return <AddUser />;

      default:
        return <Dashboard />;
    }
  };

  return <div className="min-h-[90vh]">{renderContent()}</div>;
};

export default MainContent;
