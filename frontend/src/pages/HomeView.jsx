import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import {
    Flame,
    Check,
    Clock,
    Plus,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet,
    Calendar,
    Sparkles,
    Briefcase,
    TrendingUp,
    ChevronRight,
    ListTodo,
    Quote
} from 'lucide-react';
import { AuthContext } from '../context/AuthState';
import {
    subscribeWorkspaceChange,
    emitWorkspaceChange,
    getStoredRoutineTasks,
    setStoredRoutineTasks,
    getStoredFinances,
    calculateStreakStats
} from '../utils/workspaceEvents';
import { getTaskCategoryMeta, getTaskDurationLabel, getLocalDateString } from './RoutineView';

ChartJS.register(ArcElement, Tooltip, Legend);

const QUOTES = [
    "Success is the sum of small efforts, repeated day in and day out.",
    "Don't watch the clock; do what it does. Keep going.",
    "The secret of getting ahead is getting started.",
    "Your future is created by what you do today, not tomorrow.",
    "Great things are done by a series of small wins brought together."
];

const getRecentActivity = (tasks, endDate = new Date()) => {
    const today = new Date(endDate);
    today.setHours(0, 0, 0, 0);
    const rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - 89);
    const activityByDate = {};
    const firstDate = getLocalDateString(rangeStart);
    const lastDate = getLocalDateString(today);

    tasks.forEach(task => {
        if (!task.date || task.date < firstDate || task.date > lastDate) return;
        const activity = activityByDate[task.date] || { planned: 0, completed: 0 };
        activity.planned += 1;
        if (task.completed) activity.completed += 1;
        activityByDate[task.date] = activity;
    });

    return activityByDate;
};

