import { useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
    Droplets,
    Dumbbell,
    BookOpen,
    Heart,
    Briefcase,
    Utensils,
    Smile,
    Clock,
    ChevronLeft,
    ChevronRight,
    Plus,
    Check,
    MoreVertical,
    Sparkles,
    Flame,
    Trash2,
    Calendar as CalendarIcon,
    X,
    Filter,
    RotateCcw,
    Zap,
    Coffee,
    Lock,
    AlertTriangle
} from 'lucide-react';
import { AuthContext } from '../context/AuthState';
import {
    subscribeWorkspaceChange,
    emitWorkspaceChange,
    getStoredRoutineTasks,
    setStoredRoutineTasks,
    calculateStreakStats
} from '../utils/workspaceEvents';

// Local date format helper (YYYY-MM-DD) avoiding timezone skew
export const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Smart Category & Icon Detection
export const getTaskCategoryMeta = (title = '', customColor) => {
    const t = title.toLowerCase();
    if (/water|drink|hydrate|hydration|fluid|glass/i.test(t)) {
        return { icon: Droplets, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', label: 'Hydration' };
    }
    if (/exercise|workout|gym|run|walk|yoga|cardio|fitness|stretch|training/i.test(t)) {
        return { icon: Dumbbell, color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', label: 'Fitness' };
    }
    if (/read|book|study|learn|class|course|homework|pages/i.test(t)) {
        return { icon: BookOpen, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', label: 'Learning' };
    }
    if (/brush|floss|meditat|sleep|nap|rest|teeth|shower|skin|routine|health/i.test(t)) {
        return { icon: Heart, color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', label: 'Health' };
    }
    if (/work|meeting|project|code|client|office|review|email|call|admin|focus/i.test(t)) {
        return { icon: Briefcase, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', label: 'Work' };
    }
    if (/eat|food|breakfast|lunch|dinner|snack|cook|meal|coffee|tea|nutrition/i.test(t)) {
        return { icon: Utensils, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Nutrition' };
    }
    return { icon: Sparkles, color: customColor || '#6366f1', bg: 'rgba(99, 102, 241, 0.15)', label: 'Habit' };
};

export const getTaskDurationLabel = (start, end) => {
    if (!start && !end) return null;
    if (start && end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const totalMins = (eh * 60 + em) - (sh * 60 + sm);
        if (totalMins > 0) {
            const hrs = Math.floor(totalMins / 60);
            const mins = totalMins % 60;
            if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
            if (hrs > 0) return `${hrs}h`;
            return `${mins}m`;
        }
        return `${start} - ${end}`;
    }
    return start;
};

const QUICK_PRESETS = [
    { title: 'Drink water', start: '08:00', end: '08:30', color: '#38bdf8' },
    { title: 'Do morning exercise', start: '08:30', end: '09:00', color: '#f97316' },
    { title: 'Brush & floss', start: '09:00', end: '09:15', color: '#eab308' },
    { title: 'Read 20 pages', start: '21:00', end: '21:30', color: '#ec4899' },
    { title: 'Deep Work Session', start: '10:00', end: '12:00', color: '#8b5cf6' },
];

export default function RoutineView() {
    const { syncData } = useContext(AuthContext);

    // Current local today reference
    const todayStr = useMemo(() => getLocalDateString(), []);

    // Active selected date and tasks state
    const [tasks, setTasks] = useState(() => getStoredRoutineTasks());
    const [currentDate, setCurrentDate] = useState(() => getLocalDateString());
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'morning' | 'afternoon' | 'evening' | 'completed'

    // Date status
    const isPastDate = currentDate < todayStr;
    const isFutureDate = currentDate > todayStr;
    const isToday = currentDate === todayStr;

    // Toast notification state
    const [toast, setToast] = useState(null);
    const toastTimeoutRef = useRef(null);

    const showToast = (message, type = 'info') => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast({ message, type });
        toastTimeoutRef.current = setTimeout(() => {
            setToast(null);
        }, 3400);
    };

    // Add Task Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newStartTime, setNewStartTime] = useState('');
    const [newEndTime, setNewEndTime] = useState('');
    const [selectedColor, setSelectedColor] = useState('#3b82f6');
    const [selectedCategory, setSelectedCategory] = useState('Fitness');

    // Save tasks to LocalStorage
    useEffect(() => {
        setStoredRoutineTasks(tasks);
    }, [tasks]);

    // Listen for workspace updates from AI Assistant or other views
    useEffect(() => {
        const unsubscribe = subscribeWorkspaceChange(() => {
            setTasks(getStoredRoutineTasks());
        });
        return unsubscribe;
    }, []);

    // Save helper
    const saveTasks = (updatedTasks) => {
        setTasks(updatedTasks);
        setStoredRoutineTasks(updatedTasks);
        void syncData({ routineTasks: updatedTasks });
        emitWorkspaceChange({ type: 'routine' });
    };

    // Toggle Task completion
    // RULE: Cannot complete future tasks before actual date; past tasks cannot be changed.
    const toggleTask = (id) => {
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        if (task.date > todayStr) {
            showToast('Tasks cannot be completed before their actual date.', 'warning');
            return;
        }
        if (task.date < todayStr) {
            showToast('Past tasks cannot be modified.', 'warning');
            return;
        }

        saveTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    // Delete Task
    // RULE: Future & past tasks cannot be modified/deleted once set
    const deleteTask = (id) => {
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        if (task.date < todayStr) {
            showToast('Past tasks cannot be deleted or modified.', 'warning');
            return;
        }
        if (task.date > todayStr) {
            showToast('Scheduled tasks cannot be deleted once set.', 'warning');
            return;
        }

        saveTasks(tasks.filter(t => t.id !== id));
    };

    // Clear Day Tasks
    const clearCurrentDayTasks = () => {
        if (isPastDate) {
            showToast('Past dates are read-only and cannot be modified.', 'warning');
            return;
        }
        if (isFutureDate) {
            showToast('Scheduled future tasks cannot be cleared once set.', 'warning');
            return;
        }
        if (window.confirm('Clear all tasks for today?')) {
            saveTasks(tasks.filter(t => t.date !== currentDate));
        }
    };

    // Load Routine Templates
    // RULE: Templates can only be loaded for today or future dates (planning)
    const loadTemplate = (type) => {
        if (isPastDate) {
            showToast('Past dates cannot be modified. Switch to Today or a future date to plan.', 'warning');
            return;
        }

        const templateData = type === 'working' ? [
            { title: 'Morning Routine & Breakfast', start: '07:00', end: '08:30', color: '#f97316' },
            { title: 'Deep Work Session', start: '09:00', end: '12:00', color: '#3b82f6' },
            { title: 'Lunch & Walk', start: '12:00', end: '13:00', color: '#10b981' },
            { title: 'Meetings & Review', start: '13:00', end: '17:00', color: '#8b5cf6' },
            { title: 'Read & Wind Down', start: '21:30', end: '22:30', color: '#ec4899' }
        ] : [
            { title: 'Sleep In & Relax', start: '09:00', end: '11:00', color: '#ec4899' },
            { title: 'Hobbies & Gaming', start: '11:00', end: '15:00', color: '#14b8a6' },
            { title: 'Outdoor Walk', start: '16:00', end: '17:30', color: '#10b981' },
            { title: 'Movie Night', start: '19:00', end: '22:00', color: '#f43f5e' }
        ];

        const dayTasks = tasks.filter(t => t.date === currentDate);
        const newTasks = templateData.map((t, idx) => ({
            id: Date.now() + idx,
            date: currentDate,
            order: dayTasks.length + idx,
            title: t.title,
            start: t.start,
            end: t.end,
            color: t.color,
            completed: false
        }));

        saveTasks([...tasks, ...newTasks]);
        showToast('Template routine loaded!', 'success');
    };

    // Create New Task
    // RULE: User can set their task for today or future dates; past dates are read-only
    const handleCreateTask = (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        if (isPastDate) {
            showToast('Past dates are read-only. Tasks cannot be added to past dates.', 'warning');
            return;
        }

        const dayTasks = tasks.filter(t => t.date === currentDate);
        const newTask = {
            id: Date.now(),
            date: currentDate,
            order: dayTasks.length,
            title: newTaskTitle.trim(),
            start: newStartTime,
            end: newEndTime,
            color: selectedColor,
            completed: false
        };

        saveTasks([...tasks, newTask]);
        setNewTaskTitle('');
        setNewStartTime('');
        setNewEndTime('');
        setShowAddModal(false);
        showToast(isFutureDate ? 'Task scheduled for future date!' : 'Task added to today\'s routine!', 'success');
    };

    const handleApplyPreset = (preset) => {
        setNewTaskTitle(preset.title);
        setNewStartTime(preset.start);
        setNewEndTime(preset.end);
        setSelectedColor(preset.color);
    };

    // Date navigation helpers
    const changeDateByDays = (days) => {
        const [y, m, d] = currentDate.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setDate(dt.getDate() + days);
        setCurrentDate(getLocalDateString(dt));
    };

    // Generate Date Carousel Strip (Image 2 & 3 style)
    const dateStripDays = useMemo(() => {
        const [y, m, d] = currentDate.split('-').map(Number);
        const center = new Date(y, m - 1, d);
        const list = [];
        const weekdayShort = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

        for (let i = -4; i <= 4; i++) {
            const dt = new Date(center);
            dt.setDate(dt.getDate() + i);
            const dateStr = getLocalDateString(dt);

            // Check completion for that day
            const dayT = tasks.filter(t => t.date === dateStr);
            const isCompleted = dayT.length > 0 && dayT.every(t => t.completed);
            const hasTasks = dayT.length > 0;

            list.push({
                dateStr,
                dayName: weekdayShort[dt.getDay()],
                dayNum: dt.getDate(),
                isToday: dateStr === todayStr,
                isSelected: dateStr === currentDate,
                isPast: dateStr < todayStr,
                isFuture: dateStr > todayStr,
                isCompleted,
                hasTasks
            });
        }
        return list;
    }, [currentDate, tasks, todayStr]);

    // Tasks for the selected date
    const currentDayTasks = useMemo(() => {
        return tasks
            .filter(t => t.date === currentDate)
            .sort((a, b) => {
                if (Number.isInteger(a.order) && Number.isInteger(b.order)) return a.order - b.order;
                if (!a.start) return 1;
                if (!b.start) return -1;
                return a.start.localeCompare(b.start);
            });
    }, [tasks, currentDate]);

    // Filter tasks based on Time of Day (Image 2 style)
    const filteredTasks = useMemo(() => {
        if (activeFilter === 'all') return currentDayTasks;
        if (activeFilter === 'completed') return currentDayTasks.filter(t => t.completed);
        if (activeFilter === 'morning') {
            return currentDayTasks.filter(t => {
                if (!t.start) return true;
                const hour = parseInt(t.start.split(':')[0], 10);
                return hour < 12;
            });
        }
        if (activeFilter === 'afternoon') {
            return currentDayTasks.filter(t => {
                if (!t.start) return false;
                const hour = parseInt(t.start.split(':')[0], 10);
                return hour >= 12 && hour < 17;
            });
        }
        if (activeFilter === 'evening') {
            return currentDayTasks.filter(t => {
                if (!t.start) return false;
                const hour = parseInt(t.start.split(':')[0], 10);
                return hour >= 17;
            });
        }
        return currentDayTasks;
    }, [currentDayTasks, activeFilter]);

    // Progress stats
    const totalCount = currentDayTasks.length;
    const completedCount = currentDayTasks.filter(t => t.completed).length;
    const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    const streakInfo = useMemo(() => calculateStreakStats(tasks), [tasks]);

    // Format current date label e.g. "Today", "Yesterday", "Tomorrow" or "Thu, 22 Oct"
    const displayHeaderDate = useMemo(() => {
        if (currentDate === todayStr) return 'Today';
        const [y, m, d] = currentDate.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }, [currentDate, todayStr]);

    return (
        <div className="routine-page-container">
            {/* FLOATING FEEDBACK TOAST */}
            {toast && (
                <div className={`routine-toast-banner ${toast.type}`}>
                    {toast.type === 'warning' && <AlertTriangle size={16} className="routine-toast-icon" />}
                    {toast.type === 'success' && <Check size={16} className="routine-toast-icon" />}
                    {toast.type === 'info' && <Sparkles size={16} className="routine-toast-icon" />}
                    <span>{toast.message}</span>
                    <button type="button" onClick={() => setToast(null)} className="routine-toast-close" aria-label="Dismiss">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* TOP BAR: DATE NAVIGATION & ACTIONS */}
            <div className="routine-top-header">
                <div className="routine-date-nav-wrap">
                    <button
                        type="button"
                        onClick={() => changeDateByDays(-1)}
                        className="routine-arrow-btn"
                        title="Previous day"
                        aria-label="Previous day"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <h2 className="routine-date-title">{displayHeaderDate}</h2>

                    <button
                        type="button"
                        onClick={() => changeDateByDays(1)}
                        className="routine-arrow-btn"
                        title="Next day"
                        aria-label="Next day"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="routine-header-right-actions">
                    {isPastDate && (
                        <span className="routine-status-pill past" title="Historical records are read-only">
                            <Lock size={12} />
                            <span>Past (Locked)</span>
                        </span>
                    )}
                    {isFutureDate && (
                        <span className="routine-status-pill future" title="Scheduled tasks are locked until this date arrives">
                            <CalendarIcon size={12} />
                            <span>Scheduled</span>
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() => setCurrentDate(todayStr)}
                        className={`routine-today-pill-btn ${isToday ? 'active' : ''}`}
                    >
                        Today
                    </button>

                    {!isPastDate && !isFutureDate && currentDayTasks.length > 0 && (
                        <button
                            type="button"
                            onClick={clearCurrentDayTasks}
                            className="routine-clear-day-btn"
                            title="Clear this day's tasks"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* HORIZONTAL DATE CAROUSEL STRIP (IMAGE 2 & 3 STYLE) */}
            <div className="routine-date-strip-scroll">
                <div className="routine-date-strip">
                    {dateStripDays.map((day) => (
                        <button
                            key={day.dateStr}
                            type="button"
                            onClick={() => setCurrentDate(day.dateStr)}
                            className={`routine-day-card ${day.isSelected ? 'selected' : ''} ${day.isToday ? 'today' : ''} ${day.isPast ? 'past-day' : ''} ${day.isFuture ? 'future-day' : ''}`}
                        >
                            <span className="routine-day-name">{day.dayName}</span>
                            <span className="routine-day-num">{day.dayNum}</span>
                            {day.isCompleted && (
                                <span className="routine-day-indicator completed" title="100% complete">
                                    <Flame size={11} color="#f97316" />
                                </span>
                            )}
                            {!day.isCompleted && day.hasTasks && (
                                <span className="routine-day-indicator partial" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* PROGRESS & STREAK BANNER (IMAGE 3 INSPIRED) */}
            <div className="routine-progress-banner">
                <div className="routine-progress-left">
                    <div className="routine-progress-circle-wrap">
                        <svg className="routine-progress-svg" viewBox="0 0 44 44">
                            <circle
                                className="routine-progress-bg-circle"
                                cx="22"
                                cy="22"
                                r="18"
                            />
                            <circle
                                className="routine-progress-bar-circle"
                                cx="22"
                                cy="22"
                                r="18"
                                strokeDasharray={113}
                                strokeDashoffset={113 - (113 * progressPercent) / 100}
                            />
                        </svg>
                        <div className="routine-progress-inner-text">
                            <span className="routine-progress-number">{progressPercent}%</span>
                        </div>
                    </div>
                </div>

                <div className="routine-progress-center">
                    <h3>{totalCount === 0 ? "Plan your day" : `${completedCount} of ${totalCount} completed`}</h3>
                    <p>
                        {totalCount === 0
                            ? isFutureDate
                                ? "Plan upcoming tasks in advance."
                                : isPastDate
                                ? "No tasks were recorded on this day."
                                : "No tasks scheduled for today yet."
                            : isFutureDate
                            ? "Planned tasks will unlock for completion on this date."
                            : isPastDate
                            ? "Historical record preserved."
                            : progressPercent === 100
                            ? "Incredible job! All tasks completed today! 🔥"
                            : "Keep going to build your daily streak."}
                    </p>
                </div>

                <div className="routine-progress-streak-tag">
                    <Flame size={14} color="#f97316" />
                    <span>{streakInfo.currentStreak}d streak</span>
                </div>
            </div>

            {/* TIME-OF-DAY FILTER CHIPS (IMAGE 2 STYLE) */}
            <div className="routine-time-filters">
                <button
                    type="button"
                    onClick={() => setActiveFilter('evening')}
                    className={`routine-filter-chip ${activeFilter === 'evening' ? 'active' : ''}`}
                >
                    Evening
                </button>
                <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`routine-filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
                >
                    All Day
                </button>
                <button
                    type="button"
                    onClick={() => setActiveFilter('morning')}
                    className={`routine-filter-chip ${activeFilter === 'morning' ? 'active' : ''}`}
                >
                    Morning
                </button>
                <button
                    type="button"
                    onClick={() => setActiveFilter('afternoon')}
                    className={`routine-filter-chip ${activeFilter === 'afternoon' ? 'active' : ''}`}
                >
                    Afternoon
                </button>
                {completedCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setActiveFilter('completed')}
                        className={`routine-filter-chip ${activeFilter === 'completed' ? 'active' : ''}`}
                    >
                        Done ({completedCount})
                    </button>
                )}
            </div>

            {/* REQUIREMENT 2: ADD A NEW TASK SHIFTED TO TOP OF TASKS */}
            <div className="routine-add-bar-wrap routine-add-bar-top">
                <button
                    type="button"
                    onClick={() => {
                        if (isPastDate) {
                            showToast('Past dates are read-only. Tasks cannot be added to past dates.', 'warning');
                            return;
                        }
                        setShowAddModal(true);
                    }}
                    className={`routine-add-main-btn ${isPastDate ? 'disabled-past' : ''}`}
                    title={isPastDate ? "Past dates cannot be modified" : "Add a new routine task"}
                >
                    {isPastDate ? <Lock size={18} /> : <Plus size={18} />}
                    <span>
                        {isPastDate
                            ? 'Past Date (History Locked)'
                            : isFutureDate
                            ? 'Schedule task for this day'
                            : 'Add a new task'}
                    </span>
                </button>
            </div>

            {/* TASK CARDS LIST (IMAGE 2 & 3 STYLE) */}
            <div className="routine-tasks-list">
                {filteredTasks.length === 0 ? (
                    <div className="routine-empty-box">
                        <div className="routine-empty-icon">
                            <Sparkles size={32} />
                        </div>
                        <h4>{isPastDate ? "No records on this date" : "No tasks in this view"}</h4>
                        <p>
                            {isPastDate
                                ? "This day has passed without recorded tasks."
                                : "Get started by adding custom routines or loading a preset template below:"}
                        </p>
                        {!isPastDate && (
                            <div className="routine-template-btns">
                                <button
                                    type="button"
                                    onClick={() => loadTemplate('working')}
                                    className="routine-template-btn work"
                                >
                                    <Briefcase size={16} />
                                    <span>Work Routine</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => loadTemplate('holiday')}
                                    className="routine-template-btn holiday"
                                >
                                    <Smile size={16} />
                                    <span>Holiday Routine</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    filteredTasks.map((task) => {
                        const meta = getTaskCategoryMeta(task.title, task.color);
                        const IconComponent = meta.icon;
                        const durationLabel = getTaskDurationLabel(task.start, task.end);

                        return (
                            <div
                                key={task.id}
                                className={`routine-task-card ${task.completed ? 'completed' : ''} ${isFutureDate ? 'future-task-card' : ''} ${isPastDate ? 'past-task-card' : ''}`}
                            >
                                {/* LEFT ICON IN SOFT CIRCLE */}
                                <div
                                    className="routine-task-icon-wrap"
                                    style={{
                                        background: meta.bg,
                                        color: meta.color,
                                    }}
                                >
                                    <IconComponent size={20} />
                                </div>

                                {/* CENTER DETAILS */}
                                <div className="routine-task-details">
                                    <h4 className="routine-task-title">{task.title}</h4>
                                    <div className="routine-task-meta-row">
                                        <span className="routine-task-tag">★ {meta.label}</span>
                                        {task.start && (
                                            <span className="routine-task-time-text">
                                                {task.start}{task.end ? ` - ${task.end}` : ''}
                                            </span>
                                        )}
                                        {isFutureDate && (
                                            <span className="routine-task-lock-tag" title="Cannot complete before actual date">
                                                <Lock size={10} /> Locked until {displayHeaderDate}
                                            </span>
                                        )}
                                        {isPastDate && (
                                            <span className="routine-task-lock-tag past" title="Past record locked">
                                                <Lock size={10} /> Historical
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* RIGHT: DURATION BADGE & CHECK CIRCLE */}
                                <div className="routine-task-right">
                                    {durationLabel && (
                                        <div className="routine-task-duration-badge">
                                            <Clock size={12} />
                                            <span>{durationLabel}</span>
                                        </div>
                                    )}

                                    {/* REQUIREMENT 3: FUTURE/PAST COMPLETION RESTRICTION */}
                                    <button
                                        type="button"
                                        onClick={() => toggleTask(task.id)}
                                        className={`routine-task-check-btn ${task.completed ? 'checked' : ''} ${isFutureDate ? 'future-locked' : ''} ${isPastDate ? 'past-locked' : ''}`}
                                        title={
                                            isFutureDate
                                                ? "Cannot complete before actual date"
                                                : isPastDate
                                                ? "Past records cannot be modified"
                                                : task.completed
                                                ? "Mark incomplete"
                                                : "Mark complete"
                                        }
                                        aria-label="Toggle task completion"
                                    >
                                        {task.completed ? (
                                            <Check size={14} strokeWidth={3} />
                                        ) : isFutureDate ? (
                                            <Lock size={12} className="routine-lock-center" />
                                        ) : isPastDate ? (
                                            <Lock size={12} className="routine-lock-center" />
                                        ) : null}
                                    </button>

                                    {/* REQUIREMENT 3: FUTURE/PAST MODIFICATION RESTRICTION */}
                                    {!isPastDate && !isFutureDate ? (
                                        <button
                                            type="button"
                                            onClick={() => deleteTask(task.id)}
                                            className="routine-task-delete-btn"
                                            title="Delete task"
                                            aria-label="Delete task"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => deleteTask(task.id)}
                                            className="routine-task-delete-btn locked"
                                            title={isPastDate ? "Past tasks cannot be deleted" : "Scheduled tasks cannot be deleted once set"}
                                            aria-label="Locked action"
                                        >
                                            <Lock size={13} style={{ opacity: 0.35 }} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ADD TASK MODAL / SHEET (IMAGE 2 & 3 INSPIRED) */}
            {showAddModal && (
                <div className="routine-modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div
                        className="routine-modal-card"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="routine-modal-header">
                            <h3>{isFutureDate ? `Schedule for ${displayHeaderDate}` : 'Add Routine Task'}</h3>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="routine-modal-close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* QUICK PRESETS CHIPS */}
                        <div className="routine-presets-wrap">
                            <span className="routine-presets-label">Quick Ideas:</span>
                            <div className="routine-presets-row">
                                {QUICK_PRESETS.map((preset, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleApplyPreset(preset)}
                                        className="routine-preset-chip"
                                    >
                                        {preset.title}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={handleCreateTask} className="routine-add-form">
                            <div className="routine-form-field">
                                <label>Task Name</label>
                                <input
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="e.g. Morning Meditation, Study React"
                                    required
                                    autoFocus
                                    className="routine-input-text"
                                />
                            </div>

                            <div className="routine-form-row">
                                <div className="routine-form-field">
                                    <label>Start Time</label>
                                    <input
                                        type="time"
                                        value={newStartTime}
                                        onChange={(e) => setNewStartTime(e.target.value)}
                                        className="routine-input-time"
                                    />
                                </div>
                                <div className="routine-form-field">
                                    <label>End Time</label>
                                    <input
                                        type="time"
                                        value={newEndTime}
                                        onChange={(e) => setNewEndTime(e.target.value)}
                                        className="routine-input-time"
                                    />
                                </div>
                            </div>

                            <div className="routine-form-field">
                                <label>Category Theme Color</label>
                                <div className="routine-color-picker">
                                    {['#38bdf8', '#f97316', '#ec4899', '#eab308', '#8b5cf6', '#10b981', '#6366f1'].map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            className={`routine-color-dot ${selectedColor === c ? 'selected' : ''}`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => setSelectedColor(c)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="routine-modal-actions">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="routine-btn-cancel"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="routine-btn-submit"
                                >
                                    {isFutureDate ? 'Schedule Task' : 'Add to Routine'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}