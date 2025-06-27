// theme.js
import express from "express";
import multer from "multer";
import path from "path";

const router = express.Router();

// Multer storage config - files saved to 'uploads/themes' folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/themes");
  },
  filename: (req, file, cb) => {
    // e.g. theme-123456789.png
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "theme-" + uniqueSuffix + ext);
  },
});

const upload = multer({ storage });

// GET current theme info (dummy example)
router.get("/", (req, res) => {
  res.json({ theme: "light", message: "Current theme info here" });
});

// POST upload a theme image or asset
router.post("/upload", upload.single("themeImage"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Return uploaded file info
  res.json({
    message: "Theme image uploaded successfully",
    file: req.file,
  });
});

export default router;
