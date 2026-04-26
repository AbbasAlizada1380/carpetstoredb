import Income from "../../Models/Stock/income.js";
import Exist from "../../Models/Stock/exist.js";
import sequelize from "../../dbconnection.js";

/* ===========================
   Helper Function: Update Exist Table
=========================== */
export const updateExistTable = async (size, quantityChange, operation = 'subtract') => {
  try {
    // Find existing record for this size
    let existRecord = await Exist.findOne({ where: { size } });

    if (!existRecord) {
      // If record doesn't exist and we're subtracting (shouldn't happen with validation)
      if (operation === 'subtract') {
        throw new Error(`No stock record found for size: ${size}`);
      }
      // Create new record if adding
      existRecord = await Exist.create({
        size,
        quantity: quantityChange.toString()
      });
    } else {
      // Update existing record
      const currentQty = parseFloat(existRecord.quantity || 0);
      const changeQty = parseFloat(quantityChange);
      
      let newQuantity;
      if (operation === 'subtract') {
        newQuantity = currentQty - changeQty;
        if (newQuantity < 0) {
          throw new Error(`Insufficient stock for size: ${size}. Available: ${currentQty}, Requested: ${changeQty}`);
        }
      } else if (operation === 'add') {
        newQuantity = currentQty + changeQty;
      } else {
        throw new Error('Invalid operation for stock update');
      }

      await existRecord.update({
        quantity: newQuantity.toString()
      });
    }

    return existRecord;
  } catch (error) {
    console.error('Error updating Exist table:', error);
    throw error;
  }
};

/* ===========================
   Helper Function: Get Current Stock
=========================== */
export const getCurrentStock = async (size, transaction = null) => {
  const existRecord = await Exist.findOne({ 
    where: { size },
    transaction 
  });
  return existRecord ? parseFloat(existRecord.quantity || 0) : 0;
};

/* ===========================
   Create Income (ADD to stock)
=========================== */
export const createIncome = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { size, quantity, price, spent } = req.body;

    if (!size || !quantity || !price) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Size, quantity, and price are required fields",
      });
    }

    // Get current stock before adding
    const previousStock = await getCurrentStock(size, transaction);
    const requestedQty = parseFloat(quantity);
    
    if (requestedQty <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Quantity must be greater than 0",
      });
    }

    // Calculate money based on quantity and price
    const priceNum = parseFloat(price);
    if (priceNum <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Price must be greater than 0",
      });
    }

    const money = requestedQty * priceNum;

    // Create income record
    const income = await Income.create({
      size,
      quantity: quantity.toString(),
      price: price.toString(),
      money: money.toString(),
      spent: spent || "0",
    }, { transaction });

    // Update Exist table (ADD to stock)
    const updatedExist = await updateExistTable(size, quantity, 'add', transaction);

    await transaction.commit();

    // Calculate profit
    const profit = money - parseFloat(spent || 0);
    const responseData = {
      ...income.toJSON(),
      profit: profit.toFixed(2),
      stockUpdate: {
        size: updatedExist.size,
        newQuantity: updatedExist.quantity,
        previousQuantity: previousStock.toString(),
        added: quantity.toString()
      }
    };

    res.status(201).json(responseData);
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors.map(err => err.message)
      });
    }
    
    res.status(500).json({
      message: "Error creating income record",
      error: error.message,
    });
  }
};

