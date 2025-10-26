import express from "express";
import fetch from "node-fetch";
import axios from "axios";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import FormData from "form-data";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { PageInfo } from "../models/PageInfo.js";
import { Conversation } from "../models/Conversation.js";
import { Message, type IMessage } from "../models/Message.js";
import User from "../../models/User.js";
import { AuthRequest, authMiddleware } from "../../middleware/authMiddleware.js";
import { ISocialData } from "../../models/User.js";
import { uploadImageToFacebook } from "../services/uploadImage.js";
import { TempoarayStoreLocalMsg } from "../models/TemporaryStoreLocalMsgId.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/facebook",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

const { FB_APP_ID, FB_APP_SECRET, FB_REDIRECT_URI, SERVER_BASE_URL, SERVER_PUBLIC_UR } = process.env;

// GET /facebook/pages
router.get("/facebook/pages", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  try {
    const pages = await PageInfo.find({ platform: "facebook", userId });
    const newData = pages.map((p) => ({
      ...p.toObject(),
      pageAccessToken: "****",
    }));
    res.json(newData);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch Facebook pages", error });
  }
});

// GET list conversations /facebook/conversations/:pageId
router.get("/facebook/conversations/:pageId", authMiddleware, async (req: AuthRequest, res) => {
  const administrator = req.user?.administrator;

  const { pageId } = req.params;
  const userId = req.userId;
  //   console.log("fetching conversations for pageId", pageId, "and userId", userId, administrator);
  const query: any = { platform: "facebook", pageId };
  if (administrator !== "manager" && administrator !== "tnbt12g") {
    query.assignedStaffId = userId;
  }

  try {
    const conversations = await Conversation.find({ ...query }).exec();
    // console.log("conversations", conversations);
    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch conversations", error });
  }
});
router.get("/facebook/messages/:pageId/:conversationId", authMiddleware, async (req, res) => {
  const { pageId, conversationId } = req.params;
  const { limit = 20, before } = req.query;

  const query: any = { conversationId, pageId };
  if (before) query.timestamp = { $lt: new Date(before as string) };

  const messages = await Message.find(query)
    .sort({ timestamp: -1 })
    .limit(Number(limit) + 1)
    .lean();

  await Conversation.findOneAndUpdate({ _id: conversationId }, { unreadCount: 0 });

  const hasMore = messages.length > Number(limit);
  if (hasMore) messages.pop(); // remove the extra one

  res.json({ messages, hasMore });
});

