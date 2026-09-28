import React, { useContext, useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const DashboardLayout = () => {
    const { user, logout } = useContext(AuthContext);
    const [menuOpen, setMenuOpen] = useState(false);
    
    // Streak & Modal State
    const [showStreakModal, setShowStreakModal] = useState(false);
    const [streak, setStreak] = useState(0);
    const [maxStreak, setMaxStreak] = useState(0);
    const [tasks, setTasks] = useState([]);
    
    // Calendar State
    const [viewDate, setViewDate] = useState(new Date());
    
    const navigate = useNavigate();
    const location = useLocation(); // Used to trigger recalculations when tabs change

    // --- CALCULATE STREAKS & LOAD DATA ---
    useEffect(() => {
        const allTasks = JSON.parse(localStorage.getItem('hybridRoutineTasks')) || [];
        setTasks(allTasks);
        
        const uniqueDates = [...new Set(allTasks.map(t => t.date))].sort(); 
        
        // 1. Calculate Max Streak (All-Time Record)
        let tempStreak = 0;
        let max = 0;
        uniqueDates.forEach(date => {
            const dayTasks = allTasks.filter(t => t.date === date);
            if (dayTasks.length > 0 && dayTasks.every(t => t.completed)) {
                tempStreak++;
                if (tempStreak > max) max = tempStreak;
            } else {
                tempStreak = 0;
            }
        });
        setMaxStreak(max);

        // 2. Calculate Current Streak (Working backwards)
        const datesRev = [...uniqueDates].reverse();
        let currentStreak = 0;
        for (const date of datesRev) {
            const dayTasks = allTasks.filter(t => t.date === date);
            if (dayTasks.length > 0) {
                const isPerfect = dayTasks.every(t => t.completed);
                if (isPerfect) {
                    currentStreak++;
                } else {
                    const today = new Date().toISOString().split('T')[0];
                    if (date !== today) break; // Break if a past day was missed
                }
            }
        }
        setStreak(currentStreak);
    }, [location.pathname, showStreakModal]); 

    // --- CALENDAR RENDERER LOGIC ---
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
            days.push(<div key={`empty-${i}`} style={{ background: 'transparent', border: 'none' }}></div>);
        }
        
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            const dayTasks = tasks.filter(t => t.date === dateStr);
            const totalTasks = dayTasks.length;
            const completedTasks = dayTasks.filter(t => t.completed).length;
            
            let bgStyle = 'var(--bg-card)';
            let borderStyle = '1px solid var(--border)';
            
            if (totalTasks > 0) {
                if (completedTasks === totalTasks) {
                    bgStyle = 'rgba(16, 185, 129, 0.2)'; // Green
                    borderStyle = '1px solid var(--success)';
                } else if (completedTasks > 0) {
                    bgStyle = 'rgba(249, 115, 22, 0.15)'; // Orange
                    borderStyle = '1px solid #f97316';
                } else {
                    bgStyle = 'rgba(255,255,255,0.05)';
                }
            }

            const isToday = dateStr === new Date().toISOString().split('T')[0];
            if (isToday) borderStyle = '2px solid var(--primary)';

            days.push(
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 4px', background: bgStyle, border: borderStyle, borderRadius: '6px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{i}</span>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="app-layout">
            
            {/* --- THE UPGRADED STREAK MODAL OVERLAY --- */}
            {showStreakModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="card" style={{ maxWidth: '400px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '25px', position: 'relative', animation: 'fadeIn 0.3s ease' }}>
                        <button onClick={() => setShowStreakModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                        
                        <h2 style={{ textAlign: 'center', marginBottom: '5px', fontSize: '1.4rem' }}>Consistency Log</h2>
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Complete 100% of your daily scheduled tasks to increase your streak.</p>
                        
                        {/* Side-by-Side Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', background: 'var(--bg-dark)', padding: '20px 10px', borderRadius: '12px', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                                <span style={{ fontSize: '2.5rem', lineHeight: '1', textShadow: '0 0 20px rgba(249, 115, 22, 0.5)' }}>🔥</span>
                                <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f97316', margin: '5px 0' }}>{streak}</span>
                                <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '500' }}>Current Streak</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', background: 'var(--bg-dark)', padding: '20px 10px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <span style={{ fontSize: '2.5rem', lineHeight: '1', textShadow: '0 0 20px rgba(16, 185, 129, 0.5)' }}>🏆</span>
                                <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)', margin: '5px 0' }}>{maxStreak}</span>
                                <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '500' }}>All-Time Record</span>
                            </div>
                        </div>

                        {/* Embedded Calendar View */}
                        <div style={{ background: 'var(--bg-dark)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <button onClick={() => changeMonth(-1)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', cursor: 'pointer', padding: '5px' }}>&lt;</button>
                                <strong style={{ margin: 0, color: 'var(--primary)', fontSize: '1rem' }}>{monthNames[currentMonth]} {currentYear}</strong>
                                <button onClick={() => changeMonth(1)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', cursor: 'pointer', padding: '5px' }}>&gt;</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                                {renderCalendar()}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '15px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '2px', border: '1px solid var(--success)' }}></div> Perfect</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: 'rgba(249, 115, 22, 0.15)', borderRadius: '2px', border: '1px solid #f97316' }}></div> Partial</span>
                            </div>
                        </div>

                        <button onClick={() => { setShowStreakModal(false); navigate('/routine'); }} className="primary-btn-large" style={{ marginTop: '20px' }}>Go to Planner</button>
                    </div>
                </div>
            )}

            {/* SIDEBAR (DESKTOP) */}
            <aside className="sidebar">
                <div className="logo-area">
                    <img src="/logo.png" alt="Logo" className="main-logo" onError={(e) => e.target.style.display='none'} />
                    <h2>Progress & Productivity</h2>
                </div>
                <nav className="sidebar-nav">
                    <NavLink to="/" end className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}><span className="icon">🏠</span> Home</NavLink>
                    <NavLink to="/routine" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}><span className="icon">☑️</span> Routine</NavLink>
                    <NavLink to="/finance" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}><span className="icon">💰</span> Finance</NavLink>
                    <NavLink to="/settings" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}><span className="icon">⚙️</span> Settings</NavLink>
                </nav>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="main-content">
                <header className="top-header">
                    <h1 id="pageTitle">Dashboard</h1>
                    <div className="header-right" style={{ position: 'relative' }}>
                        
                        <button className="streak-pill" onClick={() => setShowStreakModal(true)} style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', border: '1px solid #f97316', transition: 'transform 0.2s' }}>
                            Streak: {streak} 🔥
                        </button>
                        
                        <div className="user-avatar" onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border)' }}>👤</div>
                        
                        {menuOpen && (
                            <div className="profile-menu" style={{ display: 'flex' }}>
                                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', marginBottom: '5px' }}>
                                    <strong id="menuUserName" style={{ color: 'var(--text-main)' }}>{user ? user.name : 'Guest User'}</strong>
                                </div>
                                {!user ? (
                                    <button onClick={() => { setMenuOpen(false); navigate('/settings'); }}>☁️ Login to Sync</button>
                                ) : (
                                    <>
                                        <button>👤 Edit Profile</button>
                                        <button onClick={() => { logout(); setMenuOpen(false); }} style={{ color: 'var(--danger)', borderTop: '1px solid var(--border)', marginTop: '5px' }}>🚪 Log Out</button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </header>

                <div className="views-container">
                    <Outlet />
                </div>
            </main>

            {/* FLOATING BOTTOM NAV (MOBILE) */}
            <nav className="bottom-nav">
                <NavLink to="/" end className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}><span className="icon">🏠</span></NavLink>
                <NavLink to="/routine" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}><span className="icon">☑️</span></NavLink>
                <NavLink to="/finance" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}><span className="icon">💰</span></NavLink>
                <NavLink to="/settings" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}><span className="icon">⚙️</span></NavLink>
            </nav>
        </div>
    );
};

export default DashboardLayout;