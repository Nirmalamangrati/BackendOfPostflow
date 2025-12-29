import express from "express";
import Message from "../models/MessageModel.js";
import { verifyToken } from "../middleware/verifyAuth.js";

const router = express.Router();

/* GET chat messages - Fixed auth */
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

/* POST send message - Socket ready */
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

    const io = req.app.get("io");
    if (io) {
      io.to(to).emit("receiveMessage", {
        _id: message._id,
        from: req.user.id,
        to,
        text: message.text,
        createdAt: message.createdAt,
      });

      console.log(` Message emitted to room ${to}`);
    }

    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

export default router;
