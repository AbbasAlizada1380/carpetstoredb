// routes/customerAccountRoutes.js
import express from 'express';
import {
  createCustomerAccount,
  getCustomerAccounts,
  getCustomerAccountById,
  updateCustomerAccount,
  deleteCustomerAccount,
  getCustomersWithUnpaid,
  getCustomerSellsFromTotal,
  getCustomerOrderItemsByType,
  getCustomerOrderItemsByDateRange,
} from '../../Controllers/customer/customerAccountController.js';

const CustomeraccountRoute = express.Router();

// ---------- CRUD routes ----------
CustomeraccountRoute.get('/unpaid', getCustomersWithUnpaid);
CustomeraccountRoute.post('/', createCustomerAccount);               // POST /api/customer-account
CustomeraccountRoute.get('/', getCustomerAccounts);                  // GET  /api/customer-account
CustomeraccountRoute.get('/:id', getCustomerAccountById);            // GET  /api/customer-account/:id
CustomeraccountRoute.put('/:id', updateCustomerAccount);             // PUT  /api/customer-account/:id
CustomeraccountRoute.delete('/:id', deleteCustomerAccount);          // DELETE /api/customer-account/:id

// ---------- Custom report routes ----------
// Get all customers with unpaid sells (overall summary)

// Get sells for a specific customer from their 'total' array (with pagination)
CustomeraccountRoute.get('/:customerId/sells', getCustomerSellsFromTotal);

// Get customer order items by type: 'orderId' (all), 'receiptOrders' (paid), 'remainOrders' (unpaid)
CustomeraccountRoute.get('/:customerId/order-items/:type', getCustomerOrderItemsByType);

// Get customer order items within a date range (query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD)
CustomeraccountRoute.get('/:customerId/date-range', getCustomerOrderItemsByDateRange);

export default CustomeraccountRoute;
