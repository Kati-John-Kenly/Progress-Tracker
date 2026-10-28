export const WORKSPACE_CHANGE_EVENT = 'workspace-data-changed';
export const USER_PROFILE_KEY = 'progress_user_profile';
export const USER_ACCOUNTS_KEY = 'progress_user_accounts';

export const emitWorkspaceChange = (detail = {}) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGE_EVENT, { detail }));
    }
};

export const subscribeWorkspaceChange = (callback) => {
    if (typeof window === 'undefined') return () => {};
    const handler = (e) => callback(e?.detail || {});
    window.addEventListener(WORKSPACE_CHANGE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
        window.removeEventListener(WORKSPACE_CHANGE_EVENT, handler);
        window.removeEventListener('storage', handler);
    };
};

export const getStoredAccounts = () => {
    try {
        return JSON.parse(localStorage.getItem(USER_ACCOUNTS_KEY) || '[]');
    } catch {
        return [];
    }
};

export const saveStoredAccount = (account) => {
    try {
        if (!account) return false;
        const accounts = getStoredAccounts();
        const accUsername = (account.username || '').toLowerCase().trim();
        const accEmail = (account.email || '').toLowerCase().trim();
        const index = accounts.findIndex(a =>
            (accUsername && (a.username || '').toLowerCase().trim() === accUsername) ||
            (accEmail && (a.email || '').toLowerCase().trim() === accEmail)
        );
        if (index >= 0) {
            accounts[index] = { ...accounts[index], ...account, updatedAt: new Date().toISOString() };
        } else {
            accounts.push({ ...account, createdAt: new Date().toISOString() });
        }
        localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(accounts));
        return true;
    } catch (err) {
        console.error('Failed to save account', err);
        return false;
    }
};

export const getStoredUserProfile = () => {
    try {
        const data = localStorage.getItem(USER_PROFILE_KEY);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
};

export const setStoredUserProfile = (profile) => {
    try {
        if (profile) {
            localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
            saveStoredAccount(profile);
        } else {
            localStorage.removeItem(USER_PROFILE_KEY);
        }
        emitWorkspaceChange({ type: 'user_profile', profile: profile || null });
    } catch (err) {
        console.error('Failed to set user profile', err);
    }
};

export const getStoredRoutineTasks = () => {
    try {
        return JSON.parse(localStorage.getItem('hybridRoutineTasks') || '[]');
    } catch {
        return [];
    }
};

export const setStoredRoutineTasks = (tasks) => {
    localStorage.setItem('hybridRoutineTasks', JSON.stringify(tasks));
};

export const getStoredFinances = () => {
    try {
        return JSON.parse(localStorage.getItem('financeData') || '[]');
    } catch {
        return [];
    }
};

export const setStoredFinances = (finances) => {
    localStorage.setItem('financeData', JSON.stringify(finances));
};

export const getStoredFinanceCategories = () => {
    try {
        return JSON.parse(localStorage.getItem('financeCategories') || '[]');
    } catch {
        return [];
    }
};

export const setStoredFinanceCategories = (categories) => {
    localStorage.setItem('financeCategories', JSON.stringify(categories));
};

export const getStoredTheme = () => {
    return localStorage.getItem('appTheme') || 'dark';
};

export const applyAppTheme = (theme) => {
    const validTheme = theme === 'light' ? 'light' : 'dark';
    localStorage.setItem('appTheme', validTheme);
    const isLight = validTheme === 'light';
    if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('light-theme', isLight);
        document.body.classList.toggle('light-theme', isLight);
        document.documentElement.setAttribute('data-theme', validTheme);
        document.body.setAttribute('data-theme', validTheme);
    }
    emitWorkspaceChange({ type: 'theme', theme: validTheme });
    return validTheme;
};

export const setStoredTheme = applyAppTheme;

export const calculateStreakStats = (allTasks = []) => {
    const uniqueDates = [...new Set(allTasks.map(t => t.date))].filter(Boolean).sort();

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

    const datesRev = [...uniqueDates].reverse();
    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    for (const date of datesRev) {
        const dayTasks = allTasks.filter(t => t.date === date);
        if (dayTasks.length > 0) {
            const isPerfect = dayTasks.every(t => t.completed);
            if (isPerfect) {
                currentStreak++;
            } else {
                if (date !== today) break;
            }
        }
    }

    return { currentStreak, maxStreak: max };
};
