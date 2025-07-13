import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js";

dotenv.config();

const app = express();
const server = createServer(app);
const io = connectToSocket(server); // Socket setup

app.set("port", process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

// API routes
app.use("/api/v1/users", userRoutes);

// Optional health check
app.get("/", (req, res) => {
    res.send("Server is running");
});

const start = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ MongoDB connected successfully`);

        server.listen(app.get("port"), () => {
            console.log(`🚀 Server running on port ${app.get("port")}`);
        });
    } catch (error) {
        console.error("❌ MongoDB connection error:", error.message);
        process.exit(1);
    }
};

start();
