import mongoose from "mongoose";

const themeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  name: { type: String, required: true },
  color: { type: String, required: true },
  imageUrl: { type: String, required: true },

  frame: { type: String, default: "" },
  category: { type: String, default: "" },
  title: { type: String, default: "" },
  content: { type: String, default: "" },

  caption: { type: String, default: "" },
  media: { type: String, default: "" },

  // ❤️ LIKE SYSTEM (single & correct)
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],

  createdAt: { type: Date, default: Date.now },
});

export const ThemeModel = mongoose.model("Theme", themeSchema);
