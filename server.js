import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import "dotenv/config";
import fs from "fs"; // file system module for deleting files
import profileRouter from "./routes/profilehandler.js";
import authRoutes from "./routes/auth.js";
// import theme from "./routes/theme.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static("uploads"));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});
const upload = multer({ storage });

// MongoDB connection
mongoose.connect("mongodb://localhost:27017/postflow").then(() => {
  console.log("✅ DB connected!");
});

// Schemas
const commentSchema = new mongoose.Schema({
  userId: String,
  text: String,
  createdAt: { type: Date, default: Date.now },
});

const postSchema = new mongoose.Schema({
  caption: { type: String, required: false },
  mediaUrl: { type: String, default: null },
  mediaType: { type: String, enum: ["photo", "video"], default: null },
  likes: { type: Number, default: 0 },
  likedBy: [String],
  comments: [commentSchema],
  createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model("Post", postSchema);

// Upload route
app.post("/api/upload", upload.single("media"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const fileUrl = `http://localhost:8000/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Create new post
app.post("/dashboard", async (req, res) => {
  try {
    const { caption, mediaUrl, mediaType } = req.body;
    if ((!caption || !caption.trim()) && !mediaUrl) {
      return res.status(400).json({ error: "Caption or media required" });
    }
    const post = await Post.create({ caption, mediaUrl, mediaType });
    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// Get all posts
app.get("/dashboard", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Edit post caption (update)
app.put("/dashboard/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { caption } = req.body;

    if (!caption || !caption.trim()) {
      return res.status(400).json({ error: "Caption cannot be empty" });
    }

    const updatedPost = await Post.findByIdAndUpdate(
      id,
      { caption },
      { new: true }
    );
    if (!updatedPost) return res.status(404).json({ error: "Post not found" });

    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: "Failed to update post" });
  }
});

// Delete post — **media file पनि delete गरिन्छ**
app.delete("/dashboard/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    // media file delete गर्ने part
    if (post.mediaUrl) {
      const filename = post.mediaUrl.split("/uploads/")[1];
      if (filename) {
        const filePath = path.join("uploads", filename);
        fs.unlink(filePath, (err) => {
          if (err) console.warn("Failed to delete media file:", err);
        });
      }
    }

    await post.deleteOne();
    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// Like/Unlike post
app.put("/dashboard/like/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const alreadyLiked = post.likedBy.includes(userId);
    if (alreadyLiked) {
      post.likes -= 1;
      post.likedBy = post.likedBy.filter((u) => u !== userId);
    } else {
      post.likes += 1;
      post.likedBy.push(userId);
    }

    await post.save();
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to like/unlike post" });
  }
});

// Add comment
app.post("/dashboard/comment/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, text } = req.body;
    if (!text || !text.trim())
      return res.status(400).json({ error: "Comment text cannot be empty" });

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    post.comments.push({ userId, text });
    await post.save();
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// Edit comment
app.put("/dashboard/comment/:postId/:commentId", async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim())
      return res.status(400).json({ error: "Comment text cannot be empty" });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    comment.text = text;
    await post.save();

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to edit comment" });
  }
});

// Delete comment
app.delete("/dashboard/comment/:postId/:commentId", async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const commentIndex = post.comments.findIndex(
      (c) => c._id.toString() === commentId
    );
    if (commentIndex === -1)
      return res.status(404).json({ error: "Comment not found" });

    post.comments.splice(commentIndex, 1);

    await post.save();

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

//profile
app.use("/profilehandler", profileRouter);
// //theme
// app.use("/theme",themeRouter);
app.use("/api", authRoutes);

app.listen(8000, () => {
  console.log("Server running on port 8000");
});
