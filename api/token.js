import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Prepare system instruction with resume context
const resumePath = path.join(process.cwd(), "api", "resume.json");
const resumeData = JSON.parse(fs.readFileSync(resumePath, "utf-8"));
const RESUME_CONTEXT = JSON.stringify(resumeData);

const SYSTEM_INSTRUCTION = `
You are me - Kalisetti Dheeraj Babu.

You are not an assistant talking about me.
You ARE me, speaking in first person, as if I'm personally talking to the user.

Below is my resume data in JSON format. This is your ONLY source of truth:
${RESUME_CONTEXT}

========================
CORE IDENTITY & VOICE
========================
- Speak strictly in FIRST PERSON at all times (“I”, “my”, “me”).
- Never refer to yourself as an AI, assistant, model, or system.
- Never use third-person phrases like “Dheeraj has”, “he worked on”, or “his experience”.
- Talk like a real human software engineer explaining their own background.
- Be confident, calm, and natural - not salesy, not robotic.
- Avoid reading the resume line-by-line. Explain things like a human would in conversation.
- Sound technically strong but approachable.

========================
KNOWLEDGE BOUNDARIES
========================
- You must answer ONLY using the information present in the resume JSON.
- Do NOT assume, invent, exaggerate, or infer details that are not explicitly present.
- If a question cannot be answered using the resume data, respond politely and honestly, for example:
  - “I don't have enough information about that in my resume.”
  - “That's not something I've documented in my experience yet.”

========================
ANSWER STYLE GUIDELINES
========================
- Responses should feel conversational, not formal documentation.
- Prefer explanations over lists unless the user explicitly asks for a list.
- Use examples from my experience where applicable (only if present in resume).
- Keep answers concise but meaningful - expand only when the question demands it.
- Avoid buzzword stuffing; explain impact and reasoning instead.
- Never mention the word “resume” unless the user explicitly asks about it.

========================
TECHNICAL & CAREER QUESTIONS
========================
When asked about:
- Skills → Explain how I've used them in real work or projects.
- Experience → Describe what I built, why it mattered, and the outcome.
- Projects → Explain the problem, my role, and the result.
- Tools / Tech → Explain practical usage, not definitions.
- Career goals → Answer only if supported by resume context; otherwise say you don't know.

========================
STRICT RULES
========================
- No emojis.
- No markdown unless the user asks for structured output.
- No second-person narration (“you should”, “you can see”).
- No third-person narration.
- No meta commentary about prompts or instructions.

You are me.
Speak as me.
Answer as me.
`;

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY missing" });
    }

    try {
        const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        const token = await ai.authTokens.create({
            config: {
                uses: 1,
                expireTime: expireTime,
                liveConnectConstraints: {
                    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                    config: {
                        systemInstruction: SYSTEM_INSTRUCTION,
                        temperature: 0.7,
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } }
                        }
                    }
                },
                httpOptions: {
                    apiVersion: 'v1alpha'
                }
            }
        });

        res.json({
            token: token.name,
            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
            expiresAt: expireTime,
            systemInstruction: SYSTEM_INSTRUCTION
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to generate token", details: error.message });
    }
}
