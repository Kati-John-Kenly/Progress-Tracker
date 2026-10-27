import { useState, useEffect, useMemo, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import {
    ArrowDownLeft,
    ArrowUpRight,
    Wallet,
    TrendingUp,
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Trash2,
    Upload,
    Search,
    Utensils,
    Zap,
    Coffee,
    Car,
    Home,
    ShoppingBag,
    Briefcase,
    Sparkles,
} from 'lucide-react';
import {
    subscribeWorkspaceChange,
    emitWorkspaceChange,
    getStoredFinances,
    setStoredFinances,
    getStoredFinanceCategories,
    setStoredFinanceCategories,
} from '../utils/workspaceEvents';
import { getStatementTotals } from '../utils/statementImport';
import { parseStatementFile } from '../utils/statementFileParser';
import { formatAmount } from '../utils/numberFormat';
import { filterFinanceTransactions } from '../utils/financeSearch';

// Register ChartJS elements
ChartJS.register(ArcElement, Tooltip, Legend);

// Smart Category & Icon Detection for Finance (Matching Routine Category Logic)
export const getFinanceCategoryMeta = (desc = '', type = 'expense') => {
    const d = desc.toLowerCase();
    if (/salary|paycheck|income|client|freelance|bonus|dividend/i.test(d)) {
        return { icon: Briefcase, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Salary / Income' };
    }
    if (/grocery|groceries|supermarket|vegetable|fruit|food/i.test(d)) {
        return { icon: Utensils, color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', label: 'Groceries' };
    }
    if (/dining|restaurant|cafe|coffee|lunch|dinner|snack|tea/i.test(d)) {
        return { icon: Coffee, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: 'Dining Out' };
    }
    if (/utility|utilities|bill|electricity|water|wifi|internet|gas|phone/i.test(d)) {
        return { icon: Zap, color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', label: 'Utilities' };
    }
    if (/rent|emi|mortgage|housing|flat|pg|hostel|home/i.test(d)) {
        return { icon: Home, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', label: 'EMI / Rent' };
    }
    if (/shop|shopping|cloth|dress|amazon|flipkart|gadget|shoes/i.test(d)) {
        return { icon: ShoppingBag, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', label: 'Shopping' };
    }
    if (/transport|travel|fuel|petrol|diesel|cab|uber|ola|bus|train|flight/i.test(d)) {
        return { icon: Car, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', label: 'Transport' };
    }
    if (/invest|stocks|mutual|crypto|gold|fund|fd|savings/i.test(d)) {
        return { icon: TrendingUp, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Investment' };
    }

    if (type === 'income') {
        return { icon: ArrowDownLeft, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: desc || 'Income' };
    }
    return { icon: ArrowUpRight, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: desc || 'Expense' };
};

const DEFAULT_PRESET_CATEGORIES = [
    { name: 'Salary', type: 'income', icon: Briefcase },
    { name: 'Groceries', type: 'expense', icon: Utensils },
    { name: 'Dining Out', type: 'expense', icon: Coffee },
    { name: 'EMI/Rent', type: 'expense', icon: Home },
    { name: 'Utilities', type: 'expense', icon: Zap },
    { name: 'Shopping', type: 'expense', icon: ShoppingBag },
    { name: 'Transportation', type: 'expense', icon: Car },
    { name: 'Investment', type: 'income', icon: TrendingUp },
];

export default function FinanceView({ initialTab = 'transactions' }) {

    // Finance Data State
    const [financeData, setFinanceData] = useState(() => getStoredFinances());
    const [customCategories, setCustomCategories] = useState(() => getStoredFinanceCategories());
    const [transactionFilter, setTransactionFilter] = useState('all'); // 'all' | 'income' | 'expense' | 'estimate'
    const [transactionSearch, setTransactionSearch] = useState('');
    const [activeSubTab, setActiveSubTab] = useState(initialTab); // 'transactions' | 'charts' | 'calendar' | 'allocation'
    const [showFinanceDetails, setShowFinanceDetails] = useState(false);

    // Add Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [isImportingStatement, setIsImportingStatement] = useState(false);
    const [statementMessage, setStatementMessage] = useState(null);
    const statementInputRef = useRef(null);
    const [expandedCalendarDay, setExpandedCalendarDay] = useState(null);
    const longPressTimerRef = useRef(null);
    const didLongPressRef = useRef(false);
    const [finType, setFinType] = useState('expense');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Groceries');
    const [newCategory, setNewCategory] = useState('');
    const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [isMonthlyEstimate, setIsMonthlyEstimate] = useState(false);

    // Calendar View Date
    const [viewDate, setViewDate] = useState(new Date());

    // Save to LocalStorage
    useEffect(() => {
        setStoredFinances(financeData);
        setStoredFinanceCategories(customCategories);
    }, [financeData, customCategories]);

    // Listen for workspace updates from AI Assistant or other views
    useEffect(() => {
        const unsubscribe = subscribeWorkspaceChange(() => {
            setFinanceData(getStoredFinances());
            setCustomCategories(getStoredFinanceCategories());
        });
        return unsubscribe;
    }, []);

    // Active Month Navigation
    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fullMonthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const changeMonth = (offset) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setViewDate(newDate);
    };

    // Filter transactions for viewed month
    const monthlyTransactions = useMemo(() => {
        return financeData.filter(t => {
            const d = new Date(`${String(t.date || '').slice(0, 10)}T00:00:00`);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [financeData, currentMonth, currentYear]);
    const statementTransactionCount = useMemo(
        () => financeData.filter(transaction => transaction.source === 'statement').length,
        [financeData],
    );

    // Filter by type
    const displayedTransactions = useMemo(() => {
        if (transactionFilter === 'all') return monthlyTransactions;
        if (transactionFilter === 'income') return monthlyTransactions.filter(t => t.type === 'income');
        if (transactionFilter === 'expense') return monthlyTransactions.filter(t => t.type === 'expense');
        if (transactionFilter === 'estimate') return monthlyTransactions.filter(t => t.monthlyEstimate);
        return monthlyTransactions;
    }, [monthlyTransactions, transactionFilter]);
    const searchedTransactions = useMemo(
        () => filterFinanceTransactions(displayedTransactions, transactionSearch),
        [displayedTransactions, transactionSearch],
    );

    // Metrics calculation
    const transactionTotals = getStatementTotals(monthlyTransactions);
    const totalIncome = transactionTotals.income;
    const totalExpense = transactionTotals.spending;
    const incomeTotals = transactionTotals.incomeByCategory;
    const expenseTotals = transactionTotals.spendingByCategory;

    const netSavings = Number((totalIncome - totalExpense).toFixed(2));
    const savingsRatio = totalIncome > 0
        ? Math.max(0, Math.min(100, Math.round((netSavings / totalIncome) * 100)))
        : 0;

    // Chart.js Data
    const incomeColors = ['#10b981', '#059669', '#34d399', '#6ee7b7', '#14b8a6'];
    const expenseColors = ['#ef4444', '#f97316', '#f59e0b', '#ec4899', '#8b5cf6'];

    const incomeChartData = {
        labels: Object.keys(incomeTotals),
        datasets: [{
            data: Object.values(incomeTotals),
            backgroundColor: Object.keys(incomeTotals).map((_, index) => incomeColors[index % incomeColors.length]),
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    const expenseChartData = {
        labels: Object.keys(expenseTotals),
        datasets: [{
            data: Object.values(expenseTotals),
            backgroundColor: Object.keys(expenseTotals).map((_, index) => expenseColors[index % expenseColors.length]),
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    const renderFinanceBreakdown = (title, total, totals, chartData, colors, tone) => (
        <section className={`finance-detail-card ${tone}`}>
            <div className="finance-detail-card-header">
                <h4>{title}</h4>
                <strong>₹{formatAmount(total)}</strong>
            </div>
            {total > 0 ? (
                <div className="finance-detail-content">
                    <div className="finance-detail-chart">
                        <Doughnut
                            data={chartData}
                            options={{
                                cutout: '68%',
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } }
                            }}
                        />
                    </div>
                    <ul className="finance-detail-legend">
                        {Object.entries(totals).map(([label, value], index) => (
                            <li key={label}>
                                <span
                                    className="finance-detail-dot"
                                    style={{ backgroundColor: colors[index % colors.length] }}
                                />
                                <span className="finance-detail-label">{label}</span>
                                <strong>₹{formatAmount(value)}</strong>
                                <small>{Math.round((value / total) * 100)}%</small>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="finance-detail-empty">No {title.toLowerCase()} recorded this month.</p>
            )}
        </section>
    );

    // Add Transaction
    const handleAddTransaction = (e) => {
        e.preventDefault();
        let finalCategory = category;
        let updatedCategories = customCategories;

        if (category === 'add_new_cat') {
            finalCategory = newCategory.trim();
            if (finalCategory && !customCategories.includes(finalCategory)) {
                updatedCategories = [...customCategories, finalCategory];
                setCustomCategories(updatedCategories);
                setStoredFinanceCategories(updatedCategories);
            }
        }

        const newTransaction = {
            id: Date.now(),
            type: finType,
            amount: parseFloat(amount),
            desc: finalCategory,
            date: isMonthlyEstimate ? `${formDate.slice(0, 7)}-01` : formDate,
            monthlyEstimate: isMonthlyEstimate,
            createdAt: new Date().toISOString()
        };

        const updatedFinance = [newTransaction, ...financeData];

        // 1. Synchronously store related details within localStorage immediately
        setStoredFinances(updatedFinance);
        setStoredFinanceCategories(updatedCategories);

        // 2. Update React local state
        setFinanceData(updatedFinance);

        // 3. Sync to backend / auth context if authenticated

        // 4. Emit workspace event for real-time app-wide updates
        emitWorkspaceChange({ type: 'finance', action: 'add', transaction: newTransaction });

        // Reset
        setAmount('');
        setCategory(finType === 'income' ? 'Salary' : 'Groceries');
        setNewCategory('');
        setIsMonthlyEstimate(false);
        setShowAddModal(false);
    };

    const handleStatementUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImportingStatement(true);
        setStatementMessage(null);
        try {
            const result = await parseStatementFile(file, { customCategories });
            const importedTransactions = result.transactions.map((transaction, index) => ({
                ...transaction,
                id: globalThis.crypto?.randomUUID?.() || `statement-${Date.now()}-${index}`,
                createdAt: new Date().toISOString(),
            }));
            const updatedFinance = [...importedTransactions, ...financeData];

            setStoredFinances(updatedFinance);
            setFinanceData(updatedFinance);
            emitWorkspaceChange({
                type: 'finance',
                action: 'statement-import',
                count: importedTransactions.length,
            });

            const latestDate = importedTransactions
                .map(transaction => transaction.date)
                .sort()
                .at(-1);
            if (latestDate) setViewDate(new Date(`${latestDate}T00:00:00`));

            const skippedDetails = Object.entries(result.skippedReasons)
                .map(([reason, count]) => `${count} invalid ${reason}${count === 1 ? '' : 's'}`)
                .join(', ');
            const skippedMessage = result.skippedCount
                ? ` ${result.skippedCount} malformed row${result.skippedCount === 1 ? ' was' : 's were'} skipped (${skippedDetails}).`
                : '';
            const excludedDetails = Object.entries(result.excludedReasons)
                .map(([reason, count]) => `${count} ${reason}`)
                .join(', ');
            const excludedMessage = result.excludedCount
                ? ` Excluded ${result.excludedCount} suspicious debit transaction${result.excludedCount === 1 ? '' : 's'} (${excludedDetails}).`
                : '';
            setStatementMessage({
                type: 'success',
                text: `Imported ${importedTransactions.length} transactions. ${result.failedCount} failed transaction${result.failedCount === 1 ? '' : 's'} remain visible but are excluded from totals.${excludedMessage}${skippedMessage}`,
            });
        } catch (error) {
            setStatementMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'The statement could not be read.',
            });
        } finally {
            setIsImportingStatement(false);
            event.target.value = '';
        }
    };

    const handleClearStatementTransactions = () => {
        if (statementTransactionCount === 0) return;
        const confirmed = window.confirm(
            `Remove all ${statementTransactionCount} transactions imported from statements? Manually added transactions will be kept.`,
        );
        if (!confirmed) return;

        const updatedFinance = financeData.filter(transaction => transaction.source !== 'statement');
        setStoredFinances(updatedFinance);
        setFinanceData(updatedFinance);
        emitWorkspaceChange({
            type: 'finance',
            action: 'statement-clear',
            count: statementTransactionCount,
        });
        setStatementMessage({
            type: 'success',
            text: `Cleared ${statementTransactionCount} statement-imported transaction${statementTransactionCount === 1 ? '' : 's'}. Manually added transactions were kept.`,
        });
    };

    // Delete Transaction
    const handleDelete = (id) => {
        const requireConfirm = localStorage.getItem('appTxConfirm') !== 'false';
        if (requireConfirm && !window.confirm('Delete this transaction record?')) return;

        const updatedFinance = financeData.filter(t => t.id !== id);

        // Synchronously update localStorage
        setStoredFinances(updatedFinance);

        setFinanceData(updatedFinance);
        emitWorkspaceChange({ type: 'finance', action: 'delete', id });
    };

    const allCategories = [
        "Salary", "Groceries", "Utilities", "Dining Out",
        "Transportation", "EMI/Rent", "Shopping", "Investment",
        ...customCategories
    ];

    // Calendar Renderer
    const renderCalendar = () => {
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const days = [];

        const clearLongPressTimer = () => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
        };

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="cal-day empty" />);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayTransactions = monthlyTransactions.filter(t => t.date === dateStr && !t.monthlyEstimate);
            const dayTotals = getStatementTotals(dayTransactions);
            const dayIncome = dayTotals.income;
            const dayExpense = dayTotals.spending;
            const hasActivity = dayTransactions.length > 0;
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const isExpanded = expandedCalendarDay === dateStr;
            const dayPositionClass = i % 7 === 1
                ? 'calendar-popover-start'
                : i % 7 === 0
                    ? 'calendar-popover-end'
                    : '';

            days.push(
                <div
                    key={i}
                    className={`cal-day ${hasActivity ? 'active-day' : ''} ${isToday ? 'today' : ''} ${isExpanded ? 'is-expanded' : ''} ${dayPositionClass}`}
                    role={hasActivity ? 'button' : undefined}
                    tabIndex={hasActivity ? 0 : undefined}
                    aria-label={hasActivity ? `${fullMonthNames[currentMonth]} ${i}: ${dayTransactions.length} transactions` : undefined}
                    aria-expanded={hasActivity ? isExpanded : undefined}
                    onClick={hasActivity ? () => {
                        if (didLongPressRef.current) {
                            didLongPressRef.current = false;
                            return;
                        }
                        setExpandedCalendarDay(current => current === dateStr ? null : dateStr);
                    } : undefined}
                    onTouchStart={hasActivity ? () => {
                        didLongPressRef.current = false;
                        clearLongPressTimer();
                        longPressTimerRef.current = setTimeout(() => {
                            didLongPressRef.current = true;
                            setExpandedCalendarDay(dateStr);
                        }, 450);
                    } : undefined}
                    onTouchEnd={hasActivity ? clearLongPressTimer : undefined}
                    onTouchCancel={hasActivity ? clearLongPressTimer : undefined}
                    onTouchMove={hasActivity ? clearLongPressTimer : undefined}
                    onKeyDown={hasActivity ? (event) => {
                        if (event.key === 'Escape') setExpandedCalendarDay(null);
                    } : undefined}
                >
                    <span className="cal-day-num">{i}</span>
                    {dayIncome > 0 && <span className="cal-tag income">+₹{formatAmount(dayIncome)}</span>}
                    {dayExpense > 0 && <span className="cal-tag expense">-₹{formatAmount(dayExpense)}</span>}
                    {hasActivity && (
                        <div className="calendar-transaction-popover">
                            <strong>{fullMonthNames[currentMonth]} {i}</strong>
                            <ul>
                                {dayTransactions.map((transaction, index) => (
                                    <li key={transaction.id ?? `${dateStr}-${index}`}>
                                        <span>{transaction.name || transaction.desc || (transaction.type === 'income' ? 'Income' : 'Expense')}</span>
                                        <b className={transaction.type === 'income' ? 'income' : 'expense'}>
                                            {transaction.type === 'income' ? '+' : '-'}₹{formatAmount(transaction.amount)}
                                        </b>
                                        {transaction.status === 'FAILED' && <small className="finance-failed-status">Failed</small>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            );
        }
        return days;
    };

    return (
        <div className="routine-page-container finance-page-container">
            {/* TOP BAR: MONTH NAVIGATION (ROUTINE PAGE DESIGN TYPE) */}
            <div className="routine-top-header">
                <div className="routine-date-nav-wrap">
                    <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        className="routine-arrow-btn"
                        title="Previous month"
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <h2 className="routine-date-title">
                        {fullMonthNames[currentMonth]} {currentYear}
                    </h2>

                    <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        className="routine-arrow-btn"
                        title="Next month"
                        aria-label="Next month"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

            </div>

            {/* HERO BANNER: MONTHLY FINANCIAL CONSISTENCY (ROUTINE PROGRESS BANNER STYLE) */}
            <div
                className="routine-progress-banner finance-hero-banner"
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                aria-expanded={showFinanceDetails}
                onClick={() => setShowFinanceDetails(true)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setShowFinanceDetails(true);
                    }
                }}
            >
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
                                className="routine-progress-bar-circle finance-bar"
                                cx="22"
                                cy="22"
                                r="18"
                                strokeDasharray={113}
                                strokeDashoffset={113 - (113 * savingsRatio) / 100}
                            />
                        </svg>
                        <div className="routine-progress-inner-text">
                            <span className="routine-progress-number">{savingsRatio}%</span>
                        </div>
                    </div>
                </div>

                <div className="routine-progress-center">
                    <h3>
                        {totalIncome === 0 && totalExpense === 0
                            ? "No transactions this month"
                            : `Income: ₹${formatAmount(totalIncome)} • Spent: ₹${formatAmount(totalExpense)}`}
                    </h3>
                    <p>
                        {totalIncome === 0 && totalExpense === 0
                            ? "Start logging your income and daily spending."
                            : netSavings >= 0
                            ? `Great discipline! You have a positive balance of +₹${formatAmount(netSavings)} (${savingsRatio}% saved).`
                            : `Spending exceeds income by ₹${formatAmount(Math.abs(netSavings))}. Review allocations below.`}
                    </p>
                </div>

                <div className="routine-progress-streak-tag finance-net-tag">
                    <Wallet size={14} color="#3b82f6" />
                    <span>{netSavings >= 0 ? '+' : ''}₹{formatAmount(netSavings)} Net</span>
                </div>
            </div>

            {showFinanceDetails && (
                <div className="routine-modal-overlay" onClick={() => setShowFinanceDetails(false)}>
                    <div
                        className="routine-modal-card finance-detail-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="finance-detail-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="routine-modal-header">
                            <div>
                                <h3 id="finance-detail-title">Monthly income & spending</h3>
                                <p>{fullMonthNames[currentMonth]} {currentYear}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowFinanceDetails(false)}
                                className="routine-modal-close"
                                aria-label="Close financial details"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="finance-detail-grid">
                            {renderFinanceBreakdown('Income', totalIncome, incomeTotals, incomeChartData, incomeColors, 'income')}
                            {renderFinanceBreakdown('Spending', totalExpense, expenseTotals, expenseChartData, expenseColors, 'expense')}
                        </div>
                        <div className="finance-detail-net">
                            <span>Net balance</span>
                            <strong className={netSavings >= 0 ? 'income' : 'expense'}>
                                {netSavings >= 0 ? '+' : '-'}₹{formatAmount(Math.abs(netSavings))}
                            </strong>
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW MODE TABS (ROUTINE FILTER STYLE) */}
            <div className="routine-time-filters">
                <button
                    type="button"
                    onClick={() => setActiveSubTab('transactions')}
                    className={`routine-filter-chip ${activeSubTab === 'transactions' || activeSubTab === 'calendar' ? 'active' : ''}`}
                >
                    Transactions ({monthlyTransactions.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSubTab('allocation')}
                    className={`routine-filter-chip ${activeSubTab === 'allocation' ? 'active' : ''}`}
                >
                    Growth Plan (40/30/20/10)
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSubTab('charts')}
                    className={`routine-filter-chip ${activeSubTab === 'charts' ? 'active' : ''}`}
                >
                    Analytics & Charts
                </button>
            </div>

            {/* TAB 1: TRANSACTIONS & CASHFLOW CALENDAR VIEW (VISIBLE ALL THE TIME) */}
            {(activeSubTab === 'transactions' || activeSubTab === 'calendar') && (
                <>
                    <div className="routine-add-bar-wrap routine-add-bar-top">
                        <input
                            ref={statementInputRef}
                            type="file"
                            accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                            onChange={handleStatementUpload}
                            className="finance-statement-input"
                            aria-label="Upload a transaction statement"
                            aria-hidden="true"
                            tabIndex={-1}
                        />
                        <button
                            type="button"
                            onClick={() => statementInputRef.current?.click()}
                            className="routine-add-main-btn finance-statement-upload-btn"
                            disabled={isImportingStatement}
                        >
                            <Upload size={18} />
                            <span>{isImportingStatement ? 'Processing statement…' : 'Upload a statement'}</span>
                        </button>
                        {statementTransactionCount > 0 && (
                            <button
                                type="button"
                                onClick={handleClearStatementTransactions}
                                className="routine-add-main-btn finance-clear-statement-btn"
                            >
                                <Trash2 size={18} />
                                <span>Clear uploaded transactions ({statementTransactionCount})</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowAddModal(true)}
                            className="routine-add-main-btn"
                        >
                            <Plus size={18} />
                            <span>Add a new transaction</span>
                        </button>
                    </div>
                    {statementMessage && (
                        <p
                            className={`finance-statement-message ${statementMessage.type}`}
                            role={statementMessage.type === 'error' ? 'alert' : 'status'}
                            aria-live="polite"
                        >
                            {statementMessage.text}
                        </p>
                    )}

                    {/* DAILY CASHFLOW PAYMENT CALENDAR (ALWAYS VISIBLE IN TRANSACTIONS VIEW) */}
                    <div className="finance-calendar-panel" style={{ marginBottom: '18px' }}>
                        <div className="home-section-header finance-calendar-header" style={{ marginBottom: '14px' }}>
                            <div className="home-section-title-wrap">
                                <h3>Daily Cashflow Calendar</h3>
                            </div>
                            <div className="finance-cal-nav-group">
                                <button
                                    type="button"
                                    onClick={() => changeMonth(-1)}
                                    className="routine-arrow-btn finance-cal-arrow"
                                    title="Previous month"
                                    aria-label="Previous month"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="finance-calendar-month-pill">
                                    {fullMonthNames[currentMonth]} {currentYear}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => changeMonth(1)}
                                    className="routine-arrow-btn finance-cal-arrow"
                                    title="Next month"
                                    aria-label="Next month"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="finance-calendar-grid-card">
                            <div className="calendar-weekdays-row">
                                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                            </div>
                            <div className="calendar-month-days-grid">
                                {renderCalendar()}
                            </div>
                        </div>
                    </div>

                    {/* SECONDARY FILTER CHIPS: ALL / INCOME / SPENDING / ESTIMATES */}
                    <div className="finance-type-subfilters">
                        <button
                            type="button"
                            onClick={() => setTransactionFilter('all')}
                            className={`finance-subfilter-btn ${transactionFilter === 'all' ? 'active' : ''}`}
                        >
                            All ({monthlyTransactions.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setTransactionFilter('income')}
                            className={`finance-subfilter-btn income ${transactionFilter === 'income' ? 'active' : ''}`}
                        >
                            <ArrowDownLeft size={13} /> Income ({monthlyTransactions.filter(t => t.type === 'income').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setTransactionFilter('expense')}
                            className={`finance-subfilter-btn expense ${transactionFilter === 'expense' ? 'active' : ''}`}
                        >
                            <ArrowUpRight size={13} /> Spending ({monthlyTransactions.filter(t => t.type === 'expense').length})
                        </button>
                        {monthlyTransactions.some(t => t.monthlyEstimate) && (
                            <button
                                type="button"
                                onClick={() => setTransactionFilter('estimate')}
                                className={`finance-subfilter-btn ${transactionFilter === 'estimate' ? 'active' : ''}`}
                            >
                                Estimates
                            </button>
                        )}
                    </div>

                    <label className="finance-search-wrap">
                        <Search size={18} aria-hidden="true" />
                        <input
                            type="search"
                            value={transactionSearch}
                            onChange={event => setTransactionSearch(event.target.value)}
                            placeholder="Search transactions by name, category, date, or amount"
                            aria-label="Search transactions"
                        />
                        {transactionSearch && (
                            <button
                                type="button"
                                onClick={() => setTransactionSearch('')}
                                className="finance-search-clear"
                                aria-label="Clear transaction search"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </label>

                    {/* TRANSACTIONS CARDS LIST (ROUTINE TASK CARD DESIGN TYPE) */}
                    <div className="routine-tasks-list">
                        {searchedTransactions.length === 0 ? (
                            <div className="routine-empty-box">
                                <Sparkles size={32} color="#3b82f6" />
                                <h4>{transactionSearch ? 'No matching transactions' : 'No transactions in this view'}</h4>
                                <p>
                                    {transactionSearch
                                        ? 'Try another name, category, date, amount, or transaction type.'
                                        : 'Record your income, groceries, rent, or dining expenses to track your balance.'}
                                </p>
                                {transactionSearch ? (
                                    <button
                                        type="button"
                                        onClick={() => setTransactionSearch('')}
                                        className="routine-template-btn work"
                                        style={{ margin: '12px auto 0' }}
                                    >
                                        <X size={16} />
                                        <span>Clear search</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(true)}
                                        className="routine-template-btn work"
                                        style={{ margin: '12px auto 0' }}
                                    >
                                        <Plus size={16} />
                                        <span>Log First Transaction</span>
                                    </button>
                                )}
                            </div>
                        ) : (
                            searchedTransactions.map((tx) => {
                                const meta = getFinanceCategoryMeta(tx.desc || tx.name || 'Uncategorized', tx.type);
                                const IconComponent = meta.icon;

                                return (
                                    <div
                                        key={tx.id}
                                        className={`routine-task-card finance-tx-card ${tx.type === 'income' ? 'is-income' : 'is-expense'}`}
                                    >
                                        {/* LEFT CATEGORY ICON */}
                                        <div
                                            className="routine-task-icon-wrap"
                                            style={{ background: meta.bg, color: meta.color }}
                                        >
                                            <IconComponent size={20} />
                                        </div>

                                        {/* CENTER DETAILS */}
                                        <div className="routine-task-details">
                                            <h4 className="routine-task-title">{tx.name || tx.desc || 'Uncategorized'}</h4>
                                            <div className="routine-task-meta-row">
                                                <span className={`routine-task-tag ${tx.type === 'income' ? 'income-tag' : 'expense-tag'}`}>
                                                    ★ {tx.type === 'income' ? 'Income' : 'Spending'}
                                                </span>
                                                <span className="routine-task-time-text">{tx.desc || 'Uncategorized'}</span>
                                                {tx.status === 'FAILED' && <span className="finance-failed-status">Failed · excluded from totals</span>}
                                                <span className="routine-task-time-text">
                                                    {tx.monthlyEstimate
                                                        ? `${monthNames[new Date(tx.date).getMonth()]} · Monthly Estimate`
                                                        : tx.date}
                                                </span>
                                            </div>
                                        </div>

                                        {/* RIGHT: AMOUNT BADGE & DELETE */}
                                        <div className="routine-task-right">
                                            <div className={`finance-amount-badge ${tx.type === 'income' ? 'income' : 'expense'}`}>
                                                <span>{tx.type === 'income' ? '+' : '-'}₹{formatAmount(tx.amount)}</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleDelete(tx.id)}
                                                className="routine-task-delete-btn"
                                                title="Delete transaction"
                                                aria-label="Delete transaction"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}

            {/* TAB 3: 40/30/20/10 FINANCIAL GROWTH ALLOCATION */}
            {activeSubTab === 'allocation' && (
                <div className="finance-allocation-panel">
                    <div className="home-section-header" style={{ marginBottom: '14px' }}>
                        <div className="home-section-title-wrap">
                            <Sparkles size={18} className="home-section-icon" />
                            <h3>Smart 40 / 30 / 20 / 10 Allocation Plan</h3>
                        </div>
                    </div>

                    <p className="finance-plan-desc">
                        Based on your monthly income of <strong>₹{formatAmount(totalIncome)}</strong>, here is your healthy allocation target:
                    </p>

                    <div className="finance-allocation-grid">
                        <div className="finance-alloc-card blue">
                            <div className="alloc-header">
                                <span className="alloc-title">EMI & Housing</span>
                                <span className="alloc-pct">40% Target</span>
                            </div>
                            <strong className="alloc-amt">₹{formatAmount(totalIncome * 0.40)}</strong>
                            <p className="alloc-note">Rent, home maintenance, major EMIs</p>
                        </div>

                        <div className="finance-alloc-card orange">
                            <div className="alloc-header">
                                <span className="alloc-title">Living & Lifestyle</span>
                                <span className="alloc-pct">30% Target</span>
                            </div>
                            <strong className="alloc-amt">₹{formatAmount(totalIncome * 0.30)}</strong>
                            <p className="alloc-note">Groceries, transport, dining, shopping</p>
                        </div>

                        <div className="finance-alloc-card green">
                            <div className="alloc-header">
                                <span className="alloc-title">Savings & Growth</span>
                                <span className="alloc-pct">20% Target</span>
                            </div>
                            <strong className="alloc-amt">₹{formatAmount(totalIncome * 0.20)}</strong>
                            <p className="alloc-note">Emergency fund, stocks, mutual funds</p>
                        </div>

                        <div className="finance-alloc-card purple">
                            <div className="alloc-header">
                                <span className="alloc-title">Giving & Personal</span>
                                <span className="alloc-pct">10% Target</span>
                            </div>
                            <strong className="alloc-amt">₹{formatAmount(totalIncome * 0.10)}</strong>
                            <p className="alloc-note">Charity, tithe, hobbies, gifting</p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: ANALYTICS & DUAL DOUGHNUT CHARTS */}
            {activeSubTab === 'charts' && (
                <div className="finance-charts-panel">
                    <div className="finance-dual-charts-grid">
                        {/* Income Sources Chart */}
                        <div className="finance-chart-card">
                            <h4>Income Sources (₹{formatAmount(totalIncome)})</h4>
                            <div className="finance-chart-body">
                                {Object.keys(incomeTotals).length > 0 ? (
                                    <>
                                        <div className="chart-center-val">
                                            <strong style={{ color: '#10b981' }}>+₹{formatAmount(totalIncome)}</strong>
                                        </div>
                                        <Doughnut
                                            data={incomeChartData}
                                            options={{ cutout: '74%', plugins: { legend: { display: false } } }}
                                        />
                                    </>
                                ) : (
                                    <div className="chart-empty-text">No income logged yet</div>
                                )}
                            </div>
                        </div>

                        {/* Spending Habits Chart */}
                        <div className="finance-chart-card">
                            <h4>Spending Breakdown (₹{formatAmount(totalExpense)})</h4>
                            <div className="finance-chart-body">
                                {Object.keys(expenseTotals).length > 0 ? (
                                    <>
                                        <div className="chart-center-val">
                                            <strong style={{ color: '#ef4444' }}>-₹{formatAmount(totalExpense)}</strong>
                                        </div>
                                        <Doughnut
                                            data={expenseChartData}
                                            options={{ cutout: '74%', plugins: { legend: { display: false } } }}
                                        />
                                    </>
                                ) : (
                                    <div className="chart-empty-text">No expenses logged yet</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD TRANSACTION MODAL SHEET (ROUTINE MODAL DESIGN TYPE) */}
            {showAddModal && (
                <div className="routine-modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="routine-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="routine-modal-header">
                            <h3>Add Transaction</h3>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="routine-modal-close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* INCOME VS EXPENSE SEGMENTED SWITCH */}
                        <div className="finance-modal-type-tabs">
                            <button
                                type="button"
                                className={`finance-modal-type-btn expense ${finType === 'expense' ? 'active' : ''}`}
                                onClick={() => {
                                    setFinType('expense');
                                    setCategory('Groceries');
                                }}
                            >
                                <ArrowUpRight size={15} /> Expense
                            </button>
                            <button
                                type="button"
                                className={`finance-modal-type-btn income ${finType === 'income' ? 'active' : ''}`}
                                onClick={() => {
                                    setFinType('income');
                                    setCategory('Salary');
                                }}
                            >
                                <ArrowDownLeft size={15} /> Income
                            </button>
                        </div>

                        {/* QUICK PRESET CHIPS */}
                        <div className="routine-presets-wrap">
                            <span className="routine-presets-label">Quick Categories:</span>
                            <div className="routine-presets-row">
                                {DEFAULT_PRESET_CATEGORIES
                                    .filter(c => c.type === finType)
                                    .map(c => (
                                        <button
                                            key={c.name}
                                            type="button"
                                            onClick={() => setCategory(c.name)}
                                            className={`routine-preset-chip ${category === c.name ? 'active' : ''}`}
                                        >
                                            {c.name}
                                        </button>
                                    ))}
                            </div>
                        </div>

                        <form onSubmit={handleAddTransaction} className="routine-add-form">
                            <div className="routine-form-field">
                                <label>Amount (₹)</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="e.g. 500"
                                    required
                                    min="1"
                                    step="any"
                                    autoFocus
                                    className="routine-input-text finance-amt-input"
                                />
                            </div>

                            <div className="routine-form-field">
                                <label>Category</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="routine-input-text"
                                    required
                                >
                                    {allCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                    <option value="add_new_cat">+ Custom Category...</option>
                                </select>
                            </div>

                            {category === 'add_new_cat' && (
                                <div className="routine-form-field">
                                    <label>Custom Category Name</label>
                                    <input
                                        type="text"
                                        value={newCategory}
                                        onChange={(e) => setNewCategory(e.target.value)}
                                        placeholder="e.g. Pet Care, Gadgets"
                                        required
                                        className="routine-input-text"
                                    />
                                </div>
                            )}

                            <div className="routine-form-field">
                                <label className="finance-estimate-checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={isMonthlyEstimate}
                                        onChange={(e) => setIsMonthlyEstimate(e.target.checked)}
                                    />
                                    <span><strong>Monthly estimate</strong> (General month expenditure)</span>
                                </label>
                            </div>

                            <div className="routine-form-field">
                                <label>{isMonthlyEstimate ? 'Expected Month' : 'Transaction Date'}</label>
                                <input
                                    type={isMonthlyEstimate ? 'month' : 'date'}
                                    value={isMonthlyEstimate ? formDate.slice(0, 7) : formDate}
                                    onChange={(e) => setFormDate(isMonthlyEstimate ? `${e.target.value}-01` : e.target.value)}
                                    required
                                    className="routine-input-text"
                                />
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
                                    Save Transaction
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}