/* ===========================
   Update Income (PUT - Full Update)
=========================== */
export const updateIncome = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { size, quantity, price, spent } = req.body;

    const income = await Income.findByPk(id, { transaction });
    if (!income) {
      await transaction.rollback();
      return res.status(404).json({ message: "Income record not found" });
    }

    // Validate required fields for full update
    if (!size || !quantity || !price) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Size, quantity, and price are required for full update",
      });
    }

    const oldSize = income.size;
    const oldQuantity = parseFloat(income.quantity);
    const newQuantity = parseFloat(quantity);

    if (newQuantity <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Quantity must be greater than 0" });
    }

    const priceNum = parseFloat(price);
    if (priceNum <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Price must be greater than 0" });
    }

    // Handle stock adjustments
    if (size !== oldSize) {
      // Return stock from old size (subtract what was previously added)
      const oldExist = await Exist.findOne({ where: { size: oldSize }, transaction });
      if (oldExist) {
        const currentOldQty = parseFloat(oldExist.quantity);
        const newOldQty = currentOldQty - oldQuantity;
        if (newOldQty < 0) {
          await transaction.rollback();
          return res.status(400).json({
            message: `Cannot return ${oldQuantity} units from size ${oldSize}. Current stock: ${currentOldQty}`,
          });
        }
        await oldExist.update({
          quantity: newOldQty.toString()
        }, { transaction });
      }

      // Add stock to new size
      await updateExistTable(size, newQuantity, 'add', transaction);
    } 
    else {
      // Same size but quantity changed - adjust the difference
      const quantityDifference = newQuantity - oldQuantity;
      if (quantityDifference !== 0) {
        const operation = quantityDifference > 0 ? 'add' : 'subtract';
        const adjustQty = Math.abs(quantityDifference);
        
        // Check if we have enough stock to subtract
        if (operation === 'subtract') {
          const currentStock = await getCurrentStock(size, transaction);
          if (adjustQty > currentStock) {
            await transaction.rollback();
            return res.status(400).json({
              message: `Cannot subtract ${adjustQty} units. Current stock: ${currentStock}`,
            });
          }
        }
        
        await updateExistTable(size, adjustQty, operation, transaction);
      }
    }

    // Calculate money
    const money = newQuantity * priceNum;

    // Update income record
    await income.update({
      size,
      quantity: quantity.toString(),
      price: price.toString(),
      money: money.toString(),
      spent: spent || "0",
    }, { transaction });

    await transaction.commit();

    const updatedIncome = await Income.findByPk(id);
    
    // Calculate profit
    const profit = parseFloat(updatedIncome.money) - parseFloat(updatedIncome.spent || 0);
    const incomeWithProfit = {
      ...updatedIncome.toJSON(),
      profit: profit.toFixed(2),
    };

    res.json(incomeWithProfit);
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({
      message: "Error updating income record",
      error: error.message,
    });
  }
};

