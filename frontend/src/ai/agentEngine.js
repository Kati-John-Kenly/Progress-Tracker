import {
    getStoredRoutineTasks,
    setStoredRoutineTasks,
    getStoredFinances,
    setStoredFinances,
    getStoredFinanceCategories,
    setStoredFinanceCategories,
    getStoredTheme,
    setStoredTheme,
    calculateStreakStats,
    emitWorkspaceChange,
} from '../utils/workspaceEvents.js';
import { formatAmount } from '../utils/numberFormat.js';

// Custom Personal Gemini API Key management
export const getCustomGeminiApiKey = () => {
    try {
        return localStorage.getItem('aura_custom_gemini_api_key') || '';
    } catch {
        return '';
    }
};

export const setCustomGeminiApiKey = (key) => {
    try {
        if (key && key.trim()) {
            localStorage.setItem('aura_custom_gemini_api_key', key.trim());
        } else {
            localStorage.removeItem('aura_custom_gemini_api_key');
        }
    } catch {}
};

export const testGeminiApiKey = async (apiKey) => {
    const key = (apiKey || getCustomGeminiApiKey()).trim();
    if (!key) throw new Error('Please enter a valid Gemini API Key.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: "Hello Gemini, reply with 'OK' if connected." }] }]
        })
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Google API error (Status ${res.status})`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Connected successfully!';
};

export const callGoogleGeminiDirect = async (userMessage, apiKey) => {
    const tasks = getStoredRoutineTasks();
    const finances = getStoredFinances();
    const streak = calculateStreakStats(tasks);
    const todayStr = getRelativeDate(0);
    const todayTasks = tasks.filter(t => t.date === todayStr);

    const systemPrompt = `You are Aura, the user's personal AI agent for Progress & Productivity.
User Workspace Context:
- Today's date: ${todayStr}
- Scheduled tasks for today: ${todayTasks.length} (${todayTasks.filter(t => t.completed).length} completed)
- Active Consistency Streak: ${streak.currentStreak} days (Record: ${streak.maxStreak})
- Logged finance records: ${finances.length} transactions.

Respond concisely in clean markdown with bold highlights and bullet points. Be motivating, actionable, and focus on routines, habits, productivity, and smart financial growth.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [
                { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question: ${userMessage}` }] }
            ]
        })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Gemini API error (${res.status})`);
    }
    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error('No response returned from Gemini API');
    return reply;
};

// Standard finance categories matching FinanceView
const STANDARD_CATEGORIES = [
    'Salary',
    'Groceries',
    'Utilities',
    'Dining Out',
    'Transportation',
    'EMI/Rent',
    'Shopping',
    'Investment',
];

// Helper: Normalize Date strings
export const getRelativeDate = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
};

export const parseDateString = (input) => {
    if (!input) return getRelativeDate(0);
    const text = input.toLowerCase().trim();

    if (text.includes('today')) return getRelativeDate(0);
    if (text.includes('tomorrow')) return getRelativeDate(1);
    if (text.includes('yesterday')) return getRelativeDate(-1);

    // Weekday check
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < weekdays.length; i++) {
        if (text.includes(weekdays[i])) {
            const today = new Date();
            const currentDay = today.getDay();
            let distance = (i - currentDay + 7) % 7;
            if (distance === 0 && text.includes('next')) distance = 7;
            const targetDate = new Date();
            targetDate.setDate(today.getDate() + distance);
            return targetDate.toISOString().split('T')[0];
        }
    }

    // Match YYYY-MM-DD
    const isoMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (isoMatch) return isoMatch[0];

    // Match DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
    }

    return getRelativeDate(0);
};

// Helper: Parse Time string like "2pm", "14:30", "9:00 AM", "6"
export const parseTimeString = (text) => {
    if (!text) return '';
    const clean = text.toLowerCase().trim();

    // Match 12-hour format e.g. "2:30pm", "2pm", "11:15 am"
    const match12 = clean.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (match12) {
        let hour = parseInt(match12[1], 10);
        const mins = match12[2] ? match12[2].padStart(2, '0') : '00';
        const meridiem = match12[3].toLowerCase();
        if (meridiem === 'pm' && hour < 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
        return `${String(hour).padStart(2, '0')}:${mins}`;
    }

    // Match 24-hour format e.g. "14:30", "09:00"
    const match24 = clean.match(/(\d{1,2}):(\d{2})/);
    if (match24) {
        const hour = String(parseInt(match24[1], 10)).padStart(2, '0');
        const mins = match24[2].padStart(2, '0');
        return `${hour}:${mins}`;
    }

    return '';
};

// Helper: Smart category mapping for expenses
export const mapFinanceCategory = (rawCategory) => {
    if (!rawCategory) return 'Groceries';
    const clean = rawCategory.toLowerCase().trim();

    const allStoredCats = [...STANDARD_CATEGORIES, ...getStoredFinanceCategories()];
    const exactMatch = allStoredCats.find(c => c.toLowerCase() === clean);
    if (exactMatch) return exactMatch;

    if (/food|lunch|dinner|breakfast|coffee|cafe|restaurant|burger|pizza|snack|tea|dine|dining|eating/.test(clean)) {
        return 'Dining Out';
    }
    if (/grocery|supermarket|vegetable|fruit|milk|ration|market|provisions/.test(clean)) {
        return 'Groceries';
    }
    if (/cab|uber|ola|taxi|bus|metro|train|flight|fuel|petrol|diesel|gas|auto|transport|commute/.test(clean)) {
        return 'Transportation';
    }
    if (/electricity|water|wifi|internet|phone|recharge|current bill|utility|power/.test(clean)) {
        return 'Utilities';
    }
    if (/rent|emi|loan|mortgage|room rent|hostel/.test(clean)) {
        return 'EMI/Rent';
    }
    if (/cloth|clothes|dress|shoes|shopping|amazon|flipkart|myntra|gadget|electronics/.test(clean)) {
        return 'Shopping';
    }
    if (/stock|crypto|mutual fund|sip|gold|invest|shares|deposit/.test(clean)) {
        return 'Investment';
    }
    if (/salary|paycheck|freelance|stipend|wages|bonus/.test(clean)) {
        return 'Salary';
    }

    // Capitalize first letter if custom
    return rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);
};

