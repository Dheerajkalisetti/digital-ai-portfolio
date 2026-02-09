import React from 'react';
import { motion } from 'framer-motion';

const AvatarCircle = ({ isTalking, isListening, isWinking, size = "md" }) => {
    // Determine the current state for styling
    const getStateStyles = () => {
        if (isListening) {
            return 'shadow-emerald-500/50 from-emerald-400 to-emerald-600';
        }
        if (isTalking) {
            return 'animate-talk shadow-white/20 from-gray-100 to-gray-400 text-black';
        }
        if (isWinking) {
            return 'from-amber-300 to-yellow-500';
        }
        return 'shadow-emerald-900/20 from-[#0D2E26] to-black border border-white/10';
    };

    const sizeClasses = {
        sm: 'w-16 h-16',
        md: 'w-32 h-32',
        lg: 'w-48 h-48'
    };

    const innerSizeClasses = {
        sm: 'w-12 h-12',
        md: 'w-24 h-24',
        lg: 'w-36 h-36'
    };

    return (
        <div className={`relative flex items-center justify-center ${sizeClasses[size] || sizeClasses.md} mx-auto mb-4`}>
            {/* 1. ECHOS / RIPPLES (Only when Listening) */}
            {isListening && (
                <>
                    {[...Array(3)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute inset-0 rounded-full border border-emerald-500/30"
                            initial={{ opacity: 0, scale: 1 }}
                            animate={{
                                opacity: [0, 0.5, 0],
                                scale: [1, 2],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                delay: i * 0.6,
                                ease: "easeOut"
                            }}
                        />
                    ))}
                    {/* Rotating Ring */}
                    <motion.div
                        className="absolute -inset-4 rounded-full border border-emerald-500/20 border-t-emerald-500/60"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div
                        className="absolute -inset-2 rounded-full border border-emerald-500/10 border-b-emerald-500/40"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    />
                </>
            )}

            {/* Main Floating Container */}
            <motion.div
                animate={isListening ? {
                    y: [0, -10, 0],
                } : { y: 0 }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="relative z-10"
            >
                {/* Outer glow/particles effect */}
                <div
                    className={`
              absolute inset-0 rounded-full opacity-20 blur-xl transition-all duration-300
              ${isListening ? 'bg-emerald-500 scale-110' : ''}
              ${isTalking ? 'bg-white scale-125 animate-pulse-slow' : ''}
              ${!isListening && !isTalking ? 'bg-emerald-900' : ''}
            `}
                />

                {/* Main Circle */}
                <div
                    className={`
              relative z-10 ${innerSizeClasses[size] || innerSizeClasses.md} rounded-full 
              bg-gradient-to-br shadow-lg
              flex items-center justify-center
              transition-all duration-300
              ${getStateStyles()}
            `}
                >
                    {/* Inner detail */}
                    <div className={`w-[85%] h-[85%] rounded-full flex items-center justify-center border transition-colors duration-300 ${isTalking ? 'bg-gray-200 border-white/50' : 'bg-[#020A09] border-white/10'}`}>
                        {isListening ? (
                            // Microphone waves when listening
                            <div className="flex items-center gap-1">
                                <div className="w-1 h-3 bg-emerald-400 rounded animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1 h-5 bg-emerald-400 rounded animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1 h-4 bg-emerald-400 rounded animate-bounce" style={{ animationDelay: '300ms' }} />
                                <div className="w-1 h-6 bg-emerald-400 rounded animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1 h-3 bg-emerald-400 rounded animate-bounce" style={{ animationDelay: '0ms' }} />
                            </div>
                        ) : isTalking ? (
                            // Sound waves when talking - Dark Gray for contrast on Silver
                            <div className="flex items-center gap-1">
                                <div className="w-1 h-2 bg-gray-600 rounded animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1 h-4 bg-gray-600 rounded animate-bounce" style={{ animationDelay: '100ms' }} />
                                <div className="w-1 h-6 bg-gray-600 rounded animate-bounce" style={{ animationDelay: '200ms' }} />
                                <div className="w-1 h-4 bg-gray-600 rounded animate-bounce" style={{ animationDelay: '100ms' }} />
                                <div className="w-1 h-2 bg-gray-600 rounded animate-bounce" style={{ animationDelay: '0ms' }} />
                            </div>
                        ) : (
                            // Idle state - simple dot
                            <div className="w-2 h-2 rounded-full bg-emerald-800/50" />
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AvatarCircle;
