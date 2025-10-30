import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import http from "http";
import axios from "axios";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// import session from "express-session";
// import passport from "passport";
// import { Strategy as FacebookStrategy } from "passport-facebook";


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
import settingRoutes from "./routes/settingsRoutes.js";
import shopMediaRoute from "./routes/shopMediaRoutes.js";
// Facebook API
import webhookRoutes from "./FacebookAPI/routes/webhook.js"
import conversationRoutes from "./FacebookAPI/routes/conversation.js"
import facebookRoutes from "./FacebookAPI/routes/facebookRoute.js"
import { PageInfo } from "./FacebookAPI/models/PageInfo.js";

//Cron task
import { startTokenRefreshCron } from "./FacebookAPI/services/cronRefreshTokens.js";


dotenv.config({ path: "./src/.env" });

const app = express();
const port = process.env.PORT || 3000;
const websocketPort = process.env.WEBSOCKET_PORT || 3005;
const server = http.createServer(app);

// connect to MongoDB
connectDB();

// ✅ enable CORS
const originURL =  ['http://localhost:5185', 'http://localhost:5173', 'https://localhost:5185', 'https://localhost:5173'];
app.use(cors({
  origin: originURL, // your frontend URL

  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// app.options("*", cors());  //For all domain.

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
  // console.log('userId', userId);
  // const staff = await Staff.findOne({userId: "68ca05383d66d242da2b1ef9"});
  // if(!staff) {
  //       console.warn("⚠️ Missing staffID in socket handshake");
  //   return;
  // }
  // const staffID = staff.staffID;

  console.log("✅ Staff connected:", staffID);

  if (!staffID) {
    console.warn("⚠️ Missing staffID in socket handshake");
    return;
  }

  await Staff.updateOne({ staffID }, { $set: { isOnline: true } });

  socket.emit("status", { status: "online", staffID });
  socket.broadcast.emit("staff-status-changed", { staffID, status: "online" });

  socket.on("disconnect", async () => {
    console.log("❌ Staff disconnected:", staffID);
    await Staff.updateOne(
      { staffID },
      { $set: { isOnline: false, lastSeen: new Date() } }
    );
    socket.emit("status", { status: "offline", staffID });
    socket.broadcast.emit("staff-status-changed", { staffID, status: "offline" });
  });
});


// app.use((req, res, next) => {
//   console.log(req.method, req.path, req.headers.origin);
//   next();
// });
// ✅ make uploads folder public
// ✅ static first
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.get("/ping", (req, res) => {
  console.log('/ping received');
  res.json({ success: true, message: "Server is reachable 🎯" });
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

// Settings
app.use("/api-v1/settings", settingRoutes)

// heartbeat
app.use("/api-v1", heartBeatRoute);

// new order
app.use("/api-v1", newOrderRoute)

// import export
app.use("/api-v1/imp-exp-ivt", importExportInventoryRoute)

// shop media
app.use("/api-v1", shopMediaRoute)

// -- Facebook API

// Webhook
app.use("/facebook/webhook", webhookRoutes)
// app.use("/facebook/webhook2", webhookRoutes)

// Conversation
app.use("/apv-v1", conversationRoutes)

// Connect routes
app.use("/api-v1", facebookRoutes);

async function testNgrokHealth() {
  const ngrokUrl = "https://marceline-goadlike-pseudoprosperously.ngrok-free.dev";
  try {
    const res = await axios.get(`${ngrokUrl}/ping`, { timeout: 5000 });
    console.log("🌍 Ngrok reachable:", res.data);
  } catch (err: any) {
    console.error("⚠️ Ngrok not connected to server:", err.message);
  }
}
server.listen(websocketPort, () => console.log(`Server running on port ${websocketPort}`));
app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
});


