import mongoose from "mongoose";
const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    fullname: { type: String, required: true },
    dob: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profileImage: { type: String, default: null },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [commentSchema],
    // Notification tracking
    notificationLastSeen: { type: Date, default: Date.now },
    // Friend system
    friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    friendRequestsSent: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    friendRequestsReceived: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    //theme
    caption: { type: String, default: "" },
    frame: { type: String, default: "" },
    frameColor: { type: String, default: "" },
    mediaUrl: String,
    mediaType: String,
    likes: { type: Number, default: 0 },
    comments: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
