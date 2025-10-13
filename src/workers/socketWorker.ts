// socketWorker.ts
import { Server } from "socket.io";
import Staff from "../models/Staff.js";

export function initSocketWorker(server: any) {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    const { staffID } = socket.handshake.query;
    if (staffID) {
      // console.log(`Staff ${staffID} connected for notifications`);
      socket.join(staffID); // join a room named after staffID
    }
  });

  return io;
}
