import express from "express";
import User from "../models/User.js";
import { verifyToken } from "../middleware/verifyAuth.js";

const router = express.Router();
// GET all users (for "People you may know")
router.get("/all", verifyToken, async (req, res) => {
  try {
    const users = await User.find({}, "fullname email");
    const formattedUsers = users.map((user) => ({
      _id: user._id,
      name: user.fullname,
      email: user.email,
    }));
    console.log("Users fetched from DB:", formattedUsers);
    res.json(formattedUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send Friend Request
router.post("/request/:id", verifyToken, async (req, res) => {
  try {
    const friendId = req.params.id;
    const userId = req.user.id;
    console.log("Friend ID:", friendId, "User ID:", userId);
    if (friendId === userId)
      return res.status(400).json({ msg: "Can't friend yourself" });

    const friend = await User.findById(friendId);
    const user = await User.findById(userId);

    if (!friend) return res.status(404).json({ msg: "User not found" });
    if (user.friends.includes(friendId))
      return res.status(400).json({ msg: "User already a friend" });
    if (friend.friendRequests.includes(userId))
      return res.status(400).json({ msg: "Friend request already sent" });

    friend.friendRequests.push(userId);
    await friend.save();

    res.json({ msg: "Friend request sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept Friend Request
router.post("/accept/:id", verifyToken, async (req, res) => {
  try {
    const requesterId = req.params.id;
    const userId = req.user.id;
    const user = await User.findById(userId);
    const requester = await User.findById(requesterId);

    if (!user.friendRequests.includes(requesterId)) {
      return res.status(400).json({ msg: "No friend request from this user" });
    }

    user.friends.push(requesterId);
    requester.friends.push(userId);

    user.friendRequests = user.friendRequests.filter(
      (id) => id.toString() !== requesterId
    );
    await user.save();
    await requester.save();

    res.json({ msg: "Friend request accepted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Friend List
router.get("/list", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "friends",
      "name email"
    );
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove Friend
router.delete("/remove/:id", verifyToken, async (req, res) => {
  try {
    const friendId = req.params.id;
    const userId = req.user.id;
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    user.friends = user.friends.filter((id) => id.toString() !== friendId);
    friend.friends = friend.friends.filter((id) => id.toString() !== userId);

    await user.save();
    await friend.save();

    res.json({ msg: "Friend removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
