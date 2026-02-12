import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Activity, Loader2, Sparkles, ChevronRight, X } from 'lucide-react';
import { GoogleGenAI, Modality } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AvatarCircle from './AvatarCircle';
import ProfilePic from '../assets/kalisettidheeraj.jpeg';

// --- Utility for Tailwind classes ---
function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// --- Audio Worklet ---
const audioWorkletCode = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const float32Data = input[0];
      this.port.postMessage(float32Data);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

const BASE_PHRASES = [
    "I'm Dheeraj Kalisetti.",
    "I build full-stack applications.",
    "I work across frontend and backend systems.",
    "I design scalable, data-driven platforms.",
    "I turn complex problems into practical solutions.",
    "I work with cloud platforms like AWS, GCP, and Azure.",
    "I build secure and reliable systems.",
    "I enjoy working on big data and analytics platforms.",
    "I create no-code and data-focused products.",
    "I've worked on production-scale applications.",
    "I build APIs and system workflows.",
    "I focus on performance, scalability, and reliability.",
    "I work with modern JavaScript and Python stacks.",
    "I enjoy building products that people actually use.",
    "I've worked on distributed data systems.",
    "I combine engineering with problem-solving.",
    "I care about clean architecture and maintainable code.",
    "I've built applications used by real users.",
    "I enjoy learning and applying new technologies.",
    "I'm open to building impactful software."
];


const recommendations = [
    "What's your background?",
    "What kind of work do you do?",
    "Tell me about your professional experience",
    "What are you currently working on?",
    "What technologies do you use most?",
    "What does your tech stack look like?",
    "How do you usually build applications?",
    "What type of projects have you worked on?",
    "Can you walk me through your recent projects?",
    "What problems do you enjoy solving?",

    "What are your strongest technical skills?",
    "What areas do you specialize in?",
    "What kind of software do you build?",
    "Do you work more on backend or frontend?",
    "How much experience do you have with cloud platforms?",
    "What's your experience with big data technologies?",
    "How do you approach system design?",
    "What tools do you use in your daily work?",
    "What frameworks do you prefer?",
    "How do you ensure scalability and performance?",

    "Can you tell me about your role at Zinzu.io?",
    "What did you work on at Quotient Technologies?",
    "What impact did your work have in your previous roles?",
    "Have you worked on production-scale systems?",
    "What kind of challenges have you handled at work?",

    "Can you tell me about your personal projects?",
    "Which project are you most proud of?",
    "Have you worked on full-stack applications?",
    "Have you built any data-driven platforms?",
    "Have you worked with distributed systems?",

    "What's your educational background?",
    "What did you focus on during your degree?",
    "Do you have any certifications?",
    "How has your cybersecurity background helped you?",

    "Are you open to new opportunities?",
    "Are you open to relocation?",
    "What kind of roles are you interested in?",
    "What type of teams do you enjoy working with?",
    "What motivates you as an engineer?",
    "Where can I find your GitHub or LinkedIn?"
];

const FloatingRecommendation = ({ text, index }) => {
    // Generate unique random values for each instance
    const { angle, distMult, duration, delay, rotMult } = React.useMemo(() => ({
        angle: Math.random() * Math.PI * 2,
        distMult: 0.6 + Math.random() * 0.5, // 0.8x to 1.3x distance
        duration: 10 + Math.random() * 3, // 7s to 10s duration
        delay: Math.random() * 5, // 0s to 5s initial delay
        rotMult: Math.random() > 0.5 ? 1 : -1
    }), []);

    const radius = 220 + (index % 3) * 60;
    const x = Math.cos(angle) * radius * distMult;
    const y = Math.sin(angle) * radius * distMult;

    return (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <motion.div
                initial={{ opacity: 0, scale: 0.2, x: 0, y: 0 }}
                animate={{
                    opacity: [0, 0.7, 0.7, 0.4, 0],
                    scale: [0.5, 1.1, 1, 1.1, 1.2],
                    x: [0, x * 0.9, x],
                    y: [0, y * 0.9, y],
                    rotate: [0, (15 + Math.random() * 15) * rotMult]
                }}
                transition={{
                    duration: duration,
                    repeat: Infinity,
                    delay: delay,
                    ease: "easeOut",
                    times: [0, 0.1, 0.4, 0.8, 1]
                }}
            >
                <div className="px-5 py-2 rounded-full border border-emerald-400/20 bg-[#051412]/80 text-emerald-50/70 text-sm whitespace-nowrap shadow-lg ring-1 ring-white/5">
                    {text}
                </div>
            </motion.div>
        </div>
    );
};

