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
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  profileImage: { type: String, default: "" },
  frame: { type: String, default: "" },
  category: { type: String, default: "" },
  imageUrl: { type: String, required: true },
  mediaUrl: { type: String },
  mediaType: { type: String, enum: ["photo", "video"] },
  themeColor: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  title: { type: String, default: "" },
  content: { type: String, default: "" },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  // Social features
  likes: { type: Number, default: 0 },
  likedByUsers: { type: [String], default: [] },
  comments: [commentSchema],

  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  suggestions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // People You May Know
});

// Avoid OverwriteModelError
const Post = mongoose.models.Post || mongoose.model("Post", postSchema);
export default Post;
