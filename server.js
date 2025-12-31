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
import MessageModel from "./models/MessageModel.js";
import { verifyToken } from "./middleware/verifyAuth.js";
import messageRoutes from "./routes/messages.js";
import { v2 as cloudinary } from "cloudinary";

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
mongoose
  .connect(
    "mongodb+srv://nirmalamgrt_db_user:FNMz0JRpF9gMtHMW@cluster0.bvwjmc0.mongodb.net/?appName=Cluster0"
  )
  .then(() => {
    console.log("DB connected!");
  });

// Create HTTP Server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  methods: ["GET", "POST"],
});

app.get("/", (req, res) => {
  res.send("Hello world from Express!");
});

// messaging
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join user room
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log("User joined room:", userId);
  });

  socket.on("message", async ({ to, from, text }) => {
    console.log("Socket message:", { to, from, text });

    if (!to || !from || !text?.trim()) {
      socket.emit("error", { message: "Invalid message data" });
      return;
    }

    try {
      const message = await MessageModel.create({
        from: new mongoose.Types.ObjectId(from),
        to: new mongoose.Types.ObjectId(to),
        text: text.trim(),
      });

      // Send to receiver
      io.to(to).emit("receiveMessage", {
        _id: message._id,
        from,
        to,
        text: message.text,
        createdAt: message.createdAt,
      });

      // Confirm to sender
      socket.emit("messageSent", {
        _id: message._id,
        from,
        to,
        text: message.text,
        createdAt: message.createdAt,
      });

      console.log(`Message delivered: ${from} → ${to}`);
    } catch (error) {
      console.error("Message error:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

app.post("/notify", (req, res) => {
  const { userId, message } = req.body;
  const timestamp = new Date();
  io.to(userId).emit("newNotification", { message, timestamp });
  res.json({ success: true });
});

// Upload route
app.post("/api/upload", upload.single("media"), (req, res) => {
  cloudinary.uploader.upload(
    req.file.path,
    { folder: "postflow" },
    (error, result) => {
      if (error) {
        console.error("Cloudinary upload error:", error);
        return res.status(500).json({ error: "Failed to upload media" });
      }
      res.json({ url: result.secure_url });
    }
  );
  res.status(200).json({ message: "File uploaded successfully" });
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
      const regex = new RegExp(filter.trim(), "i");

      const posts = await Post.find({
        $or: [{ caption: regex }],
      })
        .populate({ path: "comments.userId", select: "fullname profileImage" })
        .populate({ path: "userId", select: "fullname profileImage" })
        .sort({ createdAt: -1 });

      return res.status(200).json(posts);
    }

    const posts = await Post.find()
      .populate({ path: "comments.userId", select: "fullname profileImage" })
      .populate({ path: "userId", select: "fullname profileImage" })
      .sort({ createdAt: -1 });

    console.log(" Dashboard LOADED with populated comments:", posts.length);
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
app.post("/dashboard/comment/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text cannot be empty" });
    }

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    post.comments.push({
      userId: req.user.id,
      text: text.trim(),
    });

    await post.save();
    const populatedPost = await Post.findById(id)
      .populate({
        path: "comments.userId",
        select: "fullname profileImage",
      })
      .populate({
        path: "userId",
        select: "fullname profileImage",
      });

    console.log(
      "Populated comment user:",
      populatedPost.comments[populatedPost.comments.length - 1]?.userId
    );
    res.json(populatedPost);
  } catch (error) {
    console.error("Comment error:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// Edit comment
app.put(
  "/dashboard/comment/:postId/:commentId",
  verifyToken,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;
      const { text } = req.body;
      const userId = req.user.id;

      const post = await Post.findById(postId);
      if (!post) return res.status(404).json({ msg: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ msg: "Comment not found" });
      if (comment.userId.toString() !== userId)
        return res.status(403).json({ msg: "Not allowed" });

      comment.text = text;
      await post.save();
      const updatedPost = await Post.findById(postId).populate(
        "comments.userId",
        "fullname profileImage"
      );

      res.json(updatedPost);
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  }
);

// Delete comment
app.delete(
  "/dashboard/comment/:postId/:commentId",
  verifyToken,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;
      const userId = req.user.id;

      const post = await Post.findById(postId);
      if (!post) return res.status(404).json({ msg: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ msg: "Comment not found" });
      if (comment.userId.toString() !== userId)
        return res.status(403).json({ msg: "Not allowed" });

      comment.deleteOne();
      await post.save();
      const updatedPost = await Post.findById(postId).populate(
        "comments.userId",
        "fullname profileImage"
      );

      res.json(updatedPost);
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  }
);

// Theme
app.get("/theme", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate({ path: "comments.userId", select: "fullname profileImage" })
      .populate({ path: "userId", select: "fullname profileImage" })
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/theme-upload", verifyToken, (req, res) => {
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

app.use("/api/users", authRoutes);
app.use("/profilehandler", profileRouter);
app.use("/api/friends", friendRoutes);
app.use("/posts", postRoutes);
app.use("/api/messages", messageRoutes);

const PORT = 8000;
server.listen(PORT, () => {
  console.log(` Server and Socket.IO running on port ${PORT}`);
});