const ChatInterface = () => {
    // --- State ---
    const [messages, setMessages] = useState([
        { role: 'ai', text: "Hi! I'm Dheeraj's AI. Ready to chat?" }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Voice State
    const [isInCall, setIsInCall] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [voiceState, setVoiceState] = useState('idle');
    const [isWinking, setIsWinking] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]);
    const [micLevel, setMicLevel] = useState(0);
    const [showChat, setShowChat] = useState(false); // Toggle for chat overlay

    // Recommendation Batch Logic
    const [shuffledRecs, setShuffledRecs] = useState([]);
    const [currentBatchStart, setCurrentBatchStart] = useState(0);
    const BATCH_SIZE = 5;

    // Shuffle only once on mount
    useEffect(() => {
        const shuffled = [...recommendations].sort(() => Math.random() - 0.5);
        setShuffledRecs(shuffled);
    }, []);

    // Rotate batch every 10 seconds
    useEffect(() => {
        if (!isInCall || voiceState !== 'listening') return;

        const interval = setInterval(() => {
            setCurrentBatchStart(prev => (prev + BATCH_SIZE) % shuffledRecs.length);
        }, 10000);

        return () => clearInterval(interval);
    }, [isInCall, voiceState, shuffledRecs.length]);

    const currentBatch = shuffledRecs.slice(currentBatchStart, currentBatchStart + BATCH_SIZE);
    // Handle wrap-around for the last batch if needed
    if (currentBatch.length < BATCH_SIZE && shuffledRecs.length > 0) {
        currentBatch.push(...shuffledRecs.slice(0, BATCH_SIZE - currentBatch.length));
    }

    // --- Refs ---
    const messagesEndRef = useRef(null);
    const sessionRef = useRef(null);
    const audioContextRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const workletNodeRef = useRef(null);
    const nextPlayTimeRef = useRef(0);
    const listeningTimeoutRef = useRef(null);

    // --- Effects ---
    useEffect(() => {
        if (showChat) scrollToBottom();
    }, [messages, debugLogs, showChat]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const addLog = (msg) => {
        setDebugLogs(prev => [...prev.slice(-2), msg]);
    };

    // --- Audio Helpers ---
    const float32ToBase64PCM = (float32Array) => {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const uint8Array = new Uint8Array(int16Array.buffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        return btoa(binary);
    };

    const playAudio = async (base64Audio) => {
        if (!audioContextRef.current) return;
        try {
            const audioContext = audioContextRef.current;
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const int16Array = new Int16Array(bytes.buffer);
            const float32Array = new Float32Array(int16Array.length);
            for (let i = 0; i < int16Array.length; i++) {
                float32Array[i] = int16Array[i] / 32768.0;
            }
            const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
            audioBuffer.getChannelData(0).set(float32Array);

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);

            const currentTime = audioContext.currentTime;
            const startTime = Math.max(currentTime, nextPlayTimeRef.current);
            source.start(startTime);
            nextPlayTimeRef.current = startTime + audioBuffer.duration;
        } catch (e) {
            console.error("Audio Playback Error", e);
        }
    };

    // --- Main Voice Logic ---
    const startCall = async () => {
        try {
            setIsInCall(true);
            setConnectionStatus('connecting');
            addLog('Initializing...');
            nextPlayTimeRef.current = 0;

            const tokenResponse = await fetch('/api/token');
            const tokenData = await tokenResponse.json();
            if (tokenData.error) throw new Error(tokenData.error);

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            mediaStreamRef.current = stream;

            const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = audioContext;

            const ai = new GoogleGenAI({ apiKey: tokenData.token, apiVersion: 'v1alpha' });

            // Connect first
            const session = await ai.live.connect({
                model: tokenData.model,
                config: { responseModalities: [Modality.AUDIO] },
                callbacks: {
                    onopen: async () => {
                        setConnectionStatus('connected');
                        setVoiceState('listening');
                        nextPlayTimeRef.current = audioContextRef.current?.currentTime || 0;
                        // Avoid using 'session' here to prevent race conditions
                    },
                    onmessage: async (message) => {
                        if (message.serverContent?.modelTurn?.parts) {
                            // Cancel any pending switch to listening state
                            if (listeningTimeoutRef.current) {
                                clearTimeout(listeningTimeoutRef.current);
                                listeningTimeoutRef.current = null;
                            }

                            setVoiceState('speaking');
                            for (const part of message.serverContent.modelTurn.parts) {
                                if (part.inlineData?.data) playAudio(part.inlineData.data);
                                if (part.text) addLog(`AI: ${part.text}`);
                            }
                        }
                        if (message.serverContent?.turnComplete) {
                            setIsWinking(false);
                            const audioContext = audioContextRef.current;
                            if (audioContext) {
                                // Calculate when the audio queue will finish
                                const delay = (nextPlayTimeRef.current - audioContext.currentTime) * 1000;
                                // Add a small buffer (50ms) to ensure smooth transition
                                const safeDelay = delay > 0 ? delay + 50 : 0;

                                if (safeDelay > 0) {
                                    if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
                                    listeningTimeoutRef.current = setTimeout(() => {
                                        setVoiceState('listening');
                                        listeningTimeoutRef.current = null;
                                    }, safeDelay);
                                } else {
                                    setVoiceState('listening');
                                }
                            } else {
                                setVoiceState('listening');
                            }
                        }
                    },
                    onerror: (e) => {
                        addLog(`Error: ${e.message}`);
                        setConnectionStatus('error');
                    },
                    onclose: (e) => endCall()
                }
            });

            // Set ref immediately
            sessionRef.current = session;

            // 1. Send Resume Context & Greeting (Combined for atomic processing)
            const prompt = tokenData.systemInstruction
                ? `${tokenData.systemInstruction}\n\nIMPORTANT: Start the conversation now by briefly introducing yourself.`
                : "Hello! Please briefly introduce yourself.";

            addLog('Sending Combined Context & Greeting...');
            await session.sendRealtimeInput([{ text: prompt }]);

            // 2. Start Audio Streaming (Only AFTER text is sent)
            // This prevents the "Silence Race Condition" where background noise stops the AI from speaking.
            await startAudioWorklet(audioContext, stream, session);

        } catch (error) {
            addLog(`Failed: ${error.message}`);
            setConnectionStatus('error');
            setTimeout(endCall, 3000);
        }
    };

    const startAudioWorklet = async (audioContext, stream, session) => {
        try {
            const blob = new Blob([audioWorkletCode], { type: "application/javascript" });
            const workletUrl = URL.createObjectURL(blob);
            await audioContext.audioWorklet.addModule(workletUrl);
            const source = audioContext.createMediaStreamSource(stream);
            const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');

            workletNode.port.onmessage = (event) => {
                const float32Data = event.data;
                let sum = 0;
                for (let i = 0; i < float32Data.length; i++) sum += float32Data[i] ** 2;
                const rms = Math.sqrt(sum / float32Data.length);
                setMicLevel(Math.min(1, rms * 8));

                if (session) {
                    const base64Audio = float32ToBase64PCM(float32Data);
                    try {
                        session.sendRealtimeInput({
                            media: { mimeType: "audio/pcm;rate=16000", data: base64Audio }
                        });
                    } catch (e) { }
                }
            };
            source.connect(workletNode);
            workletNode.connect(audioContext.destination);
            workletNodeRef.current = workletNode;
        } catch (e) {
            addLog(`Worklet Error: ${e.message}`);
        }
    };

    const endCall = () => {
        if (listeningTimeoutRef.current) {
            clearTimeout(listeningTimeoutRef.current);
            listeningTimeoutRef.current = null;
        }
        sessionRef.current?.close();
        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(console.error);
        }
        setIsInCall(false);
        setConnectionStatus('disconnected');
        setVoiceState('idle');
        setMicLevel(0);
    };

    const handleSendMessage = async (text) => {
        if (!text.trim()) return;
        const userMessage = { role: 'user', text };
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text }),
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'ai', text: "Error connecting to standard chat." }]);
        } finally {
            setIsLoading(false);
        }
    };
    // Typewriter Hook
    const useTypewriter = (phrases, typeSpeed = 100, deleteSpeed = 50, pauseTime = 2000) => {
        const [text, setText] = useState('');
        const [isDeleting, setIsDeleting] = useState(false);
        const [loopNum, setLoopNum] = useState(0);
        const [typingSpeed, setTypingSpeed] = useState(typeSpeed);

        useEffect(() => {
            const handleType = () => {
                const i = loopNum % phrases.length;
                const fullText = phrases[i];

                setText(current => {
                    if (isDeleting) {
                        return fullText.substring(0, current.length - 1);
                    } else {
                        return fullText.substring(0, current.length + 1);
                    }
                });

                setTypingSpeed(isDeleting ? deleteSpeed : typeSpeed);

                if (!isDeleting && text === fullText) {
                    setTimeout(() => setIsDeleting(true), pauseTime);
                } else if (isDeleting && text === '') {
                    setIsDeleting(false);
                    setLoopNum(prev => prev + 1);
                }
            };

            const timer = setTimeout(handleType, typingSpeed);
            return () => clearTimeout(timer);
        }, [text, isDeleting, loopNum, phrases, typeSpeed, deleteSpeed, pauseTime]);

        return { text, loopNum };
    };

    // Manage Typewriter Phrases as a shuffled pool
    const [typewriterPhrases, setTypewriterPhrases] = useState([]);

    useEffect(() => {
        const [first, ...rest] = BASE_PHRASES;
        const shuffled = [first, ...rest.sort(() => Math.random() - 0.5)];
        setTypewriterPhrases(shuffled);
    }, []);

    const { text: typewriterText, loopNum } = useTypewriter(typewriterPhrases);

    // Reshuffle when we've seen all phrases in the current batch
    useEffect(() => {
        if (typewriterPhrases.length > 0 && loopNum > 0 && loopNum % typewriterPhrases.length === 0) {
            const [first, ...rest] = BASE_PHRASES;
            const shuffled = [first, ...rest.sort(() => Math.random() - 0.5)];
            setTypewriterPhrases(shuffled);
        }
    }, [loopNum, typewriterPhrases.length]);

    // --- Render ---
    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#0A1F1C] selection:bg-emerald-200 selection:text-emerald-900 font-sans">

            {/* 1. Static Elegant Background --- */}
            <div className="absolute inset-0 z-0">
                {/* Deep British Green Base */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0D2E26] via-[#051412] to-[#020A09]" />

                {/* Subtle Grain/Noise Texture for Premium feel */}
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ filter: 'contrast(120%) brightness(100%)', backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />

                {/* Ambient Glows */}
                <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[80%] h-[60%] bg-emerald-900/20 rounded-full blur-[150px]" />

                {/* Immersive Listening Waves (Full Screen Echo) */}
                <AnimatePresence>
                    {isInCall && voiceState === 'listening' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none"
                        >
                            {[...Array(3)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-[150vmax] h-[150vmax] border border-emerald-500/10 rounded-full"
                                    initial={{ scale: 0.2, opacity: 0 }}
                                    animate={{
                                        scale: [0.2, 1],
                                        opacity: [0, 0.15, 0],
                                    }}
                                    transition={{
                                        duration: 8,
                                        repeat: Infinity,
                                        delay: i * 2.6,
                                        ease: "circOut"
                                    }}
                                />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 2. Top Bar --- */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-0 left-0 right-0 z-20 px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 flex justify-between items-center"
            >
                <div className="flex items-center gap-4">
                    {/* Logo / Icon Container - Chrome/Silver finish */}
                    <div className="bg-gradient-to-br from-gray-100 to-gray-300 p-[1px] rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                        <img
                            src={ProfilePic}
                            alt="Dheeraj Kalisetti"
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover ring-2 ring-emerald-900/20"
                        />
                    </div>

                    <div>
                        <h1 className="text-lg sm:text-xl md:text-2xl font-serif font-medium tracking-tight text-white drop-shadow-md">
                            Dheeraj Kalisetti
                        </h1>
                        <p className="text-xs text-emerald-100/60 font-medium tracking-widest uppercase">Software Engineer</p>
                    </div>
                </div>

                {/* Connection Status - "Jewel" style */}
                <div className={cn(
                    "px-3 py-1 rounded-full border backdrop-blur-md text-[10px] font-bold tracking-widest uppercase transition-all duration-500 flex items-center gap-2 sm:gap-2.5 shadow-lg",
                    connectionStatus === 'connected'
                        ? "bg-[#051412]/60 border-emerald-500/30 text-emerald-400 shadow-emerald-900/20"
                        : connectionStatus === 'connecting'
                            ? "bg-[#051412]/60 border-amber-500/30 text-amber-400"
                            : "bg-[#051412]/60 border-white/10 text-gray-400"
                )}>
                    <div className={cn(
                        "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]",
                        connectionStatus === 'connected' ? "bg-emerald-400 animate-pulse" :
                            connectionStatus === 'connecting' ? "bg-amber-400 animate-bounce" :
                                "bg-gray-500"
                    )} />
                    {connectionStatus === 'connected' ? "Live" : connectionStatus === 'connecting' ? "Starting..." : "Ready"}
                </div>
            </motion.div>

            {/* 3. Hero / Avatar --- */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-[60vh] md:h-full pt-24 sm:pt-28 md:pt-32 lg:pt-36 pb-20 md:pb-24 px-4 sm:px-6">
                <AnimatePresence mode="wait">
                    {!isInCall ? (
                        <motion.div
                            key="intro"
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: -10 }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            className="text-center max-w-4xl px-6"
                        >
                            {/* Dynamic Typewriter Headline */}
                            <div className="h-28 md:h-40 flex items-center justify-center mb-6 sm:mb-8">
                                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-100 to-gray-400 tracking-tight drop-shadow-sm leading-[1.1]">
                                    {typewriterText}
                                    <span className="w-1 h-12 md:h-16 inline-block bg-emerald-400 ml-2 animate-pulse align-middle" />
                                </h2>
                            </div>

                            <p className="text-base sm:text-lg text-emerald-100/70 mb-10 sm:mb-12 font-light max-w-xl mx-auto leading-relaxed">
                                Curious about my work? You can chat with my AI assistant to learn about my experience, projects, and how I approach building software.
                            </p>

                            <div className="flex flex-col gap-4 justify-center items-center w-full max-w-md mx-auto">
                                {/* Primary Voice Action */}
                                <button
                                    onClick={startCall}
                                    className="group relative w-full flex items-center justify-center gap-3 px-6 py-4 sm:px-8 sm:py-5 rounded-full font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-emerald-900/20"
                                >
                                    {/* Chrome/Green Button Background */}
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white via-gray-100 to-gray-400 border border-white/60" />
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                    <span className="relative z-10 flex items-center gap-3 text-[#051412] text-lg tracking-wide">
                                        <div className="p-1.5 bg-[#051412]/10 rounded-full">
                                            <Phone className="w-5 h-5 text-[#051412]" />
                                        </div>
                                        Start Voice Session
                                    </span>
                                </button>

                                {/* Secondary Chat Input-Style Button */}
                                <button
                                    onClick={() => setShowChat(true)}
                                    className="group relative w-full flex items-center justify-between px-5 py-3 sm:px-6 sm:py-4 rounded-full transition-all duration-300 bg-[#0A1F1C] border border-white/10 hover:border-emerald-500/30 hover:bg-[#0D2E26] shadow-inner text-left"
                                >
                                    <span className="text-emerald-500/40 text-lg font-light tracking-wide group-hover:text-emerald-400/60 transition-colors">
                                        Ask anything about Dheeraj...
                                    </span>
                                    <div className="p-2 bg-white/5 rounded-full group-hover:bg-emerald-500/20 transition-colors">
                                        <Send className="w-4 h-4 text-emerald-400 opacity-60 group-hover:opacity-100" />
                                    </div>
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="avatar"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.8, ease: "circOut" }}
                            className="relative"
                        >
                            {/* Floating Recommendations (Echo Effect) */}
                            {voiceState === 'listening' && currentBatch.map((rec, i) => (
                                <FloatingRecommendation
                                    key={`${rec}-${currentBatchStart}-${i}`}
                                    text={rec}
                                    index={i}
                                />
                            ))}

                            {/* Ambient Glow behind Avatar */}
                            <div className={cn(
                                "absolute inset-0 bg-emerald-500/10 rounded-full blur-[80px] transition-opacity duration-1000",
                                voiceState === 'speaking' ? "opacity-30 scale-125" : "opacity-10 scale-100"
                            )} />

                            <AvatarCircle
                                isTalking={voiceState === 'speaking'}
                                isListening={voiceState === 'listening'}
                                isWinking={isWinking}
                                size="lg"
                            />

                            {/* Elegant Status Text */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="absolute -bottom-20 md:-bottom-24 left-0 right-0 text-center"
                            >
                                <span className={cn(
                                    "text-sm font-light tracking-[0.2em] uppercase transition-colors duration-500",
                                    voiceState === 'speaking' ? "text-emerald-200 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" :
                                        voiceState === 'listening' ? "text-white/90 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" :
                                            "text-gray-500"
                                )}>
                                    {voiceState === 'speaking' ? "Speaking" : voiceState === 'listening' ? "Listening" : "Connecting"}
                                </span>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 4. Floating Dock (Bottom) - Chrome Control Panel --- */}
            <AnimatePresence>
                {isInCall && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="absolute bottom-6 sm:bottom-8 md:bottom-12 inset-x-0 z-30 px-4 flex justify-center"
                    >
                        {/* Metallic Container */}
                        <div className="relative p-[1px] rounded-full bg-gradient-to-b from-white/20 to-black/40 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl mx-auto max-w-3xl">
                            <div className="flex items-center gap-4 px-4 sm:px-6 py-2 sm:py-3 bg-[#0A1F1C]/80 rounded-full border border-white/5 relative overflow-hidden">

                                {/* Metallic Sheen Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none rounded-full" />

                                {/* Mic Visualizer - Specialized Green */}
                                <div className="flex items-end gap-1 h-6 w-20 mr-2">
                                    {[...Array(5)].map((_, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "w-1 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(52,211,153,0.2)]",
                                                voiceState === 'listening' ? "bg-emerald-400" : "bg-emerald-900/40"
                                            )}
                                            style={{
                                                height: `${Math.max(20, Math.min(100, micLevel * 100 * (Math.random() + 0.5)))}%`,
                                                opacity: voiceState === 'listening' ? 1 : 0.4
                                            }}
                                        />
                                    ))}
                                </div>

                                <div className="h-8 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

                                <div className="flex items-center gap-2 sm:gap-3">
                                    <button
                                        onClick={endCall}
                                        className="group p-3 rounded-full hover:bg-rose-950/30 transition-all duration-200 active:scale-95 border border-transparent hover:border-rose-500/30"
                                        title="End Session"
                                    >
                                        <PhoneOff className="w-5 h-5 text-gray-400 group-hover:text-rose-400 transition-colors" />
                                    </button>

                                    <button
                                        onClick={() => setShowChat(!showChat)}
                                        className={cn(
                                            "p-3 rounded-full transition-all duration-200 active:scale-95 border",
                                            showChat
                                                ? "bg-white/10 border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                                : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/10 text-gray-400 hover:text-white"
                                        )}
                                    >
                                        <ChevronRight className={cn("w-5 h-5 transition-transform duration-300", showChat ? "rotate-90" : "rotate-0")} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 5. Full-Screen "Executive" Chat Overlay --- */}
            <AnimatePresence>
                {showChat && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        transition={{ duration: 0.4 }}
                        className="fixed inset-0 z-50 bg-[#051412]/90 flex flex-col font-sans"
                    >
                        {/* Header (Executive) */}
                        <div className="flex-none h-20 sm:h-24 flex items-center justify-between px-4 sm:px-8 md:px-16 border-b border-white/5">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-black shadow-lg border border-white/10 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="font-serif text-2xl text-white tracking-wide">Dheeraj Kalisetti</h2>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_currentColor]" />
                                        <span className="text-xs text-emerald-100/40 font-medium tracking-widest uppercase">Available</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowChat(false)}
                                className="w-12 h-12 rounded-full border border-white/5 hover:bg-white/5 flex items-center justify-center transition-all text-gray-400 hover:text-white group"
                            >
                                <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>

                        {/* Messages Container */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            <div className="max-w-3xl sm:max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10 sm:space-y-12">
                                {/* Intro Message if empty */}
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-64 text-center opacity-30 mt-20">
                                        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-center mb-8">
                                            <Sparkles className="w-8 h-8 text-white" />
                                        </div>
                                        <p className="text-3xl font-serif text-white mb-3">Hello.</p>
                                        <p className="text-gray-400 font-light text-lg">I'm ready to discuss my professional background.</p>
                                    </div>
                                )}

                                {messages.map((msg, index) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: index * 0.05, ease: "easeOut" }}
                                        key={index}
                                        className={cn(
                                            "flex gap-4 w-full",
                                            msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                                        )}
                                    >
                                        {/* Avatar */}
                                        <div className={cn(
                                            "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 border shadow-2xl",
                                            msg.role === 'user'
                                                ? "bg-[#1A2E29] border-white/10 text-emerald-100" // User Avatar
                                                : "bg-gradient-to-br from-gray-100 to-gray-400 border-white/20 text-black" // AI Avatar (Chrome)
                                        )}>
                                            {msg.role === 'user' ? (
                                                <div className="text-xs font-bold tracking-widest">YOU</div>
                                            ) : (
                                                <Sparkles className="w-5 h-5" />
                                            )}
                                        </div>

                                        {/* Content Bubble */}
                                        <div className={cn(
                                            "max-w-[80%] sm:max-w-[75%] md:max-w-[60%] text-base sm:text-lg leading-relaxed font-light",
                                            msg.role === 'user' ? "text-right" : "text-left"
                                        )}>
                                            {msg.role === 'user' ? (
                                                <div className="bg-white/10 backdrop-blur-md text-white px-4 py-3 sm:px-6 sm:py-4 rounded-2xl rounded-tr-sm border border-white/5 shadow-lg inline-block">
                                                    {msg.text}
                                                </div>
                                            ) : (
                                                <div className="text-emerald-50/90 markdown-body">
                                                    {msg.text}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}

                                {isLoading && (
                                    <div className="flex gap-6">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-400 flex items-center justify-center shrink-0 shadow-lg">
                                            <Sparkles className="w-5 h-5 text-black" />
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-4">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Input Area (Executive Desk) */}
                        <div className="flex-none p-8 pb-10 bg-gradient-to-t from-[#020A09] to-transparent z-20">
                            <div className="max-w-4xl mx-auto relative group">
                                <div className="absolute -inset-[1px] bg-gradient-to-r from-emerald-500/20 via-white/10 to-emerald-500/20 rounded-[32px] opacity-20 blur-sm transition duration-500 group-focus-within:opacity-100 group-focus-within:blur-md"></div>

                                <div className="relative flex items-end p-2 pl-8 bg-[#0D2622] rounded-[30px] border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] transition-colors group-focus-within:bg-[#112e29] group-focus-within:border-emerald-500/30">
                                    <textarea
                                        className="w-full max-h-40 min-h-[64px] py-5 bg-transparent border-none focus:ring-0 focus:outline-none outline-none resize-none text-emerald-50 placeholder:text-emerald-500/30 text-lg leading-relaxed scrollbar-hide font-light"
                                        placeholder="Ask me anything..."
                                        rows={1}
                                        value={inputText}
                                        onChange={(e) => {
                                            setInputText(e.target.value);
                                            e.target.style.height = 'auto'; // Reset height
                                            e.target.style.height = e.target.scrollHeight + 'px'; // Set new height
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage(inputText);
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <div className="p-2.5">
                                        <button
                                            onClick={() => handleSendMessage(inputText)}
                                            disabled={isLoading || !inputText.trim()}
                                            className={cn(
                                                "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 relative overflow-hidden",
                                                !inputText.trim()
                                                    ? "bg-white/5 text-white/10 cursor-not-allowed"
                                                    : "bg-white text-black hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                                            )}
                                        >
                                            <Send className="w-5 h-5 ml-0.5 relative z-10" />
                                            {/* Chrome shine effect */}
                                            {inputText.trim() && (
                                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/50 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="text-center mt-5">
                                    <span className="text-[10px] text-emerald-500/40 font-bold tracking-[0.2em] uppercase">
                                        Secure Context Active
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ChatInterface;
