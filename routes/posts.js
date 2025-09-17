import express from "express";
import Post from "../models/PostModel.js";
import User from "../models/User.js";
import { verifyToken } from "../middleware/verifyAuth.js";

const router = express.Router();

// Create a Post
router.post("/", verifyToken, async (req, res) => {
  try {
    const newPost = new Post({
      userId: req.user.id,
      content: req.body.content,
    });

    const savedPost = await newPost.save();
    res.json(savedPost);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Posts from Friends
router.get("/friends", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const friendIds = user.friends;

    const posts = await Post.find({ userId: { $in: friendIds } })
      .populate("userId", "name")
      .populate("comments.userId", "name")
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Comment to Post
router.post("/:postId/comment", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: "Post not found" });

    post.comments.push({
      userId: req.user.id,
      text: req.body.text,
    });
    await post.save();

    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
