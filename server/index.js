import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Load resume data
const resumeData = JSON.parse(readFileSync(path.join(__dirname, 'resume.json'), 'utf-8'));

// Initialize Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Prepare system instruction with resume context
const RESUME_CONTEXT = JSON.stringify(resumeData);
const SYSTEM_INSTRUCTION =
  `
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

// Endpoint to generate ephemeral token for Live API
app.get('/api/token', async (req, res) => {
  try {
    console.log("Generating token for Live API...");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing!");
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    }

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: expireTime,
        liveConnectConstraints: {
          model: 'gemini-2.5-flash-native-audio-preview-12-2025', // specific model name without prefix
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

    console.log("Token generated successfully:", token.name);
    res.json({
      token: token.name,
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      expiresAt: expireTime,
      systemInstruction: SYSTEM_INSTRUCTION // Send the prompt to the client
    });

  } catch (error) {
    console.error("Error generating token:", error);
    res.status(500).json({
      error: "Failed to generate token",
      details: error.message
    });
  }
});

// Text chat endpoint (fallback)
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${SYSTEM_INSTRUCTION}\n\nUser Question: ${message}` }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      return res.status(response.status).json({
        error: "Failed to generate response",
        details: data.error?.message || JSON.stringify(data)
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
    res.json({ reply: text });

  } catch (error) {
    console.error("Error generating response:", error);
    res.status(500).json({
      error: "Failed to generate response",
      details: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.send('AI Portfolio Backend is running!');
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    if (!GEMINI_API_KEY) {
      console.warn('⚠️  WARNING: GEMINI_API_KEY is not set!');
    }
  });
}

export default app;
