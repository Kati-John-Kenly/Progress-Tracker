const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { createClerkClient } = require('@clerk/backend');
const { createClient } = require('@supabase/supabase-js');
const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const requiredEnvironment = ['MONGO_URI', 'CLERK_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnvironment = requiredEnvironment.filter(key => !process.env[key]);
if (missingEnvironment.length) {
    throw new Error(`Set these variables in backend/.env before migrating: ${missingEnvironment.join(', ')}`);
}

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

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

const migrateUsers = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    let migrated = 0;
    let skipped = 0;

    try {
        const users = User.find({ email: { $exists: true, $ne: '' } })
            .select('email routines finances')
            .lean()
            .cursor();

        for await (const legacyUser of users) {
            const matches = await clerkClient.users.getUserList({
                emailAddress: [legacyUser.email.toLowerCase()],
                limit: 1,
            });
            const clerkUser = matches.data[0];
            const primaryEmail = clerkUser?.emailAddresses.find(address => address.id === clerkUser.primaryEmailAddressId);
            if (!clerkUser || primaryEmail?.verification?.status !== 'verified'
                || primaryEmail.emailAddress.toLowerCase() !== legacyUser.email.toLowerCase()) {
                skipped++;
                continue;
            }

            const { data: existingRow, error: lookupError } = await supabaseAdmin
                .from('user_workspace_data')
                .select('clerk_user_id')
                .eq('clerk_user_id', clerkUser.id)
                .maybeSingle();
            if (lookupError) throw lookupError;
            if (existingRow) {
                skipped++;
                continue;
            }

            const { error: insertError } = await supabaseAdmin
                .from('user_workspace_data')
                .insert({ clerk_user_id: clerkUser.id, data: toWorkspaceData(legacyUser) });
            if (insertError) throw insertError;
            migrated++;
            console.log(`Migrated ${primaryEmail.emailAddress}`);
        }
    } finally {
        await mongoose.disconnect();
    }

    console.log(`Migration finished. Migrated ${migrated}; skipped ${skipped}.`);
};

migrateUsers().catch(error => {
    console.error('Mongo-to-Supabase migration failed:', error.message);
    process.exitCode = 1;
});