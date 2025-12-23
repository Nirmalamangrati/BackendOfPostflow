import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { ThemeModel } from "../models/ThemeModel.js";
import { verifyToken } from "../middleware/verifyAuth.js";

const router = express.Router();

// Multer setup for media upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// --- GET all posts ---
//Theme
router.get("/theme", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
// --- CREATE post ---
router.post("/theme-upload", verifyToken, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { caption, frame, frameColor } = req.body;

      const post = await Post.create({
        userId: req.user.id,
        caption: caption || "",
        frame: frame || "",
        frameColor: frameColor || "",
        imageUrl: `http://localhost:8000/uploads/${req.file.filename}`,
        likes: 0,
        comments: [],
      });

      res.status(201).json(post);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// --- EDIT post ---
router.patch("/theme/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    const post = await ThemeModel.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.userId.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    post.caption = text || post.caption;
    await post.save();

    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- DELETE post ---
router.delete("/theme/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const post = await ThemeModel.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.userId.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    // Delete media from disk
    if (post.mediaUrl) {
      const filePath = path.join("uploads", path.basename(post.mediaUrl));
      fs.unlink(filePath, (err) => {
        if (err) console.error(err);
      });
    }

    await post.remove();
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- LIKE/UNLIKE post ---
router.post("/theme/:id/like", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const post = await ThemeModel.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const index = post.likes.indexOf(req.user.id);
    if (index === -1) post.likes.push(req.user.id);
    else post.likes.splice(index, 1);

    await post.save();
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- ADD comment ---
router.post("/theme/:id/comments", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const post = await ThemeModel.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({ userId: req.user.id, text });
    await post.save();
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- EDIT comment ---
router.patch(
  "/theme/:postId/comments/:commentId",
  verifyToken,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;
      const { text } = req.body;

      const post = await ThemeModel.findById(postId);
      if (!post) return res.status(404).json({ message: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment)
        return res.status(404).json({ message: "Comment not found" });
      if (comment.userId.toString() !== req.user.id)
        return res.status(403).json({ message: "Unauthorized" });

      comment.text = text || comment.text;
      await post.save();
      res.json(post);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// --- DELETE comment ---
router.delete(
  "/theme/:postId/comments/:commentId",
  verifyToken,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;
      const post = await ThemeModel.findById(postId);
      if (!post) return res.status(404).json({ message: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment)
        return res.status(404).json({ message: "Comment not found" });
      if (comment.userId.toString() !== req.user.id)
        return res.status(403).json({ message: "Unauthorized" });

      comment.remove();
      await post.save();
      res.json(post);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

export default router;