// Get list messages /facebook/messages/:conversationId&:pageId
router.get("/facebook/messages2/:conversationId&:pageId", authMiddleware, async (req: AuthRequest, res) => {
  const { conversationId, pageId } = req.params;
  try {
    const messages: IMessage[] = await Message.find({ conversationId, pageId }).exec();
    if (!messages) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    res.status(200).json({ messages, hasMore: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch messages", error });
  }
});

// POST /facebook/save-user
router.post("/facebook/save-user", authMiddleware, async (req: AuthRequest, res) => {
  const { id, name, email, picture, userAccessToken } = req.body;
  const userId = req.userId;

  try {
    // 1️⃣ Get the list of pages the user manages
    const pagesRes = await axios.get(`https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,picture{url}&access_token=${userAccessToken}`);

    const pages = pagesRes.data.data;

    // 2️⃣ Save or update in MongoDB
    for (const p of pages) {
      await PageInfo.findOneAndUpdate(
        { pageId: p.id },
        {
          userId,
          pageId: p.id,
          pageName: p.name,
          pageAccessToken: p.access_token,
          platform: "facebook",
          meta: p,
          pageAvatarURL: p.picture?.data?.url || "",
          refeshTokenAt: Date.now().toString(),
        },
        { upsert: true, new: true }
      );
    }
    const facebookData: ISocialData = {
      id: id,
      name: name,
      accessToken: userAccessToken,

      email: email,
      phone: "",
      address: "",
      pictureURL: picture?.data?.url || "",
      pages: pages,
    };
    const userOwner = await User.findById(userId);
    if (!userOwner) {
      return res.status(404).json({ message: "User not found" });
    }
    await User.updateOne({ _id: userId }, { $set: { "socialData.facebook": facebookData } });

    res.json({ success: true, user: facebookData, pages });
  } catch (err: any) {
    console.error("Error connecting Facebook:", err.response?.data || err);
    res.status(500).json({ message: "Failed to connect Facebook", error: err.response?.data });
  }
});

// POST store sent message and trigger send messsage to Facebook
router.post("/facebook/send-message_v1", authMiddleware, async (req: AuthRequest, res) => {
  const { pageId, conversationId, recipientId, messageObj } = req.body;
  const userId = req.userId;
  console.log("Received send-message request:", { pageId, conversationId, recipientId, messageObj });
  try {
    // Find page access token
    const pageInfo = await PageInfo.findOne({ pageId, platform: "facebook" });
    if (!pageInfo) {
      return res.status(404).json({ message: "Page not found" });
    }
    const pageAccessToken = pageInfo.pageAccessToken;
    // Send message to Facebook

    // const attachmentId = await uploadImageToFacebook(pageAccessToken, "/tmp/image.jpg");
    const messagePayload =
      messageObj.contentType === "image" ? { attachment: { type: "image", payload: { attachment_id: 123 } } } : { text: messageObj.message };

    const v = process.env.FB_API_VERSION || "v24.0";
    const url = `https://graph.facebook.com/${v}/me/messages`;
    const fbResp = await axios.post(
      url,
      {
        recipient: { id: recipientId },
        message: messagePayload,
      },
      { params: { access_token: pageAccessToken }, timeout: 10_000 }
    );
    console.log("Facebook API response:", fbResp.data);
    //Store message in MongoDB
    const replyTo = messageObj.replyTo
      ? {
          senderName: messageObj.replyTo.senderName,
          content: messageObj.replyTo.content,
        }
      : undefined;
    const newMessage = new Message({
      pageId,
      pageName: pageInfo.pageName,

      conversationId,

      senderType: "shop",
      senderId: pageId, // use pageId as senderId for shop messages
      recipientId: recipientId,

      content: messageObj.message,
      contentType: messageObj.contentType,
      timestamp: new Date(),
      status: "sent",

      metadata: {},
      replyTo: replyTo ? replyTo : undefined,
    });
    await newMessage.save();
    res.json({ success: true, message: newMessage }); //fbResponse: fbResp.data,
  } catch (err: any) {
    console.error("Error sending Facebook message:", err.response?.data || err);
    res.status(500).json({ message: "Failed to send Facebook message", error: err.response?.data || err.message });
  }
});
// POST /facebook/send-message
// router.post("/facebook/send-message", authMiddleware, async (req: AuthRequest, res) => {
//   const { pageId, recipientId, messageObj } = req.body;
//   const localMessage_Id = messageObj._id;
//   console.log("localMessage_Id", localMessage_Id);
//   try {
//     const pageInfo = await PageInfo.findOne({ pageId, platform: "facebook" });
//     if (!pageInfo) return res.status(404).json({ message: "Page not found" });

//     const v = process.env.FB_API_VERSION || "v24.0";
//     const pageAccessToken = pageInfo.pageAccessToken;

//     const messagePayload =
//       messageObj.contentType === "image"
//         ? {
//             attachment: {
//               type: "image",
//               payload: { url: messageObj.message, is_reusable: true },
//             },
//           }
//         : { text: messageObj.message };

//     const fbResp = await axios.post(
//       `https://graph.facebook.com/${v}/me/messages`,
//       {
//         recipient: { id: recipientId },
//         message: messagePayload,
//       },
//       { params: { access_token: pageAccessToken } }
//     );

//     await TempoarayStoreLocalMsg.create({
//       localMsg_Id: localMessage_Id,
//       facebookMsg_Id: fbResp.data.message_id,
//     });

//     console.log("✅ Sent message to Facebook:", fbResp.data);
//     res.json({ success: true, message_id: fbResp.data.message_id });
//   } catch (err: any) {
//     console.error("❌ Error sending message:", err.response?.data || err);
//     res.status(500).json({ message: "Failed to send message", error: err.response?.data || err.message });
//   }
// });

// POST /facebook/send-message
// POST /facebook/send-message
router.post("/facebook/send-message", authMiddleware, async (req: AuthRequest, res) => {
  const { pageId, recipientId, messageObj } = req.body;
  const localMessage_Id = messageObj._id;
  console.log("localMessage_Id", localMessage_Id);

  try {
    const pageInfo = await PageInfo.findOne({ pageId, platform: "facebook" });
    if (!pageInfo) return res.status(404).json({ message: "Page not found" });

    const v = process.env.FB_API_VERSION || "v24.0";
    const pageAccessToken = pageInfo.pageAccessToken;

    // ✅ Build message payload
    let messagePayload: any;
    console.log("sontentType", messageObj.contentType);
    if (messageObj.contentType === "image") {
      messagePayload = {
        attachment: {
          type: "image",
          payload: { url: messageObj.message, is_reusable: true },
        },
      };
    } else if (messageObj.contentType === "sticker") {
      console.log("run here", Number(messageObj.message));
      messagePayload = {
        sticker_id: 369239263222822,
        attachment: {
          type: "image",
          payload: {
            sticker_id: 369239263222822,
            url: "https://scontent-sea5-1.xx.fbcdn.net/v/t39.1997-6/39178562_1505197616293642_5411344281094848512_n.png?stp=cp0_dst-jpg_tt6&_nc_cat=1&ccb=1-7&_nc_sid=8de5d8&_nc_ohc=Oq1KYtvUdVsQ7kNvwEG7G4R&_nc_oc=AdmXrAVxZLCGf06VhzyqAMtmlUN8hjGi7uZ0wzI2t8ZNskI1G-F1mXVKPM5uPBhwtkI2p9cI1g3WjKiWHoymGggc&_nc_ad=z-m&_nc_cid=0&_nc_zt=26&_nc_ht=scontent-sea5-1.xx&_nc_gid=X4qEnLGGX3jdPq04hr0Zdg&oh=00_Afe6uqtNHWqx7CFmgaQIe45oFvVF1hP--iuHoZ-22d04cA&oe=68FFBC4B",
          },
        },
      };
    } else {
      messagePayload = { text: messageObj.message };
    }

    // ✅ Prepare base body for API call
    const requestBody: any = {
      recipient: { id: recipientId },
      messaging_type: "RESPONSE", // REQUIRED when using reply_to
      message: messagePayload,
    };

    // ✅ Add reply_to if replying to a specific message
    if (messageObj.replyTo && messageObj.replyTo.messageIdRoot && messageObj.replyTo.messageIdRoot !== "none") {
      const originalMsg = await Message.findOne({ facebookMessageId: messageObj.replyTo.messageIdRoot });
      if (originalMsg && originalMsg.facebookMessageId) {
        requestBody.reply_to = { mid: originalMsg.facebookMessageId };
      }
    }

    // ✅ Send request to Facebook
    const fbResp = await axios.post(`https://graph.facebook.com/${v}/${pageId}/messages`, requestBody, {
      params: { access_token: pageAccessToken },
      headers: { "Content-Type": "application/json" },
    });

    // ✅ Save temporary mapping
    await TempoarayStoreLocalMsg.create({
      localMsg_Id: localMessage_Id,
      facebookMsg_Id: fbResp.data.message_id,
    });

    console.log("✅ Sent message to Facebook:", fbResp.data);
    res.json({ success: true, message_id: fbResp.data.message_id });
  } catch (err: any) {
    console.error("❌ Error sending message:", err.response?.data || err);
    res.status(500).json({
      message: "Failed to send message",
      error: err.response?.data || err.message,
    });
  }
});

router.post("/facebook/send-image_v1", authMiddleware, upload.single("file"), async (req, res) => {
  const { conversationId, recipientId, pageId } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ message: "No file uploaded" });

  try {
    const pageInfo = await PageInfo.findOne({ pageId, platform: "facebook" });
    if (!pageInfo) return res.status(404).json({ message: "Page not found" });

    const pageAccessToken = pageInfo.pageAccessToken;
    const v = process.env.FB_API_VERSION || "v24.0";

    // ✅ Build the public URL for the uploaded image
    const publicUrl = `https://marceline-goadlike-pseudoprosperously.ngrok-free.dev/uploads/facebook/${file.filename}`;
    console.log("📤 Uploading Messenger attachment from:", publicUrl);

    // ✅ Upload image to Messenger
    const uploadResp = await axios.post(
      `https://graph.facebook.com/${v}/me/message_attachments`,
      {
        message: {
          attachment: {
            type: "image",
            payload: {
              url: publicUrl,
              is_reusable: true,
            },
          },
        },
      },
      { params: { access_token: pageAccessToken } }
    );
    console.log("uploadResp.data", uploadResp.data);
    const attachmentId = uploadResp.data.attachment_id;
    console.log("✅ Uploaded attachment_id:", attachmentId);

    // ✅ Send the message to the recipient
    const msgResp = await axios.post(
      `https://graph.facebook.com/${v}/me/messages`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "image",
            payload: { attachment_id: attachmentId },
          },
        },
      },
      { params: { access_token: pageAccessToken } }
    );

    console.log("✅ Sent message:", msgResp.data);

    // ✅ Get CDN URL for image (optional, for frontend display)
    let facebookURL = "";
    try {
      const fileInfo = await axios.get(`https://graph.facebook.com/${v}/${attachmentId}`, { params: { access_token: pageAccessToken } });
      facebookURL = fileInfo.data?.image_url || fileInfo.data?.url || "";
      console.log("fileInfo", fileInfo.data);
    } catch {
      console.warn("⚠️ Failed to fetch image_url (optional)");
    }

    // ✅ Save message in MongoDB
    const newMessage = await Message.create({
      pageId,
      pageName: pageInfo.pageName,
      conversationId,
      facebookMessageId: msgResp.data.message_id,
      senderType: "shop",
      senderId: pageId,
      recipientId,
      content: publicUrl,
      contentType: "image",
      timestamp: new Date(),
      status: "sent",
      metadata: { facebookURL: publicUrl, attachmentId },
      attachments: [
        {
          type: "image",
          payload: {
            attachment_id: attachmentId,
            facebookURL,
            url: facebookURL,
          },
        },
      ],
    });

    res.json({ success: true, message: newMessage });
  } catch (err: any) {
    console.error("❌ Error sending image:", err.response?.data || err);
    res.status(500).json({
      message: "Failed to send image",
      error: err.response?.data || err.message,
    });
  }
});