export default function HomeView() {
    const { user, syncData } = useContext(AuthContext);
    const [dailyQuote, setDailyQuote] = useState(QUOTES[0]);

    // Active local date
    const todayStr = useMemo(() => getLocalDateString(), []);

    const loadHomeData = useCallback(() => {
        const allTasks = getStoredRoutineTasks();
        const filteredTasks = allTasks
            .filter(t => t.date === todayStr)
            .sort((a, b) => {
                if (Number.isInteger(a.order) && Number.isInteger(b.order)) return a.order - b.order;
                if (!a.start) return 1;
                if (!b.start) return -1;
                return a.start.localeCompare(b.start);
            });

        const allFinances = getStoredFinances();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        let inc = 0;
        let exp = 0;

        allFinances.forEach(t => {
            const d = new Date(t.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                if (t.type === 'income') inc += t.amount;
                else exp += t.amount;
            }
        });

        const streakInfo = calculateStreakStats(allTasks);

        return {
            tasks: filteredTasks,
            finances: { income: inc, expense: exp, net: inc - exp },
            streak: streakInfo.currentStreak,
            recentActivity: getRecentActivity(allTasks)
        };
    }, [todayStr]);

    const [homeData, setHomeData] = useState(() => loadHomeData());
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'routine' | 'finance'

    useEffect(() => {
        const unsubscribe = subscribeWorkspaceChange(() => {
            setHomeData(loadHomeData());
        });
        return unsubscribe;
    }, [loadHomeData]);

    useEffect(() => {
        setDailyQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

        // 3x Daily Notification Prompt
        if ("Notification" in window && Notification.permission === "granted") {
            const now = new Date();
            const triggers = [
                { hours: 9, mins: 0, message: "Good morning! Time to build your streak today! 🌅" },
                { hours: 14, mins: 0, message: "Mid-day focus check. Keep your momentum going! ⚡" },
                { hours: 20, mins: 0, message: "Evening review. Log and complete your tasks! 🌙" }
            ];

            triggers.forEach(trigger => {
                let target = new Date();
                target.setHours(trigger.hours, trigger.mins, 0, 0);
                if (now > target) target.setDate(target.getDate() + 1);
                const timeUntil = target.getTime() - now.getTime();
                setTimeout(() => {
                    new Notification("Progress Tracker", { body: trigger.message, icon: "/favicon.svg" });
                }, timeUntil);
            });
        } else if ("Notification" in window && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }, []);

    // Toggle task directly from Dashboard
    const toggleTask = (id) => {
        const allTasks = getStoredRoutineTasks();
        const updated = allTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        setStoredRoutineTasks(updated);
        void syncData({ routineTasks: updated });
        emitWorkspaceChange({ type: 'routine' });
        setHomeData(loadHomeData());
    };

    const { tasks: todayTasks, finances, streak } = homeData;
    const completedTasksCount = todayTasks.filter(t => t.completed).length;
    const totalTasksCount = todayTasks.length;
    const progressPercent = totalTasksCount === 0 ? 0 : Math.round((completedTasksCount / totalTasksCount) * 100);
    const tasksRemaining = totalTasksCount - completedTasksCount;
    const activityHeatmap = useMemo(() => {
        const endDate = new Date();
        endDate.setHours(0, 0, 0, 0);
        const rangeStart = new Date(endDate);
        rangeStart.setDate(rangeStart.getDate() - 89);
        const gridStart = new Date(rangeStart);
        gridStart.setDate(gridStart.getDate() - gridStart.getDay());
        const gridEnd = new Date(endDate);
        gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
        const days = [];

        for (const date = new Date(gridStart); date <= gridEnd; date.setDate(date.getDate() + 1)) {
            const dateString = getLocalDateString(date);
            const activity = homeData.recentActivity[dateString] || { planned: 0, completed: 0 };
            const level = activity.planned === 0
                ? 0
                : activity.completed === 0
                    ? 1
                    : activity.completed / activity.planned < 0.5
                        ? 2
                        : activity.completed / activity.planned < 0.75
                            ? 3
                            : 4;
            days.push({
                dateString,
                label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                ...activity,
                level
            });
        }

        return days;
    }, [homeData.recentActivity]);
    const activitySummary = Object.values(homeData.recentActivity).reduce((summary, day) => ({
        planned: summary.planned + day.planned,
        completed: summary.completed + day.completed,
        activeDays: summary.activeDays + 1
    }), { planned: 0, completed: 0, activeDays: 0 });

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    const displayName = user ? user.name.split(' ')[0] : 'Champion';

    // Chart.js Configuration
    const chartData = {
        labels: ['Income', 'Expense'],
        datasets: [{
            data: [finances.income, finances.expense],
            backgroundColor: ['#10b981', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    return (
        <div className="routine-page-container home-view-container">
            {/* TOP BAR (ROUTINE PAGE DESIGN TYPE) */}
            <div className="routine-top-header">
                <div className="routine-date-nav-wrap">
                    <h2 className="routine-date-title">{greeting}, {displayName}! 👋</h2>
                </div>
            </div>

            {/* SLEEK DAILY QUOTE CARD (CLEAN, MINIMAL & INSPIRING) */}
            <div className="home-quote-card">
                <div className="home-quote-left">
                    <div className="home-quote-icon-wrap">
                        <Quote size={18} />
                    </div>
                    <div className="home-quote-text-wrap">
                        <span className="home-quote-eyebrow">Daily Mindset</span>
                        <p className="home-quote-content">"{dailyQuote}"</p>
                    </div>
                </div>
            </div>

            {/* FILTER / SECTION NAVIGATION CHIPS (ROUTINE STYLE) */}
            <div className="routine-time-filters">
                <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`routine-filter-chip ${activeTab === 'all' ? 'active' : ''}`}
                >
                    Overview
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('routine')}
                    className={`routine-filter-chip ${activeTab === 'routine' ? 'active' : ''}`}
                >
                    Today's Routine ({totalTasksCount})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('finance')}
                    className={`routine-filter-chip ${activeTab === 'finance' ? 'active' : ''}`}
                >
                    Wallet Snapshot (₹{finances.net})
                </button>
            </div>

            {/* MAIN CONTENT SPLIT OR FILTERED VIEW */}
            <div className="home-content-layout">
                {/* TODAY'S ROUTINE TASKS SECTION */}
                {(activeTab === 'all' || activeTab === 'routine') && (
                    <section className="home-section-card">
                        <div className="home-section-header">
                            <div className="home-section-title-wrap">
                                <ListTodo size={18} className="home-section-icon" />
                                <h3>Today's Focus Tasks</h3>
                            </div>
                        </div>

                        <div className="routine-tasks-list home-tasks-compact">
                            {todayTasks.length === 0 ? (
                                <div className="routine-empty-box compact">
                                    <Sparkles size={26} color="#3b82f6" />
                                    <h4>No tasks scheduled for today</h4>
                                    <p>Plan your day with custom habits and time blocks.</p>
                                    <NavLink to="/routine" className="routine-add-main-btn" style={{ maxWidth: '240px', margin: '10px auto 0' }}>
                                        <Plus size={16} />
                                        <span>Plan Today's Routine</span>
                                    </NavLink>
                                </div>
                            ) : (
                                todayTasks.slice(0, 5).map((task) => {
                                    const meta = getTaskCategoryMeta(task.title, task.color);
                                    const IconComponent = meta.icon;
                                    const durationLabel = getTaskDurationLabel(task.start, task.end);

                                    return (
                                        <div
                                            key={task.id}
                                            className={`routine-task-card ${task.completed ? 'completed' : ''}`}
                                        >
                                            {/* LEFT SOFT ICON */}
                                            <div
                                                className="routine-task-icon-wrap"
                                                style={{ background: meta.bg, color: meta.color }}
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
                                                </div>
                                            </div>

                                            {/* RIGHT ACTIONS */}
                                            <div className="routine-task-right">
                                                {durationLabel && (
                                                    <div className="routine-task-duration-badge">
                                                        <Clock size={12} />
                                                        <span>{durationLabel}</span>
                                                    </div>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => toggleTask(task.id)}
                                                    className={`routine-task-check-btn ${task.completed ? 'checked' : ''}`}
                                                    title={task.completed ? "Mark incomplete" : "Mark complete"}
                                                    aria-label="Toggle task completion"
                                                >
                                                    {task.completed && <Check size={14} strokeWidth={3} />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="home-activity-card">
                            <div className="home-section-header">
                                <div className="home-section-title-wrap">
                                    <Calendar size={18} className="home-section-icon" />
                                    <h3>Routine activity</h3>
                                </div>
                                <span className="home-activity-period">Last 90 days</span>
                            </div>
                            <p className="home-activity-summary">
                                {activitySummary.completed} of {activitySummary.planned} tasks completed across {activitySummary.activeDays} active days
                            </p>
                            <div className="home-activity-chart-scroll">
                                <div className="home-activity-weekdays" aria-hidden="true">
                                    <span>Mon</span>
                                    <span>Wed</span>
                                    <span>Fri</span>
                                </div>
                                <div
                                    className="home-activity-heatmap"
                                    role="img"
                                    aria-label={`Routine completion activity for the last 90 days: ${activitySummary.completed} of ${activitySummary.planned} tasks completed`}
                                >
                                    {activityHeatmap.map(day => (
                                        <span
                                            key={day.dateString}
                                            className={`home-activity-cell level-${day.level}`}
                                            title={`${day.label}: ${day.completed} of ${day.planned} tasks completed`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="home-activity-legend" aria-hidden="true">
                                <span>Less</span>
                                {[0, 1, 2, 3, 4].map(level => (
                                    <span key={level} className={`home-activity-cell level-${level}`} />
                                ))}
                                <span>More</span>
                            </div>
                        </div>
                    </section>
                )}

                {/* MONTHLY WALLET SNAPSHOT SECTION */}
                {(activeTab === 'all' || activeTab === 'finance') && (
                    <section className="home-section-card">
                        <div className="home-section-header">
                            <div className="home-section-title-wrap">
                                <Wallet size={18} className="home-section-icon" />
                                <h3>Monthly Financial Health</h3>
                            </div>
                        </div>

                        {/* FINANCE METRIC CARDS (ROUTINE CARD STYLE) */}
                        <div className="home-finance-cards-grid">
                            {/* Income Card */}
                            <div className="home-stat-card income">
                                <div className="home-stat-icon-wrap">
                                    <ArrowDownLeft size={20} color="#10b981" />
                                </div>
                                <div className="home-stat-info">
                                    <span className="home-stat-label">Income</span>
                                    <strong className="home-stat-val income">+₹{finances.income}</strong>
                                </div>
                            </div>

                            {/* Expense Card */}
                            <div className="home-stat-card expense">
                                <div className="home-stat-icon-wrap">
                                    <ArrowUpRight size={20} color="#ef4444" />
                                </div>
                                <div className="home-stat-info">
                                    <span className="home-stat-label">Spent</span>
                                    <strong className="home-stat-val expense">-₹{finances.expense}</strong>
                                </div>
                            </div>

                            {/* Net Balance Card */}
                            <div className="home-stat-card net">
                                <div className="home-stat-icon-wrap">
                                    <TrendingUp size={20} color="#3b82f6" />
                                </div>
                                <div className="home-stat-info">
                                    <span className="home-stat-label">Net Balance</span>
                                    <strong className={`home-stat-val ${finances.net >= 0 ? 'income' : 'expense'}`}>
                                        {finances.net >= 0 ? '+' : ''}₹{finances.net}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {/* MINI DOUGHNUT CHART */}
                        {(finances.income > 0 || finances.expense > 0) && (
                            <div className="home-doughnut-wrap">
                                <div className="home-chart-container">
                                    <Doughnut
                                        data={chartData}
                                        options={{
                                            cutout: '76%',
                                            plugins: { legend: { display: false } },
                                            maintainAspectRatio: false
                                        }}
                                    />
                                    <div className="home-chart-center-label">
                                        <span className="home-chart-sub">Net Savings</span>
                                        <strong className={finances.net >= 0 ? 'text-success' : 'text-danger'}>
                                            ₹{finances.net}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}