// routes/webhook.route.ts
import { Router } from "express";
import { Conversation, type IConversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { PageInfo } from "../models/PageInfo.js";
import Staff from "../../models/Staff.js";
import { fetchFacebookProfile } from "../services/facebookServices.js";
import { emitMessageToStaff, emitConversationToStaff } from "../../workers/socketWorker.js";
import { TempoarayStoreLocalMsg } from "../models/TemporaryStoreLocalMsgId.js";
const router = Router();
const VERIFY_TOKEN = process.env.MY_FACEBOOK_WEBHOOK_SECRET || "nguyendinhtien335";

interface IProfileByPSID {
  first_name: string;
  last_name: string;
  profile_pic: string;
  id: string;
}
// GET verification endpoint
router.get("/", async (req, res) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode && token === VERIFY_TOKEN) {
      console.log("✅ Facebook webhook verified!");
      return res.status(200).send(challenge as string);
    }
    console.log("❌ Verification failed.");
    return res.sendStatus(403);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

// POST webhook events
router.post("/hook1", async (req, res) => {
  try {
    const body = req.body;
    // Basic structure for Facebook Page webhook
    if (!body || !Array.isArray(body.entry)) {
      return res.sendStatus(400);
    }

    // process each entry (page) and messaging events
    for (const entry of body.entry) {
      console.log("Processing entry", entry);
      const pageId = entry.id; // page id
      // Find PageInfo to get access token and pageName if you need
      const pageInfo = await PageInfo.findOne({ pageId }).lean().exec();

      const pageName = pageInfo?.pageName || `page_${pageId}`;
      const pageAccessToken = pageInfo?.pageAccessToken;

      const messagingEvents = entry.messaging || [];
      console.log("messagingEvents", messagingEvents);

      for (const ev of messagingEvents) {
        // skip delivery/read events for now
        if (ev.message) {
          // handle messages (text/attachments)
          const senderId: string = ev.sender?.id;
          const text: string | undefined = ev.message?.text;
          const attachments = ev.message?.attachments ?? [];
          const timestamp = ev.timestamp ? new Date(ev.timestamp).toLocaleString() : new Date().toLocaleString();
          console.log("ev.message attachments", ev.message);
          console.log("attachments", attachments);
          // determine contentType and content
          let contentType = "text";
          let content = text || "";
          let metadata: any = {};

          if (!text && attachments.length > 0) {
            const a = attachments[0];
            contentType = a.type || "file";
            content = a.payload?.url || a.payload?.attachment_id || "";
            metadata = { ...a.payload, type: a.type };
          }

          if (pageId === senderId) {
            console.log("Skipping message sent by the page itself");
            return res.sendStatus(200);
          }
          // find or create conversation
          let conversation: IConversation | null = await Conversation.findOne({ pageId, customerId: senderId }).exec();
          if (!conversation) {
            // try fetching profile if we have pageAccessToken
            let profile: IProfileByPSID = { first_name: "", last_name: "", profile_pic: "", id: senderId };
            if (pageAccessToken) {
              const getProfile = await fetchFacebookProfile(pageAccessToken, senderId);
              if (getProfile) profile = getProfile;
            }
            console.log("Fetched profile for new conversation 2", profile);
            const staff = await Staff.findOne({ staffID: "phamtamlong-0978999225" }).exec();
            if (!staff) {
              console.warn("Default staff not found, cannot assign conversation");
              continue;
            }
            const senderName = profile.first_name !== "" ? `${profile.first_name} ${profile.last_name}`.trim() : `FB:${senderId}`;

            conversation = await Conversation.create({
              platform: "facebook",

              pageId,
              pageName,

              assignedStaffId: staff.userId,
              assignedStaffName: "",

              customerId: senderId,
              customerName: senderName,
              customerAvatarURL: profile.profile_pic || "",
              customerPhone: "0",

              lastMessage: content,
              lastMessageAt: timestamp,
              unreadCount: 1,

              isMuted: false,
              isPinned: false,
              tags: [],
            });
          } else {
            conversation.lastMessage = content;
            conversation.lastMessageAt = timestamp;
            conversation.unreadCount = (conversation.unreadCount ?? 0) + 1;
            await conversation.save();
          }

          // store message
          await Message.create({
            pageId,
            pageName,

            conversationId: conversation._id,
            facebookMessageId: ev.message.mid,

            senderType: "customer",
            senderId,

            content,
            contentType,
            timestamp,
            status: "sent",

            attachments,

            metadata,
            // replyTo: { senderName: "", content: "" },
          });

          // you may want to emit websocket event here (socket.io) to notify UI
        }
      }
    }
    console.log("new message webhook processed");
    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook processing error", err);
    return res.sendStatus(500);
  }
});

/**
 * ✅ Handle incoming webhook events (messages, echoes, etc.)
 */
router.post("/", async (req, res) => {
  try {
    const body = req.body;

    if (!body || !Array.isArray(body.entry)) {
      console.warn("⚠️ Invalid webhook payload:", body);
      return res.sendStatus(400);
    }

    for (const entry of body.entry) {
      // console.log("📩 Processing entry", entry);

      const pageId = entry.id;
      const pageInfo = await PageInfo.findOne({ pageId }).lean().exec();
      if (!pageInfo) {
        console.warn(`⚠️ No PageInfo found for pageId ${pageId}`);
        continue;
      }

      const pageName = pageInfo.pageName || `page_${pageId}`;
      const pageAccessToken = pageInfo.pageAccessToken;

      const messagingEvents = entry.messaging || [];
      console.log("messagingEvents", messagingEvents);

      for (const ev of messagingEvents) {
        if (!ev.message) continue;
        console.log("ev.message", ev.message);

        const senderId: string = ev.sender?.id;
        const recipientId: string = ev.recipient?.id;
        const isEcho: boolean = ev.message?.is_echo === true;
        const attachments = ev.message?.attachments ?? [];
        const text: string | undefined = ev.message?.text;
        const timestamp = new Date(ev.timestamp || Date.now()).toISOString();
        const replyMessageId = ev.message?.reply_to?.mid;

        console.log("🧩 Incoming message event:", {
          senderId,
          recipientId,
          isEcho,
          text,
          attachmentsCount: attachments.length,
        });
        console.log("attach", attachments[0]);

        // Determine message type & content
        let contentType = "text";
        let content = text || "";
        let metadata: any = {};

        if (attachments.length > 0) {
          const a = attachments[0];
          contentType = a.type || "file";
          content = a.payload?.url || a.payload?.attachment_id || "";
          if (contentType === "fallback") {
            content = text || "";
          }
          metadata = { ...a.payload, type: a.type };
        }

        // Determine senderType
        const senderType = isEcho ? "shop" : "customer";

        // Identify the customer (always the other person)
        const customerId = isEcho ? recipientId : senderId;

        // --- Skip empty or malformed messages ---
        if (!customerId) {
          console.warn("⚠️ Skipping message with missing customerId");
          continue;
        }

        // --- Find or create conversation ---
        let conversation: IConversation | null = await Conversation.findOne({
          pageId,
          customerId,
        }).exec();

        // -- ISSUE - need to fix who will receive conversation. Now, I temporary add one staff for testing.
        const staff = await Staff.findOne({ staffID: "phamtamlong-0978999225" }).exec();
        if (!staff) {
          console.warn("⚠️ Default staff not found, cannot assign conversation");
          continue;
        }
        let isNewConversation = false;
        if (!conversation) {
          // Create new conversation (fetch profile if available)
          let profile: IProfileByPSID = {
            first_name: "",
            last_name: "",
            profile_pic: "",
            id: senderId,
          };

          if (pageAccessToken && !isEcho) {
            const getProfile = await fetchFacebookProfile(pageAccessToken, senderId);
            if (getProfile) profile = getProfile;
          }

          const senderName = profile.first_name || profile.last_name ? `${profile.first_name} ${profile.last_name}`.trim() : `FB:${senderId}`;

          conversation = await Conversation.create({
            platform: "facebook",
            pageId,
            pageName,
            assignedStaffId: staff.userId,
            assignedStaffName: "",
            customerId,
            customerName: senderName,
            customerAvatarURL: profile.profile_pic || "",
            customerPhone: "0",
            lastMessage: content,
            lastMessageAt: timestamp,
            unreadCount: isEcho ? 0 : 1,
            isMuted: false,
            isPinned: false,
            tags: {
              tagName: "Khách mới",
              color: "#ee7919ff"
            },
          });
          isNewConversation = true;
          // emitConversationToStaff(staff.staffID, conversation, "new")
        } else {
          conversation.lastMessage = contentType !== "text" ? `[${contentType}]` : content;
          conversation.lastMessageAt = timestamp;
          // Only count unread for customer messages
          if (!isEcho) {
            conversation.unreadCount = (conversation.unreadCount ?? 0) + 1;
          }
          await conversation.save();
        }

        // -- Create reply_to object if it available
        let replyRootData = {
          senderName: "No-name",
          content: "",
          messageIdRoot: "none",
          replyContentType: "text",
        };
        if (replyMessageId) {
          const findReplyRoot = await Message.findOne({ facebookMessageId: replyMessageId });
          if (findReplyRoot) {
            replyRootData.content = findReplyRoot.content;
            replyRootData.messageIdRoot = replyMessageId;
            replyRootData.replyContentType = findReplyRoot.contentType;
            if (conversation.pageId === senderId) {
              replyRootData.senderName = conversation.pageName || "No-name";
            }
            if (conversation.customerId === senderId) {
              replyRootData.senderName = conversation.customerName || "No-name";
            }
          }
        }
        // --- Save message to DB ---
        const storeMsgToDatabase = await Message.create({
          pageId,
          pageName,
          conversationId: conversation._id,
          facebookMessageId: ev.message.mid,
          senderType,
          senderId,
          recipientId,
          content,
          contentType,
          timestamp,
          status: "sent",
          attachments,
          // metadata,
          replyTo: replyRootData,
        });

        const addTypeEmitForConversation = {
          ...conversation.toObject(), // ✅ convert to plain JS object
          typeEmit: isNewConversation ? "new" : "update",
        };

        const getLocalMsgId = await TempoarayStoreLocalMsg.findOne({ facebookMsg_Id: ev.message.mid });
        const newMessageType = senderType === "shop" ? "shop-new-msg" : "customer-new-msg";
        emitMessageToStaff(
          "nguyendinhtien-33355",
          {
            newMessageType: newMessageType,
            _id: storeMsgToDatabase._id,
            pageId,
            pageName,
            conversationId: conversation._id,
            facebookMessageId: ev.message.mid,
            senderType,
            senderId,
            recipientId,
            content,
            contentType,
            timestamp,
            status: "sent",
            attachments,
            // metadata,
            replyTo: replyRootData,
            localMsg_Id: getLocalMsgId ? getLocalMsgId.localMsg_Id : "none_id",
          },
          addTypeEmitForConversation
        );

        console.log(`💾 Stored ${senderType} message:`, {
          conversationId: conversation._id,
          contentType,
          content: content.slice(0, 80),
        });
      }
    }

    console.log("✅ Webhook processed successfully");
    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    return res.sendStatus(500);
  }
});

export default router;
