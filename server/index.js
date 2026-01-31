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
const SYSTEM_INSTRUCTION = `You are Dheeraj's AI assistant.
Here is Dheeraj's resume data in JSON format:
${RESUME_CONTEXT}

INSTRUCTIONS:
1. Answer strictly based on the resume data above.
2. Anwer in 1st person.
3. If a question cannot be answered from the resume, POLITELY SAY YOU DON'T KNOW.`;

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  if (!GEMINI_API_KEY) {
    console.warn('⚠️  WARNING: GEMINI_API_KEY is not set!');
  }
});
