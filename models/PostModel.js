import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
  caption: String,
  imageUrl: String,
  createdAt: { type: Date, default: Date.now },
  author: {
    type: Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  like: {
    type: Number,
    default: 0,
  },
});

const Post = mongoose.models.Post || mongoose.model("Post", postSchema);

export default Post;
