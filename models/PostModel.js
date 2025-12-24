import mongoose from "mongoose";

// Comment sub-schema
const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Main Post schema
const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  caption: { type: String, default: "" },
  imageUrl: { type: String, required: true },
  mediaUrl: { type: String },
  mediaType: { type: String, enum: ["photo", "video"] },
  category: { type: String, default: "" },
  themeColor: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  title: { type: String, default: "" },
  content: { type: String, default: "" },
  likes: { type: Number, default: 0 },
  likedByUsers: { type: [String], default: [] },
  comments: [commentSchema],
  frame: { type: String, default: "frame1" },
  frameColor: { type: String, default: "#ec4899" },
  suggestions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

// Avoid OverwriteModelError
const Post = mongoose.models.Post || mongoose.model("Post", postSchema);
export default Post;
