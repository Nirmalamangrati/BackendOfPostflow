import mongoose from "mongoose";

// Comment sub-schema
const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  createdAt: { type: Date, default: Date.now },
});

// Main Post schema
const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  caption: { type: String, required: true },
  fullName: String,
  email: String,
  profileImage: String,
  frame: { type: String, default: "" },
  category: String,
  imageUrl: { type: String, required: true },
  mediaUrl: { type: String },
  mediaType: { type: String, enum: ["photo", "video"] },
  themeColor: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  title: String,
  content: String,
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  // Social features
  likes: { type: Number, default: 0 },
  likedByUsers: { type: [String], default: [] },
  comments: [commentSchema],

  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

// Avoid OverwriteModelError
const Post = mongoose.models.Post || mongoose.model("Post", postSchema);
export default Post;
