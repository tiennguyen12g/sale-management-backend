import { Router } from "express";
import ShopOrder from "../models/ShopOrder.js";
import Product from "../models/Product.js";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import type { OriginalOrder, FinalOrder, IOrderItem } from "../models/ShopOrder.js";
import Counter from "../models/Counter.js";
import multer from "multer";
import fs from "fs";

const router = Router();
const upload = multer({ dest: "uploads/excels/" });

// Helper to import XLSX dynamically (for ESM compatibility)
async function loadXLSX() {
  const mod = await import("xlsx");
  return mod.default || mod;
}
// ✅ Get all or own orders
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const staffRole = req.user?.staffRole;
    console.log("staff", staffRole);
    let query: any = {};

    if (staffRole !== "admin") {
      query = { userId: req.userId };
    }

    const orders = await ShopOrder.find(query).sort({ createdAt: -1 });

    // console.log('order', orders.length, orders);
    res.json(orders);
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ message: "Failed to fetch orders", error: String(err) });
  }
});

// ✅ Add new order
router.post("/add", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const createOriginal: OriginalOrder = {
      time: req.body.time,
      customerName: req.body.customerName,
      phone: req.body.phone,
      address: req.body.address,
      orderInfo: req.body.orderInfo,
      total: req.body.total,
      totalProduct: req.body.totalProduct,
      totalWeight: req.body.totalWeight,
      note: req.body.note,
      staff: req.body.staff,
      buyerIP: req.body.buyerIP,
      website: req.body.website,
      facebookLink: req.body.facebookLink,
      tiktokLink: req.body.tiktokLink,
    };

    const prefix = req.body.productId; // you could also send from frontend
    const seqNum = await getNextSequence(prefix);

    // Pad number with 6 digits (000001, 000002, ...)
    const padded = seqNum.toString().padStart(6, "0");
    const orderCode = `${prefix}-${padded}`;

    const orderConfirmed = req.body.status;
    const productId = req.body.productId;
    const orderInfo: IOrderItem[] = req.body.orderInfo;
    const deliveryStatus = req.body.deliveryStatus;
    const shippedTime = orderConfirmed === "Chốt" && deliveryStatus === "Đã gửi hàng" ? req.body.time : "";
    const stockAdjusted = orderConfirmed === "Chốt" && deliveryStatus === "Đã gửi hàng" ? true : false;
    const createFinal: FinalOrder = {
      orderCode: orderCode,
      time: req.body.time,
      customerName: req.body.customerName,
      phone: req.body.phone,
      address: req.body.address,
      orderInfo: req.body.orderInfo,
      total: req.body.total,
      totalProduct: req.body.totalProduct,
      totalWeight: req.body.totalWeight,
      note: req.body.note,
      status: req.body.status,
      confirmed: false,
      staff: req.body.staff,
      buyerIP: req.body.buyerIP,
      website: req.body.website,
      deliveryStatus: req.body.deliveryStatus,
      deliveryCode: req.body.deliveryCode,
      facebookLink: req.body.facebookLink,
      tiktokLink: req.body.tiktokLink,
      promotions: req.body.promotions,
    };
    const order = new ShopOrder({
      userId: req.userId, // attach creator
      productId: req.body.productId,
      staffID: req.body.staffID,
      orderCode: orderCode,
      original: createOriginal,
      final: createFinal,
      deliveryDetails: {
        shippedTime: shippedTime,
      },
      stockAdjusted: stockAdjusted,
    });
    const saved = await order.save();

    if (orderConfirmed === "Chốt" && stockAdjusted) {
      const product = await Product.findOne({ productId });
      if (!product) {
        console.log("Product ID does not exist");
        return res.status(201).json(saved); // ✅ Do not continue stock logic
      }
      const newProductDetailed = [...product.productDetailed];

      for (const order of orderInfo) {
        const { color, size, quantity } = order;
        const indexDetail = newProductDetailed.findIndex((item) => item.color === color && item.size === size);

        if (indexDetail !== -1) {
          const currentStock = newProductDetailed[indexDetail].stock;
          const newStock = currentStock - quantity;
          newProductDetailed[indexDetail].stock = newStock >= 0 ? newStock : 0;
        }
      }
      await Product.findOneAndUpdate({ productId }, { productDetailed: newProductDetailed });
    }
    res.status(201).json(saved);
  } catch (err) {
    console.log("err", err);
    res.status(400).json({ message: "Failed to add order", error: String(err) });
  }
});

