// routes/api.route.ts
import { Router } from "express";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { PageInfo } from "../models/PageInfo.js";
import { fetchFacebookProfile, sendFacebookMessage } from "../services/facebookServices.js";
import { AuthRequest, authMiddleware } from "../../middleware/authMiddleware.js";
import mongoose from "mongoose";

const router = Router();

/**
 * GET /api/conversations?pageId=&limit=20&cursor=<ISO date>
 * - returns conversations for given pageId sorted by lastMessageAt desc
 * - cursor: ISO timestamp (string). When provided, return items with lastMessageAt < cursor
 * - response includes nextCursor (ISO date) when more items exist
 */
router.get("/conversations", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const pageId = String(req.query.pageId || "");
    const limit = Math.min(50, Number(req.query.limit ?? 20));
    const cursor = req.query.cursor ? new Date(String(req.query.cursor)) : undefined;

    if (!pageId) return res.status(400).json({ message: "pageId is required" });

    const filter: any = { pageId };
    if (cursor) {
      filter.lastMessageAt = { $lt: cursor };
    }

    const docs = await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(limit + 1) // fetch one extra to know if there is next
      .lean()
      .exec();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit);

    const nextCursor = hasMore ? items[items.length - 1].lastMessageAt : null;

    return res.json({ items, nextCursor, hasMore });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});

/**
 * GET /api/conversations/:id/messages?limit=40&before=<ISO date>
 * - loads messages for a conversation (lazy)
 * - before: ISO date to fetch messages older than `before`. If omitted, returns latest messages.
 * - sorted newest -> oldest (but returned as oldest-first to render chronologically)
 */
router.get("/facebook/conversations/edit/:conversationId/messages",authMiddleware, async (req: AuthRequest, res) => {
  try {
    const conversationId = String(req.params.conversationId);
    const limit = Math.min(200, Number(req.query.limit ?? 40));
    const before = req.query.before ? new Date(String(req.query.before)) : undefined;

    // conversationId is probably an _id string — allow either _id or conversation custom id
    const conv = await Conversation.findById(conversationId).lean().exec();
    if (!conv) {
      // try by custom id (if you used plain id strings)
      // fallback: findOne({ _id: conversationId }) already tried; if not found, return 404
      return res.status(404).json({ message: "Conversation not found" });
    }

    const filter: any = { conversationId: conv._id.toString() };
    if (before) filter.timestamp = { $lt: before };

    // fetch newest messages first, then reverse to send oldest->newest
    const docs = await Message.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
      .exec();

    // prepare nextBefore cursor for next page (older messages)
    const hasMore = docs.length === limit;
    const nextBefore = hasMore ? docs[docs.length - 1].timestamp : null;

    // return messages ordered oldest -> newest
    const messages = docs.reverse();

    return res.json({ messages, nextBefore, hasMore });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});

/**
 * POST /api/send-message
 * body: { pageId, conversationId? , customerId?, senderId?: string (agentId), contentType, content }
 * - If conversationId omitted, it will try find conversation by (pageId + customerId) or create one
 * - Sends via Facebook Send API using stored pageAccessToken (only for facebook platform)
 * - Stores message locally (status: sending -> update to sent)
 * TODO: Create message record

 */
router.post("/send-message", authMiddleware, async (req: AuthRequest, res) => {

  try {

    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const {
      pageId,
      conversationId,
      customerId,
      contentType = "text",
      content,
      senderId, // internal agent id
      senderName,
    } = req.body;

    if (!pageId || !content) return res.status(400).json({ message: "pageId and content required" });

    // find page info
    const pageInfo = await PageInfo.findOne({ pageId }).exec();
    if (!pageInfo) return res.status(400).json({ message: "Page not registered" });

    if(!conversationId)  return res.status(404).json({ message: "Conversation not found" });

    let conv = await Conversation.findOne({ pageId, customerId, conversationId }).exec();


    // if conversation not found, create new conversation (fetch profile if possible)
    if (!conv) {
      return res.status(404).json({ message: "Conversation not found" });
    } else {
      conv.lastMessage = contentType === "text" ? content : `📷 ${contentType}`;
      conv.lastMessageAt = (new Date()).toLocaleString();;
      await conv.save();
    }

    // create local message record (status: sending)
    const localMsg = await Message.create({
      pageId,
      pageName: pageInfo.pageName,

      conversationId: conv._id,

      senderType: "agent",
      senderId: senderId,

      contentType,
      content,
      timestamp: new Date(),
      status: "sending",

      metadata: {
        senderName,
      },
      replyTo: { senderName: "", content: "" },
    });

    // send to Facebook (only if platform facebook)
    let sendResult: any = null;
    if ((pageInfo.platform || "facebook") === "facebook" && pageInfo.pageAccessToken && customerId) {
      // prepare message object
      let messageObj: any;
      if (contentType === "text") {
        messageObj = { text: content };
      } else if (contentType === "image" || contentType === "video" || contentType === "file") {
        messageObj = {
          attachment: {
            type: contentType,
            payload: { url: content, is_reusable: true },
          },
        };
      } else {
        messageObj = { text: content };
      }

      try {
        sendResult = await sendFacebookMessage(pageInfo.pageAccessToken, customerId, messageObj);
        // update message status to 'sent'
        localMsg.status = "sent";
        await localMsg.save();
      } catch (err: any) {
        localMsg.status = "failed";
        await localMsg.save();
        console.error("send to facebook failed", err);
        // still return 200 with failure info
        return res.status(200).json({ ok: false, error: err?.response?.data || String(err), message: localMsg });
      }
    } else {
      // not facebook or missing token/customerId: just persist as local message
      localMsg.status = "sent";
      await localMsg.save();
    }

    return res.status(200).json({ ok: true, message: localMsg, sendResult });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});

router.put("/conversations/:conversationId", authMiddleware, async (req: AuthRequest, res) => {
  console.log('here');
try {
  const {conversationId} = req.params;
  const {tags} = req.body;
  if(!conversationId) return res.status(401).json({ message: "Cannot find the conversationId" });

  console.log('runn here');
  // const conversation = await Conversation.findOne({conversationId});
  // if(!conversation) return res.status(401).json({ message: "The conversationId does not have data" });
  await Conversation.findOneAndUpdate({conversationId}, {tags: tags})

} catch (err) {
      console.error(err);
    return res.status(500).json({ message: "Server error", error: String(err) });
}
})

export default router;
