import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Send,
    X,
    Minimize2,
    Maximize2,
    Trash2,
    Mic,
    MicOff,
    CheckCircle,
    Calendar,
    Wallet,
    Flame,
    ArrowRight,
    ShieldAlert,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { AuthContext } from '../context/AuthState';
import { processAgentMessage } from '../ai/agentEngine';
import GeminiIcon from './GeminiIcon';

const STORAGE_CHAT_KEY = 'aura_chat_history_v1';

const INITIAL_GREETING = {
    id: 'welcome-msg',
    sender: 'bot',
    text: `👋 **Hi! I'm Aura, your personal AI agent.**\n\nI can manage your **routines & tasks**, analyze your **wallet & budget**, track your **consistency streaks**, and provide **real-market financial advice & recommendations**!\n\nTap **"📈 Market & Finance Tips"** below to get personalized financial intelligence.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    action: null,
};

const SUGGESTED_PROMPTS = [
    { label: "📈 Market & Finance Tips", query: "Give me personal financial tips and recommendations based on the real market" },
    { label: "💡 Smart Budget Check", query: "Analyze my monthly spending and recommend smart financial adjustments" },
    { label: "📅 Today's Tasks", query: "What tasks do I have scheduled for today?" },
    { label: "➕ Add Task", query: "Add task: Project Review at 3pm to 4pm" },
    { label: "💸 Log Expense", query: "Log expense of ₹250 for Coffee" },
    { label: "🔥 Streak Check", query: "What is my current streak?" },
    { label: "🎨 Switch Theme", query: "Switch theme" },
];

export default function AIAssistantBot({ onOpenStreakModal }) {
    const { user, syncData } = useContext(AuthContext);
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);

    const [messages, setMessages] = useState(() => {
        try {
            const saved = sessionStorage.getItem(STORAGE_CHAT_KEY);
            return saved ? JSON.parse(saved) : [INITIAL_GREETING];
        } catch {
            return [INITIAL_GREETING];
        }
    });

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const chatWindowRef = useRef(null);
    const fabRef = useRef(null);

    // Touch swipe tracking refs
    const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

    // Open chat with browser history integration
    const openChat = useCallback(() => {
        setIsOpen(true);
        setIsMinimized(false);
        setHasUnread(false);
        if (!window.history.state?.auraChatOpen) {
            window.history.pushState({ auraChatOpen: true }, '', window.location.href);
        }
    }, []);

    // Close/minimize chat with browser history pop
    const closeChat = useCallback((minimizeOnly = false) => {
        if (minimizeOnly) {
            setIsMinimized(true);
            return;
        }
        setIsOpen(false);
        setIsMinimized(false);
        if (window.history.state?.auraChatOpen) {
            window.history.back();
        }
    }, []);

    // 1. PERFECT WORKING BROWSER BACK NAVIGATION
    // When user presses browser back button or device back gesture on any page,
    // minimize/close the chatbot instead of navigating away!
    useEffect(() => {
        const handlePopState = () => {
            if (isOpen) {
                setIsOpen(false);
                setIsMinimized(false);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isOpen]);

    // 2. TOUCH OUTSIDE TO MINIMIZE
    // If the user touches or clicks anywhere outside the chat window, minimize it!
    useEffect(() => {
        if (!isOpen || isMinimized) return;

        const handleOutsidePointer = (e) => {
            if (
                chatWindowRef.current &&
                !chatWindowRef.current.contains(e.target) &&
                (!fabRef.current || !fabRef.current.contains(e.target))
            ) {
                setIsMinimized(true);
            }
        };

        // Use capture phase on pointerdown for immediate responsiveness
        document.addEventListener('pointerdown', handleOutsidePointer, true);
        return () => {
            document.removeEventListener('pointerdown', handleOutsidePointer, true);
        };
    }, [isOpen, isMinimized]);

    // 3. SWIPE GESTURE DETECTION (SWIPE BACK OR SWIPE DOWN TO MINIMIZE)
    const handleTouchStart = (e) => {
        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
        };
    };

    const handleTouchEnd = (e) => {
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;
        const duration = Date.now() - touchStartRef.current.time;

        // Fast gesture within 600ms
        if (duration < 600) {
            // Horizontal swipe right (iOS/Android swipe-back gesture)
            if (deltaX > 65 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
                setIsMinimized(true);
            }
            // Vertical swipe down (pull down on sheet)
            else if (deltaY > 75 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
                setIsMinimized(true);
            }
        }
    };

    // Listen for external open trigger
    useEffect(() => {
        const handleExternalOpen = () => {
            openChat();
        };
        window.addEventListener('open-ai-assistant', handleExternalOpen);
        return () => window.removeEventListener('open-ai-assistant', handleExternalOpen);
    }, [openChat]);

    // Persist messages in sessionStorage
    useEffect(() => {
        try {
            sessionStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(messages));
        } catch (e) {
            console.warn('Could not persist chat history:', e);
        }
    }, [messages]);

    // Auto scroll chat
    useEffect(() => {
        if (isOpen && !isMinimized) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen, isMinimized, isTyping]);

    // Speech Recognition setup
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = () => setIsListening(false);
            recognition.onresult = (event) => {
                const transcript = event.results[0]?.[0]?.transcript;
                if (transcript) {
                    setInput(transcript);
                }
            };
            recognitionRef.current = recognition;
        }
    }, []);

    const toggleSpeech = () => {
        if (!recognitionRef.current) {
            alert('Speech recognition is not supported in this browser.');
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            try {
                recognitionRef.current.start();
            } catch (err) {
                console.warn('Speech recognition error:', err);
            }
        }
    };

    const handleSendMessage = async (textToSend) => {
        const query = (textToSend || input).trim();
        if (!query) return;

        setInput('');
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
        }

        const userMsg = {
            id: 'msg-' + Date.now(),
            sender: 'user',
            text: query,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages(prev => [...prev, userMsg]);
        setIsTyping(true);

        try {
            const response = await processAgentMessage(query, { user, syncData });

            const botMsg = {
                id: 'bot-' + Date.now(),
                sender: 'bot',
                text: response.text,
                action: response.action,
                isGuardrail: response.isGuardrail,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };

            setMessages(prev => [...prev, botMsg]);

            if (!isOpen) {
                setHasUnread(true);
            }

            if (response.action?.type === 'navigate' && response.action?.path) {
                setTimeout(() => navigate(response.action.path), 700);
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                id: 'bot-err-' + Date.now(),
                sender: 'bot',
                text: `❌ Error processing request. Please try again.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleClearChat = () => {
        if (window.confirm('Clear conversation?')) {
            setMessages([INITIAL_GREETING]);
            sessionStorage.removeItem(STORAGE_CHAT_KEY);
        }
    };

    const handleActionClick = (action) => {
        if (!action) return;
        if (action.path) {
            navigate(action.path);
        }
        if (action.type === 'streak_info') {
            if (typeof onOpenStreakModal === 'function') {
                onOpenStreakModal();
            } else {
                window.dispatchEvent(new CustomEvent('open-streak-modal'));
            }
        }
    };

    const renderFormattedText = (text) => {
        if (!text) return null;
        const lines = text.split('\n');
        return lines.map((line, idx) => {
            const boldRegex = /\*\*(.*?)\*\*/g;
            const parts = [];
            let lastIndex = 0;
            let match;

            while ((match = boldRegex.exec(line)) !== null) {
                if (match.index > lastIndex) {
                    parts.push(line.substring(lastIndex, match.index));
                }
                parts.push(<strong key={`b-${idx}-${match.index}`}>{match[1]}</strong>);
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < line.length) {
                parts.push(line.substring(lastIndex));
            }

            return (
                <span key={idx} style={{ display: 'block', minHeight: line.trim() ? 'auto' : '6px', lineHeight: '1.45' }}>
                    {parts.length > 0 ? parts : line}
                </span>
            );
        });
    };

    return (
        <>
            {/* CHAT WINDOW (COMPACT, TOUCH-OUTSIDE-DISMISSIBLE, SWIPEABLE) */}
            {isOpen && (
                <div
                    ref={chatWindowRef}
                    className={`aura-window ${isMinimized ? 'minimized' : ''}`}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* SWIPE HANDLE (FOR MOBILE VISUAL CUE) */}
                    <div
                        className="aura-swipe-handle-bar"
                        onClick={() => setIsMinimized(!isMinimized)}
                        title="Swipe down or tap to minimize"
                    >
                        <span className="aura-swipe-handle-pill" />
                    </div>

                    {/* HEADER */}
                    <div className="aura-header">
                        <div className="aura-header-info">
                            <div className="aura-avatar">
                                <GeminiIcon size={16} />
                                <span className="aura-status-dot" />
                            </div>
                            <div>
                                <div className="aura-title">
                                    Aura <span className="aura-badge">Gemini</span>
                                </div>
                                <div className="aura-subtitle">Workspace AI</div>
                            </div>
                        </div>

                        <div className="aura-header-actions">
                            <button
                                onClick={handleClearChat}
                                title="Clear conversation"
                                className="aura-icon-btn"
                                aria-label="Clear chat"
                            >
                                <Trash2 size={14} />
                            </button>
                            <button
                                onClick={() => setIsMinimized(!isMinimized)}
                                title={isMinimized ? 'Expand' : 'Minimize (Swipe back/touch outside)'}
                                className="aura-icon-btn"
                                aria-label="Toggle minimize"
                            >
                                {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <button
                                onClick={() => closeChat(false)}
                                title="Close"
                                className="aura-icon-btn"
                                aria-label="Close assistant"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {!isMinimized && (
                        <>
                            {/* GUARDRAIL NOTICE BANNER */}
                            <div className="aura-guardrail-banner">
                                <ShieldAlert size={12} />
                                <span>Application-scoped (Swipe back or tap outside to minimize)</span>
                            </div>

                            {/* MESSAGES BODY */}
                            <div className="aura-body">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`aura-msg-row ${msg.sender === 'user' ? 'user' : 'bot'}`}
                                    >
                                        {msg.sender === 'bot' && (
                                            <div className="aura-msg-avatar">
                                                <GeminiIcon size={13} />
                                            </div>
                                        )}
                                        <div className={`aura-bubble ${msg.sender === 'user' ? 'user' : 'bot'} ${msg.isGuardrail ? 'guardrail' : ''}`}>
                                            <div className="aura-bubble-content">
                                                {renderFormattedText(msg.text)}
                                            </div>

                                            {/* ACTION CARD ATTACHMENT */}
                                            {msg.action && (
                                                <div className="aura-action-card">
                                                    {msg.action.type === 'task_added' && (
                                                        <div className="aura-action-content">
                                                            <div className="aura-action-header">
                                                                <CheckCircle size={13} color="var(--success)" />
                                                                <span>Scheduled for {msg.action.task?.date}</span>
                                                            </div>
                                                            <button
                                                                className="aura-action-btn"
                                                                onClick={() => handleActionClick(msg.action)}
                                                            >
                                                                <Calendar size={13} />
                                                                <span>Routine Planner</span>
                                                                <ArrowRight size={13} />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {msg.action.type === 'expense_logged' && (
                                                        <div className="aura-action-content">
                                                            <div className="aura-action-header">
                                                                <Wallet size={13} color="var(--danger)" />
                                                                <span>Expense: {msg.action.transaction?.desc}</span>
                                                            </div>
                                                            <button
                                                                className="aura-action-btn"
                                                                onClick={() => handleActionClick(msg.action)}
                                                            >
                                                                <Wallet size={13} />
                                                                <span>View Wallet</span>
                                                                <ArrowRight size={13} />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {msg.action.type === 'income_logged' && (
                                                        <div className="aura-action-content">
                                                            <div className="aura-action-header">
                                                                <Wallet size={13} color="var(--success)" />
                                                                <span>Income: {msg.action.transaction?.desc}</span>
                                                            </div>
                                                            <button
                                                                className="aura-action-btn"
                                                                onClick={() => handleActionClick(msg.action)}
                                                            >
                                                                <Wallet size={13} />
                                                                <span>View Wallet</span>
                                                                <ArrowRight size={13} />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {msg.action.type === 'streak_info' && (
                                                        <div className="aura-action-content">
                                                            <div className="aura-action-header">
                                                                <Flame size={13} color="#f97316" />
                                                                <span>Current: {msg.action.currentStreak} 🔥 | Record: {msg.action.maxStreak} 🏆</span>
                                                            </div>
                                                            <button
                                                                className="aura-action-btn"
                                                                onClick={() => handleActionClick(msg.action)}
                                                            >
                                                                <Flame size={13} />
                                                                <span>{msg.action.buttonText || 'Consistency Log'}</span>
                                                                <ArrowRight size={13} />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {msg.action.type === 'navigate' && (
                                                        <button
                                                            className="aura-action-btn"
                                                            onClick={() => handleActionClick(msg.action)}
                                                        >
                                                            <span>{msg.action.label || 'Go to Page'}</span>
                                                            <ArrowRight size={13} />
                                                        </button>
                                                    )}

                                                    {msg.action.type === 'view_routine' && (
                                                        <button
                                                            className="aura-action-btn"
                                                            onClick={() => handleActionClick(msg.action)}
                                                        >
                                                            <Calendar size={13} />
                                                            <span>Open Routine Planner</span>
                                                            <ArrowRight size={13} />
                                                        </button>
                                                    )}

                                                    {msg.action.type === 'finance_summary' && (
                                                        <button
                                                            className="aura-action-btn"
                                                            onClick={() => handleActionClick(msg.action)}
                                                        >
                                                            <Wallet size={14} />
                                                            <span>Open Finance Page</span>
                                                            <ArrowRight size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            <span className="aura-timestamp">{msg.timestamp}</span>
                                        </div>
                                    </div>
                                ))}

                                {isTyping && (
                                    <div className="aura-msg-row bot">
                                        <div className="aura-msg-avatar">
                                            <GeminiIcon size={13} />
                                        </div>
                                        <div className="aura-bubble bot typing">
                                            <span className="aura-typing-dot" />
                                            <span className="aura-typing-dot" />
                                            <span className="aura-typing-dot" />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* COMPACT SUGGESTION PILLS */}
                            <div className="aura-suggestions-wrap">
                                <div className="aura-suggestions">
                                    {SUGGESTED_PROMPTS.map((prompt, i) => (
                                        <button
                                            key={i}
                                            className="aura-pill-btn"
                                            onClick={() => handleSendMessage(prompt.query)}
                                        >
                                            {prompt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* COMPACT INPUT FORM */}
                            <form
                                className="aura-input-bar"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSendMessage();
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={toggleSpeech}
                                    className={`aura-mic-btn ${isListening ? 'listening' : ''}`}
                                    title={isListening ? 'Stop listening' : 'Dictate with voice'}
                                    aria-label="Dictate message"
                                >
                                    {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                                </button>

                                <input
                                    type="text"
                                    className="aura-text-input"
                                    placeholder={isListening ? 'Listening...' : 'Ask about routine, finances...'}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                />

                                <button
                                    type="submit"
                                    disabled={!input.trim()}
                                    className="aura-send-btn"
                                    title="Send message"
                                    aria-label="Send message"
                                >
                                    <Send size={14} />
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}
        </>
    );
}