// Helper: Choose task color
export const pickTaskColor = (title) => {
    const t = (title || '').toLowerCase();
    if (/gym|workout|exercise|walk|run|yoga|fitness|health/.test(t)) return '#10b981'; // green
    if (/study|exam|code|programming|reading|book|learn|class|lecture/.test(t)) return '#8b5cf6'; // purple
    if (/work|meeting|call|client|project|office|standup|review/.test(t)) return '#3b82f6'; // blue
    if (/relax|chill|movie|game|gaming|sleep|nap|holiday/.test(t)) return '#ec4899'; // pink
    if (/food|lunch|dinner|breakfast|snack|cook/.test(t)) return '#f59e0b'; // amber
    return '#f97316'; // orange default
};

/**
 * Domain Guardrail Checker:
 * Ensures the agent ONLY responds to requests relevant to this application.
 */
export const isApplicationRelevant = (query) => {
    const q = query.toLowerCase();

    // Explicit domain keywords
    const domainKeywords = [
        // Tasks & Routine
        'task', 'routine', 'schedule', 'todo', 'to-do', 'plan', 'planner', 'habit', 'focus',
        'reminder', 'calendar', 'meeting', 'workout', 'study', 'work', 'holiday', 'template',
        'complete', 'completed', 'done', 'finish', 'uncheck', 'pending', 'clear',
        // Finance & Wallet
        'finance', 'money', 'expense', 'expenses', 'spent', 'spend', 'spending', 'income',
        'salary', 'budget', 'wallet', 'cost', 'transaction', 'paid', 'rupee', 'rupees', 'rs', '₹',
        'dollar', '$', 'category', 'savings', 'save', 'earn', 'earned',
        'tip', 'tips', 'advice', 'advise', 'recommend', 'recommendation', 'recommendations',
        'market', 'invest', 'investing', 'investment', 'investments', 'stocks', 'portfolio',
        'sip', 'gold', 'wealth', 'inflation', 'emergency fund', 'allocation',
        // Streak & Progress
        'streak', 'consistency', 'record', 'progress', 'tracker', 'flame', 'stats', 'statistics',
        // App settings, navigation & commands
        'theme', 'dark mode', 'light mode', 'dark theme', 'light theme', 'settings', 'sync',
        'backup', 'export', 'home', 'dashboard', 'navigate', 'go to', 'open', 'who are you',
        'what can you do', 'help', 'aura', 'assistant', 'bot', 'hi', 'hello', 'hey', 'good morning',
        'good afternoon', 'good evening', 'thanks', 'thank you', 'clear chat', 'what is this app'
    ];

    const hasDomainKeyword = domainKeywords.some(kw => q.includes(kw));
    if (hasDomainKeyword) return true;

    // Check for patterns like amounts with currencies
    if (/(?:₹|\$|rs\.?)\s*\d+|\d+\s*(?:rs|rupees|dollars|inr|usd)/i.test(q)) return true;

    // Check for time patterns like "at 3pm", "from 10 to 11"
    if (/\b(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i.test(q)) return true;

    // If strictly unrelated (e.g. "who is napoleon", "write a python script", "translate to french")
    return false;
};

/**
 * Main AI Agent Action Processor
 * Executes real state operations and returns formatted messages with action metadata.
 */
export const processAgentMessage = async (userMessage) => {
    const raw = (userMessage || '').trim();
    const lower = raw.toLowerCase();

    // 1. Guardrail Check
    if (!isApplicationRelevant(lower)) {
        return {
            text: `⚠️ **Application Guardrail Notice**\n\nI am **Aura**, your personal productivity and workspace agent. I am designed **strictly for this application only** and cannot assist with external topics or general knowledge queries.\n\nHere are some of the things I can do for you right now:\n\n• 📅 **Tasks:** *"What tasks do I have today?"* or *"Add task: Deep Work at 10am to 12pm"*\n• 💰 **Finances:** *"Log expense of ₹350 for Groceries"* or *"How much did I spend this month?"*\n• 🔥 **Streak:** *"What is my current streak?"*\n• 🎨 **Theme:** *"Switch to light theme"* or *"Switch to dark theme"*\n• 🧭 **Navigation:** *"Take me to Routine"* or *"Go to Finance"*`,
            action: null,
            isGuardrail: true,
        };
    }

    // 2. Greetings & Persona introduction
    if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)\b/i.test(lower) && !/(task|expense|income|streak|theme|routine|finance)/.test(lower)) {
        const tasks = getStoredRoutineTasks();
        const todayStr = getRelativeDate(0);
        const todayTasks = tasks.filter(t => t.date === todayStr);
        const streakInfo = calculateStreakStats(tasks);

        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        const userName = 'there';

        return {
            text: `👋 **${timeGreeting}, ${userName}!**\n\nI am **Aura**, your personal AI assistant for **Progress & Productivity**.\n\n📊 **Your Quick Workspace Snapshot:**\n• **Today's Tasks:** ${todayTasks.length} scheduled (${todayTasks.filter(t => t.completed).length} completed)\n• **Consistency Streak:** ${streakInfo.currentStreak} days 🔥 (Best: ${streakInfo.maxStreak})\n\nHow can I help you right now? Try asking:\n- *"What's on my schedule today?"*\n- *"Add task: React practice at 4pm"*\n- *"Log an expense of ₹250 for Coffee"*\n- *"How much have I spent this month?"*`,
            action: null,
        };
    }

    // 3. App Help & Capabilities
    if (/^(help|what can you do|who are you|features|commands|capabilities)\b/i.test(lower)) {
        return {
            text: `🤖 **Aura • Personal Productivity Agent**\n\nI am your in-app assistant with direct access to your routines, wallet, and workspace:\n\n### 📅 Routine & Task Management\n• **Check Schedule:** *"What are my tasks today?"*, *"Show tomorrow's routine"*\n• **Add Task:** *"Add task: Team Meeting at 11am to 12pm"*, *"Schedule Gym tomorrow at 6:30am"*\n• **Complete Task:** *"Mark meeting as done"*, *"Complete gym task"*\n• **Uncomplete Task:** *"Uncheck standup"*\n• **Delete Task:** *"Delete task Project Review"*\n• **Templates:** *"Load working schedule"*, *"Load holiday schedule"*\n• **Clear Completed:** *"Clear completed tasks for today"*\n\n### 💰 Finance & Wallet Tracking\n• **Log Expense:** *"Spent ₹450 on Dining Out"*, *"Log expense 1200 for Groceries"*\n• **Log Income:** *"Add income ₹50000 for Salary"*, *"Received ₹3000 for Freelance"*\n• **Summary & Budget:** *"How much have I spent this month?"*, *"Give me a budget check"*\n• **Add Category:** *"Add finance category Subscriptions"*\n\n### 🔥 Streak & Workspace Controls\n• **Streak:** *"What is my current streak?"*, *"Show streak details"*\n• **Theme:** *"Switch to light mode"*, *"Switch to dark mode"*\n• **Navigation:** *"Take me to routine"*, *"Open finance"*, *"Go home"*\n• **Backup:** *"Export my data backup"*`,
            action: null,
        };
    }

    // 4. NAVIGATION COMMANDS
    if (/(?:go to|take me to|navigate to|open|show me)\s+(home|routine|planner|finance|wallet|settings|preferences)/i.test(lower)) {
        const dest = lower.match(/(home|routine|planner|finance|wallet|settings|preferences)/i)?.[1];
        let targetPath = '/';
        let pageName = 'Dashboard Home';

        if (dest === 'routine' || dest === 'planner') {
            targetPath = '/routine';
            pageName = 'Routine Planner';
        } else if (dest === 'finance' || dest === 'wallet') {
            targetPath = '/finance';
            pageName = 'Finance & Wallet';
        } else if (dest === 'settings' || dest === 'preferences') {
            targetPath = '/settings';
            pageName = 'Settings';
        }

        return {
            text: `🚀 Navigating you to **${pageName}**...`,
            action: { type: 'navigate', path: targetPath, label: `Go to ${pageName}` },
        };
    }

    // 5. THEME TOGGLE / SWITCH
    if (/theme|dark mode|light mode|dark theme|light theme/i.test(lower) && /(switch|toggle|change|set|turn|enable|activate|make)/i.test(lower)) {
        const currentTheme = getStoredTheme();
        let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        if (lower.includes('light')) newTheme = 'light';
        if (lower.includes('dark')) newTheme = 'dark';

        setStoredTheme(newTheme);
        emitWorkspaceChange({ type: 'theme', theme: newTheme });

        return {
            text: `🎨 Theme switched to **${newTheme === 'dark' ? 'Dark Mode 🌙' : 'Light Mode ☀️'}**!`,
            action: { type: 'theme_changed', theme: newTheme },
        };
    }

    // 6. STREAK QUERIES
    if (/streak|consistency|consecutive days|record/i.test(lower)) {
        const allTasks = getStoredRoutineTasks();
        const { currentStreak, maxStreak } = calculateStreakStats(allTasks);

        return {
            text: `🔥 **Consistency Log & Streak**\n\n• **Current Streak:** **${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}** 🔥\n• **All-Time Record:** **${maxStreak} ${maxStreak === 1 ? 'day' : 'days'}** 🏆\n\n💡 *Tip: To build and keep your streak, complete 100% of your scheduled tasks for the day.*`,
            action: {
                type: 'streak_info',
                currentStreak,
                maxStreak,
                buttonText: 'Open Consistency Calendar',
            },
        };
    }

    // 7. TASK: LOAD TEMPLATES
    if (/template/i.test(lower) && /(working|work|holiday|weekend)/i.test(lower)) {
        const isWorking = /work|working/.test(lower);
        const targetDate = parseDateString(lower);
        const templateType = isWorking ? 'working' : 'holiday';

        const templateData = isWorking ? [
            { title: 'Morning Routine & Breakfast', start: '07:00', end: '08:30', color: '#f97316' },
            { title: 'Deep Work Session', start: '09:00', end: '12:00', color: '#3b82f6' },
            { title: 'Lunch & Walk', start: '12:00', end: '13:00', color: '#10b981' },
            { title: 'Meetings & Admin', start: '13:00', end: '17:00', color: '#8b5cf6' },
        ] : [
            { title: 'Sleep In & Relax', start: '09:00', end: '11:00', color: '#ec4899' },
            { title: 'Hobbies / Gaming', start: '11:00', end: '15:00', color: '#14b8a6' },
            { title: 'Movie Night', start: '19:00', end: '22:00', color: '#f43f5e' },
        ];

        const allTasks = getStoredRoutineTasks();
        const existingDayTasks = allTasks.filter(t => t.date === targetDate);

        const newTasks = templateData.map((t, index) => ({
            id: Date.now() + index,
            date: targetDate,
            order: existingDayTasks.length + index,
            title: t.title,
            start: t.start,
            end: t.end,
            color: t.color,
            completed: false,
        }));

        const updatedTasks = [...allTasks, ...newTasks];
        setStoredRoutineTasks(updatedTasks);
        emitWorkspaceChange({ type: 'routine', action: 'load_template', date: targetDate });

        return {
            text: `✅ Loaded **${isWorking ? 'Working Schedule' : 'Holiday Schedule'}** template (${newTasks.length} tasks) for **${targetDate}**!\n\n${newTasks.map(t => `• **${t.title}** (${t.start} - ${t.end})`).join('\n')}`,
            action: { type: 'template_loaded', count: newTasks.length, date: targetDate, path: '/routine' },
        };
    }

    // 8. TASK: COMPLETE / MARK DONE
    if (/(?:mark|set|check|complete|done|finish)\s+(?:task\s+)?(.+?)(?:\s+as\s+(?:done|completed|finished)|\s+done|\s+finished)?$/i.test(lower) && !lower.startsWith('add') && !lower.startsWith('log') && !lower.startsWith('how')) {
        let matchTerm = lower
            .replace(/^(?:mark|set|check|complete|done|finish)\s+(?:task\s+)?/i, '')
            .replace(/\s+(?:as\s+(?:done|completed|finished)|done|finished)$/i, '')
            .trim();

        const targetDate = parseDateString(lower);
        const allTasks = getStoredRoutineTasks();

        // Search among tasks on target date, or any pending task matching name
        let targetTask = allTasks.find(t => t.date === targetDate && t.title.toLowerCase().includes(matchTerm));
        if (!targetTask) {
            targetTask = allTasks.find(t => t.title.toLowerCase().includes(matchTerm) && !t.completed);
        }
        if (!targetTask) {
            targetTask = allTasks.find(t => t.title.toLowerCase().includes(matchTerm));
        }

        if (targetTask) {
            const updated = allTasks.map(t => t.id === targetTask.id ? { ...t, completed: true } : t);
            setStoredRoutineTasks(updated);
            emitWorkspaceChange({ type: 'routine', action: 'toggle_task', id: targetTask.id });

            const streak = calculateStreakStats(updated);
            return {
                text: `🎉 Marked task **"${targetTask.title}"** as **completed**! ✓\n\nYour current streak is **${streak.currentStreak} days** 🔥`,
                action: { type: 'task_completed', task: targetTask, path: '/routine' },
            };
        }
    }

    // 9. TASK: UNCOMPLETE / UNCHECK
    if (/(?:uncheck|uncomplete|mark\s+(?:as\s+)?(?:incomplete|pending|not\s+done))\s+(?:task\s+)?(.+)/i.test(lower)) {
        let matchTerm = lower
            .replace(/(?:uncheck|uncomplete|mark\s+(?:as\s+)?(?:incomplete|pending|not\s+done))\s+(?:task\s+)?/i, '')
            .trim();

        const allTasks = getStoredRoutineTasks();
        const targetTask = allTasks.find(t => t.title.toLowerCase().includes(matchTerm) && t.completed);

        if (targetTask) {
            const updated = allTasks.map(t => t.id === targetTask.id ? { ...t, completed: false } : t);
            setStoredRoutineTasks(updated);
            emitWorkspaceChange({ type: 'routine', action: 'toggle_task', id: targetTask.id });

            return {
                text: `↩️ Marked task **"${targetTask.title}"** as **pending**.`,
                action: { type: 'task_uncompleted', task: targetTask, path: '/routine' },
            };
        }
    }

    // 10. TASK: DELETE TASK
    if (/(?:delete|remove|erase|drop)\s+task\s+(.+)/i.test(lower)) {
        const matchTerm = lower.replace(/(?:delete|remove|erase|drop)\s+task\s+/i, '').trim();
        const allTasks = getStoredRoutineTasks();
        const targetTask = allTasks.find(t => t.title.toLowerCase().includes(matchTerm));

        if (targetTask) {
            const updated = allTasks.filter(t => t.id !== targetTask.id);
            setStoredRoutineTasks(updated);
            emitWorkspaceChange({ type: 'routine', action: 'delete_task', id: targetTask.id });

            return {
                text: `🗑️ Deleted task **"${targetTask.title}"** for date ${targetTask.date}.`,
                action: { type: 'task_deleted', task: targetTask, path: '/routine' },
            };
        } else {
            return {
                text: `🔍 Could not find a task matching **"${matchTerm}"** to delete.`,
                action: null,
            };
        }
    }

    // 11. TASK: CLEAR COMPLETED TASKS
    if (/clear\s+(?:all\s+)?completed\s+tasks/i.test(lower)) {
        const targetDate = parseDateString(lower);
        const allTasks = getStoredRoutineTasks();
        const remaining = allTasks.filter(t => !(t.date === targetDate && t.completed));
        const deletedCount = allTasks.length - remaining.length;

        setStoredRoutineTasks(remaining);
        emitWorkspaceChange({ type: 'routine', action: 'clear_completed', count: deletedCount });

        return {
            text: `🧹 Cleared **${deletedCount}** completed task${deletedCount === 1 ? '' : 's'} for **${targetDate}**.`,
            action: { type: 'tasks_cleared', count: deletedCount, path: '/routine' },
        };
    }

    // 12. TASK: ADD TASK
    if (/(?:add|create|schedule|set|insert|new)\s+task\b/i.test(lower) || (/(?:schedule|plan)\s+/i.test(lower) && !lower.includes('template'))) {
        const targetDate = parseDateString(lower);

        // Extract times: e.g. "at 10am to 11am", "from 14:00 to 15:30", "at 3pm"
        let startTime = '';
        let endTime = '';

        const fromToMatch = lower.match(/(?:from|at)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(?:to|until|-)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
        if (fromToMatch) {
            startTime = parseTimeString(fromToMatch[1]);
            endTime = parseTimeString(fromToMatch[2]);
        } else {
            const atMatch = lower.match(/(?:at|for|around)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
            if (atMatch) {
                startTime = parseTimeString(atMatch[1]);
            }
        }

        // Clean up title
        let taskTitle = raw
            .replace(/^(?:can you\s+)?(?:please\s+)?(?:add|create|schedule|set|insert|new)\s+(?:a\s+)?task(?:\s*[:-])?\s*/i, '')
            .replace(/^(?:schedule|plan)\s+/i, '')
            .replace(/(?:from|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s+(?:to|until|-)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i, '')
            .replace(/(?:at|for|around)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i, '')
            .replace(/\b(?:today|tomorrow|yesterday|on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!taskTitle) taskTitle = 'New Activity';

        const allTasks = getStoredRoutineTasks();
        const dayTasks = allTasks.filter(t => t.date === targetDate);
        const color = pickTaskColor(taskTitle);

        const newTask = {
            id: Date.now(),
            date: targetDate,
            order: dayTasks.length,
            title: taskTitle,
            start: startTime,
            end: endTime,
            color,
            completed: false,
        };

        const updatedTasks = [...allTasks, newTask];
        setStoredRoutineTasks(updatedTasks);
        emitWorkspaceChange({ type: 'routine', action: 'add_task', task: newTask });

        const timeDisplay = startTime ? (endTime ? ` from ${startTime} to ${endTime}` : ` at ${startTime}`) : '';
        return {
            text: `✅ **Task Added Successfully!**\n\n📌 **${newTask.title}**\n📅 **Date:** ${targetDate}${timeDisplay ? `\n⏰ **Time:** ${timeDisplay}` : ''}\n🎨 **Color Tag:** \`${color}\``,
            action: { type: 'task_added', task: newTask, path: '/routine' },
        };
    }

    // 13. TASK: LIST / QUERY TASKS
    if (/task|schedule|routine|todo|to-do|what.*today|what.*tomorrow/i.test(lower) && !/(spent|expense|income|budget)/.test(lower)) {
        const targetDate = parseDateString(lower);
        const allTasks = getStoredRoutineTasks();
        const dayTasks = allTasks
            .filter(t => t.date === targetDate)
            .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

        const total = dayTasks.length;
        const completed = dayTasks.filter(t => t.completed).length;
        const pending = total - completed;
        const dateLabel = targetDate === getRelativeDate(0) ? 'Today' : (targetDate === getRelativeDate(1) ? 'Tomorrow' : targetDate);

        if (total === 0) {
            return {
                text: `📅 **Schedule for ${dateLabel} (${targetDate})**\n\nYou currently have **0 tasks scheduled**. Would you like me to add one, or load a daily template?`,
                action: { type: 'view_routine', date: targetDate, path: '/routine' },
            };
        }

        const taskListStr = dayTasks.map(t => {
            const check = t.completed ? '✅' : '⏳';
            const time = t.start ? ` [${t.start}${t.end ? ` - ${t.end}` : ''}]` : '';
            return `${check} **${t.title}**${time}`;
        }).join('\n');

        return {
            text: `📋 **Schedule for ${dateLabel} (${targetDate}):**\n\n${taskListStr}\n\n📊 **Progress:** ${completed}/${total} completed (${pending} pending remaining)`,
            action: { type: 'view_routine', count: total, date: targetDate, path: '/routine' },
        };
    }

    // 14. FINANCE: ADD EXPENSE
    if (/(?:log|add|record|spent|spend|paid|buy|bought)\s+(?:an?\s+)?expense\b/i.test(lower) || /(?:spent|paid|bought)\s+(?:₹|\$|rs\.?)?\s*\d+/i.test(lower)) {
        // Extract amount: e.g. "₹250", "500", "1250 rs"
        const amountMatch = lower.match(/(?:₹|\$|rs\.?)\s*(\d+(?:\.\d{1,2})?)|\b(\d+(?:\.\d{1,2})?)\s*(?:rs|rupees|dollars|bucks|inr)?/i);
        const rawAmount = amountMatch ? (amountMatch[1] || amountMatch[2]) : null;
        const amount = rawAmount ? parseFloat(rawAmount) : null;

        if (!amount || isNaN(amount)) {
            return {
                text: `❓ Could not determine the expense amount. Please specify e.g., *"Log expense of ₹350 for Groceries"*.`,
                action: null,
            };
        }

        const targetDate = parseDateString(lower);

        // Extract category/description: e.g. "for groceries", "on dining out", "for coffee"
        let categoryDesc = 'Groceries';
        const forMatch = lower.match(/(?:for|on|desc|category)\s+([a-zA-Z0-9\s/]+?)(?:\s+(?:today|tomorrow|yesterday|\d{4}-\d{2}-\d{2}))?$/i);
        if (forMatch && forMatch[1]) {
            categoryDesc = mapFinanceCategory(forMatch[1].trim());
        }

        const allFinances = getStoredFinances();
        const newTransaction = {
            id: Date.now(),
            type: 'expense',
            amount,
            desc: categoryDesc,
            date: targetDate,
            monthlyEstimate: false,
        };

        const updated = [...allFinances, newTransaction];
        setStoredFinances(updated);
        emitWorkspaceChange({ type: 'finance', action: 'add_expense', transaction: newTransaction });

        // Calculate this month's expense total
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        const monthExpense = updated
            .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === thisMonth && new Date(t.date).getFullYear() === thisYear)
            .reduce((sum, t) => sum + t.amount, 0);

        return {
            text: `💸 **Expense Logged Successfully!**\n\n• **Amount:** -₹${amount.toFixed(2)}\n• **Category:** ${categoryDesc}\n• **Date:** ${targetDate}\n\n📊 Total spent this month so far: **₹${monthExpense.toFixed(2)}**`,
            action: { type: 'expense_logged', transaction: newTransaction, path: '/finance' },
        };
    }

    // 15. FINANCE: ADD INCOME
    if (/(?:log|add|record|receive|received|earned|got)\s+(?:an?\s+)?income\b/i.test(lower) || /(?:salary|income)\s+(?:of\s+)?(?:₹|\$|rs\.?)?\s*\d+/i.test(lower)) {
        const amountMatch = lower.match(/(?:₹|\$|rs\.?)\s*(\d+(?:\.\d{1,2})?)|\b(\d+(?:\.\d{1,2})?)\s*(?:rs|rupees|dollars|inr)?/i);
        const rawAmount = amountMatch ? (amountMatch[1] || amountMatch[2]) : null;
        const amount = rawAmount ? parseFloat(rawAmount) : null;

        if (!amount || isNaN(amount)) {
            return {
                text: `❓ Could not determine the income amount. Please specify e.g., *"Log income of ₹45000 for Salary"*.`,
                action: null,
            };
        }

        const targetDate = parseDateString(lower);
        let categoryDesc = 'Salary';
        const forMatch = lower.match(/(?:from|for|desc|source)\s+([a-zA-Z0-9\s/]+?)(?:\s+(?:today|tomorrow|yesterday|\d{4}-\d{2}-\d{2}))?$/i);
        if (forMatch && forMatch[1]) {
            categoryDesc = mapFinanceCategory(forMatch[1].trim());
        }

        const allFinances = getStoredFinances();
        const newTransaction = {
            id: Date.now(),
            type: 'income',
            amount,
            desc: categoryDesc,
            date: targetDate,
            monthlyEstimate: false,
        };

        const updated = [...allFinances, newTransaction];
        setStoredFinances(updated);
        emitWorkspaceChange({ type: 'finance', action: 'add_income', transaction: newTransaction });

        return {
            text: `💰 **Income Logged Successfully!**\n\n• **Amount:** +₹${amount.toFixed(2)}\n• **Source/Category:** ${categoryDesc}\n• **Date:** ${targetDate}`,
            action: { type: 'income_logged', transaction: newTransaction, path: '/finance' },
        };
    }

    // 16. FINANCE: ADD CUSTOM CATEGORY
    if (/(?:add|create)\s+(?:finance\s+)?category\s+(.+)/i.test(lower)) {
        const catName = raw.replace(/(?:add|create)\s+(?:finance\s+)?category\s+/i, '').trim();
        if (catName) {
            const currentCats = getStoredFinanceCategories();
            if (!currentCats.includes(catName)) {
                const updatedCats = [...currentCats, catName];
                setStoredFinanceCategories(updatedCats);
                emitWorkspaceChange({ type: 'finance', action: 'add_category', category: catName });

                return {
                    text: `🏷️ Added new finance category: **"${catName}"**! You can now log transactions under this category.`,
                    action: { type: 'category_added', category: catName, path: '/finance' },
                };
            } else {
                return {
                    text: `ℹ️ Category **"${catName}"** already exists in your workspace.`,
                    action: null,
                };
            }
        }
    }

    // 17. FINANCE: DELETE TRANSACTION
    if (/(?:delete|remove)\s+(?:transaction|expense|income)\s+(.+)/i.test(lower)) {
        const matchTerm = lower.replace(/(?:delete|remove)\s+(?:transaction|expense|income)\s+/i, '').trim();
        const allFinances = getStoredFinances();
        const target = allFinances.find(t => t.desc.toLowerCase().includes(matchTerm) || String(t.amount).includes(matchTerm));

        if (target) {
            const updated = allFinances.filter(t => t.id !== target.id);
            setStoredFinances(updated);
            emitWorkspaceChange({ type: 'finance', action: 'delete_transaction', id: target.id });

            return {
                text: `🗑️ Removed transaction: **${target.type.toUpperCase()} ₹${formatAmount(target.amount)}** (${target.desc}) on ${target.date}.`,
                action: { type: 'transaction_deleted', transaction: target, path: '/finance' },
            };
        } else {
            return {
                text: `🔍 Could not find a transaction matching **"${matchTerm}"** to delete.`,
                action: null,
            };
        }
    }

    // 17.5. PERSONAL FINANCIAL AGENT & REAL-MARKET RECOMMENDATIONS
    if (/tip|advice|advise|recommend|market|invest|investing|investment|wealth|inflation|portfolio|stock|mutual fund|emergency fund|growth plan|save more|savings guide|financial plan/i.test(lower)) {
        const allFinances = getStoredFinances();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let totalIncome = 0;
        let totalExpense = 0;
        const categoryMap = {};

        allFinances.forEach(t => {
            const d = new Date(t.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                if (t.type === 'income') {
                    totalIncome += t.amount;
                } else {
                    totalExpense += t.amount;
                    categoryMap[t.desc] = (categoryMap[t.desc] || 0) + t.amount;
                }
            }
        });

        const netSavings = totalIncome - totalExpense;
        const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
        const topCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
        const highestSpend = topCategories[0] || null;

        // Suggested investment allocations based on real income or benchmark
        const benchmarkIncome = totalIncome > 0 ? totalIncome : 50000;
        const monthlySipRec = Math.round(benchmarkIncome * 0.20);
        const discretionaryTrim = highestSpend ? Math.round(highestSpend[1] * 0.20) : Math.round(benchmarkIncome * 0.05);

        // Compounding calculation: 15% discretionary trim invested in Nifty/S&P 500 at 12% CAGR over 5 & 10 years
        const r = 0.12 / 12;
        const n5 = 60;
        const n10 = 120;
        const futureVal5 = Math.round(discretionaryTrim * ((Math.pow(1 + r, n5) - 1) / r) * (1 + r));
        const futureVal10 = Math.round(discretionaryTrim * ((Math.pow(1 + r, n10) - 1) / r) * (1 + r));

        let statusBrief = '';
        if (totalIncome === 0) {
            statusBrief = `ℹ️ *Currently you haven't logged monthly income yet (using ₹50,000 standard market benchmark for projections). Log your income anytime for exact real-time calibration!*`;
        } else if (savingsRate >= 30) {
            statusBrief = `🔥 **Stellar Financial Position:** You are saving **${savingsRate}%** (₹${netSavings.toFixed(0)}) of your income this month! You are prime for aggressive wealth compounding.`;
        } else if (savingsRate >= 15) {
            statusBrief = `👍 **Solid Baseline:** You are saving **${savingsRate}%** (₹${netSavings.toFixed(0)}). With smart market allocations, you can easily accelerate toward financial independence.`;
        } else {
            statusBrief = `⚠️ **Cashflow Alert:** Your monthly burn rate is high (saving only ${savingsRate}% or running a deficit of ₹${Math.abs(netSavings).toFixed(0)}). Immediate discretionary optimization is recommended.`;
        }

        const text = `📊 **Personal Market Advisory • Aura Wealth Intelligence**

${statusBrief}

---

### 🏛️ Real-Market Financial Strategy & Action Plan

1. **🛡️ Emergency Shield (Beat Inflation • 3–6 Months Reserves)**
   • **Target:** Accumulate ₹${formatAmount(benchmarkIncome * 3)} – ₹${formatAmount(benchmarkIncome * 6)} in liquid reserves.
   • **Real Market Tip:** Do **not** park emergency funds in low-yield regular savings accounts (2.7%–3.0%) where ~5.5% CPI inflation erodes value. Utilize **Liquid Mutual Funds** or **Sweep-in / Flexi-FDs** yielding **6.8%–7.4% p.a.** with T+1 instant liquidity.

2. **📈 Systematic Wealth Compounding (Broad-Market Equity SIP)**
   • **Recommended Allocation:** 15%–20% of income (**₹${formatAmount(monthlySipRec)}/month**).
   • **Real Market Tip:** Focus on ultra-low-cost index funds (**Nifty 50 Index / S&P 500 ETFs**, expense ratio < 0.15%). Historically, broad-market index SIPs yield **12%–14% CAGR**, doubling invested capital approximately every 5.5 to 6 years.

3. **🪙 Market Volatility & Currency Hedge (Gold Allocation)**
   • **Target:** 5%–10% of total savings portfolio.
   • **Real Market Tip:** Opt for **Sovereign Gold Bonds (SGBs)** or **Gold ETFs** over physical gold. SGBs provide **2.5% additional annual interest** plus tax-free capital gains on maturity, shielding your wealth against currency depreciation.

4. **✂️ Discretionary Trim Multiplier**
   ${highestSpend ? `• Your largest spending category this month is **${highestSpend[0]}** (₹${formatAmount(highestSpend[1])}).` : `• Trimming everyday non-essential expenditures by just 15%.`}
   • If you redirect just **₹${formatAmount(discretionaryTrim)}/month** (a 15% trim) into a 12% CAGR equity SIP:
     - 🚀 In **5 Years:** Compounds to **₹${formatAmount(futureVal5)}**
     - 💎 In **10 Years:** Compounds to **₹${formatAmount(futureVal10)}**

5. **⚖️ Recommended 40 / 30 / 20 / 10 Balanced Rule**
   • **40% Housing & EMIs:** ₹${formatAmount(benchmarkIncome * 0.40)} max
   • **30% Essentials & Living:** ₹${formatAmount(benchmarkIncome * 0.30)}
   • **20% Wealth & Equity SIP:** ₹${formatAmount(benchmarkIncome * 0.20)}
   • **10% Liquid Cushion / Giving:** ₹${formatAmount(benchmarkIncome * 0.10)}

Would you like me to take you to your **Finance Dashboard** or help you log an income or investment?`;

        return {
            text,
            action: {
                type: 'navigate',
                path: '/finance',
                label: 'Open Finance & 40/30/20/10 Plan',
            },
        };
    }

    // 18. FINANCE: SUMMARY / SPENT QUERY / BUDGET CHECK
    if (/finance|wallet|spent|expense|income|budget|balance|savings/i.test(lower)) {
        const allFinances = getStoredFinances();
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        let totalIncome = 0;
        let totalExpense = 0;
        const categoryMap = {};

        allFinances.forEach(t => {
            const d = new Date(t.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                if (t.type === 'income') {
                    totalIncome += t.amount;
                } else {
                    totalExpense += t.amount;
                    categoryMap[t.desc] = (categoryMap[t.desc] || 0) + t.amount;
                }
            }
        });

        const netSavings = totalIncome - totalExpense;
        const sortedCats = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

        let breakdownStr = '';
        if (sortedCats.length > 0) {
            breakdownStr = `\n\n📌 **Top Spending Categories:**\n` + sortedCats.slice(0, 4).map(([cat, amt]) => `• **${cat}:** ₹${amt.toFixed(2)} (${totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0}%)`).join('\n');
        }

        let adviceStr = '';
        if (totalIncome > 0 && totalExpense > totalIncome) {
            adviceStr = `\n\n⚠️ **Budget Alert:** Your spending exceeds your income this month by ₹${(totalExpense - totalIncome).toFixed(2)}. Consider reviewing discretionary expenses!`;
        } else if (totalIncome > 0) {
            const saveRate = Math.round((netSavings / totalIncome) * 100);
            adviceStr = `\n\n💡 **Savings Rate:** You are currently saving **${saveRate}%** of your monthly income. Keep it up!`;
        }

        return {
            text: `💰 **Financial Overview (${monthNames[currentMonth]} ${currentYear})**\n\n• **Total Income:** +₹${totalIncome.toFixed(2)}\n• **Total Expenses:** -₹${totalExpense.toFixed(2)}\n• **Net Balance:** **${netSavings >= 0 ? '+' : '-'}₹${Math.abs(netSavings).toFixed(2)}**${breakdownStr}${adviceStr}`,
            action: { type: 'finance_summary', totalIncome, totalExpense, netSavings, path: '/finance' },
        };
    }

    // 19. BACKUP / EXPORT
    if (/backup|export/i.test(lower)) {
        return {
            text: `💾 You can download a complete JSON backup of your workspace anytime from the **Settings** page, or I can take you there right now!`,
            action: { type: 'navigate', path: '/settings', label: 'Go to Settings' },
        };
    }

    // 19.5 Personal Gemini API Fallback (if user configured their personal key)
    const customKey = getCustomGeminiApiKey();
    if (customKey) {
        try {
            const geminiReply = await callGoogleGeminiDirect(raw, customKey);
            if (geminiReply) {
                return {
                    text: `✨ **Gemini Intelligence (Personal API)**\n\n${geminiReply}`,
                    action: null,
                };
            }
        } catch (apiErr) {
            console.warn('Personal Gemini API call failed, falling back to local engine:', apiErr);
        }
    }

    // 20. FALLBACK: Clarify with supported application actions
    return {
        text: `🤔 I didn't quite catch how to apply that to your workspace. As your **Progress & Productivity Assistant**, here is what I can do:\n\n• 📅 **Tasks:** *"What tasks do I have today?"* or *"Add task: Reading at 8pm"*\n• 💰 **Finances:** *"Log expense of ₹200 for Groceries"* or *"How much have I spent this month?"*\n• 🔥 **Streak:** *"What is my current streak?"*\n• 🎨 **Theme:** *"Switch to light mode"*\n• 🧭 **Navigation:** *"Take me to Routine"*`,
        action: null,
    };
};