// Bulk update deliveryStatus
router.put("/bulk-update", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { ids, deliveryStatus, localFormatted } = req.body; // ids: string[]

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No order IDs provided" });
    }
    if (!deliveryStatus) {
      return res.status(400).json({ message: "No delivery status provided" });
    }

    // ✅ Fetch all relevant orders first
    const orders = await ShopOrder.find({ _id: { $in: ids } });

    if (!orders.length) {
      return res.status(404).json({ message: "No matching orders found" });
    }

    // ✅ If bulk status = "Đã gửi hàng" → deduct stock safely
    if (deliveryStatus === "Đã gửi hàng") {
      for (const order of orders) {
        if (order.final?.status !== "Chốt") continue; // only confirmed orders reduce stock
        if (order.stockAdjusted) continue; // skip if stock already deducted

        const { productId } = order;
        const orderInfo = order.final?.orderInfo || [];

        if (!productId || orderInfo.length === 0) continue;

        const product = await Product.findOne({ productId });
        if (!product) continue;

        const newProductDetailed = [...product.productDetailed];

        for (const item of orderInfo) {
          const { color, size, quantity } = item;
          const index = newProductDetailed.findIndex((d) => d.color === color && d.size === size);

          if (index !== -1) {
            const currentStock = newProductDetailed[index].stock;
            const newStock = Math.max(currentStock - quantity, 0);
            newProductDetailed[index].stock = newStock;
          }
        }

        await Product.findOneAndUpdate({ productId }, { productDetailed: newProductDetailed });

        // ✅ Mark order as stock-adjusted + update status + shippedTime
        const updateData: any = {
          "final.deliveryStatus": deliveryStatus,
          stockAdjusted: true,
        };

        if (localFormatted) {
          updateData["deliveryDetails.shippedTime"] = localFormatted;
        }

        await ShopOrder.findByIdAndUpdate(order._id, { $set: updateData });
      }
    } else {
      // ✅ other statuses: just update deliveryStatus
      await ShopOrder.updateMany({ _id: { $in: ids } }, { $set: { "final.deliveryStatus": deliveryStatus } });
    }

    res.json({ message: "Orders updated successfully" });
  } catch (err) {
    console.error("bulk-update error:", err);
    res.status(500).json({
      message: "Failed to update orders",
      error: String(err),
    });
  }
});

// ✅ Update order

router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { staffRole } = req.user!;
    const filter = staffRole === "admin" ? { _id: req.params.id } : { _id: req.params.id, userId: req.userId };

    const originData = await ShopOrder.findOne(filter);
    if (!originData) return res.status(404).json({ message: "Order not found" });
    const newData = {
      ...req.body,
      stockAdjusted: originData.stockAdjusted,
    };
    const updated = await ShopOrder.findOneAndUpdate(filter, newData, { new: true });
    if (!updated) return res.status(404).json({ message: "Order not found" });

    const orderConfirmed = req.body.final?.status;
    const productId = req.body.productId;
    const orderInfo: IOrderItem[] = req.body.final?.orderInfo || [];
    const deliveryStatus = req.body.final?.deliveryStatus || "";
    const shippedTime = updated.deliveryDetails?.shippedTime;
    console.log("origin", originData);
    console.log("updated.stockAdjusted", updated.stockAdjusted, updated);
    // ✅ Handle stock update
    if (orderConfirmed === "Chốt" && !updated.stockAdjusted) {
      console.log("updated.stockAdjusted", updated.stockAdjusted);
      const product = await Product.findOne({ productId });
      if (product) {
        const newProductDetailed = [...product.productDetailed];
        for (const order of orderInfo) {
          const { color, size, quantity } = order;
          const index = newProductDetailed.findIndex((item) => item.color === color && item.size === size);
          if (index !== -1) {
            const currentStock = newProductDetailed[index].stock;
            newProductDetailed[index].stock = Math.max(currentStock - quantity, 0);
          }
        }
        await Product.findOneAndUpdate({ productId }, { productDetailed: newProductDetailed });
        await ShopOrder.findOneAndUpdate(filter, { stockAdjusted: true });
      }
    }

    // ✅ Handle shipped time update
    if (deliveryStatus === "Đã gửi hàng" && !shippedTime) {
      const now = new Date();
      const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace("T", " ");

      await ShopOrder.findOneAndUpdate(filter, { "deliveryDetails.shippedTime": localTime }, { new: true });
    }

    res.json(updated);
  } catch (err) {
    console.error("Error updating order:", err);
    res.status(400).json({ message: "Failed to update order", error: String(err) });
  }
});

// ✅ Delete order
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { staffRole } = req.user!;
    const filter = staffRole === "admin" ? { _id: req.params.id } : { _id: req.params.id, userId: req.userId };

    const deleted = await ShopOrder.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: "Failed to delete order", error: String(err) });
  }
});

