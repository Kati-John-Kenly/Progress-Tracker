import { useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { House, ListTodo, Wallet, Settings as SettingsIcon, Sparkles, Bell, X, ChevronRight, Flame, Quote } from 'lucide-react';
import { AuthContext } from '../context/AuthState';
import AIAssistantBot from './AIAssistantBot';
import GeminiIcon from './GeminiIcon';
import StreakFireBadge from './StreakFireBadge';
import { subscribeWorkspaceChange, calculateStreakStats, getStoredRoutineTasks } from '../utils/workspaceEvents';

const DAILY_NOTIF_QUOTES = [
    "Your future is created by what you do today, not tomorrow.",
    "Success is the sum of small efforts, repeated day in and day out.",
    "Don't watch the clock; do what it does. Keep going.",
    "The secret of getting ahead is getting started."
];

const DashboardLayout = () => {
    const { user, logout } = useContext(AuthContext);
    const [menuOpen, setMenuOpen] = useState(false);
    
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
    const pageTitle = location.pathname === '/routine' ? 'Routine'
        : location.pathname === '/finance' ? 'Finance'
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
                    <img src="/favicon.svg" alt="Logo" className="main-logo" onError={(e) => e.target.style.display='none'} />
                    <h2>Progress</h2>
                </div>
                <nav className="sidebar-nav">
                    <NavLink to="/" end className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}><span className="icon"><House size={20} aria-hidden="true" /></span> Home</NavLink>
                    <NavLink to="/routine" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}><span className="icon"><ListTodo size={20} aria-hidden="true" /></span> Routine</NavLink>
                    <NavLink to="/finance" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}><span className="icon"><Wallet size={20} aria-hidden="true" /></span> Finance</NavLink>
                    <NavLink to="/settings" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}><span className="icon"><SettingsIcon size={20} aria-hidden="true" /></span> Settings</NavLink>
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
                {location.pathname !== '/settings' && <header className="top-header">
                    <h1 id="pageTitle">{pageTitle}</h1>
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

                        {/* STREAK FIRE BADGE (COUNT INSIDE FLAME) */}
                        <StreakFireBadge streak={streak} onClick={() => setShowStreakModal(true)} />
                        
                        <button
                            className="user-avatar"
                            type="button"
                            aria-label="Account menu"
                            aria-expanded={menuOpen}
                            onClick={() => setMenuOpen(!menuOpen)}
                        >
                            {user?.imageUrl ? (
                                <img src={user.imageUrl} alt="" />
                            ) : (
                                user?.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '👤'
                            )}
                        </button>
                        
                        {menuOpen && (
                            <div className="profile-menu">
                                <div className="profile-menu-info">
                                    <strong id="menuUserName">{user ? user.name : 'Guest User'}</strong>
                                    {user?.email && <small>{user.email}</small>}
                                </div>
                                {!user ? (
                                    <button type="button" onClick={() => { setMenuOpen(false); navigate('/settings'); }}>Sign in or create account</button>
                                ) : (
                                    <>
                                        <button type="button" onClick={() => { setMenuOpen(false); navigate('/settings'); }}>Account settings</button>
                                        <button type="button" className="signout-btn" onClick={() => { logout(); setMenuOpen(false); }}>Sign out</button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </header>}

                <div className="views-container">
                    <Outlet />
                </div>
            </main>

            {/* FLOATING BOTTOM NAV DOCK (MATCHING IMAGE 1 & 3 ELEVATED CENTER NOTCH) */}
            <nav className="bottom-nav bottom-nav-dock" aria-label="Primary navigation">
                <div className="bottom-nav-side bottom-nav-left">
                    <NavLink to="/" end aria-label="Home" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                        <span className="icon"><House size={20} aria-hidden="true" /></span>
                        <span className="nav-label">Home</span>
                    </NavLink>
                    <NavLink to="/routine" aria-label="Routine" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                        <span className="icon"><ListTodo size={20} aria-hidden="true" /></span>
                        <span className="nav-label">Routine</span>
                    </NavLink>
                </div>

                {/* ELEVATED CENTER GEMINI AI BUTTON */}
                <div className="bottom-nav-center-notch">
                    <button
                        type="button"
                        aria-label="Ask Gemini AI"
                        className="dock-gemini-center-btn"
                        onClick={() => window.dispatchEvent(new CustomEvent('open-ai-assistant'))}
                        title="Open Gemini AI Assistant"
                    >
                        <div className="dock-gemini-glow" />
                        <GeminiIcon size={26} color="#ffffff" />
                    </button>
                </div>

                <div className="bottom-nav-side bottom-nav-right">
                    <NavLink to="/finance" aria-label="Finance" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                        <span className="icon"><Wallet size={20} aria-hidden="true" /></span>
                        <span className="nav-label">Finance</span>
                    </NavLink>
                    <NavLink to="/settings" aria-label="Settings" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                        <span className="icon"><SettingsIcon size={20} aria-hidden="true" /></span>
                        <span className="nav-label">Settings</span>
                    </NavLink>
                </div>
            </nav>

            {/* AURA PERSONAL WORKSPACE AI ASSISTANT BOT */}
            <AIAssistantBot onOpenStreakModal={() => setShowStreakModal(true)} />
        </div>
    );
};

export default DashboardLayout;