/* ===========================
   Delete Income
=========================== */
export const deleteIncome = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;

    const income = await Income.findByPk(id, { transaction });
    if (!income) {
      await transaction.rollback();
      return res.status(404).json({ message: "Income record not found" });
    }

    // Remove stock from Exist table (subtract what was added)
    const existRecord = await Exist.findOne({ 
      where: { size: income.size },
      transaction 
    });

    if (existRecord) {
      const currentQty = parseFloat(existRecord.quantity);
      const incomeQty = parseFloat(income.quantity);
      const newQty = currentQty - incomeQty;
      
      if (newQty < 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Cannot remove ${incomeQty} units from stock. Current: ${currentQty}`,
        });
      }
      
      await existRecord.update({
        quantity: newQty.toString()
      }, { transaction });
    } else {
      // This shouldn't happen if stock was properly managed
      await transaction.rollback();
      return res.status(400).json({
        message: `No stock record found for size: ${income.size}`,
      });
    }

    // Delete income record
    await income.destroy({ transaction });

    await transaction.commit();
    
    res.json({ 
      message: "Income record deleted successfully",
      note: `Stock adjusted: ${income.quantity} units removed from size ${income.size}`
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({
      message: "Error deleting income record",
      error: error.message,
    });
  }
};

/* ===========================
   Get Incomes (Paginated)
=========================== */
export const getIncomes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Income.findAndCountAll({
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // Calculate totals
    const totalMoney = rows.reduce((sum, income) => {
      return sum + parseFloat(income.money || 0);
    }, 0);

    const totalSpent = rows.reduce((sum, income) => {
      return sum + parseFloat(income.spent || 0);
    }, 0);

    const totalProfit = totalMoney - totalSpent;

    // Get current stock levels for all sizes mentioned
    const allSizes = [...new Set(rows.map(income => income.size))];
    const stockLevels = {};
    
    for (const size of allSizes) {
      const stock = await Exist.findOne({ where: { size } });
      stockLevels[size] = stock ? stock.quantity : "0";
    }

    res.json({
      incomes: rows,
      summary: {
        totalMoney,
        totalSpent,
        totalProfit,
        totalItems: count,
      },
      stockLevels,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error fetching income records",
      error: error.message,
    });
  }
};

/* ===========================
   Get Income by ID
=========================== */
export const getIncomeById = async (req, res) => {
  try {
    const { id } = req.params;

    const income = await Income.findByPk(id);

    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    // Get current stock for this size
    const currentStock = await getCurrentStock(income.size);

    // Calculate profit for this record
    const profit = parseFloat(income.money) - parseFloat(income.spent || 0);
    const incomeWithProfit = {
      ...income.toJSON(),
      profit: profit.toFixed(2),
      currentStock: currentStock.toString()
    };

    res.json(incomeWithProfit);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error fetching income record",
      error: error.message,
    });
  }
};



/* ===========================
   Partial Update (PATCH)
=========================== */
export const updateIncomeProperties = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const updateData = req.body;

    const income = await Income.findByPk(id, { transaction });
    if (!income) {
      await transaction.rollback();
      return res.status(404).json({ message: "Income record not found" });
    }

    const oldSize = income.size;
    const oldQuantity = parseFloat(income.quantity);
    
    // Handle stock adjustments if size or quantity is being updated
    if (updateData.size || updateData.quantity) {
      const newSize = updateData.size || oldSize;
      const newQuantity = updateData.quantity ? parseFloat(updateData.quantity) : oldQuantity;

      // If size changed
      if (newSize !== oldSize) {
        // Return stock to old size
        const oldExist = await Exist.findOne({ where: { size: oldSize } });
        if (oldExist) {
          const currentOldQty = parseFloat(oldExist.quantity);
          await oldExist.update({
            quantity: (currentOldQty + oldQuantity).toString()
          }, { transaction });
        }

        // Check stock availability for new size
        const newExist = await Exist.findOne({ where: { size: newSize } });
        if (!newExist || parseFloat(newExist.quantity || 0) < newQuantity) {
          await transaction.rollback();
          return res.status(400).json({
            message: `Insufficient stock for new size: ${newSize}`,
          });
        }

        // Subtract from new size
        const currentNewQty = parseFloat(newExist.quantity);
        await newExist.update({
          quantity: (currentNewQty - newQuantity).toString()
        }, { transaction });
      }
      // If same size but quantity changed
      else if (newQuantity !== oldQuantity) {
        const existRecord = await Exist.findOne({ where: { size: oldSize } });
        if (!existRecord) {
          await transaction.rollback();
          return res.status(400).json({ message: `No stock record found for size: ${oldSize}` });
        }

        const currentStock = parseFloat(existRecord.quantity);
        const quantityDifference = newQuantity - oldQuantity;

        if (quantityDifference > 0 && quantityDifference > currentStock) {
          await transaction.rollback();
          return res.status(400).json({
            message: `Insufficient stock. Available: ${currentStock}, Additional needed: ${quantityDifference}`,
          });
        }

        const newStock = currentStock - quantityDifference;
        await existRecord.update({
          quantity: newStock.toString()
        }, { transaction });
      }
    }

    // Auto-recalculate money if quantity or price is updated
    if (updateData.quantity || updateData.price) {
      const quantity = updateData.quantity || income.quantity;
      const price = updateData.price || income.price;
      const quantityNum = parseFloat(quantity);
      const priceNum = parseFloat(price);
      updateData.money = (quantityNum * priceNum).toString();
    }

    // Update income record
    await income.update(updateData, { transaction });

    await transaction.commit();

    const updatedIncome = await Income.findByPk(id);
    
    // Calculate profit
    const profit = parseFloat(updatedIncome.money) - parseFloat(updatedIncome.spent || 0);
    const incomeWithProfit = {
      ...updatedIncome.toJSON(),
      profit: profit.toFixed(2),
    };

    res.json(incomeWithProfit);
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({
      message: "Error updating income record",
      error: error.message,
    });
  }
};
