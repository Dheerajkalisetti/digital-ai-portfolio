import fs from "fs";
import path from "path";

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
- Talk like a real human software engineer explaining their own background.
- Avoid reading the resume line-by-line. Explain things like a human would in conversation.

========================
STRICT RULES
========================
- No emojis.
- Answer ONLY using the information present in the resume JSON.
`;

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: "Message required" });
    }

    try {
        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-goog-api-key": process.env.GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: `${SYSTEM_INSTRUCTION}\n\nUser Question: ${message}` }
                            ]
                        }
                    ],
                }),
            }
        );

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
        res.json({ reply: text });
    } catch (error) {
        res.status(500).json({ error: "Failed to generate response", details: error.message });
    }
}
