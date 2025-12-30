// messagesRoutes.js - FULL 100% FIXED
import express from "express";
import mongoose from "mongoose";
import Message from "../models/MessageModel.js";
import { verifyToken } from "../middleware/verifyAuth.js";

const router = express.Router();

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/* GET chat messages */
router.get("/:friendId", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const friendId = req.params.friendId;

  if (!userId || !friendId) {
    return res.status(400).json({ msg: "userId and friendId required" });
  }

  try {
    const messages = await Message.find({
      $or: [
        { from: userId, to: friendId },
        { from: friendId, to: userId },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

/* POST send message ✅ PERFECT */
router.post("/", verifyToken, async (req, res) => {
  const { to, text } = req.body;

  if (!text || !to) {
    return res.status(400).json({ msg: "to and text required" });
  }

  try {
    const message = await Message.create({
      from: req.user.id,
      to,
      text,
    });

    console.log("✅ NEW MESSAGE CREATED:", message._id);

    const io = req.app.get("io");
    if (io) {
      io.to(req.user.id).emit("receiveMessage", {
        _id: message._id.toString(),
        from: req.user.id,
        to,
        text: message.text,
        createdAt: message.createdAt,
      });

      io.to(to).emit("receiveMessage", {
        _id: message._id.toString(),
        from: req.user.id,
        to: req.user.id,
        text: message.text,
        createdAt: message.createdAt,
      });
    }

    res.json(message);
  } catch (err) {
    console.error("POST error:", err);
    res.status(500).json({ msg: err.message });
  }
});

/* PUT EDIT - 100% FIXED */
router.put("/:messageId", verifyToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    console.log("🔍 EDIT:", { messageId, userId });

    if (!text || !messageId) {
      return res.status(400).json({ msg: "Text and messageId required" });
    }

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({ msg: `Invalid ID: ${messageId}` });
    }

    const message = await Message.findOne({ _id: messageId, from: userId });
    if (!message) {
      return res
        .status(404)
        .json({ msg: "Message not found or no permission" });
    }

    message.text = text;
    message.isEdited = true;
    message.updatedAt = new Date();
    await message.save();

    console.log("✅ EDITED:", messageId);

    const io = req.app.get("io");
    if (io) {
      io.to(message.from).to(message.to).emit("messageEdited", {
        _id: message._id.toString(),
        text: message.text,
        isEdited: true,
        editedAt: message.updatedAt,
      });
    }

    res.json(message);
  } catch (error) {
    console.error("EDIT ERROR:", error);
    res.status(500).json({ msg: error.message });
  }
});

/* DELETE - 100% FIXED */
router.delete("/:messageId", verifyToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    console.log("🗑️ DELETE:", { messageId, userId });

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({ msg: `Invalid ID: ${messageId}` });
    }

    const message = await Message.findOne({
      _id: messageId,
      $or: [{ from: userId }, { to: userId }],
    });

    if (!message) {
      return res
        .status(404)
        .json({ msg: "Message not found or no permission" });
    }

    await Message.findByIdAndDelete(messageId);
    console.log("✅ DELETED:", messageId);

    const io = req.app.get("io");
    if (io) {
      io.to(message.from).to(message.to).emit("messageDeleted", { messageId });
    }

    res.json({ msg: "Deleted successfully" });
  } catch (error) {
    console.error("DELETE ERROR:", error);
    res.status(500).json({ msg: error.message });
  }
});

export default router;
