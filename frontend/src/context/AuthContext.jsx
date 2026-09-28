import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) setUser(JSON.parse(userInfo));
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const res = await axios.post('http://localhost:5000/api/auth/login', { email, password });
        localStorage.setItem('userInfo', JSON.stringify(res.data));
        setUser(res.data);
    };

    const register = async (name, email, password, pin) => {
        const res = await axios.post('http://localhost:5000/api/auth/register', { name, email, password, pin });
        localStorage.setItem('userInfo', JSON.stringify(res.data));
        setUser(res.data);
    };

    const logout = () => {
        localStorage.removeItem('userInfo');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};