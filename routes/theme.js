import express from "express";
import multer from "multer";
import path from "path";
import Post from "../models/PostModel.js";
import { verifyToken } from "../middleware/verifyAuth.js";

const router = express.Router();

//  Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/themes");
  },
  filename: (req, file, cb) => {
    const uniqueName = "theme-" + Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// POST /theme-upload route
router.post(
  "/theme-upload",
  verifyToken,
  upload.single("media"),
  async (req, res) => {
    try {
      const { caption, frame } = req.body;
      const userId = req.user.id; // from token

      console.log("Caption:", caption);
      console.log("File:", req.file);
      console.log("UserId:", userId);

      if (!caption || !req.file || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const mediaType = req.file.mimetype.startsWith("video")
        ? "video"
        : "photo";
      const imageUrl = req.file.filename;

      const newPost = new Post({
        userId,
        caption,
        frame,
        imageUrl,
        mediaType,
        likes: 0,
        likedBy: [],
        comments: [],
        createdAt: new Date(),
      });

      await newPost.save();
      res.status(201).json(newPost);
    } catch (error) {
      console.error("Upload Error:", error);
      res.status(400).json({ error: "Failed to upload post" });
    }
  }
);

export default router;
