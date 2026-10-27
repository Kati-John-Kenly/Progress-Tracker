import { useMemo, useState, useEffect } from 'react';
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
    ArrowRight,
    ArrowUpRight,
    BarChart3,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Flame,
    Lightbulb,
    Wallet,
    X,
} from 'lucide-react';
import {
    calculateStreakStats,
    getStoredFinances,
    getStoredRoutineTasks,
    subscribeWorkspaceChange,
} from '../utils/workspaceEvents';
import { getStatementTotals } from '../utils/statementImport';
import { formatAmount } from '../utils/numberFormat';
import { getTaskCategoryMeta, getLocalDateString } from './RoutineView';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip, Legend);

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CHART_COLORS = ['#11c7a1', '#388bff', '#9b72f7', '#ffb547', '#36c6e4', '#f05f8c', '#839bb8', '#e6814a'];
const makeLocalDate = (dateString) => new Date(`${dateString}T12:00:00`);
const dateOffset = (date, offset) => {
    const result = new Date(date);
    result.setDate(result.getDate() + offset);
    return result;
};
const weekMonday = (date) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
    return result;
};
const taskDurationHours = (task) => {
    const timePattern = /^(\d{1,2}):(\d{2})$/;
    const start = timePattern.exec(task.start || '');
    const end = timePattern.exec(task.end || '');
    if (!start || !end) return 0;
    const minutes = Number(end[1]) * 60 + Number(end[2]) - (Number(start[1]) * 60 + Number(start[2]));
    return minutes > 0 ? minutes / 60 : 0;
};
const isFocusTask = (task) => /work|study|read|learn|class|course|project|code|focus|meeting/i.test(task.title || '');
function AnalyticsView() {
    const [tasks, setTasks] = useState(() => getStoredRoutineTasks());
    const [finances, setFinances] = useState(() => getStoredFinances());
    const [weekStart, setWeekStart] = useState(() => weekMonday(new Date()));
    const [selectedDetailId, setSelectedDetailId] = useState(null);
    const [isLightTheme, setIsLightTheme] = useState(() => document.documentElement.classList.contains('light-theme'));
    const today = getLocalDateString();

    useEffect(() => subscribeWorkspaceChange(detail => {
        setTasks(getStoredRoutineTasks());
        setFinances(getStoredFinances());
        if (detail.type === 'theme') setIsLightTheme(detail.theme === 'light');
    }), []);

    const chartTextColor = isLightTheme ? '#64748b' : '#91a5c1';
    const chartGridColor = isLightTheme ? 'rgba(100, 116, 139, 0.18)' : 'rgba(112,145,185,.12)';
    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: isLightTheme ? '#ffffff' : '#0b1930',
                titleColor: isLightTheme ? '#0f172a' : '#f5f8ff',
                bodyColor: isLightTheme ? '#334155' : '#d1ddf0',
                borderColor: isLightTheme ? '#cbd5e1' : 'rgba(112,145,185,.22)',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 10,
            },
        },
    }), [isLightTheme]);

    const weekDates = useMemo(
        () => Array.from({ length: 7 }, (_, index) => getLocalDateString(dateOffset(weekStart, index))),
        [weekStart],
    );
    const previousWeekDates = useMemo(
        () => Array.from({ length: 7 }, (_, index) => getLocalDateString(dateOffset(weekStart, index - 7))),
        [weekStart],
    );
    const weekTasks = useMemo(() => tasks.filter(task => weekDates.includes(task.date)), [tasks, weekDates]);
    const priorWeekTasks = useMemo(() => tasks.filter(task => previousWeekDates.includes(task.date)), [tasks, previousWeekDates]);
    const completedTasks = weekTasks.filter(task => task.completed).length;
    const priorCompletedTasks = priorWeekTasks.filter(task => task.completed).length;
    const completionRate = weekTasks.length ? Math.round((completedTasks / weekTasks.length) * 100) : 0;
    const priorCompletionRate = priorWeekTasks.length
        ? Math.round((priorCompletedTasks / priorWeekTasks.length) * 100)
        : 0;
    const todaysTasks = tasks.filter(task => task.date === today);
    const todaysHours = todaysTasks.reduce((sum, task) => sum + taskDurationHours(task), 0);
    const weeklyTime = weekDates.map(date => {
        const dayTasks = weekTasks.filter(task => task.date === date);
        return {
            focus: dayTasks.filter(isFocusTask).reduce((sum, task) => sum + taskDurationHours(task), 0),
            other: dayTasks.filter(task => !isFocusTask(task)).reduce((sum, task) => sum + taskDurationHours(task), 0),
        };
    });

    const monthTransactions = useMemo(() => {
        const now = new Date();
        return finances.filter(transaction => {
            const date = makeLocalDate(String(transaction.date || '').slice(0, 10));
            return Number.isFinite(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        });
    }, [finances]);
    const monthTotals = useMemo(() => getStatementTotals(monthTransactions), [monthTransactions]);
    const monthlyNet = monthTotals.income - monthTotals.spending;
    const streak = calculateStreakStats(tasks).currentStreak;
    const rangeLabel = `${makeLocalDate(weekDates[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${makeLocalDate(weekDates[6]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const weeklyBars = weekDates.map(date => {
        const dayTransactions = finances.filter(transaction => transaction.date === date);
        const totals = getStatementTotals(dayTransactions);
        return { income: totals.income, spending: totals.spending };
    });
    const selectedWeekLabel = weekStart.getTime() === weekMonday(new Date()).getTime()
        ? 'This week'
        : `${makeLocalDate(weekDates[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${makeLocalDate(weekDates[6]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

    const habitCategories = useMemo(() => {
        const totals = new Map();
        weekTasks.forEach(task => {
            const category = getTaskCategoryMeta(task.title, task.color);
            const entry = totals.get(category.label) || { label: category.label, color: category.color, planned: 0, completed: 0 };
            entry.planned += 1;
            if (task.completed) entry.completed += 1;
            totals.set(category.label, entry);
        });
        return [...totals.values()].sort((a, b) => b.planned - a.planned);
    }, [weekTasks]);
    const financeCategories = useMemo(() => {
        const totals = new Map();
        monthTransactions.filter(transaction => transaction.type !== 'income').forEach(transaction => {
            const meta = getTaskCategoryMeta(transaction.desc || transaction.name || 'Other');
            const label = transaction.desc || meta.label;
            totals.set(label, (totals.get(label) || 0) + Math.round(Math.abs(Number(transaction.amount) || 0) * 100) / 100);
        });
        return [...totals.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
    }, [monthTransactions]);
    const expenseTotal = financeCategories.reduce((total, entry) => total + entry.amount, 0);
    const currentWeekProgress = weekDates.map((date, index) => {
        const dayTasks = weekTasks.filter(task => task.date === date);
        const planned = dayTasks.length;
        const completed = dayTasks.filter(task => task.completed).length;
        const ratio = planned ? completed / planned : 0;
        return { date, label: WEEKDAY_NAMES[index], planned, completed, ratio, level: !planned ? 0 : ratio === 1 ? 4 : ratio >= 0.66 ? 3 : ratio > 0 ? 2 : 1 };
    });
    const insight = completionRate > priorCompletionRate
        ? `Your habit completion rate improved by ${completionRate - priorCompletionRate}% compared with the previous week.`
        : completionRate < priorCompletionRate
            ? `You completed ${priorCompletionRate - completionRate}% fewer planned habits than the previous week.`
            : weekTasks.length
                ? 'Your completion rate is holding steady. Keep your routine consistent.'
                : 'Add routines and transactions to start building your weekly insights.';

    const activityDoughnut = {
        labels: ['Completed', 'Remaining'],
        datasets: [{ data: [completedTasks, Math.max(weekTasks.length - completedTasks, 0)], backgroundColor: ['#12c7a1', isLightTheme ? '#e2e8f0' : '#1b3455'], borderWidth: 0, hoverOffset: 4 }],
    };
    const timeLineData = {
        labels: WEEKDAY_NAMES,
        datasets: [
            { label: 'Focused time', data: weeklyTime.map(day => day.focus), borderColor: '#38a8ff', backgroundColor: 'rgba(56,168,255,0.2)', fill: true, tension: 0.35, pointRadius: 2 },
            { label: 'Other activities', data: weeklyTime.map(day => day.other), borderColor: '#a77cff', backgroundColor: 'rgba(167,124,255,0.16)', fill: true, tension: 0.35, pointRadius: 2 },
        ],
    };
    const financeBars = {
        labels: WEEKDAY_NAMES,
        datasets: [
            { label: 'Income', data: weeklyBars.map(day => day.income), backgroundColor: '#17c8a1', borderRadius: 3, barPercentage: 0.72 },
            { label: 'Expenses', data: weeklyBars.map(day => day.spending), backgroundColor: '#f45f86', borderRadius: 3, barPercentage: 0.72 },
        ],
    };
    const habitDoughnut = {
        labels: habitCategories.map(item => item.label),
        datasets: [{ data: habitCategories.map(item => item.planned), backgroundColor: habitCategories.map(item => item.color), borderWidth: 0, hoverOffset: 4 }],
    };
    const financeDoughnut = {
        labels: financeCategories.slice(0, 7).map(item => item.label),
        datasets: [{ data: financeCategories.slice(0, 7).map(item => item.amount), backgroundColor: CHART_COLORS, borderWidth: 0, hoverOffset: 4 }],
    };
    const weeklySummary = [
        { label: 'Habits', detail: `${completionRate}% completion rate`, value: `${completedTasks}/${weekTasks.length}`, color: 'mint', icon: Check },
        { label: 'Time', detail: `${formatAmount(weeklyTime.reduce((sum, day) => sum + day.focus, 0))}h focused this week`, value: `${formatAmount(todaysHours)}h today`, color: 'violet', icon: Clock3 },
        { label: 'Finance', detail: `Net this month: ₹${formatAmount(monthlyNet)}`, value: `${monthTransactions.length} transactions`, color: 'gold', icon: Wallet },
        { label: 'Overall progress', detail: `${completedTasks} habits completed this week`, value: streak ? `${streak} day streak` : 'Keep going', color: 'rose', icon: Flame },
    ];
    const focusedHours = weeklyTime.reduce((sum, day) => sum + day.focus, 0);
    const otherHours = weeklyTime.reduce((sum, day) => sum + day.other, 0);
    const weeklyIncome = weeklyBars.reduce((sum, day) => sum + day.income, 0);
    const weeklySpending = weeklyBars.reduce((sum, day) => sum + day.spending, 0);
    const detailCards = [
        {
            id: 'habits-kpi',
            title: 'Habits completed',
            subtitle: 'Weekly habit completion',
            description: 'This compares completed routines with all routines scheduled during the selected week.',
            icon: Check,
            color: 'mint',
            facts: [
                { label: 'Completed', value: `${completedTasks} of ${weekTasks.length}` },
                { label: 'Completion rate', value: `${completionRate}%` },
                { label: 'Previous week', value: `${priorCompletedTasks} of ${priorWeekTasks.length} (${priorCompletionRate}%)` },
            ],
            chart: 'habit',
        },
        {
            id: 'time-kpi',
            title: 'Time utilization',
            subtitle: 'Scheduled routine time',
            description: 'Time is calculated from routines with valid start and end times. Focused time is estimated from work, study, reading, project, coding and meeting titles.',
            icon: Clock3,
            color: 'violet',
            facts: [
                { label: 'Scheduled today', value: `${formatAmount(todaysHours)} hours` },
                { label: 'Focused this week', value: `${formatAmount(focusedHours)} hours` },
                { label: 'Other scheduled time', value: `${formatAmount(otherHours)} hours` },
            ],
            chart: 'time',
        },
        {
            id: 'finance-kpi',
            title: 'Total balance',
            subtitle: 'Finance month to date',
            description: 'Net balance is calculated from recorded income minus spending this calendar month. Failed transactions are excluded from totals.',
            icon: Wallet,
            color: 'gold',
            facts: [
                { label: 'Income this month', value: `₹${formatAmount(monthTotals.income)}` },
                { label: 'Spending this month', value: `₹${formatAmount(monthTotals.spending)}` },
                { label: 'Net balance', value: `₹${formatAmount(monthlyNet)}` },
                { label: 'Transactions this month', value: String(monthTransactions.length) },
            ],
            chart: 'finance-categories',
        },
        {
            id: 'streak-kpi',
            title: 'Current streak',
            subtitle: 'Routine consistency',
            description: 'Your current streak reflects consecutive days with completed routines, based on the saved routine history.',
            icon: Flame,
            color: 'rose',
            facts: [
                { label: 'Current streak', value: `${streak} ${streak === 1 ? 'day' : 'days'}` },
                { label: 'Completed this week', value: `${completedTasks} routines` },
                { label: 'Scheduled this week', value: `${weekTasks.length} routines` },
            ],
        },
        {
            id: 'habit-analytics',
            title: 'Habit analytics',
            subtitle: 'Weekly completion rate and daily pattern',
            description: 'The ring shows completed versus remaining routines. The day-by-day list shows how many planned routines were completed each day.',
            icon: Check,
            color: 'mint',
            facts: [
                { label: 'Completion rate', value: `${completionRate}%` },
                { label: 'Completed routines', value: `${completedTasks} of ${weekTasks.length}` },
                { label: 'Compared with previous week', value: `${completionRate > priorCompletionRate ? '+' : ''}${completionRate - priorCompletionRate} percentage points` },
            ],
            chart: 'habit',
            rows: currentWeekProgress.map(day => ({
                label: day.label,
                value: `${day.completed} / ${day.planned} completed`,
            })),
        },
        {
            id: 'time-analytics',
            title: 'Time analytics',
            subtitle: 'How scheduled time is used',
            description: 'Daily scheduled hours are split into focused and other activities using routine titles and available start/end times.',
            icon: Clock3,
            color: 'violet',
            facts: [
                { label: 'Focused this week', value: `${formatAmount(focusedHours)} hours` },
                { label: 'Other activities this week', value: `${formatAmount(otherHours)} hours` },
                { label: 'Time scheduled today', value: `${formatAmount(todaysHours)} hours` },
            ],
            chart: 'time',
            rows: weeklyTime.map((day, index) => ({
                label: WEEKDAY_NAMES[index],
                value: `${formatAmount(day.focus + day.other)} hours`,
            })),
        },
        {
            id: 'finance-overview',
            title: 'Finance overview',
            subtitle: 'Income vs expenses this week',
            description: 'This chart compares the recorded daily income and spending for the selected week.',
            icon: Wallet,
            color: 'gold',
            facts: [
                { label: 'Income this week', value: `₹${formatAmount(weeklyIncome)}` },
                { label: 'Expenses this week', value: `₹${formatAmount(weeklySpending)}` },
                { label: 'Net this week', value: `₹${formatAmount(weeklyIncome - weeklySpending)}` },
            ],
            chart: 'finance',
            rows: weeklyBars.map((day, index) => ({
                label: WEEKDAY_NAMES[index],
                value: `₹${formatAmount(day.income)} income · ₹${formatAmount(day.spending)} spent`,
            })),
        },
        {
            id: 'habit-categories',
            title: 'Habit categories',
            subtitle: 'Planned habits this week',
            description: 'See how this week’s scheduled routines are distributed across their categories.',
            icon: BarChart3,
            color: 'blue',
            facts: [
                { label: 'Total planned routines', value: String(weekTasks.length) },
                { label: 'Categories represented', value: String(habitCategories.length) },
            ],
            chart: 'habit-categories',
            rows: habitCategories.map(category => ({
                label: category.label,
                value: `${category.planned} planned · ${category.completed} completed · ${weekTasks.length ? Math.round(category.planned / weekTasks.length * 100) : 0}%`,
                color: category.color,
            })),
        },
        {
            id: 'finance-breakdown',
            title: 'Finance breakdown',
            subtitle: 'Spending by transaction category this month',
            description: 'Compare this month’s expense categories. Amounts are rounded to two decimal places and percentages use the recorded expense total.',
            icon: Wallet,
            color: 'gold',
            facts: [
                { label: 'Total recorded spending', value: `₹${formatAmount(expenseTotal)}` },
                { label: 'Expense categories', value: String(financeCategories.length) },
            ],
            chart: 'finance-categories',
            rows: financeCategories.map((category, index) => ({
                label: category.label,
                value: `₹${formatAmount(category.amount)} · ${expenseTotal ? Math.round(category.amount / expenseTotal * 100) : 0}%`,
                color: CHART_COLORS[index % CHART_COLORS.length],
            })),
        },
        {
            id: 'weekly-summary',
            title: 'Weekly summary',
            subtitle: 'Your progress at a glance',
            description: 'A focused summary of habits, scheduled time, month-to-date finances and consistency.',
            icon: BarChart3,
            color: 'blue',
            facts: weeklySummary.map(item => ({ label: item.label, value: `${item.value} · ${item.detail}` })),
        },
        {
            id: 'habit-insight',
            title: 'Habit insight',
            subtitle: 'Weekly completion comparison',
            description: insight,
            icon: Check,
            color: 'mint',
            facts: [
                { label: 'This week', value: `${completedTasks} of ${weekTasks.length} routines (${completionRate}%)` },
                { label: 'Previous week', value: `${priorCompletedTasks} of ${priorWeekTasks.length} routines (${priorCompletionRate}%)` },
            ],
        },
        {
            id: 'time-insight',
            title: 'Time insight',
            subtitle: 'Scheduled time today',
            description: todaysHours
                ? `You have ${formatAmount(todaysHours)} hours scheduled today.`
                : 'Add start and end times to routines to track scheduled time.',
            icon: Clock3,
            color: 'violet',
            facts: [
                { label: 'Scheduled today', value: `${formatAmount(todaysHours)} hours` },
                { label: 'Focused this week', value: `${formatAmount(focusedHours)} hours` },
                { label: 'Other scheduled time this week', value: `${formatAmount(otherHours)} hours` },
            ],
            chart: 'time',
        },
        {
            id: 'finance-insight',
            title: 'Finance insight',
            subtitle: 'Month-to-date spending',
            description: expenseTotal
                ? `Your recorded spending this month is ₹${formatAmount(expenseTotal)}.`
                : 'Record expenses to get personalized finance insights.',
            icon: Wallet,
            color: 'gold',
            facts: [
                { label: 'Recorded spending this month', value: `₹${formatAmount(expenseTotal)}` },
                { label: 'Income this month', value: `₹${formatAmount(monthTotals.income)}` },
                { label: 'Net balance this month', value: `₹${formatAmount(monthlyNet)}` },
            ],
            chart: 'finance-categories',
        },
    ];
    const selectedDetail = detailCards.find(item => item.id === selectedDetailId);

    useEffect(() => {
        if (!selectedDetailId) return undefined;
        const handleKeyDown = event => {
            if (event.key === 'Escape') setSelectedDetailId(null);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [selectedDetailId]);

    const openDetailOnKeyDown = (event, id) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setSelectedDetailId(id);
        }
    };

    return (
        <main className="analytics-page">
            <header className="analytics-heading">
                <div>
                    <span className="analytics-title-icon"><BarChart3 size={21} /></span>
                    <div>
                        <h2>Analytics</h2>
                        <p>Track your habits, time and finances — all in one place.</p>
                    </div>
                </div>
                <div className="analytics-week-picker" aria-label="Select week">
                    <button type="button" onClick={() => setWeekStart(dateOffset(weekStart, -7))} aria-label="Previous week">
                        <ChevronLeft size={17} />
                    </button>
                    <span><CalendarDays size={15} />{rangeLabel}</span>
                    <button type="button" onClick={() => setWeekStart(dateOffset(weekStart, 7))} aria-label="Next week">
                        <ChevronRight size={17} />
                    </button>
                </div>
            </header>

            <section className="analytics-kpi-grid" aria-label="Weekly overview">
                <article className="analytics-kpi-card analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('habits-kpi')} onKeyDown={event => openDetailOnKeyDown(event, 'habits-kpi')}>
                    <span className="analytics-kpi-icon mint"><Check size={21} /></span>
                    <div><small>Habits completed</small><strong>{completedTasks} <span>/ {weekTasks.length}</span></strong></div>
                    <b className="analytics-kpi-trend">{completionRate}% this week</b>
                </article>
                <article className="analytics-kpi-card analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('time-kpi')} onKeyDown={event => openDetailOnKeyDown(event, 'time-kpi')}>
                    <span className="analytics-kpi-icon violet"><Clock3 size={21} /></span>
                    <div><small>Time utilization</small><strong>{formatAmount(todaysHours)} <span>/ 24h today</span></strong></div>
                    <b className="analytics-kpi-trend">{formatAmount(weeklyTime.reduce((sum, day) => sum + day.focus, 0))}h focused this week</b>
                </article>
                <article className="analytics-kpi-card analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('finance-kpi')} onKeyDown={event => openDetailOnKeyDown(event, 'finance-kpi')}>
                    <span className="analytics-kpi-icon gold"><Wallet size={21} /></span>
                    <div><small>Total balance</small><strong>₹{formatAmount(monthlyNet)}</strong></div>
                    <b className="analytics-kpi-trend">Month to date</b>
                </article>
                <article className="analytics-kpi-card analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('streak-kpi')} onKeyDown={event => openDetailOnKeyDown(event, 'streak-kpi')}>
                    <span className="analytics-kpi-icon rose"><Flame size={21} /></span>
                    <div><small>Current streak</small><strong>{streak} <span>days</span></strong></div>
                    <b className="analytics-kpi-trend">Based on completed routines</b>
                </article>
            </section>

            <section className="analytics-chart-grid analytics-chart-grid-primary">
                <article className="analytics-card analytics-habit-card analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('habit-analytics')} onKeyDown={event => openDetailOnKeyDown(event, 'habit-analytics')}>
                    <div className="analytics-card-heading">
                        <span className="analytics-card-icon mint"><Check size={16} /></span>
                        <div><h3>Habit analytics</h3><p>Weekly completion rate</p></div>
                        <span className="analytics-card-range">{selectedWeekLabel}</span>
                    </div>
                    <div className="analytics-habit-chart">
                        <div className="analytics-doughnut-wrap">
                            <Doughnut data={activityDoughnut} options={{ ...chartOptions, cutout: '72%' }} />
                            <strong>{completionRate}%</strong>
                            <small>Completion</small>
                        </div>
                        <div className="analytics-week-heatmap">
                            <div className="analytics-heatmap-row analytics-heatmap-labels"><span>Habits</span>{currentWeekProgress.map(day => <small key={day.date}>{day.label.slice(0, 1)}</small>)}</div>
                            {habitCategories.slice(0, 5).map(category => (
                                <div className="analytics-heatmap-row" key={category.label}>
                                    <span>{category.label}</span>
                                    {currentWeekProgress.map(day => {
                                        const dayCategory = tasks.filter(task => task.date === day.date && getTaskCategoryMeta(task.title, task.color).label === category.label);
                                        const ratio = dayCategory.length ? dayCategory.filter(task => task.completed).length / dayCategory.length : 0;
                                        return <i key={day.date} title={`${day.label}: ${dayCategory.filter(task => task.completed).length}/${dayCategory.length} ${category.label}`} style={{ background: dayCategory.length ? `${category.color}${ratio === 1 ? 'dd' : ratio > 0 ? '88' : '44'}` : isLightTheme ? '#e2e8f0' : 'rgba(44,72,108,.55)' }} />;
                                    })}
                                </div>
                            ))}
                            {!habitCategories.length && <p className="analytics-empty">Complete planned habits to see your weekly pattern.</p>}
                        </div>
                    </div>
                    <div className="analytics-chart-legend"><span><i className="mint-dot" /> Completed</span><span><i className="muted-dot" /> Remaining</span></div>
                </article>

                <article className="analytics-card analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('time-analytics')} onKeyDown={event => openDetailOnKeyDown(event, 'time-analytics')}>
                    <div className="analytics-card-heading">
                        <span className="analytics-card-icon violet"><Clock3 size={16} /></span>
                        <div><h3>Time analytics</h3><p>How scheduled time is used</p></div>
                        <span className="analytics-card-range">Hours / day</span>
                    </div>
                    <div className="analytics-line-chart">
                        <Line data={timeLineData} options={{
                            ...chartOptions,
                            scales: {
                                x: { grid: { display: false }, ticks: { color: chartTextColor, font: { size: 10 } } },
                                y: { beginAtZero: true, grid: { color: chartGridColor }, ticks: { color: chartTextColor, font: { size: 9 }, maxTicksLimit: 5 } },
                            },
                        }} />
                    </div>
                    <div className="analytics-chart-legend">
                        <span><i className="blue-dot" /> Focused time</span><span><i className="violet-dot" /> Other activities</span>
                    </div>
                </article>

                <article className="analytics-card analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('finance-overview')} onKeyDown={event => openDetailOnKeyDown(event, 'finance-overview')}>
                    <div className="analytics-card-heading">
                        <span className="analytics-card-icon gold"><Wallet size={16} /></span>
                        <div><h3>Finance overview</h3><p>Income vs expenses</p></div>
                        <span className="analytics-card-range">This week</span>
                    </div>
                    <div className="analytics-bar-chart">
                        <Bar data={financeBars} options={{
                            ...chartOptions,
                            scales: {
                                x: { grid: { display: false }, ticks: { color: chartTextColor, font: { size: 10 } } },
                                y: { beginAtZero: true, grid: { color: chartGridColor }, ticks: { color: chartTextColor, font: { size: 9 }, callback: value => `₹${value}` } },
                            },
                        }} />
                    </div>
                    <div className="analytics-chart-legend"><span><i className="mint-dot" /> Income</span><span><i className="rose-dot" /> Expenses</span></div>
                </article>
            </section>

            <section className="analytics-chart-grid analytics-chart-grid-secondary">
                <article className="analytics-card analytics-donut-card analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('habit-categories')} onKeyDown={event => openDetailOnKeyDown(event, 'habit-categories')}>
                    <div className="analytics-card-heading">
                        <span className="analytics-card-icon blue"><BarChart3 size={16} /></span>
                        <div><h3>Habit categories</h3><p>Planned habits this week</p></div>
                        <span className="analytics-card-range">{habitCategories.length} categories</span>
                    </div>
                    {habitCategories.length ? (
                        <div className="analytics-breakdown">
                            <div className="analytics-breakdown-donut"><Doughnut data={habitDoughnut} options={{ ...chartOptions, cutout: '66%' }} /><strong>{habitCategories.reduce((sum, item) => sum + item.planned, 0)}<small>Habits</small></strong></div>
                            <ul>{habitCategories.slice(0, 5).map(item => <li key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><b>{Math.round(item.planned / weekTasks.length * 100) || 0}%</b></li>)}</ul>
                        </div>
                    ) : <p className="analytics-empty">Your planned habit categories will appear here.</p>}
                </article>

                <article className="analytics-card analytics-donut-card analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('finance-breakdown')} onKeyDown={event => openDetailOnKeyDown(event, 'finance-breakdown')}>
                    <div className="analytics-card-heading">
                        <span className="analytics-card-icon gold"><Wallet size={16} /></span>
                        <div><h3>Finance breakdown</h3><p>Spending by transaction category</p></div>
                        <span className="analytics-card-range">This month</span>
                    </div>
                    {financeCategories.length ? (
                        <div className="analytics-breakdown">
                            <div className="analytics-breakdown-donut"><Doughnut data={financeDoughnut} options={{ ...chartOptions, cutout: '66%' }} /><strong>₹{formatAmount(expenseTotal)}<small>Total spent</small></strong></div>
                            <ul>{financeCategories.slice(0, 5).map((item, index) => <li key={item.label}><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} /><span>{item.label}</span><b>{expenseTotal ? Math.round(item.amount / expenseTotal * 100) : 0}%</b></li>)}</ul>
                        </div>
                    ) : <p className="analytics-empty">Add expense transactions to see your spending categories.</p>}
                </article>

                <article className="analytics-card analytics-summary-card analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('weekly-summary')} onKeyDown={event => openDetailOnKeyDown(event, 'weekly-summary')}>
                    <div className="analytics-card-heading">
                        <span className="analytics-card-icon blue"><BarChart3 size={16} /></span>
                        <div><h3>Weekly summary</h3><p>Your progress at a glance</p></div>
                    </div>
                    <div className="analytics-summary-list">
                        {weeklySummary.map(({ label, detail, value, color, icon: Icon }) => (
                            <div className={`analytics-summary-item ${color}`} key={label}>
                                <span><Icon size={16} /></span><div><strong>{label}</strong><small>{detail}</small></div><b>{value}</b>
                            </div>
                        ))}
                    </div>
                </article>
            </section>

            <section className="analytics-insights">
                <div className="analytics-insights-heading"><Lightbulb size={18} /><h3>Insights & suggestions</h3></div>
                <div className="analytics-insight-item analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('habit-insight')} onKeyDown={event => openDetailOnKeyDown(event, 'habit-insight')}><span className="analytics-card-icon mint"><Check size={16} /></span><p>{insight}</p><ArrowRight size={16} /></div>
                <div className="analytics-insight-item analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('time-insight')} onKeyDown={event => openDetailOnKeyDown(event, 'time-insight')}><span className="analytics-card-icon violet"><Clock3 size={16} /></span><p>{todaysHours ? `You have ${formatAmount(todaysHours)} hours scheduled today.` : 'Add start and end times to routines to track scheduled time.'}</p><ArrowRight size={16} /></div>
                <div className="analytics-insight-item analytics-detail-trigger" role="button" tabIndex={0} aria-haspopup="dialog" onClick={() => setSelectedDetailId('finance-insight')} onKeyDown={event => openDetailOnKeyDown(event, 'finance-insight')}><span className="analytics-card-icon gold"><ArrowUpRight size={16} /></span><p>{expenseTotal ? `Your recorded spending this month is ₹${formatAmount(expenseTotal)}.` : 'Record expenses to get personalized finance insights.'}</p><ArrowRight size={16} /></div>
            </section>

            {selectedDetail && (
                <div
                    className="analytics-modal-backdrop"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setSelectedDetailId(null);
                    }}
                >
                    <section
                        className="analytics-detail-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="analytics-detail-title"
                        onKeyDown={event => {
                            if (event.key === 'Escape') setSelectedDetailId(null);
                        }}
                    >
                        <header className="analytics-detail-header">
                            <span className={`analytics-card-icon ${selectedDetail.color}`}>
                                <selectedDetail.icon size={18} />
                            </span>
                            <div>
                                <h2 id="analytics-detail-title">{selectedDetail.title}</h2>
                                <p>{selectedDetail.subtitle}</p>
                            </div>
                            <button type="button" className="analytics-detail-close" onClick={() => setSelectedDetailId(null)} aria-label="Close analytics details" autoFocus>
                                <X size={19} />
                            </button>
                        </header>
                        <div className="analytics-detail-scroll">
                            <p className="analytics-detail-description">{selectedDetail.description}</p>
                            <div className="analytics-detail-facts">
                                {selectedDetail.facts.map(fact => (
                                    <div className="analytics-detail-fact" key={fact.label}>
                                        <span>{fact.label}</span>
                                        <strong>{fact.value}</strong>
                                    </div>
                                ))}
                            </div>

                            {selectedDetail.chart && (
                                <div className="analytics-detail-chart">
                                    <h3>
                                        {selectedDetail.chart === 'habit' ? 'Daily habit completion' :
                                            selectedDetail.chart === 'time' ? 'Scheduled time by day' :
                                                selectedDetail.chart === 'finance' ? 'Income and expenses by day' :
                                                    selectedDetail.chart === 'habit-categories' ? 'Planned habits by category' :
                                                        'Spending by category'}
                                    </h3>
                                    <div className="analytics-detail-chart-canvas">
                                        {selectedDetail.chart === 'habit' && (
                                            weekTasks.length
                                                ? <Doughnut data={activityDoughnut} options={{ ...chartOptions, cutout: '70%' }} />
                                                : <p className="analytics-empty">No routines are scheduled for this week yet.</p>
                                        )}
                                        {selectedDetail.chart === 'time' && (
                                            <Line data={timeLineData} options={{
                                                ...chartOptions,
                                                scales: {
                                                    x: { grid: { display: false }, ticks: { color: chartTextColor } },
                                                    y: { beginAtZero: true, grid: { color: chartGridColor }, ticks: { color: chartTextColor, maxTicksLimit: 6 } },
                                                },
                                            }} />
                                        )}
                                        {selectedDetail.chart === 'finance' && (
                                            <Bar data={financeBars} options={{
                                                ...chartOptions,
                                                scales: {
                                                    x: { grid: { display: false }, ticks: { color: chartTextColor } },
                                                    y: { beginAtZero: true, grid: { color: chartGridColor }, ticks: { color: chartTextColor, callback: value => `₹${formatAmount(value)}` } },
                                                },
                                            }} />
                                        )}
                                        {selectedDetail.chart === 'habit-categories' && (
                                            habitCategories.length
                                                ? <Doughnut data={habitDoughnut} options={{ ...chartOptions, cutout: '62%' }} />
                                                : <p className="analytics-empty">Your planned habit categories will appear here.</p>
                                        )}
                                        {selectedDetail.chart === 'finance-categories' && (
                                            financeCategories.length
                                                ? <Doughnut data={{
                                                    labels: financeCategories.map(item => item.label),
                                                    datasets: [{ data: financeCategories.map(item => item.amount), backgroundColor: financeCategories.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]), borderWidth: 0 }],
                                                }} options={{ ...chartOptions, cutout: '62%' }} />
                                                : <p className="analytics-empty">Add expense transactions to see your spending categories.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedDetail.rows?.length > 0 && (
                                <div className="analytics-detail-rows">
                                    <h3>Details</h3>
                                    {selectedDetail.rows.map(row => (
                                        <div className="analytics-detail-row" key={row.label}>
                                            <span>{row.color && <i style={{ background: row.color }} />}{row.label}</span>
                                            <strong>{row.value}</strong>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}

export default AnalyticsView;
