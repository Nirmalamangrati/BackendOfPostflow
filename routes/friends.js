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

    if (friendId === userId)
      return res.status(400).json({ msg: "Can't friend yourself" });

    const friend = await User.findById(friendId);
    const user = await User.findById(userId);

    if (!friend) return res.status(404).json({ msg: "User not found" });

    // Check if already friends
    if (user.friends.includes(friendId))
      return res.status(400).json({ msg: "User already a friend" });

    // Check if already sent
    if (friend.friendRequestsReceived.includes(userId))
      return res.status(400).json({ msg: "Friend request already sent" });

    // Add request
    friend.friendRequestsReceived.push(userId);
    user.friendRequestsSent.push(friendId);

    await friend.save();
    await user.save();

    return res.status(200).json({ msg: "Friend request sent" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
//dashboard friend request
// Get Friend Requests Received
router.get("/get-friend-requests", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "friendRequestsReceived",
      "fullname  profileImage"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const friendRequests = user.friendRequestsReceived.map((friend) => ({
      _id: friend._id,
      name: friend.fullname,
      profile: friend.profileImage,
    }));

    console.log("Friend requests received:", friendRequests);
    res.json(friendRequests);
  } catch (err) {
    console.error(err);
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

    if (friendId === userId)
      return res.status(400).json({ msg: "You cannot remove yourself" });

    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user || !friend)
      return res.status(404).json({ msg: "User not found" });

    // Check if they are actually friends
    const isFriendUser = user.friends.some((id) => id.equals(friendId));
    const isFriendOther = friend.friends.some((id) => id.equals(userId));

    if (!isFriendUser || !isFriendOther)
      return res.status(400).json({ msg: "You are not friends" });

    // Remove each other from friends list
    user.friends = user.friends.filter((id) => !id.equals(friendId));
    friend.friends = friend.friends.filter((id) => !id.equals(userId));

    await user.save();
    await friend.save();

    return res.status(200).json({ msg: "Friend removed successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
// Remove a suggested user from "People You May Know"
router.delete("/removes/:id", verifyToken, async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.userId;

  try {
    const user = await User.findById(currentUserId);
    if (!user)
      return res.status(404).json({ message: "Current user not found" });
    if (!user.suggestions.includes(userId)) {
      return res.status(400).json({ message: "User not in suggestions" });
    }

    // Remove user from suggestions
    user.suggestions = user.suggestions.filter(
      (id) => id.toString() !== userId
    );
    await user.save();

    res.status(200).json({
      message: "User removed from suggestions",
      suggestions: user.suggestions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
export default router;
