import React, { useState, useEffect } from 'react';

export default function RoutineView() {
    // --- STATE MANAGEMENT ---
    const [tasks, setTasks] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Calendar View State
    const [viewDate, setViewDate] = useState(new Date());
    
    // Form State
    const [newTaskName, setNewTaskName] = useState('');
    const [newStartTime, setNewStartTime] = useState('');
    const [newEndTime, setNewEndTime] = useState('');
    const [selectedColor, setSelectedColor] = useState('#3b82f6'); 

    // Load & Save LocalStorage
    useEffect(() => {
        const savedTasks = JSON.parse(localStorage.getItem('hybridRoutineTasks')) || [];
        setTasks(savedTasks);
    }, []);

    useEffect(() => {
        localStorage.setItem('hybridRoutineTasks', JSON.stringify(tasks));
    }, [tasks]);

    // --- DERIVED STATE ---
    const dailyTasks = tasks.filter(t => t.date === currentDate).sort((a, b) => {
        if (!a.start) return 1;
        if (!b.start) return -1;
        return a.start.localeCompare(b.start);
    });

    // --- HANDLERS ---
    const handleAddTask = (e) => {
        e.preventDefault();
        if (!newTaskName.trim()) return;

        const newTask = {
            id: Date.now(),
            date: currentDate,
            title: newTaskName.trim(),
            start: newStartTime,
            end: newEndTime,
            color: selectedColor,
            completed: false
        };

        setTasks([...tasks, newTask]);
        setNewTaskName('');
        setNewStartTime('');
        setNewEndTime('');
    };

    const toggleTask = (id) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    const deleteTask = (id) => setTasks(tasks.filter(t => t.id !== id));

    const loadTemplate = (type) => {
        let templateData = [];
        if (type === 'working') {
            templateData = [
                { title: 'Morning Routine & Breakfast', start: '07:00', end: '08:30', color: '#f97316' },
                { title: 'Deep Work Session', start: '09:00', end: '12:00', color: '#3b82f6' },
                { title: 'Lunch & Walk', start: '12:00', end: '13:00', color: '#10b981' },
                { title: 'Meetings & Admin', start: '13:00', end: '17:00', color: '#8b5cf6' }
            ];
        } else if (type === 'holiday') {
            templateData = [
                { title: 'Sleep In & Relax', start: '09:00', end: '11:00', color: '#ec4899' },
                { title: 'Hobbies / Gaming', start: '11:00', end: '15:00', color: '#14b8a6' },
                { title: 'Movie Night', start: '19:00', end: '22:00', color: '#f43f5e' }
            ];
        }

        const newTasks = templateData.map((t, index) => ({
            id: Date.now() + index,
            date: currentDate,
            title: t.title,
            start: t.start,
            end: t.end,
            color: t.color,
            completed: false
        }));
        setTasks([...tasks, ...newTasks]);
    };

    const resetTemplate = () => {
        if (window.confirm('Clear today\'s schedule?')) {
            setTasks(tasks.filter(t => t.date !== currentDate));
        }
    };

    // --- HELPER: FORMAT OPTIONAL TIMES ---
    const formatTimeDisplay = (start, end) => {
        if (start && end) return `${start} to ${end}`;
        if (start) return `Starts at ${start}`;
        if (end) return `Ends at ${end}`;
        return null; // Return nothing if no time is provided
    };

    // --- ANALYTICS CALCULATIONS ---
    let totalLoggedMinutes = 0;
    dailyTasks.forEach(t => {
        if (t.start && t.end) {
            const startMins = parseInt(t.start.split(':')[0]) * 60 + parseInt(t.start.split(':')[1]);
            const endMins = parseInt(t.end.split(':')[0]) * 60 + parseInt(t.end.split(':')[1]);
            if (endMins > startMins) totalLoggedMinutes += (endMins - startMins);
        } else {
            totalLoggedMinutes += 60; // Default 1 hour if no time specified
        }
    });

    const loggedHours = (totalLoggedMinutes / 60).toFixed(1);
    const progressPercentage = Math.min((totalLoggedMinutes / (24 * 60)) * 100, 100);

    // --- CALENDAR RENDERER ---
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
        // Empty slots for alignment
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="cal-day" style={{ background: 'transparent', border: 'none' }}></div>);
        }
        
        // Actual days
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            // Calculate consistency for this day
            const dayTasks = tasks.filter(t => t.date === dateStr);
            const totalTasks = dayTasks.length;
            const completedTasks = dayTasks.filter(t => t.completed).length;
            
            let bgStyle = 'var(--bg-card)';
            let borderStyle = '1px solid var(--border)';
            
            if (totalTasks > 0) {
                if (completedTasks === totalTasks) {
                    bgStyle = 'rgba(16, 185, 129, 0.2)'; // All tasks done: Green
                    borderStyle = '1px solid var(--success)';
                } else if (completedTasks > 0) {
                    bgStyle = 'rgba(249, 115, 22, 0.15)'; // Some tasks done: Orange
                    borderStyle = '1px solid #f97316';
                } else {
                    bgStyle = 'rgba(255,255,255,0.05)'; // Tasks scheduled but 0 done
                }
            }

            // Highlight the currently selected date
            if (dateStr === currentDate) {
                borderStyle = '2px solid var(--primary)';
            }

            days.push(
                <div 
                    key={i} 
                    onClick={() => setCurrentDate(dateStr)}
                    className="cal-day" 
                    style={{ 
                        flexDirection: 'column', 
                        padding: '8px 4px', 
                        background: bgStyle, 
                        border: borderStyle,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{i}</span>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="view-section active">
            <div className="dashboard" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                
                {/* LEFT COLUMN: Timeblocks & Tasks */}
                <div className="column" style={{ flex: 2, minWidth: '320px' }}>
                    
                    {/* Header: Date & Controls (FIXED ALIGNMENT) */}
                    <div className="card" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span>📅</span> Schedule
                            </h2>
                            {dailyTasks.length > 0 && (
                                <button onClick={resetTemplate} style={{ background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    ↺ Clear Day
                                </button>
                            )}
                        </div>
                        <input 
                            type="date" 
                            value={currentDate}
                            onChange={(e) => setCurrentDate(e.target.value)}
                            className="sleek-input"
                            style={{ background: 'rgba(255,255,255,0.05)', marginBottom: 0, padding: '10px 14px', width: '100%', maxWidth: '100%' }}
                        />
                    </div>

                    {/* Task List or Templates */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '30px' }}>
                        {dailyTasks.length === 0 ? (
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '40px 20px', borderRadius: '16px', textAlign: 'center', border: '1px dashed var(--border)' }}>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '1.05rem' }}>Your day is completely open. Load a routine to get started:</p>
                                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <button onClick={() => loadTemplate('working')} className="primary-btn-large" style={{ width: 'auto', padding: '12px 24px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid #3b82f6' }}>💼 Work Day</button>
                                    <button onClick={() => loadTemplate('holiday')} className="primary-btn-large" style={{ width: 'auto', padding: '12px 24px', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', border: '1px solid #ec4899' }}>🏖️ Holiday</button>
                                </div>
                            </div>
                        ) : (
                            dailyTasks.map(task => {
                                const timeDisplay = formatTimeDisplay(task.start, task.end);
                                return (
                                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `6px solid ${task.color}`, borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div onClick={() => toggleTask(task.id)} style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${task.completed ? 'var(--success)' : task.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: task.completed ? 'var(--success)' : 'transparent', cursor: 'pointer', flexShrink: 0 }}>
                                                {task.completed && <span style={{ color: 'var(--bg-dark)', fontSize: '0.8rem', fontWeight: 'bold' }}>✓</span>}
                                            </div>
                                            <div>
                                                <strong style={{ display: 'block', fontSize: '1.1rem', color: task.completed ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: task.completed ? 'line-through' : 'none', marginBottom: timeDisplay ? '4px' : '0' }}>
                                                    {task.title}
                                                </strong>
                                                {timeDisplay && (
                                                    <small style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{timeDisplay}</small>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => deleteTask(task.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.4rem', padding: '5px' }}>✕</button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Add Task Form (Time is now perfectly optional) */}
                    <form onSubmit={handleAddTask} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>➕ Add Custom Block</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '500' }}>Task Name & Color</label>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{ position: 'relative', width: '50px', height: '50px', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--border)', cursor: 'pointer', flexShrink: 0, background: selectedColor }} title="Choose Task Color">
                                    <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute', top: 0, left: 0 }} />
                                </div>
                                <input type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="What are you working on?" required className="sleek-input" style={{ flexGrow: 1, marginBottom: 0, padding: '15px', fontSize: '1.05rem', borderRadius: '12px' }} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '500' }}>Start Time <span style={{ fontSize: '0.75rem' }}>(Optional)</span></label>
                                <input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} className="sleek-input" style={{ marginBottom: 0, padding: '14px', borderRadius: '12px' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '500' }}>End Time <span style={{ fontSize: '0.75rem' }}>(Optional)</span></label>
                                <input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} className="sleek-input" style={{ marginBottom: 0, padding: '14px', borderRadius: '12px' }} />
                            </div>
                        </div>

                        <button type="submit" className="primary-btn-large" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', borderRadius: '12px', marginTop: '10px' }}>
                            + Schedule Task
                        </button>
                    </form>
                </div>

                {/* RIGHT COLUMN: Calendar & Analytics */}
                <div className="column" style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* NEW: Consistency Calendar */}
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <button onClick={() => changeMonth(-1)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', cursor: 'pointer' }}>&lt; Prev</button>
                            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.1rem' }}>{monthNames[currentMonth]} {currentYear}</h3>
                            <button onClick={() => changeMonth(1)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', cursor: 'pointer' }}>Next &gt;</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
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

                    {/* Daily Capacity Analytics */}
                    <div className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>⏱️ Daily Capacity</h3>
                        </div>
                        
                        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--text-main)', lineHeight: 1 }}>{loggedHours} <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>hrs</span></span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', paddingBottom: '4px' }}>/ 24 hrs scheduled</span>
                        </div>
                        
                        <div style={{ width: '100%', height: '16px', background: 'var(--bg-dark)', borderRadius: '20px', overflow: 'hidden', display: 'flex', border: '1px solid var(--border)' }}>
                            {dailyTasks.map(task => {
                                if (!task.start || !task.end) return null;
                                const startMins = parseInt(task.start.split(':')[0]) * 60 + parseInt(task.start.split(':')[1]);
                                const endMins = parseInt(task.end.split(':')[0]) * 60 + parseInt(task.end.split(':')[1]);
                                const duration = endMins - startMins;
                                if (duration <= 0) return null;
                                
                                const widthPct = (duration / (24 * 60)) * 100;
                                return (
                                    <div key={task.id} title={`${task.title} (${duration}m)`} style={{ width: `${widthPct}%`, height: '100%', background: task.color, borderRight: '1px solid rgba(0,0,0,0.2)' }}></div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}