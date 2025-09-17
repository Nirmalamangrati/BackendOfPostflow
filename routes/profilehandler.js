import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import Post from "../models/PostModel.js";
import { verifyToken } from "../middleware/verifyAuth.js";
const router = express.Router();

// Multer setup for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/profile";
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});
const upload = multer({ storage });

// POST create new post
router.post("/", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { caption } = req.body;
    const imageUrl = req.file?.filename;

    if (!userId) {
      return res.status(400).json({ error: "Missing user from token" });
    }

    if (!imageUrl) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const newPost = await Post.create({
      userId,
      caption,
      imageUrl: `http://localhost:8000/uploads/profile/${imageUrl}`,
    });

    res.status(201).json(newPost);
  } catch (error) {
    console.error("POST /profilehandler failed:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// GET all posts (public)
router.get("/my-post", verifyToken, async (req, res) => {
  try {
    const user = req.user;
    console.log(user);
    const posts = await Post.find({ userId: user.id }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error("Error fetching user posts:", err);
    res.status(500).json({ error: "Failed to fetch user posts" });
  }
});
// GET posts of logged-in user
router.get("profilehandler/my-post", verifyToken, async (req, res) => {
  try {
    const posts = await Post.find({ createdBy: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fetching posts failed" });
  }
});

// POST like/unlike toggle
router.post("/:postId/like", verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const likedIndex = post.likedByUsers.indexOf(userId);
    if (likedIndex === -1) {
      // Not liked yet - add like
      post.likes += 1;
      post.likedByUsers.push(userId);
    } else {
      // Already liked - remove like
      post.likes = Math.max(post.likes - 1, 0);
      post.likedByUsers.splice(likedIndex, 1);
    }

    await post.save();

    res.json({
      success: true,
      likes: post.likes,
      likedByUser: likedIndex === -1,
    });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST add comment
router.post("/:postId/comment", verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    if (!text)
      return res.status(400).json({ message: "Comment text required" });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({ text, createdAt: new Date() });
    await post.save();

    res.json({ comments: post.comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT update caption (only owner)
router.put("/:postId", verifyToken, async (req, res) => {
  try {
    console.log("User:", req.user);
    const { postId } = req.params;
    const { caption } = req.body;

    if (typeof caption !== "string")
      return res.status(400).json({ message: "Caption must be a string" });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.userId.toString() !== req.user.id)
      return res
        .status(403)
        .json({ message: "Unauthorized to edit this post" });

    post.caption = caption;
    await post.save();

    res.json({ message: "Post updated", caption: post.caption });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE post and image (only owner)
router.delete("/:postId", verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!post.userId || post.userId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Unauthorized to delete this post" });
    }

    const imagePath = path.join(process.cwd(), post.imageUrl);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await Post.findByIdAndDelete(postId);
    res.json({ message: "Post deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE comment (only owner of post)
router.delete("/:postId/comment/:commentId", verifyToken, async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!post.userId || post.userId.toString() !== req.user.id)
      return res
        .status(403)
        .json({ message: "Unauthorized to delete comment" });

    const commentIndex = post.comments.findIndex(
      (c) => c._id.toString() === commentId
    );
    if (commentIndex === -1)
      return res.status(404).json({ message: "Comment not found" });

    post.comments.splice(commentIndex, 1);
    await post.save();

    res.json({ message: "Comment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT edit comment (only owner of post)
router.put("/:postId/comment/:commentId", verifyToken, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;

    if (!text) return res.status(400).json({ message: "Text required" });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!post.userId || post.userId.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized to edit comment" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.text = text;
    await post.save();

    res.json({ message: "Comment updated", comments: post.comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
