import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import "dotenv/config";
import fs from "fs";
import profileRouter from "./routes/profilehandler.js";
import authRoutes from "./routes/auth.js";
import Post from "./models/PostModel.js";
import friendRoutes from "./routes/friends.js";
import postRoutes from "./routes/posts.js";
import http from "http";
import { Server } from "socket.io";
import { ThemeModel } from "./models/ThemeModel.js";
import { verifyToken } from "./middleware/verifyAuth.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads/profile", express.static("uploads/profile"));
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
  console.log("DB connected!");
});

// 1. Create HTTP Server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  methods: ["GET", "POST"],
});
// Define  routes
app.get("/", (req, res) => {
  res.send("Hello world from Express!");
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("joinRoom", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Endpoint to trigger a notification
app.post("/notify", (req, res) => {
  const { userId, message } = req.body;
  const timestamp = new Date();

  // Send notification to the user's room
  io.to(userId).emit("newNotification", { message, timestamp });
  res.json({ success: true });
});

// Upload route
app.post("/api/upload", upload.single("media"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const fileUrl = `http://localhost:8000/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Create new post
app.post("/dashboard", async (req, res) => {
  try {
    const { caption, mediaType, userId, imageUrl } = req.body;

    if ((!caption || !caption.trim()) && !imageUrl) {
      return res.status(400).json({ error: "Caption or image required" });
    }

    const post = await Post.create({
      caption,
      imageUrl,
      mediaType,
      userId,
    });

    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// Get all posts
app.get("/dashboard", async (req, res) => {
  try {
    const { filter } = req.query;

    if (filter && typeof filter === "string" && filter.trim().length > 0) {
      const regex = new RegExp(filter.trim(), "i"); // case-insensitive regex

      const posts = await Post.find({
        $or: [{ caption: regex }],
      }).sort({ createdAt: -1 });

      return res.status(200).json(posts);
    }

    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
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

// Delete post
app.delete("/dashboard/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    // media file delete garne part
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
app.post("/dashboard/:postId/like", verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    if (!mongoose.Types.ObjectId.isValid(postId))
      return res.status(400).json({ message: "Invalid post ID" });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.likedByUsers = post.likedByUsers || [];
    post.likes = post.likes || 0;

    const likedIndex = post.likedByUsers.indexOf(userId);
    if (likedIndex === -1) {
      post.likes += 1;
      post.likedByUsers.push(userId);
    } else {
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
//Theme

app.get("/theme", async (req, res) => {
  try {
    const themes = await ThemeModel.find();
    res.json(themes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching themes" });
  }
});

app.post("/theme-upload", verifyToken, (req, res) => {
  const uploadSingle = upload.single("image");
  const userId = req.user.id;
  uploadSingle(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: "Multer error: " + err.message });
    } else if (err) {
      return res
        .status(500)
        .json({ error: "Unknown upload error: " + err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { caption, frame, image } = req.body;

    const fileUrl = `http://localhost:8000/uploads/${req.file.filename}`;
    const post = await Post.create({
      user: req.user.id,
      text: req.body.text,
      media: req.file ? req.file.filename : null,
      frame: req.body.frame,
    });
    const savedPost = await post.save();
    res.status(200).json(savedPost);
    res.json({
      message: "File uploaded successfully",
      url: fileUrl,
      caption,
      frame,
      image,
    });
  });
});

// Other Routers
app.use("/api/users", authRoutes);
// Profile
app.use("/profilehandler", profileRouter);
//theme
app.use("/posts", postRoutes);

app.use("/api/friends", friendRoutes);
app.use("/api/friends", postRoutes);
app.use("/api", friendRoutes);

const PORT = 8000;
server.listen(PORT, () => {
  console.log(` Server and Socket.IO running on port ${PORT}`);
});
