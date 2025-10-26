import mongoose from "mongoose";
import { startTokenRefreshCron } from "../FacebookAPI/services/cronRefreshTokens.js";
const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/SaleManagement_API");

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    startTokenRefreshCron(); // start the cron after DB connect
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1); // stop the app if db fails
  }
};

export default connectDB;
