import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import userRout from "./routes/userRout.js";
import sequelize from "./dbconnection.js";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import ReportRouter from "./routes/ordersReportRout.js";
import CustomerRoute from "./routes/customer/CustomersRoute.js";
// import OrderItemRoute from "./routes/OrderItemsRoute.js";
import ExistRoute from "./routes/ExistRoute.js";
import TypeRouter from "./routes/grouping/TypeRouter.js";
import CategoryRouter from "./routes/grouping/CategoryRouter.js";
import sellsRouter from "./routes/Stock/OutgoingRoute.js";
import incomeRoute from "./routes/Stock/StockIncomeRoute.js";
import ExpenseRoute from "./routes/ExpenseRoute.js";
const FRONT_URL = process.env.FRONT_URL
const port = 8038;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Configure CORS properly
const allowedOrigins = [
  `${FRONT_URL}`, // React local dev
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy: Access denied from this origin."));
      }
    },
    credentials: true, // allow cookies and auth headers
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Global error handler for CORS
app.use((err, req, res, next) => {
  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({ message: err.message });
  }
  next(err);
});

app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser());

// Middleware to serve static files (images)
const uploadsDirectory = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDirectory));

// Routes
app.use("/users", userRout);
app.use("/expense", ExpenseRoute);
// app.use("/orderItems", OrderItemRoute);
// app.use("/report", ReportRouter);
app.use("/income", incomeRoute);
app.use("/sells", sellsRouter);
// app.use("/stock/exist", ExistRoute);
app.use("/customer", CustomerRoute);
app.use("/type", TypeRouter);
app.use("/category", CategoryRouter);

// Sync database and start server
sequelize
  .sync({ alter: true })
  .then(() => {
    app.listen(port, () => {
      console.log(`✅ Server is running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("❌ Unable to connect to the database:", error);
  });
