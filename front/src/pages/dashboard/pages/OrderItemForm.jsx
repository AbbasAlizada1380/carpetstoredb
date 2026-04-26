import React from "react";
import { FaTrash } from "react-icons/fa";
import sizes from "../services/Size.js";

const OrderItemForm = ({ item, index, handleItemChange, deleteOrderItem, canDelete }) => {
  // Check if item is completely empty
  const isEmpty = !item.size && !item.qnty && !item.price && !item.fileName;

  return (
    <div className={`p-4 border rounded-md relative ${isEmpty ? 'bg-gray-50 border-dashed border-gray-300' : 'bg-white border-gray-300'}`}>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">

        {/* invoice number */}
        <div>
          <label className="block mb-1 text-sm font-medium">نمبر بیل</label>
          <input
            type="text"
            value={item.invoiceNumber}
            onChange={(e) => handleItemChange(index, "invoiceNumber", e.target.value)}
            className={`w-full border rounded-md px-3 py-2 ${isEmpty ? 'border-dashed' : ''}`}
            placeholder="000"
          />
        </div>

        {/* File Name */}
        <div>
          <label className="block mb-1 text-sm font-medium">نام فایل</label>
          <input
            type="text"
            value={item.fileName}
            onChange={(e) => handleItemChange(index, "fileName", e.target.value)}
            className={`w-full border rounded-md px-3 py-2 ${isEmpty ? 'border-dashed' : ''}`}
            placeholder="example.pdf"
          />
        </div>

        {/* Size */}
        <div>
          <label className="block mb-1 text-sm font-medium">سایز</label>
          <select
            value={item.size}
            onChange={(e) => handleItemChange(index, "size", e.target.value)}
            className={`w-full border rounded-md px-3 py-2 ${isEmpty ? 'border-dashed' : ''}`}
          >
            <option value="">انتخاب سایز</option>
            {sizes.map((s) => (
              <option key={s.id || s} value={s.label || s}>
                {s.label || s}
              </option>
            ))}
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label className="block mb-1 text-sm font-medium">تعداد</label>
          <input
            type="number"
            min="1"
            value={item.qnty}
            onChange={(e) => handleItemChange(index, "qnty", e.target.value)}
            className={`w-full border rounded-md px-3 py-2 ${isEmpty ? 'border-dashed' : ''}`}
            placeholder="0"
          />
        </div>


        {/* Price */}
        <div>
          <label className="block mb-1 text-sm font-medium">قیمت</label>
          <input
            type="number"
            min="0"
            value={item.price}
            onChange={(e) => handleItemChange(index, "price", e.target.value)}
            className={`w-full border rounded-md px-3 py-2 ${isEmpty ? 'border-dashed' : ''}`}
            placeholder="0"
          />
        </div>

        {/* Money */}
        <div>
          <label className="block mb-1 text-sm font-medium">مجموع مبلغ</label>
          <input
            type="number"
            min="0"
            onChange={(e) => handleItemChange(index, "money", e.target.value)}
            value={item.money || ""}
            className="w-full border rounded-md px-3 py-2 bg-gray-50"
            placeholder="0"
          />
        </div>
      </div>

      {/* Delete Button - Only show if canDelete (more than 5 items) */}
      {canDelete && (
        <button
          type="button"
          onClick={() => deleteOrderItem(index)}
          className="absolute top-6 right-2 text-red-500 hover:text-red-700"
          title="حذف این مورد"
        >
          <FaTrash />
        </button>
      )}
    </div>
  );
};

export default OrderItemForm;