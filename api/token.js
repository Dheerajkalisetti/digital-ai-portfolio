import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

dotenv.config();

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY missing" });
    }

    const resumePath = path.join(process.cwd(), "server", "resume.json");
    const resumeData = JSON.parse(fs.readFileSync(resumePath, "utf-8"));

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const token = await ai.authTokens.create({
        config: {
            uses: 1,
            expireTime,
            liveConnectConstraints: {
                model: "gemini-2.5-flash-native-audio-preview-12-2025",
            },
        },
    });

    res.json({
        token: token.name,
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        expiresAt: expireTime,
        systemInstruction: JSON.stringify(resumeData),
    });
}
