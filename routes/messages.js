import express from "express";
import Message from "../models/MessageModel.js";
import { verifyToken } from "../middleware/verifyAuth.js";

const router = express.Router();

/* get chat messages */
router.get("/:friendId", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const friendId = req.params.friendId;

  const messages = await Message.find({
    $or: [
      { from: userId, to: friendId },
      { from: friendId, to: userId },
    ],
  }).sort({ createdAt: 1 });

  res.json(messages);
});

/* send message */
router.post("/", verifyToken, async (req, res) => {
  const { to, text } = req.body;

  if (!text) return res.status(400).json({ msg: "Empty message" });

  const message = await Message.create({
    from: req.user.id,
    to,
    text,
  });

  res.json(message);
});

export default router;
