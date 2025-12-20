import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const MessageModel = mongoose.model("Message", messageSchema);

export default MessageModel;
