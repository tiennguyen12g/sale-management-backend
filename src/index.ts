import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import Staff from "./models/Staff.js";
import { initSocketWorker } from "./workers/socketWorker.js"
import { setSocketIO } from "./routes/newOrderRoutes.js";

import connectDB from "./config/database.js"
import userRoutes from "./routes/authRoutes.js"
import registerRoute from "./routes/RegisterRoutes.js"
import staffRoutes from "./routes/staffRoutes.js";
import operatingCostsRoutes from "./routes/operatingCostsRoutes.js"
import moneyInOutRoutes from "./routes/moneyInOutRoutes.js"
import moneyBankRoutes from "./routes/moneyBankRoutes.js";
import adsCostRoutes from "./routes/adsCostRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import shopOrderRoutes from "./routes/shopOrdersRoutes.js";
import updateOrderDataRoutes from "./routes/updateOrderDataRoutes.js";
import heartBeatRoute from "./routes/heartbeat.js";
import newOrderRoute from "./routes/newOrderRoutes.js";
import importExportInventoryRoute from "./routes/importExportInventoryRoutes.js";
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const websocketPort = process.env.WEBSOCKET_PORT || 3005;
const server = http.createServer(app);

// connect to MongoDB
connectDB();

// ✅ enable CORS
const originURL =  ['http://localhost:5185', 'http://localhost:5173'];
app.use(cors({
  origin: originURL, // your frontend URL
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// app.options("*", cors());  For all domain.

app.use(express.json());

// initialize socket worker
const io = initSocketWorker(server);
setSocketIO(io);
// attach socket.io
// const io = new Server(server, {
//   cors: {
//     origin: "*", // change this to your frontend URL
//     methods: ["GET", "POST"]
//   }
// });

// socket.io connection handler
io.on("connection", async (socket) => {
  const { staffID } = socket.handshake.query;

  if (staffID) {
    // console.log(`${staffID} connected`);

    // mark staff online
    await Staff.updateOne({ staffID }, { $set: { isOnline: true } });

    // notify this client
    socket.emit("status", { status: "online", staffID });

    // notify others (optional, e.g. manager dashboard)
    socket.broadcast.emit("staff-status-changed", { staffID, status: "online" });

    socket.on("disconnect", async () => {
      // console.log(`${staffID} disconnected`);
      await Staff.updateOne(
        { staffID },
        { $set: { isOnline: false, lastSeen: new Date() } }
      );

      // notify this client
      socket.emit("status", { status: "offline", staffID });

      // notify others
      socket.broadcast.emit("staff-status-changed", { staffID, status: "offline" });
    });
  }
});

app.get("/", (req: Request, res: Response) => {
  res.send("Hello TypeScript + Express!");
});
// User
app.use("/api-v1/auth", userRoutes);

// Staffs
app.use("/api-v1/staff", staffRoutes);

// Operating Costs
app.use("/api-v1/operating-costs", operatingCostsRoutes);

// Money In Out
app.use("/api-v1/money-in-out", moneyInOutRoutes);

// Bank
app.use("/api-v1/money-banks", moneyBankRoutes);

// Ads Costs
app.use("/api-v1/ads-costs", adsCostRoutes);

// Product
app.use("/api-v1/products", productRoutes);

// Shop Orders
app.use("/api-v1/shop-orders", shopOrderRoutes);

// Update order data
app.use("/api-v1/update-order", updateOrderDataRoutes)

// ✅ make uploads folder public
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// heartbeat
app.use("/api-v1", heartBeatRoute);

// new order
app.use("/api-v1", newOrderRoute)

// import export
app.use("/api-v1/imp-exp-ivt", importExportInventoryRoute)



server.listen(websocketPort, () => console.log(`Server running on port ${websocketPort}`));
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


