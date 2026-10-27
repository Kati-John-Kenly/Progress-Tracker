import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { House, ListTodo, Wallet, Settings as SettingsIcon, Sparkles, Bell, X, ChevronRight, Flame, Quote, BarChart3, Search, Smile } from 'lucide-react';
import AIAssistantBot from './AIAssistantBot';
import GeminiIcon from './GeminiIcon';
import { subscribeWorkspaceChange, calculateStreakStats, getStoredRoutineTasks } from '../utils/workspaceEvents';
import { hasSavedDeviceBiometric, verifyDeviceBiometric } from '../utils/deviceBiometrics';
import { isLocalPasscodeConfigured, verifyLocalPasscode } from '../utils/localPasscode';

const DAILY_NOTIF_QUOTES = [
    "Your future is created by what you do today, not tomorrow.",
    "Success is the sum of small efforts, repeated day in and day out.",
    "Don't watch the clock; do what it does. Keep going.",
    "The secret of getting ahead is getting started."
];

const primaryNavigation = [
    { to: '/', label: 'Dashboard', icon: House, end: true },
    { to: '/routine', label: 'Habits', icon: ListTodo, end: true },
    { to: '/finance', label: 'Finance', icon: Wallet, end: true },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: SettingsIcon }
];

const isAppLockEnabled = () => (
    (localStorage.getItem('appFaceId') === 'true' && hasSavedDeviceBiometric()) ||
    isLocalPasscodeConfigured()
);

