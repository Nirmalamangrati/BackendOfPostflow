import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import postRoutes from "./routes/postRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static folder for uploaded images
app.use("/uploads", express.static("uploads"));

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/postflow")
  .then(() => console.log("DB connected!"))
  .catch((err) => console.error("DB connection error:", err));

// Use post routes
app.use("/", postRoutes);

// Start server
app.listen(8000, () => {
  console.log("Server running on http://localhost:8000");
});