// POST /facebook/send-image
router.post("/facebook/send-image", authMiddleware, upload.single("file"), async (req, res) => {
  const { pageId, recipientId, _id } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ message: "No file uploaded" });

  try {
    const pageInfo = await PageInfo.findOne({ pageId, platform: "facebook" });
    if (!pageInfo) return res.status(404).json({ message: "Page not found" });

    const v = process.env.FB_API_VERSION || "v24.0";
    const pageAccessToken = pageInfo.pageAccessToken;

    const publicUrl = `${process.env.SERVER_PUBLIC_URL || "https://marceline-goadlike-pseudoprosperously.ngrok-free.dev"}/uploads/facebook/${file.filename}`;
    console.log("📤 Sending image message via public URL:", publicUrl);

    const fbResp = await axios.post(
      `https://graph.facebook.com/${v}/me/messages`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "image",
            payload: { url: publicUrl, is_reusable: true },
          },
        },
      },
      { params: { access_token: pageAccessToken } }
    );

    await TempoarayStoreLocalMsg.create({
      localMsg_Id: _id,
      facebookMsg_Id: fbResp.data.message_id,
    });

    console.log("✅ Sent image:", fbResp.data);
    res.json({ success: true, image_url: publicUrl, fb: fbResp.data });
  } catch (err: any) {
    console.error("❌ Error sending image:", err.response?.data || err);
    res.status(500).json({ message: "Failed to send image", error: err.response?.data || err.message });
  }
});

