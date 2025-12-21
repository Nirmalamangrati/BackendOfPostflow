import express from "express";
import Message from "../models/MessageModel.js";
import { verifyToken } from "../middleware/verifyAuth.js";

const router = express.Router();

/* get chat messages */
// GET messages between logged-in user & friend
router.get("/:friendId", async (req, res) => {
  const userId = req.query.userId;
  const friendId = req.params.friendId;

  if (!userId) return res.status(400).json({ msg: "userId required" });

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
