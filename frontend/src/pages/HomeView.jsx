import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
    Check,
    Clock,
    Plus,
    Wallet,
    Calendar,
    Sparkles,
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
            const date = new Date(`${String(transaction.date || '').slice(0, 10)}T00:00:00`);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });
        const financeTotals = getStatementTotals(monthlyFinances);
        const inc = financeTotals.income;
        const exp = financeTotals.spending;

        return {
            tasks: filteredTasks,
            finances: {
                income: inc,
                expense: exp,
                net: inc - exp,
                expensesByCategory: financeTotals.spendingByCategory,
                recentTransactions: monthlyFinances
                    .filter(transaction => !transaction.monthlyEstimate)
                    .sort((a, b) => (
                        String(b.date || '').localeCompare(String(a.date || ''))
                        || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
                    ))
                    .slice(0, 3),
            },
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

    const expenseCategories = Object.entries(finances.expensesByCategory || {})
        .sort((a, b) => b[1] - a[1]);
    const visibleExpenseCategories = expenseCategories.length > 4
        ? [
            ...expenseCategories.slice(0, 3),
            [
                expenseCategories.slice(0, 3).some(([category]) => category.toLowerCase() === 'other')
                    ? 'Other categories'
                    : 'Other',
                expenseCategories.slice(3).reduce((total, [, amount]) => total + amount, 0),
            ],
        ]
        : expenseCategories;
    const maxCategoryAmount = Math.max(...visibleExpenseCategories.map(([, amount]) => amount), 0);
    const spendingPercent = finances.income > 0
        ? Math.round((finances.expense / finances.income) * 100)
        : 0;
    const formatFinanceAmount = (value) => Number(value || 0).toLocaleString('en-IN', {
        maximumFractionDigits: 2,
    });
    const formatTransactionDate = (dateValue) => {
        const transactionDate = new Date(`${String(dateValue || '').slice(0, 10)}T00:00:00`);
        if (!Number.isFinite(transactionDate.getTime())) return '';
        const today = new Date();
        const isToday = transactionDate.toDateString() === today.toDateString();
        const isCurrentMonth = transactionDate.getMonth() === today.getMonth()
            && transactionDate.getFullYear() === today.getFullYear();
        if (isToday) return 'Today';
        if (isCurrentMonth) return transactionDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return transactionDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
                <div className="home-section-card home-finance-preview">
                    <div className="home-section-header">
                        <div className="home-section-title-wrap">
                            <span className="home-finance-preview-icon"><Wallet size={19} /></span>
                            <div className="home-finance-heading-copy">
                                <h3>Finance</h3>
                                <p>Track spending, plan budgets, and grow savings.</p>
                            </div>
                        </div>
                        <NavLink to="/finance" className="home-finance-preview-link">Preview</NavLink>
                    </div>
                    <div className="home-finance-summary">
                        <div className="home-finance-summary-item">
                            <span>Income</span>
                            <strong className="income">₹{formatFinanceAmount(finances.income)}</strong>
                        </div>
                        <div className="home-finance-summary-item">
                            <span>Expenses</span>
                            <strong className="expense">₹{formatFinanceAmount(finances.expense)}</strong>
                        </div>
                    </div>
                    <section className="home-finance-spending" aria-label="Monthly spending compared with income">
                        <div className="home-finance-subheading">
                            <h4>Monthly spending</h4>
                            <span>{finances.income > 0 ? `${spendingPercent}% of income` : 'No income recorded'}</span>
                        </div>
                        <div className="home-finance-spending-caption">
                            <span>
                                ₹{formatFinanceAmount(finances.expense)} spent
                                {finances.income > 0 && ` of ₹${formatFinanceAmount(finances.income)} income`}
                            </span>
                            <strong>{finances.income > 0 ? `${spendingPercent}%` : '—'}</strong>
                        </div>
                        <div className="home-finance-progress" aria-hidden="true">
                            <span style={{ width: `${Math.min(spendingPercent, 100)}%` }} />
                        </div>
                    </section>
                    <section className="home-finance-breakdown">
                        <h4>Spending breakdown</h4>
                        {visibleExpenseCategories.length > 0 ? (
                            <ul>
                                {visibleExpenseCategories.map(([category, amount]) => (
                                    <li key={category}>
                                        <div className="home-finance-category-label">
                                            <span>{category}</span>
                                            <strong>₹{formatFinanceAmount(amount)}</strong>
                                        </div>
                                        <div className="home-finance-category-track" aria-hidden="true">
                                            <span style={{ width: `${maxCategoryAmount ? (amount / maxCategoryAmount) * 100 : 0}%` }} />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="home-finance-empty">No spending recorded this month.</p>
                        )}
                    </section>
                    <section className="home-finance-recent">
                        <div className="home-finance-recent-heading">
                            <h4>Recent transactions</h4>
                            <NavLink to="/finance">View all</NavLink>
                        </div>
                        {finances.recentTransactions.length > 0 ? (
                            <ul>
                                {finances.recentTransactions.map((transaction, index) => {
                                    const transactionTitle = transaction.name || transaction.desc || 'Transaction';
                                    const transactionCategory = transaction.desc || (transaction.type === 'income' ? 'Income' : 'Expense');
                                    const isIncome = transaction.type === 'income';
                                    return (
                                        <li key={transaction.id || `${transaction.date}-${transactionTitle}-${index}`}>
                                            <span className={`home-finance-transaction-icon ${isIncome ? 'income' : ''}`}>
                                                <Wallet size={17} aria-hidden="true" />
                                            </span>
                                            <span className="home-finance-transaction-copy">
                                                <strong>{transactionTitle}</strong>
                                                <small>{transactionCategory} · {formatTransactionDate(transaction.date)}</small>
                                            </span>
                                            <strong className={`home-finance-transaction-amount ${isIncome ? 'income' : ''}`}>
                                                {isIncome ? '+' : '−'}₹{formatFinanceAmount(Math.abs(Number(transaction.amount) || 0))}
                                            </strong>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="home-finance-empty">No transactions recorded this month.</p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}