const DashboardLayout = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [headerSearch, setHeaderSearch] = useState('');
    const [isLocked, setIsLocked] = useState(() => isAppLockEnabled());
    const [unlockPin, setUnlockPin] = useState('');
    const [unlockError, setUnlockError] = useState('');
    const [isUnlocking, setIsUnlocking] = useState(false);
    
    // Streak & Modal State
    const [showStreakModal, setShowStreakModal] = useState(false);
    const [streak, setStreak] = useState(0);
    const [maxStreak, setMaxStreak] = useState(0);
    const [tasks, setTasks] = useState([]);

    // In-App Notification Center State
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(() => {
        try {
            return sessionStorage.getItem('notif_read_session') !== 'true';
        } catch {
            return true;
        }
    });
    const [notifQuote] = useState(() => DAILY_NOTIF_QUOTES[Math.floor(Math.random() * DAILY_NOTIF_QUOTES.length)]);
    
    // Calendar State
    const [viewDate, setViewDate] = useState(new Date());
    
    const navigate = useNavigate();
    const location = useLocation();
    const pageTitle = location.pathname === '/routine' ? 'Habits'
        : location.pathname === '/schedule' ? 'Schedule'
            : location.pathname === '/finance' ? 'Finance'
                : location.pathname === '/analytics' ? 'Analytics'
                    : location.pathname === '/settings' ? 'Settings'
                        : 'Dashboard';
    // Refresh streak and tasks
    const refreshData = useCallback(() => {
        const allTasks = getStoredRoutineTasks();
        setTasks(allTasks);
        const { currentStreak, maxStreak: calculatedMax } = calculateStreakStats(allTasks);
        setStreak(currentStreak);
        setMaxStreak(calculatedMax);
    }, []);

    // Workspace subscription (Optimized dependencies: only on mount / refreshData)
    useEffect(() => {
        refreshData();
        const unsubscribe = subscribeWorkspaceChange(() => {
            refreshData();
        });
        const handleOpenModal = () => setShowStreakModal(true);
        window.addEventListener('open-streak-modal', handleOpenModal);
        return () => {
            unsubscribe();
            window.removeEventListener('open-streak-modal', handleOpenModal);
        };
    }, [refreshData]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && isAppLockEnabled()) {
                setIsLocked(true);
                setUnlockPin('');
                setUnlockError('');
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    const unlockWithBiometric = async () => {
        setIsUnlocking(true);
        setUnlockError('');
        try {
            await verifyDeviceBiometric();
            setIsLocked(false);
        } catch (error) {
            if (error.name !== 'NotAllowedError') {
                setUnlockError(error.message || 'Biometric verification failed. Use your passcode to unlock.');
            }
        } finally {
            setIsUnlocking(false);
        }
    };

    const unlockWithPasscode = async (event) => {
        event.preventDefault();
        setIsUnlocking(true);
        setUnlockError('');
        try {
            const isValid = await verifyLocalPasscode(unlockPin);
            if (!isValid) {
                setUnlockError('Incorrect passcode.');
                return;
            }
            setUnlockPin('');
            setIsLocked(false);
        } catch (error) {
            setUnlockError(error.message || 'Could not verify the passcode.');
        } finally {
            setIsUnlocking(false);
        }
    };

    // Active day tasks calculation for notification alert badges
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    const todayTasks = useMemo(() => tasks.filter(t => t.date === todayStr), [tasks, todayStr]);
    const todayTasksCount = todayTasks.length;
    const completedTasksCount = todayTasks.filter(t => t.completed).length;
    const remainingTasksCount = todayTasksCount - completedTasksCount; 

    // Calendar Renderer Logic
    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const changeMonth = (offset) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setViewDate(newDate);
    };

    const renderCalendar = () => {
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="cal-day empty" />);
        }
        
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayTasks = tasks.filter(t => t.date === dateStr);
            const totalTasks = dayTasks.length;
            const completedTasks = dayTasks.filter(t => t.completed).length;
            
            let statusClass = 'none';
            if (totalTasks > 0) {
                if (completedTasks === totalTasks) statusClass = 'perfect';
                else if (completedTasks > 0) statusClass = 'partial';
                else statusClass = 'pending';
            }

            const isToday = dateStr === new Date().toISOString().split('T')[0];

            days.push(
                <div
                    key={i}
                    className={`streak-cal-day ${statusClass} ${isToday ? 'is-today' : ''}`}
                >
                    <span>{i}</span>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="app-layout">
            {/* UPGRADED STREAK MODAL OVERLAY (LIGHT/DARK THEME CLEAN) */}
            {showStreakModal && (
                <div className="routine-modal-overlay" onClick={() => setShowStreakModal(false)}>
                    <div className="routine-modal-card streak-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="routine-modal-header">
                            <h3>Consistency Streak</h3>
                            <button
                                type="button"
                                onClick={() => setShowStreakModal(false)}
                                className="routine-modal-close"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <p className="streak-modal-sub">
                            Complete 100% of your scheduled tasks daily to build and maintain your streak.
                        </p>
                        
                        {/* Side-by-Side Stats */}
                        <div className="streak-stats-row">
                            <div className="streak-stat-box current">
                                <span className="streak-stat-icon">🔥</span>
                                <span className="streak-stat-number">{streak}</span>
                                <span className="streak-stat-label">Current Streak</span>
                            </div>
                            <div className="streak-stat-box max">
                                <span className="streak-stat-icon">🏆</span>
                                <span className="streak-stat-number">{maxStreak}</span>
                                <span className="streak-stat-label">Best Record</span>
                            </div>
                        </div>

                        {/* Embedded Calendar View */}
                        <div className="streak-calendar-box">
                            <div className="streak-cal-nav">
                                <button type="button" onClick={() => changeMonth(-1)} className="routine-arrow-btn">&lt;</button>
                                <strong>{monthNames[currentMonth]} {currentYear}</strong>
                                <button type="button" onClick={() => changeMonth(1)} className="routine-arrow-btn">&gt;</button>
                            </div>

                            <div className="calendar-weekdays-row">
                                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                            </div>

                            <div className="streak-cal-grid">
                                {renderCalendar()}
                            </div>

                            <div className="streak-legend-row">
                                <span className="legend-item"><span className="legend-dot perfect" /> 100% Done</span>
                                <span className="legend-item"><span className="legend-dot partial" /> In Progress</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => { setShowStreakModal(false); navigate('/routine'); }}
                            className="routine-submit-btn"
                            style={{ marginTop: '16px' }}
                        >
                            Open Daily Planner
                        </button>
                    </div>
                </div>
            )}

            {/* IN-APP NOTIFICATIONS MODAL OVERLAY (IMAGE 1 ALERTS CONVERTED TO NOTIFICATIONS) */}
            {showNotificationModal && (
                <div className="routine-modal-overlay" onClick={() => setShowNotificationModal(false)}>
                    <div className="routine-modal-card notification-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="routine-modal-header">
                            <div className="notification-modal-title">
                                <Bell size={20} color="#3b82f6" />
                                <h3>Daily Notifications & Alerts</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowNotificationModal(false)}
                                className="routine-modal-close"
                                aria-label="Close notifications"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="notification-items-list">
                            {/* NOTIFICATION 1: TASKS AGENDA ALERT (CONVERTED FROM ALERT 2) */}
                            <div
                                className="notification-item tasks-notif"
                                onClick={() => { setShowNotificationModal(false); navigate('/routine'); }}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="notif-icon-wrap tasks">
                                    <ListTodo size={18} />
                                </div>
                                <div className="notif-content">
                                    <div className="notif-header">
                                        <span className="notif-category tasks">Tasks Progress</span>
                                        <span className="notif-badge-pill tasks">
                                            {todayTasksCount === 0 ? 'No Tasks' : remainingTasksCount === 0 ? '100% Done' : `${remainingTasksCount} Pending`}
                                        </span>
                                    </div>
                                    <h4 className="notif-title">
                                        {todayTasksCount === 0
                                            ? "No tasks planned for today"
                                            : remainingTasksCount === 0
                                            ? `All ${todayTasksCount} tasks completed! 🎉`
                                            : `${remainingTasksCount} task${remainingTasksCount === 1 ? '' : 's'} remaining (${completedTasksCount}/${todayTasksCount} finished)`}
                                    </h4>
                                    <p className="notif-desc">
                                        {todayTasksCount === 0
                                            ? "Tap here to plan your focus routine and set your goals."
                                            : remainingTasksCount === 0
                                            ? "Incredible focus today! You've achieved 100% of your targets."
                                            : "Tap to open your routine planner and conquer your next habit."}
                                    </p>
                                </div>
                                <ChevronRight size={16} className="notif-arrow" />
                            </div>

                            {/* NOTIFICATION 2: STREAK SHIELD DEFENSE (CONVERTED FROM ALERT 3) */}
                            <div
                                className="notification-item streak-notif"
                                onClick={() => { setShowNotificationModal(false); setShowStreakModal(true); }}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="notif-icon-wrap streak">
                                    <Flame size={18} />
                                </div>
                                <div className="notif-content">
                                    <div className="notif-header">
                                        <span className="notif-category streak">Streak Shield</span>
                                        <span className="notif-badge-pill streak">{streak}d Streak 🔥</span>
                                    </div>
                                    <h4 className="notif-title">
                                        {streak === 0
                                            ? "Ignite your consistency streak today!"
                                            : "Don't let your streak die!"}
                                    </h4>
                                    <p className="notif-desc">
                                        {remainingTasksCount > 0
                                            ? `Complete your ${remainingTasksCount} remaining task${remainingTasksCount === 1 ? '' : 's'} before midnight to protect your flame.`
                                            : todayTasksCount === 0
                                            ? "Complete at least one task today to build your unbroken streak."
                                            : "Flame secured for today! Keep the momentum alive tomorrow."}
                                    </p>
                                </div>
                                <ChevronRight size={16} className="notif-arrow" />
                            </div>

                            {/* NOTIFICATION 3: DAILY INSPIRATION QUOTE */}
                            <div className="notification-item quote-notif">
                                <div className="notif-icon-wrap quote">
                                    <Quote size={18} />
                                </div>
                                <div className="notif-content">
                                    <div className="notif-header">
                                        <span className="notif-category quote">Daily Mindset</span>
                                        <span className="notif-badge-pill quote">Inspiration</span>
                                    </div>
                                    <p className="notif-quote-phrase">
                                        "{notifQuote}"
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="notification-modal-footer">
                            <button
                                type="button"
                                className="notif-clear-btn"
                                onClick={() => {
                                    setHasUnreadNotifications(false);
                                    setShowNotificationModal(false);
                                    try { sessionStorage.setItem('notif_read_session', 'true'); } catch {}
                                }}
                            >
                                Mark All as Read & Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SIDEBAR (DESKTOP) */}
            <aside className="sidebar">
                <div className="logo-area">
                    <img src="/favicon.png" alt="" className="main-logo" />
                    <h2><span>Progress</span><strong>Tracker</strong></h2>
                </div>
                <nav className="sidebar-nav">
                    {primaryNavigation.map(({ to, label, icon: Icon, end }) => (
                        <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                            <span className="icon"><Icon size={20} aria-hidden="true" /></span>
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-bottom-ai">
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('open-ai-assistant'))}
                        className="sidebar-ai-trigger"
                        title="Open Gemini AI Assistant"
                    >
                        <div className="sidebar-ai-trigger-left">
                            <GeminiIcon size={18} />
                            <span>Ask Gemini AI</span>
                        </div>
                        <Sparkles size={14} />
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="main-content">
                <header className="top-header">
                    <h1 className="mobile-page-title">{pageTitle}</h1>
                    <div className="header-search-wrap">
                        <Search size={19} aria-hidden="true" />
                        <input
                            type="text"
                            value={headerSearch}
                            onChange={event => setHeaderSearch(event.target.value)}
                            placeholder="Search pages..."
                            aria-label="Search navigation"
                            aria-expanded={Boolean(headerSearch.trim())}
                            aria-controls="header-search-results"
                        />
                        {headerSearch.trim() && (
                            <div className="header-search-results" id="header-search-results">
                                {primaryNavigation
                                    .filter(item => item.label.toLowerCase().includes(headerSearch.trim().toLowerCase()))
                                    .map(({ to, label, icon: Icon }) => (
                                        <NavLink key={to} to={to} onClick={() => setHeaderSearch('')}>
                                            <Icon size={17} aria-hidden="true" />
                                            <span>{label}</span>
                                        </NavLink>
                                    ))}
                                {!primaryNavigation.some(item => item.label.toLowerCase().includes(headerSearch.trim().toLowerCase())) && (
                                    <span className="header-search-empty">No pages found</span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="header-right">
                        {/* IN-APP NOTIFICATION BELL WITH UNREAD BADGE */}
                        <button
                            type="button"
                            className="notification-bell-btn"
                            onClick={() => {
                                setShowNotificationModal(true);
                                setHasUnreadNotifications(false);
                                try { sessionStorage.setItem('notif_read_session', 'true'); } catch {}
                            }}
                            title="Daily Notifications & Alerts"
                            aria-label="Open notifications"
                        >
                            <Bell size={19} />
                            {hasUnreadNotifications && <span className="bell-badge-dot" />}
                        </button>

                        <button
                            className="user-avatar"
                            type="button"
                            aria-label="Workspace menu"
                            aria-expanded={menuOpen}
                            onClick={() => setMenuOpen(!menuOpen)}
                        >
                            P
                        </button>
                        
                        {menuOpen && (
                            <div className="profile-menu">
                                <div className="profile-menu-info">
                                    <strong id="menuUserName">Personal Workspace</strong>
                                </div>
                                <button type="button" onClick={() => { setMenuOpen(false); navigate('/settings'); }}>Settings</button>
                            </div>
                        )}
                    </div>
                </header>

                <div className="views-container">
                    <Outlet />
                </div>
            </main>

            <nav className="bottom-nav bottom-nav-dock" aria-label="Primary navigation">
                {primaryNavigation.map(({ to, label, icon: Icon, end }) => (
                    <NavLink key={to} to={to} end={end} aria-label={label} className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                        <span className="icon"><Icon size={20} aria-hidden="true" /></span>
                        <span className="nav-label">{label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* AURA PERSONAL WORKSPACE AI ASSISTANT BOT */}
            <AIAssistantBot onOpenStreakModal={() => setShowStreakModal(true)} />

            {isLocked && (
                <div className="app-lock-overlay">
                    <section className="app-lock-card" aria-labelledby="app-lock-title">
                        <div className="app-lock-icon">
                            <Lock size={25} />
                        </div>
                        <h2 id="app-lock-title">Unlock Progress</h2>
                        <p>Verify your identity to continue to your workspace.</p>
                        {localStorage.getItem('appFaceId') === 'true' && hasSavedDeviceBiometric() && (
                            <button
                                type="button"
                                className="app-lock-biometric-btn"
                                onClick={unlockWithBiometric}
                                disabled={isUnlocking}
                            >
                                <Smile size={18} />
                                {isUnlocking ? 'Verifying…' : 'Use Face ID or fingerprint'}
                            </button>
                        )}
                        {isLocalPasscodeConfigured() && (
                            <form className="app-lock-passcode-form" onSubmit={unlockWithPasscode}>
                                <label htmlFor="app-unlock-pin">Passcode</label>
                                <div className="app-lock-passcode-row">
                                    <input
                                        id="app-unlock-pin"
                                        type="password"
                                        inputMode="numeric"
                                        autoComplete="current-password"
                                        maxLength={4}
                                        pattern="[0-9]{4}"
                                        value={unlockPin}
                                        onChange={(event) => setUnlockPin(event.target.value.replace(/\D/g, ''))}
                                        autoFocus={localStorage.getItem('appFaceId') !== 'true'}
                                    />
                                    <button type="submit" disabled={isUnlocking || unlockPin.length !== 4}>
                                        Unlock
                                    </button>
                                </div>
                            </form>
                        )}
                        {unlockError && <p className="app-lock-error" role="alert">{unlockError}</p>}
                    </section>
                </div>
            )}
        </div>
    );
};

export default DashboardLayout;