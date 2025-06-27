import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";

const router = express.Router();

// Multer setup
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

// Mongoose schema & model
const commentSchema = new mongoose.Schema({
  text: String,
  createdAt: { type: Date, default: Date.now },
});

const profilePostSchema = new mongoose.Schema({
  imageUrl: String,
  caption: String,
  createdAt: { type: Date, default: Date.now },
  likes: { type: Number, default: 0 },
  likedByUsers: { type: [String], default: [] },
  comments: [commentSchema],
});

const ProfilePost = mongoose.model("ProfilePost", profilePostSchema);

// POST new post
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { caption } = req.body;
    if (!req.file) return res.status(400).json({ message: "Image required" });

    const imageUrl = `/uploads/profile/${req.file.filename}`;
    const post = await ProfilePost.create({ imageUrl, caption });

    res.json({ message: "Post uploaded", post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET all posts
router.get("/", async (req, res) => {
  try {
    const posts = await ProfilePost.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// router.get(
//   "/my-post",
//   /**verifyAuth */ async (req, res) => {
//     console.log(req.user._id, "@user");
//     await Post.findOne({ _id: req.user._id });
//   }
// );

// POST like/unlike
router.post("/:postId/like", async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "UserId required" });

    const post = await ProfilePost.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const likedIndex = post.likedByUsers.indexOf(userId);
    if (likedIndex === -1) {
      post.likedByUsers.push(userId);
      post.likes++;
    } else {
      post.likedByUsers.splice(likedIndex, 1);
      post.likes = Math.max(post.likes - 1, 0);
    }
    await post.save();

    res.json({
      likes: post.likes,
      likedByUser: post.likedByUsers.includes(userId),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST add comment
router.post("/:postId/comment", async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    if (!text)
      return res.status(400).json({ message: "Comment text required" });

    const post = await ProfilePost.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({ text, createdAt: new Date() });
    await post.save();

    res.json({ comments: post.comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT update caption
router.put("/:postId", async (req, res) => {
  try {
    const { postId } = req.params;
    const { caption } = req.body;

    if (typeof caption !== "string") {
      return res
        .status(400)
        .json({ message: "Caption is required and must be a string" });
    }

    const post = await ProfilePost.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.caption = caption;
    await post.save();

    res.json({ message: "Post updated", caption: post.caption });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE post & image
router.delete("/:postId", async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await ProfilePost.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const imagePath = path.join(process.cwd(), post.imageUrl);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await ProfilePost.findByIdAndDelete(postId);

    res.json({ message: "Post deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
//comment delete
router.delete("/:postId/comment/:commentId", async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    const post = await ProfilePost.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const commentIndex = post.comments.findIndex(
      (c) => c._id.toString() === commentId
    );
    if (commentIndex === -1)
      return res.status(404).json({ message: "Comment not found" });

    post.comments.splice(commentIndex, 1);
    await post.save();

    res.json({ message: "Comment deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
//comment edit
router.put("/:postId/comment/:commentId", async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;

    if (!text) return res.status(400).json({ message: "Text required" });

    const post = await ProfilePost.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.text = text;
    await post.save();

    res.json({ message: "Comment updated", comments: post.comments });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
