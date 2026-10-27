import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import {
    Check,
    Clock,
    Plus,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet,
    Calendar,
    Sparkles,
    TrendingUp,
    ChevronRight,
    ListTodo,
} from 'lucide-react';
import {
    subscribeWorkspaceChange,
    emitWorkspaceChange,
    getStoredRoutineTasks,
    setStoredRoutineTasks,
    getStoredFinances
} from '../utils/workspaceEvents';
import { getStatementTotals } from '../utils/statementImport';
import { formatAmount } from '../utils/numberFormat';
import { getTaskCategoryMeta, getTaskDurationLabel, getLocalDateString } from './RoutineView';

ChartJS.register(ArcElement, Tooltip, Legend);

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
        const monthlyFinances = allFinances.filter(transaction => {
            const date = new Date(transaction.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });
        const financeTotals = getStatementTotals(monthlyFinances);
        const inc = financeTotals.income;
        const exp = financeTotals.spending;

        return {
            tasks: filteredTasks,
            finances: { income: inc, expense: exp, net: inc - exp },
            recentActivity: getRecentActivity(allTasks)
        };
    }, [todayStr]);

    const [homeData, setHomeData] = useState(() => loadHomeData());
    useEffect(() => {
        const unsubscribe = subscribeWorkspaceChange(() => {
            setHomeData(loadHomeData());
        });
        return unsubscribe;
    }, [loadHomeData]);

    useEffect(() => {
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
                    new Notification("Progress Tracker", { body: trigger.message, icon: "/favicon.png" });
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
        emitWorkspaceChange({ type: 'routine' });
        setHomeData(loadHomeData());
    };

    const { tasks: todayTasks, finances } = homeData;
    const completedTasksCount = todayTasks.filter(t => t.completed).length;
    const totalTasksCount = todayTasks.length;
    const progressPercent = totalTasksCount === 0 ? 0 : Math.round((completedTasksCount / totalTasksCount) * 100);
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
    const displayName = 'Champion';
    const plannedHours = todayTasks.reduce((total, task) => {
        const start = /^(\d{1,2}):(\d{2})$/.exec(task.start || '');
        const end = /^(\d{1,2}):(\d{2})$/.exec(task.end || '');
        if (!start || !end) return total;
        const startMinutes = Number(start[1]) * 60 + Number(start[2]);
        const endMinutes = Number(end[1]) * 60 + Number(end[2]);
        return endMinutes > startMinutes ? total + (endMinutes - startMinutes) / 60 : total;
    }, 0);
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekProgress = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        const dateString = getLocalDateString(date);
        const activity = homeData.recentActivity[dateString] || { planned: 0, completed: 0 };
        return {
            dateString,
            label: date.toLocaleDateString(undefined, { weekday: 'short' }),
            complete: activity.planned > 0 && activity.completed === activity.planned
        };
    });

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
            <section className="dashboard-welcome">
                <h2>{greeting}, {displayName} <span aria-hidden="true">👋</span></h2>
                <p>Small steps every day lead to big results.</p>
            </section>

            <section className="dashboard-stat-grid" aria-label="Your overview">
                <article className="dashboard-stat-card habit">
                    <span className="dashboard-stat-icon"><Check size={18} /></span>
                    <span className="dashboard-stat-label">Habits</span>
                    <strong>{completedTasksCount}/{totalTasksCount}</strong>
                    <div className="dashboard-stat-track"><span style={{ width: `${progressPercent}%` }} /></div>
                </article>
                <article className="dashboard-stat-card time">
                    <span className="dashboard-stat-icon"><Clock size={18} /></span>
                    <span className="dashboard-stat-label">Time planned</span>
                    <strong>{formatAmount(plannedHours)} <small>/ 24h</small></strong>
                    <div className="dashboard-stat-track"><span style={{ width: `${Math.min((plannedHours / 24) * 100, 100)}%` }} /></div>
                </article>
                <article className="dashboard-stat-card balance">
                    <span className="dashboard-stat-icon"><Wallet size={18} /></span>
                    <span className="dashboard-stat-label">Balance this month</span>
                    <strong>₹{formatAmount(finances.net)}</strong>
                    <div className="dashboard-stat-track"><span style={{ width: `${Math.min(Math.abs(finances.net) / Math.max(Math.abs(finances.income), Math.abs(finances.expense), 1) * 100, 100)}%` }} /></div>
                </article>
            </section>

            <section className="dashboard-progress-grid">
                <div className="dashboard-week-card">
                    <div className="dashboard-week-heading">
                        <h3>Today's Progress</h3>
                        <NavLink to="/schedule">View schedule <ChevronRight size={15} /></NavLink>
                    </div>
                    <div className="dashboard-week-days">
                        {weekProgress.map(day => (
                            <div className="dashboard-week-day" key={day.dateString}>
                                <span className={day.complete ? 'complete' : ''}>
                                    {day.complete ? <Check size={15} aria-label="Completed" /> : null}
                                </span>
                                <small>{day.label}</small>
                            </div>
                        ))}
                    </div>
                </div>
                <a
                    href="#ai-assistant"
                    className="dashboard-promo-card"
                    onClick={event => {
                        event.preventDefault();
                        window.dispatchEvent(new CustomEvent('open-ai-assistant'));
                    }}
                >
                    <span>Better habits<br />Smarter time<br />Stronger finances</span>
                    <ChevronRight size={22} aria-hidden="true" />
                </a>
            </section>

            <div className="home-content-layout">
                <div className="home-section-card">
                    <div className="home-section-header">
                        <div className="home-section-title-wrap">
                            <ListTodo size={18} className="home-section-icon" />
                            <h3>Today's Focus Tasks</h3>
                        </div>
                        <NavLink to="/routine" className="home-action-pill">View habits <ChevronRight size={14} /></NavLink>
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
                                    <div key={task.id} className={`routine-task-card ${task.completed ? 'completed' : ''}`}>
                                        <div className="routine-task-icon-wrap" style={{ background: meta.bg, color: meta.color }}>
                                            <IconComponent size={20} />
                                        </div>
                                        <div className="routine-task-details">
                                            <h4 className="routine-task-title">{task.title}</h4>
                                            <div className="routine-task-meta-row">
                                                <span className="routine-task-tag">★ {meta.label}</span>
                                                {task.start && <span className="routine-task-time-text">{task.start}{task.end ? ` - ${task.end}` : ''}</span>}
                                            </div>
                                        </div>
                                        <div className="routine-task-right">
                                            {durationLabel && <div className="routine-task-duration-badge"><Clock size={12} /><span>{durationLabel}</span></div>}
                                            <button
                                                type="button"
                                                onClick={() => toggleTask(task.id)}
                                                className={`routine-task-check-btn ${task.completed ? 'checked' : ''}`}
                                                title={task.completed ? 'Mark incomplete' : 'Mark complete'}
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
                            <div className="home-activity-heatmap" role="img" aria-label={`Routine completion activity for the last 90 days: ${activitySummary.completed} of ${activitySummary.planned} tasks completed`}>
                                {activityHeatmap.map(day => (
                                    <span key={day.dateString} className={`home-activity-cell level-${day.level}`} title={`${day.label}: ${day.completed} of ${day.planned} tasks completed`} />
                                ))}
                            </div>
                        </div>
                        <div className="home-activity-legend" aria-hidden="true">
                            <span>Less</span>
                            {[0, 1, 2, 3, 4].map(level => <span key={level} className={`home-activity-cell level-${level}`} />)}
                            <span>More</span>
                        </div>
                    </div>
                </div>
                <div className="home-section-card">
                    <div className="home-section-header">
                        <div className="home-section-title-wrap">
                            <Wallet size={18} className="home-section-icon" />
                            <h3>Monthly Financial Health</h3>
                        </div>
                        <NavLink to="/analytics" className="home-action-pill">View analytics <ChevronRight size={14} /></NavLink>
                    </div>
                    <div className="home-finance-cards-grid">
                        <div className="home-stat-card income">
                            <div className="home-stat-icon-wrap"><ArrowDownLeft size={20} color="#10b981" /></div>
                            <div className="home-stat-info">
                                <span className="home-stat-label">Income</span>
                                <strong className="home-stat-val income">+₹{formatAmount(finances.income)}</strong>
                            </div>
                        </div>
                        <div className="home-stat-card expense">
                            <div className="home-stat-icon-wrap"><ArrowUpRight size={20} color="#ef4444" /></div>
                            <div className="home-stat-info">
                                <span className="home-stat-label">Spent</span>
                                <strong className="home-stat-val expense">-₹{formatAmount(finances.expense)}</strong>
                            </div>
                        </div>
                        <div className="home-stat-card net">
                            <div className="home-stat-icon-wrap"><TrendingUp size={20} color="#3b82f6" /></div>
                            <div className="home-stat-info">
                                <span className="home-stat-label">Net Balance</span>
                                <strong className={`home-stat-val ${finances.net >= 0 ? 'income' : 'expense'}`}>
                                    {finances.net >= 0 ? '+' : ''}₹{formatAmount(finances.net)}
                                </strong>
                            </div>
                        </div>
                    </div>
                    {(finances.income > 0 || finances.expense > 0) && (
                        <div className="home-doughnut-wrap">
                            <div className="home-chart-container">
                                <Doughnut data={chartData} options={{ cutout: '76%', plugins: { legend: { display: false } }, maintainAspectRatio: false }} />
                                <div className="home-chart-center-label">
                                    <span className="home-chart-sub">Net Savings</span>
                                    <strong className={finances.net >= 0 ? 'text-success' : 'text-danger'}>₹{formatAmount(finances.net)}</strong>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}