router.post("/facebook/send-media", authMiddleware, upload.single("file"), async (req, res) => {
  const { pageId, recipientId, _id } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ message: "No file uploaded" });

  try {
    const pageInfo = await PageInfo.findOne({ pageId, platform: "facebook" });
    if (!pageInfo) return res.status(404).json({ message: "Page not found" });

    const v = process.env.FB_API_VERSION || "v24.0";
    const pageAccessToken = pageInfo.pageAccessToken;

    // ✅ Detect type automatically from MIME
    let mediaType: "image" | "video" | "audio" | "file" = "file";
    if (file.mimetype.startsWith("image")) mediaType = "image";
    else if (file.mimetype.startsWith("video")) mediaType = "video";
    else if (file.mimetype.startsWith("audio")) mediaType = "audio";
    else mediaType = "file";

    // ✅ Build public URL (via ngrok or your domain)
    const publicUrl = `${process.env.SERVER_PUBLIC_URL || "https://marceline-goadlike-pseudoprosperously.ngrok-free.dev"}/uploads/facebook/${file.filename}`;
    console.log(`📤 Sending ${mediaType} message via public URL:`, publicUrl);

    // ✅ Send to Messenger API
    const fbResp = await axios.post(
      `https://graph.facebook.com/${v}/me/messages`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: mediaType,
            payload: { url: publicUrl, is_reusable: true },
          },
        },
      },
      { params: { access_token: pageAccessToken } }
    );

    // ✅ Map local ↔ FB message IDs
    await TempoarayStoreLocalMsg.create({
      localMsg_Id: _id,
      facebookMsg_Id: fbResp.data.message_id,
    });

    console.log(`✅ Sent ${mediaType}:`, fbResp.data);

    // ✅ Respond to frontend
    res.json({
      success: true,
      type: mediaType,
      url: publicUrl,
      fb: fbResp.data,
    });
  } catch (err: any) {
    console.error("❌ Error sending media:", err.response?.data || err);
    res.status(500).json({
      message: "Failed to send media",
      error: err.response?.data || err.message,
    });
  }
});

router.put("/facebook/conversations/edit/:conversationId", authMiddleware, async (req: AuthRequest, res) => {
  console.log('here');
try {
  const {conversationId} = req.params;
  const {tags} = req.body;
  if(!conversationId) return res.status(401).json({ message: "Cannot find the conversationId" });

  console.log('runn here', tags);
  // const conversation = await Conversation.findOne({conversationId});
  // if(!conversation) return res.status(401).json({ message: "The conversationId does not have data" });
  await Conversation.findOneAndUpdate({_id: conversationId}, {tags: tags})
return res.status(200).json({ message: "Update tag to conversation success" });
} catch (err) {
      console.error(err);
    return res.status(500).json({ message: "Server error", error: String(err) });
}
})
export default router;
