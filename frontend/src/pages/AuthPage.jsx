import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AuthPage = () => {
    const [step, setStep] = useState(1); 
    const { login, register } = useContext(AuthContext);
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [pin, setPin] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            alert(err.response?.data?.message || 'Login failed');
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            await register(name, email, password, pin);
            navigate('/');
        } catch (err) {
            alert(err.response?.data?.message || 'Registration failed');
        }
    };

    return (
        <div className="auth-container" style={{ display: 'flex' }}>
            {step === 1 && (
                <div className="card auth-card" style={{ textAlign: 'center' }}>
                    <h2 style={{ marginBottom: '10px' }}>Welcome to Progress</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Sign in to sync your habits across devices.</p>
                    <button className="primary-btn-large" onClick={() => setStep(3)}>Login to Account</button>
                    <button className="primary-btn-large" style={{ marginTop: '10px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)' }} onClick={() => setStep(2)}>Create New Profile</button>
                </div>
            )}

            {step === 2 && (
                <div className="card auth-card">
                    <h2 style={{ marginBottom: '15px' }}>Create Account</h2>
                    <form onSubmit={handleRegister} style={{ width: '100%' }}>
                        <input className="sleek-input" type="text" placeholder="Full Name" required onChange={e => setName(e.target.value)} />
                        <input className="sleek-input" type="email" placeholder="Email Address" required onChange={e => setEmail(e.target.value)} />
                        <input className="sleek-input" type="password" placeholder="Create Password" required onChange={e => setPassword(e.target.value)} />
                        <input className="sleek-input text-center" type="password" placeholder="4-Digit App PIN" maxLength="4" required onChange={e => setPin(e.target.value)} style={{ fontSize: '1.2rem', letterSpacing: '5px' }} />
                        <button className="primary-btn-large" type="submit" style={{ marginTop: '10px' }}>Sign Up</button>
                        <button type="button" style={{ background: 'transparent', color: 'var(--text-muted)', marginTop: '15px', width: '100%', border: 'none', cursor: 'pointer' }} onClick={() => setStep(3)}>Already have an account? Login</button>
                    </form>
                </div>
            )}

            {step === 3 && (
                <div className="card auth-card">
                    <h2 style={{ marginBottom: '15px' }}>🔒 Security Lock</h2>
                    <form onSubmit={handleLogin} style={{ width: '100%' }}>
                        <input className="sleek-input" type="email" placeholder="Email" required onChange={e => setEmail(e.target.value)} />
                        <input className="sleek-input text-center" type="password" placeholder="Password" required onChange={e => setPassword(e.target.value)} />
                        <button className="primary-btn-large" type="submit" style={{ marginTop: '10px' }}>Sign In</button>
                        <button type="button" style={{ background: 'transparent', color: 'var(--text-muted)', marginTop: '15px', width: '100%', border: 'none', cursor: 'pointer' }} onClick={() => setStep(2)}>Need an account? Sign Up</button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AuthPage;