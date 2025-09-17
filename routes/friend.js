import express from "express";
import User from "../models/PostModel.js";
const router = express.Router();

// Add friend
router.post("/add", async (req, res) => {
  const { userId, friendId } = req.body;

  if (userId === friendId)
    return res.status(400).json({ msg: "Cannot add yourself" });

  try {
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user.friends.includes(friendId)) {
      user.friends.push(friendId);
      friend.friends.push(userId); // Mutual friendship
      await user.save();
      await friend.save();
      return res.status(200).json({ msg: "Friend added" });
    } else {
      return res.status(400).json({ msg: "Already friends" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Friend List
router.get("/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate(
      "friends",
      "fullName email profileImage"
    );
    res.status(200).json(user.friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
