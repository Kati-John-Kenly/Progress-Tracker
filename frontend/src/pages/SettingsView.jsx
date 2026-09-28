import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function SettingsView() {
    const { user, login, register, logout } = useContext(AuthContext);
    
    // Auth Form State
    const [isLoginView, setIsLoginView] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [pin, setPin] = useState('');

    // Theme State
    const [theme, setTheme] = useState(localStorage.getItem('appTheme') || 'dark');

    // Apply theme to the entire app body when toggled
    useEffect(() => {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        localStorage.setItem('appTheme', theme);
    }, [theme]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isLoginView) {
                await login(email, password);
            } else {
                await register(name, email, password, pin);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Authentication failed. Make sure backend is running.');
        }
    };

    return (
        <div className="view-section active">
            <div className="dashboard" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                
                {/* COLUMN 1: ACCOUNT & CLOUD SYNC */}
                <div className="column" style={{ flex: 1, minWidth: '320px' }}>
                    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <h2 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem' }}>
                            ☁️ Cloud Sync & Account
                        </h2>
                        
                        {user ? (
                            // --- SUCCESSFUL LOGIN VIEW ---
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '30px 20px', borderRadius: '16px', border: '1px solid var(--success)', textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
                                    <div style={{ fontSize: '3.5rem', marginBottom: '15px', textShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}>✅</div>
                                    <h3 style={{ color: 'var(--success)', margin: '0 0 10px 0', fontSize: '1.3rem' }}>Login Successful!</h3>
                                    <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', margin: '0 0 5px 0' }}>Welcome back, <strong>{user.name}</strong></p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>{user.email}</p>
                                </div>
                                
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center', lineHeight: '1.6', margin: '10px 0' }}>
                                    Your routines and finances are actively backing up to the cloud. Your progress is secure.
                                </p>
                                
                                <div style={{ marginTop: 'auto' }}>
                                    <button onClick={logout} className="primary-btn-large" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)', width: '100%' }}>
                                        🚪 Log Out & Stop Sync
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // --- GUEST / LOGIN VIEW ---
                            <div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '25px', lineHeight: '1.6' }}>
                                    Create a free account to securely backup your progress to the cloud and sync across devices.
                                </p>
                                
                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {!isLoginView && (
                                        <input className="sleek-input" type="text" placeholder="Full Name" required onChange={e => setName(e.target.value)} style={{ marginBottom: 0, padding: '14px' }} />
                                    )}
                                    <input className="sleek-input" type="email" placeholder="Email Address" required onChange={e => setEmail(e.target.value)} style={{ marginBottom: 0, padding: '14px' }} />
                                    <input className="sleek-input" type="password" placeholder="Password" required onChange={e => setPassword(e.target.value)} style={{ marginBottom: 0, padding: '14px' }} />
                                    {!isLoginView && (
                                        <input className="sleek-input text-center" type="password" placeholder="Create 4-Digit PIN" maxLength="4" required onChange={e => setPin(e.target.value)} style={{ fontSize: '1.2rem', letterSpacing: '8px', marginBottom: 0, padding: '14px' }} />
                                    )}
                                    
                                    <button className="primary-btn-large" type="submit" style={{ marginTop: '10px', padding: '16px', fontSize: '1.05rem' }}>
                                        {isLoginView ? 'Sign In & Sync' : 'Create Account'}
                                    </button>
                                </form>

                                <button 
                                    type="button" 
                                    style={{ background: 'transparent', color: 'var(--text-muted)', marginTop: '20px', width: '100%', border: 'none', cursor: 'pointer', fontSize: '0.95rem', padding: '10px' }} 
                                    onClick={() => setIsLoginView(!isLoginView)}
                                >
                                    {isLoginView ? "Need an account? Sign Up" : "Already have an account? Log In"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUMN 2: PREFERENCES & BACKUP */}
                <div className="column" style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* THEME TOGGLES */}
                    <div className="card">
                        <h2 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.3rem' }}>
                            🎨 App Theme
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>Customize the look and feel of your dashboard.</p>
                        
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button 
                                onClick={() => setTheme('dark')}
                                style={{ 
                                    flex: 1, padding: '20px 10px', background: '#09090b', 
                                    border: theme === 'dark' ? '2px solid var(--primary)' : '2px solid var(--border)', 
                                    borderRadius: '12px', color: '#fff', cursor: 'pointer', transition: 'all 0.2s'
                                }}>
                                <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🌙</div>
                                <strong style={{ display: 'block', fontSize: '0.95rem' }}>OLED Dark</strong>
                            </button>
                            
                            <button 
                                onClick={() => setTheme('light')}
                                style={{ 
                                    flex: 1, padding: '20px 10px', background: '#f8fafc', 
                                    border: theme === 'light' ? '2px solid var(--primary)' : '2px solid #cbd5e1', 
                                    borderRadius: '12px', color: '#0f172a', cursor: 'pointer', transition: 'all 0.2s'
                                }}>
                                <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>☀️</div>
                                <strong style={{ display: 'block', fontSize: '0.95rem' }}>Light Mode</strong>
                            </button>
                        </div>
                    </div>

                    {/* LOCAL BACKUP */}
                    <div className="card">
                        <h2 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.3rem' }}>
                            💾 Local Backup
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>Download a manual offline copy of your data, or restore from a previous file.</p>
                        
                        <button style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', marginBottom: '20px', width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}>
                            📥 Download Backup JSON
                        </button>
                        
                        <hr style={{ borderTop: '1px solid var(--border)', borderBottom: 'none', marginBottom: '20px' }} />
                        
                        <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block', fontSize: '0.95rem', color: 'var(--text-muted)' }}>Restore from File:</label>
                        <input type="file" accept=".json" className="sleek-input" style={{ marginBottom: '15px', padding: '12px' }} />
                        <button className="primary-btn-large" style={{ background: 'var(--text-main)', color: 'var(--bg-dark)', width: '100%' }}>
                            📤 Restore Data
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}