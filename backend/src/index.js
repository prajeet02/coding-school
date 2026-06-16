import express from "express"
import dotenv from "dotenv"
import prisma from "./prismaClient.js";
import cors from "cors"

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


app.get("/health", async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT NOW()`
        res.json({
            status: "backend is running",
            db: "Database is conncected",
        })
    } catch (err) {
        res.status(500).json({
            status: "backend is running",
            db: "Database is not connected",
            error: err.message,
        })
    }
})

app.listen(8080, () => {
    console.log("Server is listening on 8080")
})