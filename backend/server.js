const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

dotenv.config({ path: path.join(__dirname, '.env') });
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// --- API ROUTES ---

// 1. REGISTER NEW USER
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, pin } = req.body;
        
        // Check if user exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'User already exists' });

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save User
        user = new User({ name, email, password: hashedPassword, pin });
        await user.save();

        // Create JWT Token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });

    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// 2. LOGIN USER
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid Credentials' });

        // Check Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid Credentials' });

        // Create JWT Token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });

    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
        throw new Error('MONGO_URI and JWT_SECRET must be set in backend/.env');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected Successfully');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
};

startServer().catch((error) => {
    console.error('❌ Unable to start server:', error.message);
    process.exit(1);
});