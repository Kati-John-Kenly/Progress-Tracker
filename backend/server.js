const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { clerkMiddleware, getAuth, clerkClient } = require('@clerk/express');
const { createClient } = require('@supabase/supabase-js');
const User = require('./models/User');

dotenv.config({ path: path.join(__dirname, '.env') });
const app = express();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

// Middleware
app.use(express.json());
app.use(cors());
if (process.env.CLERK_SECRET_KEY) app.use(clerkMiddleware());

const requireClerkUser = (req, res, next) => {
    if (!process.env.CLERK_SECRET_KEY) {
        return res.status(503).json({ message: 'Clerk is not configured on the API.' });
    }
    if (!supabaseAdmin) {
        return res.status(503).json({ message: 'Supabase is not configured on the API.' });
    }

    const { isAuthenticated, userId } = getAuth(req);
    if (!isAuthenticated || !userId) return res.status(401).json({ message: 'Sign in to access workspace data.' });
    req.clerkUserId = userId;
    next();
};

const toWorkspaceData = (legacyUser) => {
    const routineValue = legacyUser.routines;
    let routineTasks = [];
    if (Array.isArray(routineValue)) {
        routineTasks = routineValue;
    } else if (Array.isArray(routineValue?.tasks)) {
        routineTasks = routineValue.tasks;
    } else if (routineValue && typeof routineValue === 'object') {
        routineTasks = Object.entries(routineValue).flatMap(([date, value]) => (
            Array.isArray(value) ? value.map(task => ({ ...task, date: task.date || date })) : []
        ));
    }

    return {
        routineTasks,
        financeData: Array.isArray(legacyUser.finances) ? legacyUser.finances : [],
        financeCategories: [],
        appTheme: 'dark',
    };
};

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        supabase: supabaseAdmin ? 'configured' : 'not-configured',
        clerk: process.env.CLERK_SECRET_KEY ? 'configured' : 'not-configured',
    });
});

app.get('/api/ai/info', (req, res) => {
    res.json({
        assistant: 'Aura',
        role: 'Personal Productivity & Workspace Agent',
        status: 'online',
        supportedDomains: ['routines', 'tasks', 'finances', 'streaks', 'theme', 'workspace'],
        guardrails: 'Strictly restricted to application workspace functions',
    });
});

app.post('/api/ai/chat', async (req, res) => {
    const { message } = req.body || {};
    if (!message) {
        return res.status(400).json({ message: 'Message is required.' });
    }
    res.json({
        received: true,
        message,
        status: 'ok',
    });
});

app.get('/api/data', requireClerkUser, async (req, res) => {
    try {
        const { data: record, error } = await supabaseAdmin
            .from('user_workspace_data')
            .select('data')
            .eq('clerk_user_id', req.clerkUserId)
            .maybeSingle();
        if (error) throw error;
        if (record) return res.json({ data: record.data, migrated: false });

        const clerkUser = await clerkClient.users.getUser(req.clerkUserId);
        const primaryEmail = clerkUser.emailAddresses.find(address => address.id === clerkUser.primaryEmailAddressId);
        if (primaryEmail?.verification?.status !== 'verified') return res.json({ data: null, migrated: false });

        const escapedEmail = primaryEmail.emailAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const legacyUser = await User.findOne({ email: new RegExp(`^${escapedEmail}$`, 'i') }).select('routines finances');
        if (!legacyUser) return res.json({ data: null, migrated: false });

        const migratedData = toWorkspaceData(legacyUser);
        const { error: migrationError } = await supabaseAdmin
            .from('user_workspace_data')
            .upsert({ clerk_user_id: req.clerkUserId, data: migratedData, updated_at: new Date().toISOString() });
        if (migrationError) throw migrationError;
        res.json({ data: migratedData, migrated: true });
    } catch (error) {
        console.error('Workspace data load failed:', error.message);
        res.status(500).json({ message: 'Could not load workspace data.' });
    }
});

app.put('/api/data', requireClerkUser, async (req, res) => {
    const { routineTasks, financeData, financeCategories, appTheme } = req.body || {};
    if (!Array.isArray(routineTasks) || !Array.isArray(financeData)
        || !Array.isArray(financeCategories) || !['dark', 'light'].includes(appTheme)) {
        return res.status(400).json({ message: 'Workspace data has an invalid format.' });
    }

    try {
        const { error } = await supabaseAdmin
            .from('user_workspace_data')
            .upsert({
                clerk_user_id: req.clerkUserId,
                data: { routineTasks, financeData, financeCategories, appTheme },
                updated_at: new Date().toISOString(),
            });
        if (error) throw error;
        res.json({ saved: true });
    } catch (error) {
        console.error('Workspace data save failed:', error.message);
        res.status(500).json({ message: 'Could not save workspace data.' });
    }
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI must be set in backend/.env');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected Successfully');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
};

startServer().catch((error) => {
    console.error('❌ Unable to start server:', error.message);
    process.exit(1);
});