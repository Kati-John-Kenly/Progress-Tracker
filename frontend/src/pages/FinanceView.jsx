import React, { useState, useEffect } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Register ChartJS elements
ChartJS.register(ArcElement, Tooltip, Legend);

export default function FinanceView() {
    // --- STATE MANAGEMENT ---
    const [financeData, setFinanceData] = useState([]);
    const [customCategories, setCustomCategories] = useState([]);
    
    // Form State
    const [finType, setFinType] = useState('expense');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Salary');
    const [newCategory, setNewCategory] = useState('');
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Calendar View State
    const [viewDate, setViewDate] = useState(new Date());

    // Load data from LocalStorage
    useEffect(() => {
        const savedData = JSON.parse(localStorage.getItem('financeData')) || [];
        const savedCats = JSON.parse(localStorage.getItem('financeCategories')) || [];
        setFinanceData(savedData);
        setCustomCategories(savedCats);
    }, []);

    // Save to LocalStorage
    useEffect(() => {
        localStorage.setItem('financeData', JSON.stringify(financeData));
        localStorage.setItem('financeCategories', JSON.stringify(customCategories));
    }, [financeData, customCategories]);

    // --- CALCULATIONS FOR CURRENT VIEW MONTH ---
    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();

    let totalIncome = 0;
    let totalExpense = 0;
    const incomeTotals = {};
    const expenseTotals = {};

    // Filter transactions for the viewed month
    const monthlyTransactions = financeData.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    monthlyTransactions.forEach(t => {
        if (t.type === 'income') {
            totalIncome += t.amount;
            incomeTotals[t.desc] = (incomeTotals[t.desc] || 0) + t.amount;
        } else {
            totalExpense += t.amount;
            expenseTotals[t.desc] = (expenseTotals[t.desc] || 0) + t.amount;
        }
    });

    // --- CHART DATA CONFIGURATIONS ---
    const incomeColors = ['#10b981', '#059669', '#34d399', '#6ee7b7']; // Greens for Income
    const expenseColors = ['#ef4444', '#f97316', '#f59e0b', '#ec4899', '#8b5cf6']; // Warm colors for Expense

    const incomeChartData = {
        labels: Object.keys(incomeTotals),
        datasets: [{
            data: Object.values(incomeTotals),
            backgroundColor: incomeColors,
            borderWidth: 0, hoverOffset: 4
        }]
    };

    const expenseChartData = {
        labels: Object.keys(expenseTotals),
        datasets: [{
            data: Object.values(expenseTotals),
            backgroundColor: expenseColors,
            borderWidth: 0, hoverOffset: 4
        }]
    };

    // --- HANDLERS ---
    const handleAddTransaction = (e) => {
        e.preventDefault();
        let finalCategory = category;

        if (category === 'add_new_cat') {
            finalCategory = newCategory.trim();
            if (finalCategory && !customCategories.includes(finalCategory)) {
                setCustomCategories([...customCategories, finalCategory]);
            }
        }

        const newTransaction = {
            id: Date.now(),
            type: finType,
            amount: parseFloat(amount),
            desc: finalCategory,
            date: formDate
        };

        setFinanceData([...financeData, newTransaction]);
        
        // Reset form
        setAmount('');
        setCategory(finType === 'income' ? 'Salary' : 'Groceries');
        setNewCategory('');
    };

    const handleDelete = (id) => {
        setFinanceData(financeData.filter(t => t.id !== id));
    };

    const changeMonth = (offset) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setViewDate(newDate);
    };

    const allCategories = ["Salary", "Groceries", "Utilities", "Dining Out", "Transportation", "EMI/Rent", "Shopping", "Investment", ...customCategories];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // --- CALENDAR RENDERER ---
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
            
            // Sum transactions for this specific day
            let dayIncome = 0;
            let dayExpense = 0;
            monthlyTransactions.forEach(t => {
                if (t.date === dateStr) {
                    if (t.type === 'income') dayIncome += t.amount;
                    else dayExpense += t.amount;
                }
            });

            days.push(
                <div key={i} className="cal-day" style={{ flexDirection: 'column', padding: '4px', background: (dayIncome > 0 || dayExpense > 0) ? 'rgba(255,255,255,0.05)' : 'var(--bg-card)' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '2px' }}>{i}</span>
                    {dayIncome > 0 && <span style={{ fontSize: '0.6rem', color: 'var(--success)', fontWeight: 'bold' }}>+₹{dayIncome}</span>}
                    {dayExpense > 0 && <span style={{ fontSize: '0.6rem', color: 'var(--danger)', fontWeight: 'bold' }}>-₹{dayExpense}</span>}
                </div>
            );
        }
        return days;
    };

    return (
        <div className="view-section active">
            
            

            <div className="dashboard" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                
                {/* LEFT COLUMN: Summary & Add Form */}
                <div className="column" style={{ flex: 1, minWidth: '300px' }}>
                    
                    <div className="finance-summary-column" style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                        <div className="card" style={{ flex: 1, padding: '15px', borderLeft: '4px solid var(--success)' }}>
                            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>Total Income</h3>
                            <h2 style={{ color: 'var(--success)', margin: '5px 0 0 0' }}>₹{totalIncome}</h2>
                        </div>
                        <div className="card" style={{ flex: 1, padding: '15px', borderLeft: '4px solid var(--danger)' }}>
                            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>Total Spending</h3>
                            <h2 style={{ color: 'var(--danger)', margin: '5px 0 0 0' }}>₹{totalExpense}</h2>
                        </div>
                    </div>
                    
                    {/* UPDATE 1: NEW 40/30/20/10 Allocation Plan */}
                    <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
                        <h3 style={{ marginBottom: '15px', textAlign: 'center' }}>🌱 Financial Growth Plan</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', textAlign: 'center' }}>
                            <div className="alloc-box" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', padding: '10px', borderRadius: '12px' }}>
                                <small style={{ color: 'var(--text-muted)' }}>EMI / Rent (40%)</small><br/>
                                <strong style={{ color: '#3b82f6' }}>₹{Math.round(totalIncome * 0.40)}</strong>
                            </div>
                            <div className="alloc-box" style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid #f97316', padding: '10px', borderRadius: '12px' }}>
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Foods/Travel/Shop (30%)</small><br/>
                                <strong style={{ color: '#f97316' }}>₹{Math.round(totalIncome * 0.30)}</strong>
                            </div>
                            <div className="alloc-box" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '10px', borderRadius: '12px' }}>
                                <small style={{ color: 'var(--text-muted)' }}>Savings / Invest (20%)</small><br/>
                                <strong style={{ color: '#10b981' }}>₹{Math.round(totalIncome * 0.20)}</strong>
                            </div>
                            <div className="alloc-box" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid #8b5cf6', padding: '10px', borderRadius: '12px' }}>
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Tithe/Donate/Personal (10%)</small><br/>
                                <strong style={{ color: '#8b5cf6' }}>₹{Math.round(totalIncome * 0.10)}</strong>
                            </div>
                        </div>
                    </div>
                    
                    {/* Add Transaction Form */}
                    <div className="card">
                        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>➕ Add Transaction</h2>
                        <form onSubmit={handleAddTransaction}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginBottom: '20px' }}>
                                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="radio" name="finType" value="expense" checked={finType === 'expense'} onChange={() => setFinType('expense')} /> 
                                    <span style={{ color: 'var(--danger)' }}>Expense</span>
                                </label>
                                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="radio" name="finType" value="income" checked={finType === 'income'} onChange={() => setFinType('income')} /> 
                                    <span style={{ color: 'var(--success)' }}>Income</span>
                                </label>
                            </div>
                            <input className="sleek-input" type="number" placeholder="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} required min="1" />
                            
                            <select className="sleek-input" value={category} onChange={e => setCategory(e.target.value)} required>
                                {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                <option value="add_new_cat" style={{ color: 'var(--primary)' }}>+ Custom Category...</option>
                            </select>
                            
                            {category === 'add_new_cat' && (
                                <input className="sleek-input" type="text" placeholder="Type new category..." value={newCategory} onChange={e => setNewCategory(e.target.value)} required />
                            )}
                            
                            <input className="sleek-input" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} required />
                            <button className="primary-btn-large" type="submit">Save Transaction</button>
                        </form>
                    </div>
                </div>

                {/* RIGHT COLUMN: Dual Charts & Calendar */}
                <div className="column" style={{ flex: 1, minWidth: '300px' }}>
                    
                    {/* UPDATE 2: DUAL CHARTS (Income vs Expense) */}
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '24px' }}>
                        {/* Income Chart */}
                        <div className="card" style={{ flex: 1, padding: '15px' }}>
                            <h3 style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Income Sources</h3>
                            <div style={{ position: 'relative', height: '140px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '10px' }}>
                                {Object.keys(incomeTotals).length > 0 ? (
                                    <>
                                        <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                                            <strong style={{ fontSize: '1.1rem', color: 'var(--success)' }}>₹{totalIncome}</strong>
                                        </div>
                                        <Doughnut data={incomeChartData} options={{ cutout: '75%', plugins: { legend: { display: false } } }} />
                                    </>
                                ) : <p style={{ color: 'var(--border)' }}>No Income</p>}
                            </div>
                        </div>

                        {/* Spending Chart */}
                        <div className="card" style={{ flex: 1, padding: '15px' }}>
                            <h3 style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Spending Habits</h3>
                            <div style={{ position: 'relative', height: '140px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '10px' }}>
                                {Object.keys(expenseTotals).length > 0 ? (
                                    <>
                                        <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                                            <strong style={{ fontSize: '1.1rem', color: 'var(--danger)' }}>₹{totalExpense}</strong>
                                        </div>
                                        <Doughnut data={expenseChartData} options={{ cutout: '75%', plugins: { legend: { display: false } } }} />
                                    </>
                                ) : <p style={{ color: 'var(--border)' }}>No Expenses</p>}
                            </div>
                        </div>
                    </div>

                    {/* UPDATE 3: PAYMENT CALENDAR */}
                    <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
                        <h3 style={{ marginBottom: '15px', color: 'var(--text-main)' }}>📅 Payment Calendar</h3>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'var(--bg-card)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <button onClick={() => changeMonth(-1)} style={{ background: 'var(--border)', color: 'var(--text-main)', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>&lt; Prev</button>
                <h2 style={{ margin: 0, color: 'var(--primary)' }}>{monthNames[currentMonth]} {currentYear}</h2>
                <button onClick={() => changeMonth(1)} style={{ background: 'var(--border)', color: 'var(--text-main)', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>Next &gt;</button>
            </div>
                        <div className="calendar-days-labels" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                        </div>
                        <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                            {renderCalendar()}
                        </div>
                    </div>

                    {/* Recent Transactions List */}
                    <div className="card">
                        <h2 style={{ marginBottom: '15px' }}>📋 Recent Transactions</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                            {monthlyTransactions.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>No transactions in {monthNames[currentMonth]}.</p>}
                            {monthlyTransactions.map(t => (
                                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    <div>
                                        <strong>{t.desc}</strong>
                                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>{t.date.split('-').reverse().join('-')}</small>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ color: t.type === 'income' ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                                            {t.type === 'income' ? '+' : '-'}₹{t.amount}
                                        </span>
                                        <button onClick={() => handleDelete(t.id)} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}