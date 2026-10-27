import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Send,
    X,
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
    ChevronUp,
    History,
    Plus,
    MessageSquare,
    Clock,
    ArrowLeft,
    Sparkles,
    Volume2,
    VolumeX,
    GripHorizontal,
    SlidersHorizontal
} from 'lucide-react';
import { processAgentMessage } from '../ai/agentEngine';
import GeminiIcon from './GeminiIcon';
import './AIAssistantBot.css';

const STORAGE_CONVERSATIONS_KEY = 'aura_conversations_v2';
const STORAGE_ACTIVE_ID_KEY = 'aura_active_conv_id_v2';
const LEGACY_STORAGE_CHAT_KEY = 'aura_chat_history_v1';
const STORAGE_WINDOW_POS_KEY = 'aura_window_pos_v2';
const STORAGE_FAB_POS_KEY = 'aura_fab_pos_v2';
const STORAGE_AUTO_SPEAK_KEY = 'aura_auto_speak_v1';
const STORAGE_MODE_KEY = 'aura_storage_mode'; // 'local' | 'session' | 'none'

const INITIAL_GREETING = {
    id: 'welcome-msg',
    sender: 'bot',
    text: `👋 **Hi! I'm Aura, your personal AI agent.**\n\nI can manage your **routines & tasks**, analyze your **wallet & budget**, track your **consistency streaks**, and provide **real-market financial advice & recommendations**!\n\n💡 You can now **drag me anywhere on your screen**, use **voice dictation** (auto-sends when you pause speaking), or tap the **speaker icon** to hear responses read aloud!`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    action: null,
};

const SUGGESTED_PROMPTS = [
    { label: "➕ New Chat", isNewChat: true },
    { label: "📈 Market & Finance Tips", query: "Give me personal financial tips and recommendations based on the real market" },
    { label: "💡 Smart Budget Check", query: "Analyze my monthly spending and recommend smart financial adjustments" },
    { label: "📋 Today's Tasks", query: "What tasks do I have scheduled for today?" },
    { label: "⚡ Add Task", query: "Add task: Project Review at 3pm to 4pm" },
    { label: "💳 Log Expense", query: "Log expense of ₹250 for Coffee" },
    { label: "🔥 Streak Check", query: "What is my current streak?" },
    { label: "🌓 Switch Theme", query: "Switch theme" },
];

const REQUEST_TYPE_OPTIONS = [
    {
        icon: '📈',
        title: 'Market & Finance',
        desc: 'Real market financial tips & recommendations',
        query: 'Give me personal financial tips and recommendations based on the real market',
    },
    {
        icon: '📋',
        title: "Today's Tasks",
        desc: 'Review scheduled routine tasks',
        query: 'What tasks do I have scheduled for today?',
    },
    {
        icon: '💡',
        title: 'Smart Budget Check',
        desc: 'Analyze monthly spending & savings',
        query: 'Analyze my monthly spending and recommend smart financial adjustments',
    },
    {
        icon: '🔥',
        title: 'Consistency Streak',
        desc: 'Check current consistency streak',
        query: 'What is my current streak?',
    },
];

const createFreshConversation = (title = 'New Conversation') => ({
    id: 'conv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [INITIAL_GREETING],
});

const generateConvTitle = (text) => {
    if (!text) return 'New Conversation';
    const clean = text.trim();
    if (clean.toLowerCase().includes('market & finance') || clean.toLowerCase().includes('real market')) {
        return 'Market & Finance Tips';
    }
    if (clean.toLowerCase().includes('smart budget') || clean.toLowerCase().includes('monthly spending')) {
        return 'Smart Budget Check';
    }
    if (clean.toLowerCase().includes('today') && clean.toLowerCase().includes('task')) {
        return "Today's Tasks";
    }
    if (clean.toLowerCase().startsWith('add task:')) {
        return clean.replace(/add task:\s*/i, 'Task: ').slice(0, 24);
    }
    if (clean.toLowerCase().startsWith('log expense')) {
        return clean.slice(0, 24);
    }
    if (clean.toLowerCase().includes('streak')) {
        return 'Streak Tracking';
    }
    const sanitized = clean.replace(/^(please\s+|can you\s+|could you\s+|i want to\s+|what is\s+|how do i\s+)/i, '');
    const capitalized = sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
    return capitalized.length > 24 ? capitalized.slice(0, 24) + '…' : capitalized;
};

const formatConvTime = (isoString) => {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = d.toDateString() === yesterday.toDateString();
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (isToday) return `Today, ${timeStr}`;
        if (isYesterday) return `Yesterday, ${timeStr}`;
        return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
    } catch {
        return '';
    }
};