// ✅ Delete order
router.post("/bulk-delete", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { staffRole } = req.user!;
    const arrayDeleteIds = req.body.deleteIds || [];
    console.log("array", arrayDeleteIds);
    const filter = staffRole === "admin" ? { _id: req.params.id } : { _id: req.params.id, userId: req.userId };

    const bulkDelete = await ShopOrder.deleteMany({ orderCode: { $in: arrayDeleteIds } });
    if (!bulkDelete) return res.status(404).json({ message: "Order not found" });
    res.json({ message: `Deleted ${arrayDeleteIds.length} successfully` });
  } catch (err) {
    console.log("err", err);
    res.status(400).json({ message: "Failed to delete order", error: String(err) });
  }
});

// Upload Excel → Create multiple orders
router.post("/upload-orders", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const XLSX = await loadXLSX();
    const buf = fs.readFileSync(req.file.path);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const newOrders: any[] = [];

    for (const row of rows) {
      // parse orderInfo column (split by newline)
      const orderInfoLines = String(row["orderInfo"] || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const orderItems: any[] = [];

      // -- If in the orderInfo have multiple product, this can wrong.
      let getProductId = "";
      for (const line of orderInfoLines) {
        // expected format: productId - name - color - size - quantity
        const parts = line.split(" - ").map((p) => p.trim());
        if (parts.length < 5) continue;

        const [productId, name, color, size, quantityStr] = parts;
        const quantity = Number(quantityStr);
        getProductId = productId;

        // find product details from DB
        const product = await Product.findOne({ productId });
        let price = 0;
        let weight = 0;
        // console.log('product', product);

        if (product) {
          const matchDetail = product.productDetailed.find((d: any) => d.color === color && d.size === size);
          // console.log('match', matchDetail);
          if (matchDetail) {
            price = matchDetail.price;
            weight = matchDetail.weight;
          }
        }

        orderItems.push({
          name,
          color,
          size,
          quantity,
          price,
          weight,
        });
      }

      // recalc totals
      const totalProduct = orderItems.reduce((sum, i) => sum + i.quantity, 0);
      const totalWeight = orderItems.reduce((sum, i) => sum + i.quantity * i.weight, 0);
      const total = orderItems.reduce((sum, i) => sum + i.quantity * i.price, 0);

      // build order object
      const createOriginal: OriginalOrder = {
        time: row["time"],
        customerName: row["customerName"],
        phone: row["phone"],
        address: row["address"],
        orderInfo: orderItems,
        total,
        totalProduct,
        totalWeight,
        note: row["note"] || "",
        staff: row["staff"] || "",
        buyerIP: row["ip"] || "",
        website: row["website"] || "",
        facebookLink: "",
        tiktokLink: "",
      };

      let deliveryStatus = row["status"] === "Chốt" ? "Chưa gửi hàng" : "Khách chưa chốt";

      const prefix = getProductId; // you could also send from frontend
      const seqNum = await getNextSequence(prefix);

      // Pad number with 6 digits (000001, 000002, ...)
      const padded = seqNum.toString().padStart(6, "0");
      const orderCode = `${prefix}-${padded}`;

      const finalOrder: FinalOrder = {
        orderCode: orderCode, // can generate auto with uuid if needed
        time: row["time"],
        customerName: row["customerName"],
        phone: row["phone"],
        address: row["address"],
        orderInfo: orderItems,
        total,
        totalProduct,
        totalWeight,
        note: row["note"] || "",
        status: row["status"] || "Chưa gọi điện",
        confirmed: false,
        staff: row["staff"] || "",
        buyerIP: row["ip"] || "",
        website: row["website"] || "",
        deliveryStatus: deliveryStatus,
        deliveryCode: "",
        historyChanged: [],
        facebookLink: "",
        tiktokLink: "",
        promotions: {
          shipTags: "none",
          discount: 0
        }
      };

      const orderDoc = new ShopOrder({
        userId: req.userId, // attach creator
        productId: getProductId,
        orderCode: orderCode,
        original: createOriginal,
        final: finalOrder,
      });

      await orderDoc.save();
      newOrders.push(orderDoc);
    }

    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {}

    res.json({ message: "Orders uploaded successfully", inserted: newOrders.length, orders: newOrders });
  } catch (err) {
    console.error("upload-orders error:", err);
    res.status(500).json({ message: "Failed to upload orders", error: String(err) });
  }
});

