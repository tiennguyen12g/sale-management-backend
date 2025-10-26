
import { Server } from "socket.io";
import { IConversation } from "../FacebookAPI/models/Conversation.js";
let io: Server | null = null;

export function initSocketWorker(server: any) {
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    const { staffID } = socket.handshake.query;
    if (staffID) {
      console.log(`✅ Staff ${staffID} connected`);
      socket.join(staffID);
    }

    socket.on("disconnect", () => {
      console.log(`❌ Staff disconnected: ${staffID}`);
    });
  });

  return io;
}

// --- helper for emitting events ---
export function getIO(): Server {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

// emit message to a specific staff

export function emitMessageToStaff(staffID: string, message: any, conversationUpdate: any) {
  if (!io) {
    console.warn("⚠️ No io instance, cannot emit message");
    return;
  }
  console.log(`📤 Emitting message to staff ${staffID}`);
  io.to(staffID).emit("message:new", {message, conversationUpdate});
}

// emit conversation
export function emitConversationToStaff(staffID: string, conversation: IConversation, type: "update" | "new") {
  if (!io) {
    console.warn("⚠️ No io instance, cannot emit conversation");
    return;

  }
  const addTypeEmit = {...conversation, typeEmit: type}
  console.log(`📤 Emitting conversation to staff ${staffID}`);
  io.to(staffID).emit("conversation:new", addTypeEmit);
}
// broadcast to all
export function broadcastMessage(event: string, data: any) {
  if (!io) return;
  io.emit(event, data);
}

export function setSocketIO(instance: any) {
  io = instance;
}