const cleanTextForSpeech = (text) => {
    if (!text) return '';
    return text
        .replace(/[*#_`~]/g, '')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
};

const getActiveStorage = () => {
    try {
        const mode = localStorage.getItem(STORAGE_MODE_KEY);
        if (mode === 'session') return sessionStorage;
        if (mode === 'none') return null;
        return localStorage;
    } catch {
        return localStorage;
    }
};

const loadInitialConversations = () => {
    try {
        const storage = getActiveStorage();
        if (storage) {
            const saved = storage.getItem(STORAGE_CONVERSATIONS_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        }
        const localSaved = localStorage.getItem(STORAGE_CONVERSATIONS_KEY);
        if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
        const legacy = sessionStorage.getItem(LEGACY_STORAGE_CHAT_KEY);
        if (legacy) {
            const parsedLegacy = JSON.parse(legacy);
            if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
                const migrated = [{
                    id: 'conv-' + Date.now(),
                    title: 'Previous Chat',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    messages: parsedLegacy,
                }];
                localStorage.setItem(STORAGE_CONVERSATIONS_KEY, JSON.stringify(migrated));
                return migrated;
            }
        }
    } catch (e) {
        console.warn('Error loading conversations:', e);
    }
    const fresh = createFreshConversation();
    return [fresh];
};

const loadInitialActiveId = (convs) => {
    try {
        const storage = getActiveStorage();
        if (storage) {
            const saved = storage.getItem(STORAGE_ACTIVE_ID_KEY);
            if (saved && convs.some(c => c.id === saved)) {
                return saved;
            }
        }
    } catch (e) {
        console.warn('Error loading active conv id:', e);
    }
    return convs[0]?.id || '';
};

// Safe side snapping with generous gap/distance from screen borders
const snapFabToSide = (posX, posY) => {
    const fabSize = 54;
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const isMobile = screenWidth <= 600;

    // Generous gap from side walls so it never hugs the bezel
    const sideGap = isMobile ? 24 : 36;
    const isLeft = (posX + fabSize / 2) < (screenWidth / 2);
    const finalX = isLeft ? sideGap : (screenWidth - fabSize - sideGap);

    const minY = 24;
    const bottomNavMargin = isMobile ? 86 : 30;
    const maxY = Math.max(minY, screenHeight - fabSize - bottomNavMargin);
    const finalY = Math.min(Math.max(minY, posY), maxY);

    return { x: finalX, y: finalY, side: isLeft ? 'left' : 'right' };
};

const snapWindowToSide = (posX, posY, isMin) => {
    const width = isMin ? 200 : 340;
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const isMobile = screenWidth <= 600;

    const sideGap = isMobile ? 18 : 32;
    const isLeft = (posX + width / 2) < (screenWidth / 2);
    const finalX = isLeft ? sideGap : (screenWidth - width - sideGap);

    const minY = 24;
    const bottomNavMargin = isMobile ? 88 : 30;
    const maxY = Math.max(minY, screenHeight - (isMin ? 44 : 450) - bottomNavMargin);
    const finalY = Math.min(Math.max(minY, posY), maxY);

    return { x: finalX, y: finalY };
};

const hasValidActionCard = (action) => {
    if (!action) return false;
    const validTypes = [
        'task_added',
        'expense_logged',
        'income_logged',
        'streak_info',
        'navigate',
        'view_routine',
        'finance_summary'
    ];
    return validTypes.includes(action.type);
};

export default function AIAssistantBot({ onOpenStreakModal }) {
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [viewMode, setViewMode] = useState('chat'); // 'chat' | 'history'
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [voiceFeedback, setVoiceFeedback] = useState('');
    const [hasUnread, setHasUnread] = useState(false);

    // Text-to-Speech (AI Voice) state
    const [autoSpeak, setAutoSpeak] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_AUTO_SPEAK_KEY) === 'true';
        } catch {
            return false;
        }
    });
    const [speakingMsgId, setSpeakingMsgId] = useState(null);

    // Multi-conversation state
    const [conversations, setConversations] = useState(loadInitialConversations);
    const [activeConvId, setActiveConvId] = useState(() => loadInitialActiveId(conversations));

    const [isDraggingFab, setIsDraggingFab] = useState(false);

    // MOVABLE POSITION STATES
    const [windowPos, setWindowPos] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_WINDOW_POS_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
                    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;
                    const sideGap = isMobile ? 18 : 32;
                    const maxX = Math.max(sideGap, window.innerWidth - 340 - sideGap);
                    const maxY = Math.max(20, window.innerHeight - 480 - (isMobile ? 86 : 30));
                    return {
                        x: Math.min(Math.max(sideGap, parsed.x), maxX),
                        y: Math.min(Math.max(20, parsed.y), maxY),
                    };
                }
            }
        } catch (e) {}
        const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;
        return {
            x: Math.max(16, (typeof window !== 'undefined' ? window.innerWidth : 400) - 355),
            y: Math.max(20, (typeof window !== 'undefined' ? window.innerHeight : 800) - 490 - (isMobile ? 86 : 30)),
        };
    });

    const [fabPos, setFabPos] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_FAB_POS_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
                    return snapFabToSide(parsed.x, parsed.y);
                }
            }
        } catch (e) {}
        return snapFabToSide(
            (typeof window !== 'undefined' ? window.innerWidth : 400) - 80,
            (typeof window !== 'undefined' ? window.innerHeight : 800) - 95
        );
    });

    const activeConversation = useMemo(() => {
        return conversations.find(c => c.id === activeConvId) || conversations[0] || null;
    }, [conversations, activeConvId]);

    const messages = useMemo(() => {
        return activeConversation?.messages || [INITIAL_GREETING];
    }, [activeConversation]);

    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const recognitionRef = useRef(null);
    const transcriptRef = useRef('');
    const chatWindowRef = useRef(null);
    const fabRef = useRef(null);

    // Window drag tracking
    const windowDragRef = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        startPosX: 0,
        startPosY: 0,
    });

    // FAB drag tracking
    const fabDragRef = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        startPosX: 0,
        startPosY: 0,
        hasMoved: false,
    });

    const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

    // Keep positions inside viewport on resize
    useEffect(() => {
        const handleResize = () => {
            const isMobile = window.innerWidth <= 600;
            const sideGap = isMobile ? 18 : 32;
            const bottomNavMargin = isMobile ? 86 : 30;

            setWindowPos(prev => {
                const maxX = Math.max(sideGap, window.innerWidth - (chatWindowRef.current?.offsetWidth || 340) - sideGap);
                const maxY = Math.max(20, window.innerHeight - (chatWindowRef.current?.offsetHeight || 440) - bottomNavMargin);
                return {
                    x: Math.min(Math.max(sideGap, prev.x), maxX),
                    y: Math.min(Math.max(20, prev.y), maxY),
                };
            });
            setFabPos(prev => snapFabToSide(prev.x, prev.y));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const openChat = useCallback(() => {
        setIsOpen(true);
        setIsMinimized(false);
        setHasUnread(false);
        if (!window.history.state?.auraChatOpen) {
            window.history.pushState({ auraChatOpen: true }, '', window.location.href);
        }
    }, []);

    const closeChat = useCallback((minimizeOnly = false) => {
        if (minimizeOnly) {
            setIsMinimized(true);
            return;
        }
        setIsOpen(false);
        setIsMinimized(false);
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setSpeakingMsgId(null);
        }
        if (window.history.state?.auraChatOpen) {
            window.history.back();
        }
    }, []);

    useEffect(() => {
        const handlePopState = () => {
            if (isOpen) {
                if (viewMode === 'history') {
                    setViewMode('chat');
                } else {
                    setIsOpen(false);
                    setIsMinimized(false);
                }
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isOpen, viewMode]);

    useEffect(() => {
        if (!isOpen) return;

        const handleOutsidePointer = (event) => {
            if (windowDragRef.current.isDragging || fabDragRef.current.isDragging) return;
            if (
                chatWindowRef.current &&
                !chatWindowRef.current.contains(event.target)
            ) {
                closeChat(false);
            }
        };

        const handleScroll = (event) => {
            if (
                chatWindowRef.current &&
                !chatWindowRef.current.contains(event.target)
            ) {
                closeChat(false);
            }
        };

        document.addEventListener('pointerdown', handleOutsidePointer, true);
        document.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('pointerdown', handleOutsidePointer, true);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen, closeChat]);

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

        if (duration < 600) {
            if (deltaX > 75 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
                if (viewMode === 'history') {
                    setViewMode('chat');
                } else {
                    setIsMinimized(true);
                }
            } else if (deltaY > 85 && Math.abs(deltaY) > Math.abs(deltaX) * 1.3) {
                setIsMinimized(true);
            }
        }
    };

    useEffect(() => {
        const handleExternalOpen = () => openChat();
        window.addEventListener('open-ai-assistant', handleExternalOpen);
        return () => window.removeEventListener('open-ai-assistant', handleExternalOpen);
    }, [openChat]);

    // Data persistence respecting Privacy Mode
    useEffect(() => {
        try {
            const mode = localStorage.getItem(STORAGE_MODE_KEY) || 'local';
            if (mode === 'none') return;
            const storage = mode === 'session' ? sessionStorage : localStorage;
            storage.setItem(STORAGE_CONVERSATIONS_KEY, JSON.stringify(conversations));
            if (mode === 'session') {
                localStorage.removeItem(STORAGE_CONVERSATIONS_KEY);
            }
        } catch (e) {
            console.warn('Could not persist conversations:', e);
        }
    }, [conversations]);

    useEffect(() => {
        try {
            const mode = localStorage.getItem(STORAGE_MODE_KEY) || 'local';
            if (mode === 'none') return;
            const storage = mode === 'session' ? sessionStorage : localStorage;
            if (activeConvId) {
                storage.setItem(STORAGE_ACTIVE_ID_KEY, activeConvId);
            }
        } catch (e) {
            console.warn('Could not persist activeConvId:', e);
        }
    }, [activeConvId]);

    useEffect(() => {
        if (isOpen && !isMinimized && viewMode === 'chat') {
            if (chatWindowRef.current && chatWindowRef.current.scrollTop !== 0) {
                chatWindowRef.current.scrollTop = 0;
            }
            if (messagesContainerRef.current) {
                messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
        }
    }, [messages, isOpen, isMinimized, isTyping, viewMode]);

    // =========================================================
    // 1. DRAGGABLE CHAT WINDOW EVENT HANDLERS
    // =========================================================
    const handleWindowPointerDown = (e) => {
        if (e.target.closest('button, input, textarea, a, .aura-history-item, .aura-history-topic-card, .aura-pill-btn')) {
            return;
        }
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        windowDragRef.current = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            startPosX: windowPos.x,
            startPosY: windowPos.y,
        };
    };

    const handleWindowPointerMove = (e) => {
        if (!windowDragRef.current.isDragging) return;
        const deltaX = e.clientX - windowDragRef.current.startX;
        const deltaY = e.clientY - windowDragRef.current.startY;
        const width = chatWindowRef.current?.offsetWidth || 340;
        const height = chatWindowRef.current?.offsetHeight || 440;
        const isMobile = window.innerWidth <= 600;
        const sideGap = isMobile ? 16 : 28;
        const bottomNavMargin = window.innerWidth <= 768 ? 86 : 26;

        const maxX = Math.max(sideGap, window.innerWidth - width - sideGap);
        const maxY = Math.max(20, window.innerHeight - height - bottomNavMargin);

        const newX = Math.min(Math.max(sideGap, windowDragRef.current.startPosX + deltaX), maxX);
        const newY = Math.min(Math.max(20, windowDragRef.current.startPosY + deltaY), maxY);
        setWindowPos({ x: newX, y: newY });
    };

    const handleWindowPointerUp = (e) => {
        if (windowDragRef.current.isDragging) {
            windowDragRef.current.isDragging = false;
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {}

            let finalPos = windowPos;
            if (isMinimized) {
                finalPos = snapWindowToSide(windowPos.x, windowPos.y, true);
                setWindowPos(finalPos);
            }

            try {
                localStorage.setItem(STORAGE_WINDOW_POS_KEY, JSON.stringify(finalPos));
            } catch {}
        }
    };

    // =========================================================
    // 2. DRAGGABLE FAB BUTTON EVENT HANDLERS
    // =========================================================
    const handleFabPointerDown = (e) => {
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        setIsDraggingFab(true);
        fabDragRef.current = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            startPosX: fabPos.x,
            startPosY: fabPos.y,
            hasMoved: false,
        };
    };

    const handleFabPointerMove = (e) => {
        if (!fabDragRef.current.isDragging) return;
        const deltaX = e.clientX - fabDragRef.current.startX;
        const deltaY = e.clientY - fabDragRef.current.startY;

        if (Math.hypot(deltaX, deltaY) > 5) {
            fabDragRef.current.hasMoved = true;
        }

        if (fabDragRef.current.hasMoved) {
            const isMobile = window.innerWidth <= 600;
            const sideGap = isMobile ? 20 : 32;
            const bottomNavMargin = isMobile ? 86 : 30;
            const maxX = Math.max(sideGap, window.innerWidth - 54 - sideGap);
            const maxY = Math.max(20, window.innerHeight - 54 - bottomNavMargin);
            const newX = Math.min(Math.max(sideGap, fabDragRef.current.startPosX + deltaX), maxX);
            const newY = Math.min(Math.max(20, fabDragRef.current.startPosY + deltaY), maxY);
            setFabPos({ x: newX, y: newY });
        }
    };

    const handleFabPointerUp = (e) => {
        if (fabDragRef.current.isDragging) {
            fabDragRef.current.isDragging = false;
            setIsDraggingFab(false);
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {}

            if (!fabDragRef.current.hasMoved) {
                openChat();
            } else {
                const snapped = snapFabToSide(fabPos.x, fabPos.y);
                setFabPos(snapped);
                try {
                    localStorage.setItem(STORAGE_FAB_POS_KEY, JSON.stringify(snapped));
                } catch {}
            }
        }
    };

    // =========================================================
    // 3. VOICE ENGINE (SPEECH-TO-TEXT WITH AUTO-SEND & TTS)
    // =========================================================
    const speakMessage = useCallback((text, msgId) => {
        if (!('speechSynthesis' in window)) {
            alert('Text-to-speech is not supported on this device/browser.');
            return;
        }

        if (speakingMsgId === msgId) {
            window.speechSynthesis.cancel();
            setSpeakingMsgId(null);
            return;
        }

        window.speechSynthesis.cancel();
        const clean = cleanTextForSpeech(text);
        if (!clean) return;

        const utterance = new SpeechSynthesisUtterance(clean);
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Aria') || v.name.includes('Jenny')) && v.lang.startsWith('en'))
            || voices.find(v => v.lang.startsWith('en'))
            || voices[0];

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        utterance.rate = 1.02;
        utterance.pitch = 1.0;

        utterance.onstart = () => setSpeakingMsgId(msgId);
        utterance.onend = () => setSpeakingMsgId(null);
        utterance.onerror = () => setSpeakingMsgId(null);

        window.speechSynthesis.speak(utterance);
    }, [speakingMsgId]);

    const toggleAutoSpeak = () => {
        setAutoSpeak(prev => {
            const next = !prev;
            try {
                localStorage.setItem(STORAGE_AUTO_SPEAK_KEY, String(next));
            } catch {}
            if (!next && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                setSpeakingMsgId(null);
            }
            return next;
        });
    };

    // Voice Microphone Input: Streams speech live and auto-sends on finish
    const toggleSpeechInput = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Voice speech recognition is supported in Google Chrome, Microsoft Edge, and Safari. Please check microphone permissions.');
            return;
        }

        if (isListening) {
            try {
                recognitionRef.current?.stop();
            } catch {}
            setIsListening(false);
            const textToSend = transcriptRef.current.trim();
            if (textToSend) {
                handleSendMessage(textToSend);
                transcriptRef.current = '';
            }
            setVoiceFeedback('');
            return;
        }

        try {
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch {}
            }

            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            transcriptRef.current = '';

            recognition.onstart = () => {
                setIsListening(true);
                setVoiceFeedback('Listening... speak now 🎙️');
            };

            recognition.onresult = (event) => {
                let accumulated = '';
                for (let i = 0; i < event.results.length; ++i) {
                    accumulated += event.results[i][0].transcript;
                }
                transcriptRef.current = accumulated;
                setInput(accumulated);
                if (accumulated) {
                    setVoiceFeedback(`🎙️ "${accumulated}"`);
                }
            };

            recognition.onerror = (e) => {
                console.warn('SpeechRecognition error:', e.error);
                setIsListening(false);
                if (e.error === 'not-allowed') {
                    setVoiceFeedback('Microphone permission blocked. Please allow mic.');
                } else if (e.error === 'no-speech') {
                    setVoiceFeedback('No speech detected. Tap mic to retry.');
                } else {
                    setVoiceFeedback(`Mic error: ${e.error}`);
                }
                setTimeout(() => setVoiceFeedback(''), 3500);
            };

            recognition.onend = () => {
                setIsListening(false);
                const textToSend = transcriptRef.current.trim();
                if (textToSend) {
                    setVoiceFeedback('Sending speech message...');
                    handleSendMessage(textToSend);
                    transcriptRef.current = '';
                    setTimeout(() => setVoiceFeedback(''), 1500);
                } else {
                    setVoiceFeedback('');
                }
            };

            recognitionRef.current = recognition;
            recognition.start();
        } catch (err) {
            console.error('Failed to start speech recognition:', err);
            setIsListening(false);
            setVoiceFeedback('Could not start microphone. Check browser permissions.');
            setTimeout(() => setVoiceFeedback(''), 3500);
        }
    };

    // =========================================================
    // 4. CONVERSATION MANAGEMENT
    // =========================================================
    const handleStartNewChat = (customTitle = null) => {
        if (activeConversation) {
            const hasUserMsg = activeConversation.messages.some(m => m.sender === 'user');
            if (!hasUserMsg) {
                setViewMode('chat');
                return;
            }
        }

        const fresh = createFreshConversation(customTitle || 'New Conversation');
        setConversations(prev => [fresh, ...prev]);
        setActiveConvId(fresh.id);
        setViewMode('chat');
    };

    const handleStartTopicChat = (query, topicTitle) => {
        const fresh = createFreshConversation(topicTitle);
        setConversations(prev => [fresh, ...prev]);
        setActiveConvId(fresh.id);
        setViewMode('chat');

        setTimeout(() => {
            handleSendMessage(query, fresh.id);
        }, 120);
    };

    const handleSelectConversation = (convId) => {
        setActiveConvId(convId);
        setViewMode('chat');
    };

    const handleDeleteConversation = (idToDelete, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm('Delete this conversation?')) return;

        setConversations(prev => {
            const filtered = prev.filter(c => c.id !== idToDelete);
            if (filtered.length === 0) {
                const fresh = createFreshConversation();
                setActiveConvId(fresh.id);
                return [fresh];
            }
            if (activeConvId === idToDelete) {
                setActiveConvId(filtered[0].id);
            }
            return filtered;
        });
    };

    const handleClearCurrentChat = () => {
        if (!window.confirm('Clear messages in this conversation?')) return;
        setConversations(prev => prev.map(conv => {
            if (conv.id !== activeConvId) return conv;
            return {
                ...conv,
                title: 'New Conversation',
                updatedAt: new Date().toISOString(),
                messages: [INITIAL_GREETING],
            };
        }));
    };

    const handleClearAllConversations = () => {
        if (!window.confirm('Delete all chat history? This cannot be undone.')) return;
        const fresh = createFreshConversation();
        setConversations([fresh]);
        setActiveConvId(fresh.id);
        setViewMode('chat');
    };

    const handleSendMessage = async (textToSend, targetConvId = null) => {
        const convId = targetConvId || activeConvId;
        const query = (textToSend || input).trim();
        if (!query) return;

        setInput('');
        setVoiceFeedback('');
        transcriptRef.current = '';
        if (isListening && recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch {}
        }

        const userMsg = {
            id: 'msg-' + Date.now(),
            sender: 'user',
            text: query,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setConversations(prev => prev.map(conv => {
            if (conv.id !== convId) return conv;
            const hasExistingUser = conv.messages.some(m => m.sender === 'user');
            const title = !hasExistingUser && (conv.title === 'New Conversation' || !conv.title)
                ? generateConvTitle(query)
                : conv.title;
            return {
                ...conv,
                title,
                updatedAt: new Date().toISOString(),
                messages: [...conv.messages, userMsg],
            };
        }));

        setIsTyping(true);

        try {
            const response = await processAgentMessage(query);

            const botMsg = {
                id: 'bot-' + Date.now(),
                sender: 'bot',
                text: response.text,
                action: response.action,
                isGuardrail: response.isGuardrail,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };

            setConversations(prev => prev.map(conv => {
                if (conv.id !== convId) return conv;
                return {
                    ...conv,
                    updatedAt: new Date().toISOString(),
                    messages: [...conv.messages, botMsg],
                };
            }));

            if (autoSpeak && response.text) {
                setTimeout(() => speakMessage(response.text, botMsg.id), 300);
            }

            if (!isOpen) {
                setHasUnread(true);
            }

            if (response.action?.type === 'navigate' && response.action?.path) {
                setTimeout(() => navigate(response.action.path), 700);
            }
        } catch (err) {
            const errMsg = {
                id: 'bot-err-' + Date.now(),
                sender: 'bot',
                text: `❌ Error processing request. Please try again.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setConversations(prev => prev.map(conv => {
                if (conv.id !== convId) return conv;
                return {
                    ...conv,
                    updatedAt: new Date().toISOString(),
                    messages: [...conv.messages, errMsg],
                };
            }));
        } finally {
            setIsTyping(false);
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
            {/* MOVABLE CHAT WINDOW */}
            {isOpen && (
                <div
                    ref={chatWindowRef}
                    className={`aura-window ${isMinimized ? 'minimized' : ''}`}
                    style={{
                        left: `${windowPos.x}px`,
                        top: `${windowPos.y}px`,
                        right: 'auto',
                        bottom: 'auto',
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {isMinimized ? (
                        /* ULTRA-SLEEK MINIMIZED PILL: ABSOLUTELY ZERO ELEMENT OVERLAPPING */
                        <div
                            className="aura-minimized-pill"
                            onPointerDown={handleWindowPointerDown}
                            onPointerMove={handleWindowPointerMove}
                            onPointerUp={handleWindowPointerUp}
                            onClick={(e) => {
                                if (!e.target.closest('button')) {
                                    setIsMinimized(false);
                                }
                            }}
                            title="Tap to expand Aura AI"
                        >
                            <div className="aura-min-left">
                                <div className="aura-min-avatar">
                                    <GeminiIcon size={16} />
                                </div>
                                <span className="aura-min-name">Aura</span>
                                <span className="aura-badge">Gemini</span>
                            </div>
                            <div className="aura-min-actions">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMinimized(false);
                                    }}
                                    title="Expand chat"
                                    className="aura-min-btn expand"
                                    aria-label="Expand Aura AI"
                                >
                                    <ChevronUp size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        closeChat(false);
                                    }}
                                    title="Close"
                                    className="aura-min-btn close"
                                    aria-label="Close assistant"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* EXPANDED FULL CHATBOT WINDOW */
                        <>
                            {/* SWIPE / DRAG HANDLE BAR */}
                            <div
                                className="aura-swipe-handle-bar"
                                onPointerDown={handleWindowPointerDown}
                                onPointerMove={handleWindowPointerMove}
                                onPointerUp={handleWindowPointerUp}
                                title="Drag to move anywhere • Swipe down to minimize"
                            >
                                <span className="aura-swipe-handle-pill" />
                            </div>

                            {/* HEADER */}
                            <div
                                className="aura-header"
                                onPointerDown={handleWindowPointerDown}
                                onPointerMove={handleWindowPointerMove}
                                onPointerUp={handleWindowPointerUp}
                                title="Drag header to move anywhere"
                            >
                                <div className="aura-header-left">
                                    <div className="aura-drag-handle" title="Drag to move anywhere">
                                        <GripHorizontal size={14} />
                                    </div>

                                    {/* CHAT HISTORY / MENU BUTTON */}
                                    <button
                                        type="button"
                                        onClick={() => setViewMode(prev => prev === 'history' ? 'chat' : 'history')}
                                        title={viewMode === 'history' ? 'Back to current chat' : 'Chat History & Conversations'}
                                        className={`aura-icon-btn aura-menu-btn ${viewMode === 'history' ? 'active' : ''}`}
                                        aria-label="Toggle chat history"
                                    >
                                        {viewMode === 'history' ? <ArrowLeft size={16} /> : <History size={16} />}
                                    </button>

                                    <div
                                        className="aura-header-info"
                                        onClick={() => setViewMode('chat')}
                                        title="Click to view conversation"
                                    >
                                        <div className="aura-avatar">
                                            <GeminiIcon size={16} />
                                        </div>
                                        <div className="aura-title-wrap">
                                            <div className="aura-title">
                                                <span>Aura</span>
                                                <span className="aura-badge">Gemini</span>
                                            </div>
                                            <div className="aura-subtitle">
                                                {viewMode === 'history'
                                                    ? `${conversations.length} saved chats`
                                                    : (activeConversation?.title || 'Workspace AI')}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="aura-header-actions">
                                    {/* AUTO-SPEAK TOGGLE */}
                                    <button
                                        type="button"
                                        onClick={toggleAutoSpeak}
                                        title={autoSpeak ? 'Auto AI Voice enabled (tap to mute)' : 'Enable Auto AI Voice'}
                                        className={`aura-icon-btn ${autoSpeak ? 'auto-speak-active' : ''}`}
                                        aria-label="Toggle auto voice response"
                                    >
                                        {autoSpeak ? <Volume2 size={15} /> : <VolumeX size={15} />}
                                    </button>

                                    {/* NEW CHAT BUTTON */}
                                    <button
                                        type="button"
                                        onClick={() => handleStartNewChat()}
                                        title="Start New Chat"
                                        className="aura-icon-btn aura-new-chat-btn"
                                        aria-label="New chat"
                                    >
                                        <Plus size={16} />
                                    </button>

                                    {/* CLEAR CHAT BUTTON */}
                                    {viewMode === 'chat' && (
                                        <button
                                            type="button"
                                            onClick={handleClearCurrentChat}
                                            title="Clear this conversation"
                                            className="aura-icon-btn"
                                            aria-label="Clear chat"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}

                                    {/* TOGGLE MINIMIZE */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMinimized(true);
                                        }}
                                        title="Minimize (Swipe back/touch outside)"
                                        className="aura-icon-btn aura-minimize-btn"
                                        aria-label="Minimize assistant"
                                    >
                                        <ChevronDown size={16} />
                                    </button>

                                    {/* CLOSE ASSISTANT */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            closeChat(false);
                                        }}
                                        title="Close"
                                        className="aura-icon-btn"
                                        aria-label="Close assistant"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* VIEW MODE 1: CHAT HISTORY PANEL */}
                            {viewMode === 'history' ? (
                                <div className="aura-history-view">
                                    <div className="aura-history-header">
                                        <div className="aura-history-header-title">
                                            <History size={16} />
                                            <span>Chat History & Topics</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleStartNewChat()}
                                            className="aura-history-new-btn"
                                        >
                                            <Plus size={14} />
                                            <span>New Chat</span>
                                        </button>
                                    </div>

                                    <div className="aura-history-topics-section">
                                        <div className="aura-history-section-label">Quick AI Topics</div>
                                        <div className="aura-history-topics-grid">
                                            {REQUEST_TYPE_OPTIONS.map((item, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className="aura-history-topic-card"
                                                    onClick={() => handleStartTopicChat(item.query, item.title)}
                                                >
                                                    <span className="aura-topic-icon">{item.icon}</span>
                                                    <div className="aura-topic-text">
                                                        <strong>{item.title}</strong>
                                                        <small>{item.desc}</small>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="aura-history-list-section">
                                        <div className="aura-history-section-label">Previous Conversations</div>
                                        <div className="aura-history-list">
                                            {conversations.map((conv) => {
                                                const isActive = conv.id === activeConvId;
                                                const userMsgCount = conv.messages.filter(m => m.sender === 'user').length;
                                                return (
                                                    <div
                                                        key={conv.id}
                                                        className={`aura-history-item ${isActive ? 'active' : ''}`}
                                                        onClick={() => handleSelectConversation(conv.id)}
                                                    >
                                                        <div className="aura-history-item-icon">
                                                            <MessageSquare size={14} />
                                                        </div>
                                                        <div className="aura-history-item-body">
                                                            <div className="aura-history-item-title">{conv.title}</div>
                                                            <div className="aura-history-item-meta">
                                                                <Clock size={11} />
                                                                <span>{formatConvTime(conv.updatedAt)}</span>
                                                                <span className="aura-meta-bullet">•</span>
                                                                <span>{userMsgCount} msg{userMsgCount === 1 ? '' : 's'}</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                                                            title="Delete this conversation"
                                                            className="aura-history-item-del"
                                                            aria-label="Delete conversation"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="aura-history-footer">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                closeChat(false);
                                                navigate('/settings');
                                            }}
                                            className="aura-history-settings-btn"
                                            title="Open AI Model & Data Privacy Settings"
                                        >
                                            <SlidersHorizontal size={14} />
                                            <span>AI Model & Privacy Settings</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleClearAllConversations}
                                            className="aura-history-clear-all"
                                            title="Delete all chat history"
                                        >
                                            Clear All History
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* VIEW MODE 2: ACTIVE CONVERSATION */
                                <>
                                    {voiceFeedback && (
                                        <div className="aura-voice-banner">
                                            <span>{voiceFeedback}</span>
                                        </div>
                                    )}

                                    <div className="aura-messages" ref={messagesContainerRef}>
                                        {messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`aura-msg-row ${msg.sender === 'user' ? 'user' : 'bot'} ${msg.isGuardrail ? 'guardrail' : ''}`}
                                            >
                                                {msg.sender === 'bot' && (
                                                    <div className="aura-msg-avatar">
                                                        <GeminiIcon size={13} />
                                                    </div>
                                                )}

                                                <div className={`aura-bubble ${msg.sender === 'user' ? 'user' : 'bot'} ${msg.isGuardrail ? 'guardrail' : ''}`}>
                                                    {msg.isGuardrail && (
                                                        <div className="aura-guardrail-banner">
                                                            <ShieldAlert size={14} color="#f59e0b" />
                                                            <span>Safety Scope Notice</span>
                                                        </div>
                                                    )}

                                                    <div className="aura-bubble-text">
                                                        {renderFormattedText(msg.text)}
                                                    </div>

                                                    {/* ACTION CARDS (ONLY RENDER IF ACTUAL ACTIONABLE BUTTON EXISTS) */}
                                                    {hasValidActionCard(msg.action) && (
                                                        <div className="aura-action-card">
                                                            {msg.action.type === 'task_added' && (
                                                                <div className="aura-action-content">
                                                                    <div className="aura-action-header">
                                                                        <CheckCircle size={13} color="var(--success)" />
                                                                        <span>Added: {msg.action.task?.title}</span>
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
                                                                    <ArrowRight size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* BUBBLE FOOTER: TIMESTAMP & AI VOICE PLAY BUTTON */}
                                                    <div className="aura-bubble-footer">
                                                        {msg.sender === 'bot' && (
                                                            <button
                                                                type="button"
                                                                className={`aura-speak-btn ${speakingMsgId === msg.id ? 'speaking' : ''}`}
                                                                onClick={() => speakMessage(msg.text, msg.id)}
                                                                title={speakingMsgId === msg.id ? 'Stop audio' : 'Listen with AI voice'}
                                                                aria-label="Speak response"
                                                            >
                                                                {speakingMsgId === msg.id ? <VolumeX size={12} /> : <Volume2 size={12} />}
                                                                <span>{speakingMsgId === msg.id ? 'Stop' : 'Voice'}</span>
                                                            </button>
                                                        )}
                                                        <span className="aura-timestamp">{msg.timestamp}</span>
                                                    </div>
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
                                                    className={`aura-pill-btn ${prompt.isNewChat ? 'new-chat-pill' : ''}`}
                                                    onClick={() => {
                                                        if (prompt.isNewChat) {
                                                            handleStartNewChat();
                                                        } else {
                                                            handleSendMessage(prompt.query);
                                                        }
                                                    }}
                                                >
                                                    {prompt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* COMPACT INPUT FORM WITH VOICE */}
                                    <form
                                        className="aura-input-bar"
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={toggleSpeechInput}
                                            className={`aura-mic-btn ${isListening ? 'listening' : ''}`}
                                            title={isListening ? 'Stop recording & send' : 'Speak to Aura (Dictate with voice)'}
                                            aria-label="Dictate message with voice"
                                        >
                                            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                                        </button>

                                        <input
                                            type="text"
                                            className="aura-text-input"
                                            placeholder={isListening ? 'Listening to voice...' : 'Ask about routine, finances...'}
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
                        </>
                    )}
                </div>
            )}

            {/* FLOATING DRAGGABLE FAB BUTTON (WHEN CHAT CLOSED) */}
            {!isOpen && (
                <button
                    ref={fabRef}
                    type="button"
                    className={`aura-fab ${isDraggingFab ? 'dragging' : ''}`}
                    style={{
                        left: `${fabPos.x}px`,
                        top: `${fabPos.y}px`,
                        right: 'auto',
                        bottom: 'auto',
                    }}
                    onPointerDown={handleFabPointerDown}
                    onPointerMove={handleFabPointerMove}
                    onPointerUp={handleFabPointerUp}
                    aria-label="Open Aura AI assistant (Drag to move left or right)"
                    title="Chat with Aura • Drag to snap left or right"
                >
                    <GeminiIcon size={26} className="aura-gemini-logo" />
                </button>
            )}
        </>
    );
}