router.post("/upload-delivery-details", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const shipCompany = req.body.shipCompany; // ✅ Read from form-data
    console.log("Ship company:", shipCompany);

    const XLSX = await loadXLSX();
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const sheetJson = XLSX.utils.sheet_to_json(sheet, {
      header: 1, // each row = array
      defval: "",
    });

    if (shipCompany === "viettel-post") {
      // Rows: skip first 9 rows
      const dataRows: any[] = sheetJson.slice(9);
      const validRows = dataRows.filter(
        (row) => row && (row[1] || row[2]) // carrierCode or orderCode exists
      );

      const updatedOrders = [];
      for (const row of validRows) {
        // row is an array based on cell index; adapt if needed
        const carrierCode = row[1]; // B
        const orderCode = row[2]; // C
        const sendTime = row[3]; // D
        const whoPayShippingFee = row[21]; // V
        const totalFeeAndVAT = Number(row[25]); // Z
        const status = row[32]; // AG
        const receivedCOD = row[34]; // AI
        const timeForChangeStatus = row[41]; // AP
        // console.log('row', row[1], row[2], row[21], row[32]);

        // console.log("ROW VALUES:", {
        //   carrierCode,
        //   orderCode,
        //   sendTime,
        //   whoPayShippingFee,
        //   totalFeeAndVAT,
        //   status,
        //   receivedCOD,
        //   timeForChangeStatus
        // });
        if (!orderCode) continue;

        const updated = await ShopOrder.findOneAndUpdate(
          { orderCode },
          {
            $set: {
              "deliveryDetails.shipCompany": shipCompany,
              "deliveryDetails.deliveryStatus": status,
              "deliveryDetails.carrierCode": carrierCode,
              "deliveryDetails.orderCode": orderCode,
              "deliveryDetails.totalFeeAndVAT": totalFeeAndVAT,
              "deliveryDetails.receivedCOD": receivedCOD,
              "deliveryDetails.whoPayShippingFee": whoPayShippingFee,
              "deliveryDetails.sendTime": sendTime,
              "deliveryDetails.timeForChangeStatus": timeForChangeStatus,
              "final.deliveryStatus": status,
            },
          },
          { new: true }
        );

        if (updated) {
          updatedOrders.push(updated);
        }
      }
      fs.unlinkSync(req.file.path);
      res.json({
        message: `Processed file. Updated ${updatedOrders.length} orders.`,
        updatedCount: updatedOrders.length,
      });
    }

    if (shipCompany === "j&t") {
      // Rows: skip first 1 rows
      const dataRows: any[] = sheetJson.slice(1);
      const validRows = dataRows.filter(
        (row) => row && row[0] // carrierCode or orderCode exists
      );

      const updatedOrders = [];
      for (const row of validRows) {
        // row is an array based on cell index; adapt if needed
        const carrierCode = row[0]; // B
        const orderCode = row[14]; // C
        const sendTime = row[15]; // D
        const whoPayShippingFee = row[10]; // V
        const totalFeeAndVAT = Number(row[9]); // Z
        const status = row[1]; // AG
        const receivedCOD = row[13]; // AI
        const timeForChangeStatus = "none"; // AP
        // console.log('row', row[1], row[2], row[21], row[32]);

        console.log("ROW VALUES:", {
          carrierCode,
          orderCode,
          sendTime,
          whoPayShippingFee,
          totalFeeAndVAT,
          status,
          receivedCOD,
          timeForChangeStatus,
        });
        if (!orderCode) continue;

        const updated = await ShopOrder.findOneAndUpdate(
          { orderCode },
          {
            $set: {
              "deliveryDetails.shipCompany": shipCompany,
              "deliveryDetails.deliveryStatus": status,
              "deliveryDetails.carrierCode": carrierCode,
              "deliveryDetails.orderCode": orderCode,
              "deliveryDetails.totalFeeAndVAT": totalFeeAndVAT,
              "deliveryDetails.receivedCOD": receivedCOD,
              "deliveryDetails.whoPayShippingFee": whoPayShippingFee,
              "deliveryDetails.sendTime": sendTime,
              "deliveryDetails.timeForChangeStatus": timeForChangeStatus,
              "final.deliveryStatus": status,
            },
          },
          { new: true }
        );

        if (updated) {
          updatedOrders.push(updated);
        }
      }
      fs.unlinkSync(req.file.path);
      res.json({
        message: `Processed file. Updated ${updatedOrders.length} orders.`,
        updatedCount: updatedOrders.length,
      });
    }
  } catch (err) {
    console.error("upload-delivery-details error:", err);
    res.status(500).json({ message: "Failed to upload", error: String(err) });
  }
});

// Helper: get next sequence number for a prefix
async function getNextSequence(prefix: string) {
  const counter = await Counter.findOneAndUpdate(
    { prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true } // create if not exists
  );
  return counter.seq;
}

export default router;
