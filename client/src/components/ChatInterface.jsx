import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Activity, Loader2, Sparkles, ChevronRight, X } from 'lucide-react';
import { GoogleGenAI, Modality } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AvatarCircle from './AvatarCircle';

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

    // --- Refs ---
    const messagesEndRef = useRef(null);
    const sessionRef = useRef(null);
    const audioContextRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const workletNodeRef = useRef(null);
    const nextPlayTimeRef = useRef(0);

    // --- Effects ---
    useEffect(() => {
        if (showChat) scrollToBottom();
    }, [messages, debugLogs, showChat]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const addLog = (msg) => {
        console.log(`[App] ${msg}`);
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
                            setVoiceState('speaking');
                            for (const part of message.serverContent.modelTurn.parts) {
                                if (part.inlineData?.data) playAudio(part.inlineData.data);
                                if (part.text) addLog(`AI: ${part.text}`);
                            }
                        }
                        if (message.serverContent?.turnComplete) {
                            setVoiceState('listening');
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

    // --- Render ---
    return (
        <div className="relative h-screen w-full overflow-hidden bg-white selection:bg-indigo-100 selection:text-indigo-900 font-sans">

            {/* 1. Animated Mesh Gradient Background --- */}
            <div className="absolute inset-0 z-0 opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-300 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-300 rounded-full blur-[120px] animate-pulse delay-1000" />
                <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-teal-200 rounded-full blur-[100px] animate-pulse delay-2000" />
            </div>

            {/* 2. Top Bar --- */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-start"
            >
                <div className="flex items-center gap-2">
                    <div className="bg-white/80 backdrop-blur-md p-2 rounded-xl border border-white/50 shadow-sm">
                        <Sparkles className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                            Gemini Live
                        </h1>
                        <p className="text-xs text-gray-500 font-medium">Interactive AI Experience</p>
                    </div>
                </div>

                <div className={cn(
                    "px-4 py-2 rounded-full border backdrop-blur-md text-xs font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-2",
                    connectionStatus === 'connected' ? "bg-emerald-50/80 border-emerald-200 text-emerald-700 shadow-emerald-100" :
                        connectionStatus === 'connecting' ? "bg-amber-50/80 border-amber-200 text-amber-700" :
                            "bg-white/60 border-gray-200 text-gray-500"
                )}>
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        connectionStatus === 'connected' ? "bg-emerald-500 animate-pulse" :
                            connectionStatus === 'connecting' ? "bg-amber-500 animate-bounce" :
                                "bg-gray-400"
                    )} />
                    {connectionStatus}
                </div>
            </motion.div>

            {/* 3. Hero / Avatar --- */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full pb-20">
                <AnimatePresence mode="wait">
                    {!isInCall ? (
                        <motion.div
                            key="intro"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="text-center max-w-md px-6"
                        >
                            <h2 className="text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
                                Talk to Dheeraj's<br />
                                <span className="text-indigo-600">Digital Twin.</span>
                            </h2>
                            <p className="text-lg text-gray-600 mb-8">
                                Ask about his experience, projects, or technical skills in a natural voice conversation.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                                <button
                                    onClick={startCall}
                                    className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-full font-semibold shadow-2xl hover:bg-gray-800 hover:scale-105 active:scale-95 transition-all duration-300"
                                >
                                    <Phone className="w-5 h-5 group-hover:animate-shake" />
                                    Start Conversation
                                    <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-4 transition-all" />
                                </button>

                                <button
                                    onClick={() => setShowChat(true)}
                                    className="flex items-center gap-2 px-6 py-4 bg-white/70 text-gray-700 border border-gray-200 rounded-full font-semibold hover:bg-white hover:text-indigo-600 hover:border-indigo-200 transition-all duration-300"
                                >
                                    <Send className="w-4 h-4" />
                                    Text Chat
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="avatar"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className="relative"
                        >
                            <div className={cn(
                                "absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full blur-[60px] opacity-20 transition-all duration-500",
                                voiceState === 'speaking' ? "scale-150 opacity-40" : "scale-100"
                            )} />

                            <AvatarCircle
                                isTalking={voiceState === 'speaking'}
                                isListening={voiceState === 'listening'}
                                isWinking={isWinking}
                                size="lg"
                            />

                            {/* <div className="absolute -bottom-16 left-0 right-0 text-center">
                                <span className={cn(
                                    "px-4 py-1 rounded-full text-sm font-medium backdrop-blur-md border transition-colors duration-300",
                                    voiceState === 'speaking' ? "bg-indigo-100/50 border-indigo-200 text-indigo-700" :
                                        voiceState === 'listening' ? "bg-emerald-100/50 border-emerald-200 text-emerald-700" :
                                            "bg-white/50 border-gray-200 text-gray-500"
                                )}>
                                    {voiceState === 'speaking' ? "Speaking..." : voiceState === 'listening' ? "Listening..." : "Thinking..."}
                                </span>
                            </div> */}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 4. Floating Dock (Bottom) --- */}
            <AnimatePresence>
                {isInCall && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30"
                    >
                        <div className="flex items-center gap-4 px-6 py-3 bg-white/70 backdrop-blur-xl border border-white/50 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">

                            {/* Mic Visualizer */}
                            <div className="flex items-end gap-1 h-8 w-24 mr-4 bg-gray-100/50 rounded-lg px-2 py-1 overflow-hidden">
                                {[...Array(5)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-1.5 bg-gray-400 rounded-full transition-all duration-75"
                                        style={{
                                            height: `${Math.max(20, Math.min(100, micLevel * 100 * (Math.random() + 0.5)))}%`,
                                            opacity: voiceState === 'listening' ? 1 : 0.3
                                        }}
                                    />
                                ))}
                            </div>

                            <div className="h-8 w-px bg-gray-200" />

                            <button
                                onClick={endCall}
                                className="p-3 bg-rose-50 text-rose-500 rounded-full hover:bg-rose-500 hover:text-white transition-all duration-200 active:scale-95"
                            >
                                <PhoneOff className="w-5 h-5" />
                            </button>

                            <button
                                onClick={() => setShowChat(!showChat)}
                                className={cn(
                                    "p-3 rounded-full transition-all duration-200 active:scale-95",
                                    showChat ? "bg-indigo-100 text-indigo-600" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                                )}
                            >
                                <ChevronRight className={cn("w-5 h-5 transition-transform", showChat ? "rotate-90" : "rotate-0")} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 5. Full-Screen "Ultra-Minimalist" Chat Overlay --- */}
            <AnimatePresence>
                {showChat && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }} // smooth cubic bezier
                        className="fixed inset-0 z-50 bg-white/90 backdrop-blur-[40px] flex flex-col font-sans"
                    >
                        {/* Header (Minimalist) */}
                        <div className="flex-none h-20 flex items-center justify-between px-6 sm:px-12 bg-transparent z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] flex items-center justify-center border border-gray-100">
                                    <Sparkles className="w-5 h-5 text-zinc-800" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-zinc-900 text-lg tracking-tight">Dheeraj AI</h2>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-xs text-zinc-500 font-medium">Ready to help</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowChat(false)}
                                className="w-10 h-10 rounded-full bg-transparent hover:bg-zinc-100 flex items-center justify-center transition-colors text-zinc-400 hover:text-zinc-900"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Messages Container */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200">
                            <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
                                {/* Intro Message if empty */}
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-64 text-center opacity-40">
                                        <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mb-6">
                                            <Sparkles className="w-8 h-8 text-zinc-400" />
                                        </div>
                                        <p className="text-2xl font-semibold text-zinc-900 mb-2">How can I help you?</p>
                                        <p className="text-zinc-500">Ask about Dheeraj's experience, projects, or resume.</p>
                                    </div>
                                )}

                                {messages.map((msg, index) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4, delay: index * 0.1 }}
                                        key={index}
                                        className={cn(
                                            "flex gap-5 w-full",
                                            msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                                        )}
                                    >
                                        {/* Avatar */}
                                        <div className={cn(
                                            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm",
                                            msg.role === 'user'
                                                ? "bg-zinc-100 text-zinc-500"
                                                : "bg-gradient-to-tr from-zinc-800 to-black text-white"
                                        )}>
                                            {msg.role === 'user' ? (
                                                <div className="w-full h-full rounded-full bg-zinc-200" />
                                            ) : (
                                                <Sparkles className="w-4 h-4" />
                                            )}
                                        </div>

                                        {/* Content Bubble */}
                                        <div className={cn(
                                            "max-w-[80%] text-[15.5px] leading-7 tracking-[0.01em]",
                                            msg.role === 'user' ? "text-right" : "text-left"
                                        )}>
                                            {msg.role === 'user' ? (
                                                <div className="bg-zinc-800 text-white px-6 py-4 rounded-[24px] rounded-tr-md shadow-lg shadow-zinc-500/10 inline-block font-medium">
                                                    {msg.text}
                                                </div>
                                            ) : (
                                                <div className="text-zinc-800 markdown-body">
                                                    {msg.text}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}

                                {isLoading && (
                                    <div className="flex gap-5">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-zinc-800 to-black flex items-center justify-center shrink-0 shadow-sm">
                                            <Sparkles className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="flex items-center gap-2 text-zinc-400 mt-2">
                                            <div className="flex gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Input Area (Floating Island) */}
                        <div className="flex-none p-6 pb-8 bg-gradient-to-t from-white via-white/90 to-transparent z-20">
                            <div className="max-w-3xl mx-auto relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-zinc-200 via-gray-200 to-zinc-200 rounded-[32px] opacity-40 blur-lg transition duration-500 group-focus-within:opacity-80 group-focus-within:bg-zinc-300"></div>
                                <div className="relative flex items-end p-2 pl-6 bg-white rounded-[28px] shadow-[0_8px_40px_-10px_rgba(0,0,0,0.1)] border border-white/50">
                                    <textarea
                                        className="w-full max-h-40 min-h-[56px] py-4 bg-transparent border-none focus:ring-0 focus:outline-none outline-none resize-none text-zinc-900 placeholder:text-zinc-400 text-lg leading-relaxed scrollbar-hide font-medium"
                                        placeholder="Message Dheeraj AI..."
                                        rows={1}
                                        value={inputText}
                                        onChange={(e) => {
                                            setInputText(e.target.value);
                                            e.target.style.height = 'auto'; // Reset height to recalculate
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
                                    <div className="p-2">
                                        <button
                                            onClick={() => handleSendMessage(inputText)}
                                            disabled={isLoading || !inputText.trim()}
                                            className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                                                !inputText.trim()
                                                    ? "bg-zinc-100 text-zinc-300"
                                                    : "bg-black text-white hover:scale-105 active:scale-95 shadow-md"
                                            )}
                                        >
                                            <Send className="w-5 h-5 ml-0.5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-center mt-4">
                                    <span className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase">
                                        Gemini 2.5 Flash • Resume Context Active
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
