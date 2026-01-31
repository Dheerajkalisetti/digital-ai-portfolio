import React from 'react';

const AvatarCircle = ({ isTalking, isListening, isWinking }) => {
    // Determine the current state for styling
    const getStateStyles = () => {
        if (isListening) {
            return 'animate-pulse shadow-green-500/50 from-green-400 to-emerald-600';
        }
        if (isTalking) {
            return 'animate-talk shadow-blue-500/50 from-blue-400 to-indigo-600';
        }
        if (isWinking) {
            return 'from-yellow-400 to-orange-500';
        }
        return 'shadow-blue-500/20 from-blue-400 to-indigo-600';
    };

    return (
        <div className="relative flex items-center justify-center w-32 h-32 mx-auto mb-4 transition-all duration-300">
            {/* Outer glow/particles effect */}
            <div
                className={`
          absolute inset-0 rounded-full opacity-20 blur-xl transition-all duration-300
          ${isListening ? 'bg-green-500 scale-150 animate-ping' : ''}
          ${isTalking ? 'bg-blue-500 scale-125 animate-pulse-slow' : ''}
          ${!isListening && !isTalking ? 'bg-blue-500' : ''}
        `}
            />

            {/* Main Circle */}
            <div
                className={`
          relative z-10 w-24 h-24 rounded-full 
          bg-gradient-to-br shadow-lg
          flex items-center justify-center
          transition-all duration-300
          ${getStateStyles()}
        `}
            >
                {/* Inner detail */}
                <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center border border-blue-500/30">
                    {isListening ? (
                        // Microphone waves when listening
                        <div className="flex items-center gap-1">
                            <div className="w-1 h-3 bg-green-400 rounded animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1 h-5 bg-green-400 rounded animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1 h-4 bg-green-400 rounded animate-bounce" style={{ animationDelay: '300ms' }} />
                            <div className="w-1 h-6 bg-green-400 rounded animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1 h-3 bg-green-400 rounded animate-bounce" style={{ animationDelay: '0ms' }} />
                        </div>
                    ) : isTalking ? (
                        // Sound waves when talking
                        <div className="flex items-center gap-1">
                            <div className="w-1 h-2 bg-blue-400 rounded animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1 h-4 bg-blue-400 rounded animate-bounce" style={{ animationDelay: '100ms' }} />
                            <div className="w-1 h-6 bg-blue-400 rounded animate-bounce" style={{ animationDelay: '200ms' }} />
                            <div className="w-1 h-4 bg-blue-400 rounded animate-bounce" style={{ animationDelay: '100ms' }} />
                            <div className="w-1 h-2 bg-blue-400 rounded animate-bounce" style={{ animationDelay: '0ms' }} />
                        </div>
                    ) : (
                        // Idle state - simple dot
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                    )}
                </div>
            </div>

            {/* Status text */}
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium">
                {isListening && <span className="text-green-400">Listening...</span>}
                {isTalking && <span className="text-blue-400">Speaking...</span>}
            </div>
        </div>
    );
};

export default AvatarCircle;
