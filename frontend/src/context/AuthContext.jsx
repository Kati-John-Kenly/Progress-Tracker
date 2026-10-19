import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/react';
import { AuthContext } from './AuthState';

const defaultContext = {
    user: null,
    loading: false,
    configured: Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY),
    syncError: '',
    syncData: async () => {},
    logout: async () => {},
};

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const hasClerkKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const localOwnerKey = 'clerkWorkspaceOwnerId';
const localDataKeys = ['hybridRoutineTasks', 'financeData', 'financeCategories', 'appTheme'];
const offlineBackupKey = (userId) => `clerkOfflineBackup:${userId}`;

const readLocalData = () => ({
    routineTasks: JSON.parse(localStorage.getItem('hybridRoutineTasks') || '[]'),
    financeData: JSON.parse(localStorage.getItem('financeData') || '[]'),
    financeCategories: JSON.parse(localStorage.getItem('financeCategories') || '[]'),
    appTheme: localStorage.getItem('appTheme') || 'dark',
});

const writeLocalData = (data) => {
    localStorage.setItem('hybridRoutineTasks', JSON.stringify(data.routineTasks || []));
    localStorage.setItem('financeData', JSON.stringify(data.financeData || []));
    localStorage.setItem('financeCategories', JSON.stringify(data.financeCategories || []));
    if (data.appTheme === 'dark' || data.appTheme === 'light') {
        localStorage.setItem('appTheme', data.appTheme);
        document.body.classList.toggle('light-theme', data.appTheme === 'light');
    }
};

const mergeById = (localItems, remoteItems) => {
    const items = new Map();
    [...(remoteItems || []), ...(localItems || [])].forEach((item, index) => {
        const key = item?.id ?? `${item?.date || ''}-${item?.title || item?.desc || index}`;
        items.set(String(key), item);
    });
    return [...items.values()];
};

const getLegacyAccountEmail = () => {
    try {
        const legacyAccount = JSON.parse(localStorage.getItem('userInfo') || 'null');
        return legacyAccount?.user?.email || legacyAccount?.email || null;
    } catch {
        return null;
    }
};

const readOfflineBackup = (userId) => {
    try {
        return JSON.parse(localStorage.getItem(offlineBackupKey(userId)) || 'null');
    } catch {
        return null;
    }
};

function ClerkSessionBridge({ children }) {
    const { isLoaded, isSignedIn, userId, getToken } = useAuth();
    const { user: clerkUser } = useUser();
    const { signOut } = useClerk();
    const [hydratedUserId, setHydratedUserId] = useState(null);
    const [syncError, setSyncError] = useState('');
    const syncQueueRef = useRef(Promise.resolve());

    useEffect(() => {
        if (!isLoaded || !isSignedIn || !userId) return;
        let active = true;
        const storedOwnerId = localStorage.getItem(localOwnerKey);
        const legacyEmail = getLegacyAccountEmail();
        const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase();
        const legacyAccountMatches = !legacyEmail || legacyEmail.toLowerCase() === primaryEmail;
        if ((storedOwnerId && storedOwnerId !== userId) || (!storedOwnerId && !legacyAccountMatches)) {
            localDataKeys.forEach(key => localStorage.removeItem(key));
            localStorage.removeItem(localOwnerKey);
        }

        const hydrateUserData = async () => {
            const token = await getToken();
            if (!token) throw new Error('Could not verify your Clerk session.');
            const headers = { Authorization: `Bearer ${token}` };
            const response = await fetch(`${apiUrl}/api/data`, { headers });
            if (!response.ok) throw new Error('Could not load your cloud data. Check the API and Supabase configuration.');
            const result = await response.json();
            const currentOwnerId = localStorage.getItem(localOwnerKey);
            const canReuseLocalData = currentOwnerId === userId || (!currentOwnerId && legacyAccountMatches);
            const browserData = canReuseLocalData ? readLocalData() : {
                routineTasks: [],
                financeData: [],
                financeCategories: [],
                appTheme: 'dark',
            };
            const offlineData = readOfflineBackup(userId);
            const localData = {
                routineTasks: mergeById(browserData.routineTasks, offlineData?.routineTasks),
                financeData: mergeById(browserData.financeData, offlineData?.financeData),
                financeCategories: [...new Set([...browserData.financeCategories, ...(offlineData?.financeCategories || [])])],
                appTheme: offlineData?.appTheme || browserData.appTheme,
            };
            const data = result.data ? {
                ...result.data,
                routineTasks: mergeById(localData.routineTasks, result.data.routineTasks),
                financeData: mergeById(localData.financeData, result.data.financeData),
                financeCategories: [...new Set([...(result.data.financeCategories || []), ...localData.financeCategories])],
            } : localData;
            const saveResponse = await fetch(`${apiUrl}/api/data`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!saveResponse.ok) throw new Error('Your workspace data could not be initialized in Supabase.');

            if (active) {
                writeLocalData(data);
                localStorage.setItem(localOwnerKey, userId);
                localStorage.removeItem(offlineBackupKey(userId));
                if (legacyAccountMatches) localStorage.removeItem('userInfo');
                setSyncError('');
            }
        };

        hydrateUserData()
            .catch(error => {
                if (active) {
                    const offlineData = readOfflineBackup(userId);
                    if (offlineData) {
                        writeLocalData(offlineData);
                        localStorage.setItem(localOwnerKey, userId);
                    }
                    setSyncError(error.message || 'Cloud data could not be loaded.');
                }
            })
            .finally(() => {
                if (active) setHydratedUserId(userId);
            });

        return () => { active = false; };
    }, [clerkUser, getToken, isLoaded, isSignedIn, userId]);

    const syncData = useCallback(async (updates = {}) => {
        if (!isSignedIn) return;
        syncQueueRef.current = syncQueueRef.current.catch(() => {}).then(async () => {
            try {
                const token = await getToken();
                const data = { ...readLocalData(), ...updates };
                const response = await fetch(`${apiUrl}/api/data`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (!response.ok) throw new Error('Cloud sync failed. Your changes are still saved on this device.');
                setSyncError('');
                return true;
            } catch (error) {
                setSyncError(error.message || 'Cloud sync failed. Your changes remain saved on this device.');
                return false;
            }
        });
        return syncQueueRef.current;
    }, [getToken, isSignedIn]);

    const logout = useCallback(async () => {
        const synced = await syncData();
        if (!synced) localStorage.setItem(offlineBackupKey(userId), JSON.stringify(readLocalData()));
        await signOut();
        localDataKeys.forEach(key => localStorage.removeItem(key));
        localStorage.removeItem(localOwnerKey);
        document.body.classList.remove('light-theme');
        return true;
    }, [signOut, syncData, userId]);

    const user = useMemo(() => clerkUser ? {
        id: userId,
        name: clerkUser.fullName || clerkUser.firstName || 'Progress user',
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        imageUrl: clerkUser.imageUrl,
    } : null, [clerkUser, userId]);
    const loading = !isLoaded || (Boolean(isSignedIn) && hydratedUserId !== userId);
    const value = useMemo(() => ({
        user,
        loading,
        configured: true,
        syncError,
        syncData,
        logout,
    }), [user, loading, syncError, syncData, logout]);

    return (
        <AuthContext.Provider value={value}>
            {loading ? <div className="app-loading" role="status">Loading your workspace…</div> : children}
        </AuthContext.Provider>
    );
}

export const AuthProvider = ({ children }) => (
    hasClerkKey
        ? <ClerkSessionBridge>{children}</ClerkSessionBridge>
        : <AuthContext.Provider value={{ ...defaultContext, configured: false }}>
            {children}
        </AuthContext.Provider>
);