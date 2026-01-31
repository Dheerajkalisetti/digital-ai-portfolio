# AIME: AI Multimedia Experience
### *The Next Generation of Interactive Personal Portfolios*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tech: Gemini 2.5 Flash](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-blueviolet)](https://deepmind.google/technologies/gemini/)
[![Framework: React/Vite](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)](https://vitejs.dev/)

AIME (AI Multimedia Experience) is an ultra-premium, full-stack application designed to showcase professional experiences through a "Digital Twin" persona. Leveraging the cutting-edge **Gemini 2.5 Flash Multimodal Live API**, AIME facilitates natural, low-latency voice and text conversations using a curated professional context (Resume).

---

## 💎 Design Philosophy: "Luxury Minimalist"
The user interface follows a "Glassmorphism" and "Neo-Minimalism" aesthetic, inspired by high-end engineering brands like Linear and Vercel.
- **Floating Island Input**: A sleek, persistent input field designed for focus.
- **Animated Mesh Gradients**: Liquid background states that react to application flow.
- **Typography-First**: Clean, high-contrast layouts using modern sans-serif fonts.

---

## 🛠 Tech Stack

### Core AI Engine
- **Google Generative AI SDK**: Utilizing `v1alpha` for the Multimodal Live API.
- **Gemini 2.5 Flash**: Hyper-fast, multimodal model for real-time speech-to-speech and text processing.
- **System Instruction Injection**: Dynamic context injection for professional persona adherence.

### Frontend (Client)
- **Framework**: React 18 with Vite for HMR (Hot Module Replacement).
- **Styling**: Tailwind CSS for atomic design and responsive layouts.
- **Animations**: Framer Motion for liquid transitions, staggered reveals, and modal dynamics.
- **Audio Processing**: 
  - **Web Audio API**: PCM/Int16 processing for raw audio streaming.
  - **Audio Worklets**: High-performance, low-latency audio capture on a separate thread.
- **Iconography**: Lucide React.

### Backend (Server)
- **Runtime**: Node.js & Express.
- **Authentication**: Token-based secure access for Google AI APIs.
- **API Architecture**: Hybrid approach using REST for chat and secure WebSockets (via SDK) for Live Voice.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- A Google Gemini API Key with access to the Multimodal Live features.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/aime.git
   cd aime
   ```

2. **Setup Server**
   ```bash
   cd server
   npm install
   ```
   Create a `.env` file in the `server` directory:
   ```env
   GOOGLE_API_KEY=your_gemini_api_key_here
   PORT=3000
   ```

3. **Setup Client**
   ```bash
   cd ../client
   npm install
   ```

### Running Locally

1. **Start the Backend**
   ```bash
   cd server
   npm start
   ```

2. **Start the Frontend**
   ```bash
   cd client
   npm run dev
   ```

3. Open `http://localhost:5173` (or the port specified by Vite) to interact with your AI twin.

---

## 📁 Project Structure

```bash
aime/
├── client/                 # React (Vite) Application
│   ├── src/
│   │   ├── components/     # UI Components (ChatInterface, AvatarCircle)
│   │   ├── index.css       # Global Styles & Custom Scrollbars
│   │   └── main.jsx        # Entry point
├── server/                 # Express Backend
│   ├── index.js            # API Routes, Token Generation, Context Management
│   └── resume.json         # The "Brain" - Professional data injected into the AI
└── README.md
```

---

## 🔒 Security & Performance
- **Client-Side Safety**: API Keys are never hardcoded. All communication is routed through a secure backend proxy or temporary session tokens.
- **Worklet Optimization**: Mic processing is handled in an AudioWorklet to prevent main-thread lag during 3D/Animation rendering.
- **Vercel Optimized**: Ready for zero-configuration deployment via `vercel.json`.

---

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
