import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { NavLink } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const QUOTES = [
    "Success is the sum of small efforts, repeated day in and day out.",
    "Don't watch the clock; do what it does. Keep going.",
    "The secret of getting ahead is getting started.",
    "Your future is created by what you do today, not tomorrow.",
    "Great things are not done by impulse, but by a series of small things brought together."
];

export default function HomeView() {
    const { user } = useContext(AuthContext);
    const [dailyQuote, setDailyQuote] = useState(QUOTES[0]);
    
    // LAZY INITIALIZATION: Prevents the React routing bug from wiping data!
    const [todayTasks, setTodayTasks] = useState(() => {
        const allTasks = JSON.parse(localStorage.getItem('hybridRoutineTasks')) || [];
        const today = new Date().toISOString().split('T')[0];
        return allTasks.filter(t => t.date === today).sort((a, b) => {
            if (!a.start) return 1;
            if (!b.start) return -1;
            return a.start.localeCompare(b.start);
        });
    });

    const [financeStats, setFinanceStats] = useState(() => {
        const allFinances = JSON.parse(localStorage.getItem('financeData')) || [];
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        let inc = 0; let exp = 0;
        allFinances.forEach(t => {
            const d = new Date(t.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                if (t.type === 'income') inc += t.amount;
                else exp += t.amount;
            }
        });
        return { income: inc, expense: exp };
    });

    useEffect(() => {
        setDailyQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

        // 3x DAILY NOTIFICATION LOGIC
        if ("Notification" in window && Notification.permission === "granted") {
            const now = new Date();
            const triggers = [
                { hours: 9, mins: 0, message: "Good morning! Time to crush your goals today! 🌅" },
                { hours: 14, mins: 0, message: "Mid-day check-in. Stay focused and keep your streak alive! ⚡" },
                { hours: 20, mins: 0, message: "Evening review. Did you complete your tasks today? 🌙" }
            ];

            triggers.forEach(trigger => {
                let target = new Date();
                target.setHours(trigger.hours, trigger.mins, 0, 0);
                if (now > target) target.setDate(target.getDate() + 1);
                
                const timeUntil = target.getTime() - now.getTime();
                setTimeout(() => {
                    new Notification("Progress Tracker", { body: trigger.message, icon: "/logo.png" });
                }, timeUntil);
            });
        } else if ("Notification" in window && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }, []);

    const completedTasksCount = todayTasks.filter(t => t.completed).length;
    const totalTasksCount = todayTasks.length;
    const progress = totalTasksCount === 0 ? 0 : Math.round((completedTasksCount / totalTasksCount) * 100);
    const tasksRemaining = totalTasksCount - completedTasksCount;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    const displayName = user ? user.name.split(' ')[0] : 'Champion';

    // FINANCE CHART DATA
    const chartData = {
        labels: ['Income', 'Expense'],
        datasets: [{
            data: [financeStats.income, financeStats.expense],
            backgroundColor: ['#10b981', '#ef4444'],
            borderWidth: 0, hoverOffset: 4
        }]
    };

    return (
        <div className="view-section active">
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px 20px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', marginBottom: '24px', borderRadius: '16px' }}>
                <span style={{ fontSize: '1.8rem' }}>💡</span>
                <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem', fontStyle: 'italic', lineHeight: '1.5' }}>"{dailyQuote}"</p>
            </div>

            <div className="home-grid">
                {/* LEFT COLUMN */}
                <div className="home-left-col">
                    <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '30px' }}>
                        <h2 style={{ fontSize: '1.8rem', marginBottom: '10px', color: 'var(--text-main)' }}>{greeting}, {displayName}! 👋</h2>
                        {totalTasksCount === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', margin: 0 }}>You have a completely free schedule today. Take time to relax or plan ahead!</p>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', margin: 0 }}>
                                Ready to make today count? You have <strong style={{ color: 'var(--primary)' }}>{tasksRemaining}</strong> tasks remaining.
                            </p>
                        )}
                    </div>

                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>☑️ Today's Focus</h3>
                            <NavLink to="/routine" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 'bold', background: 'rgba(59, 130, 246, 0.1)', padding: '5px 12px', borderRadius: '20px' }}>Open Planner</NavLink>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            <span>Daily Progress</span>
                            <span>{progress}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-dark)', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px', border: '1px solid var(--border)' }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--success)', transition: 'width 0.3s ease' }}></div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {todayTasks.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center', padding: '20px 0' }}>No tasks scheduled for today.</p>
                            ) : (
                                todayTasks.slice(0, 4).map(task => (
                                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', background: 'var(--bg-dark)', borderRadius: '10px', borderLeft: `4px solid ${task.color}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${task.completed ? 'var(--success)' : task.color}`, background: task.completed ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {task.completed && <span style={{ color: 'var(--bg-dark)', fontSize: '0.6rem', fontWeight: 'bold' }}>✓</span>}
                                            </div>
                                            <span style={{ color: task.completed ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: task.completed ? 'line-through' : 'none', fontSize: '1.05rem' }}>{task.title}</span>
                                        </div>
                                        {task.start && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{task.start}</span>}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="home-right-col">
                    
                    {/* UPDATED: Monthly Finance Snapshot WITH GRAPH */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>💰 This Month</h3>
                            <NavLink to="/finance" style={{ color: 'var(--success)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.1)', padding: '5px 12px', borderRadius: '20px' }}>View Wallet</NavLink>
                        </div>

                        {/* Mini Finance Graph */}
                        <div style={{ height: '160px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
                            {(financeStats.income > 0 || financeStats.expense > 0) ? (
                                <>
                                    <Doughnut data={chartData} options={{ cutout: '75%', plugins: { legend: { display: false } }, maintainAspectRatio: false }} />
                                    <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Net</span><br/>
                                        <strong style={{ fontSize: '1.1rem', color: financeStats.income >= financeStats.expense ? 'var(--success)' : 'var(--danger)' }}>
                                            ₹{financeStats.income - financeStats.expense}
                                        </strong>
                                    </div>
                                </>
                            ) : (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No data yet</div>
                            )}
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>Income</span>
                                <strong style={{ color: 'var(--success)', fontSize: '1.2rem' }}>+₹{financeStats.income}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>Spent</span>
                                <strong style={{ color: 'var(--danger)', fontSize: '1.2rem' }}>-₹{financeStats.expense}</strong>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}