import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/react';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from './AuthState';
import { applyAppTheme } from '../utils/workspaceEvents';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);
const hasAppConfig = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) && hasSupabaseConfig;

const defaultContext = {
    user: null,
    loading: false,
    configured: hasAppConfig,
    syncError: '',
    syncData: async () => {},
    logout: async () => {},
};

const localOwnerKey = 'clerkWorkspaceOwnerId';
const localDataKeys = ['hybridRoutineTasks', 'financeData', 'financeCategories'];
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
    const activeTheme = localStorage.getItem('appTheme') || data.appTheme || 'dark';
    applyAppTheme(activeTheme);
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
    const supabase = useMemo(() => createClient(supabaseUrl, supabasePublishableKey, {
        accessToken: async () => getToken(),
    }), [getToken]);

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
            const { data: record, error: loadError } = await supabase
                .from('user_workspace_data')
                .select('data')
                .eq('clerk_user_id', userId)
                .maybeSingle();
            if (loadError) throw loadError;
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
            const data = record?.data ? {
                ...record.data,
                routineTasks: mergeById(localData.routineTasks, record.data.routineTasks),
                financeData: mergeById(localData.financeData, record.data.financeData),
                financeCategories: [...new Set([...(record.data.financeCategories || []), ...localData.financeCategories])],
            } : localData;
            const { error: saveError } = await supabase
                .from('user_workspace_data')
                .upsert({ clerk_user_id: userId, data, updated_at: new Date().toISOString() });
            if (saveError) throw saveError;

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
    }, [clerkUser, isLoaded, isSignedIn, supabase, userId]);

    const syncData = useCallback(async (updates = {}) => {
        if (!isSignedIn) return;
        syncQueueRef.current = syncQueueRef.current.catch(() => {}).then(async () => {
            try {
                const data = { ...readLocalData(), ...updates };
                const { error } = await supabase
                    .from('user_workspace_data')
                    .upsert({ clerk_user_id: userId, data, updated_at: new Date().toISOString() });
                if (error) throw error;
                setSyncError('');
                return true;
            } catch (error) {
                setSyncError(error.message || 'Cloud sync failed. Your changes remain saved on this device.');
                return false;
            }
        });
        return syncQueueRef.current;
    }, [isSignedIn, supabase, userId]);

    const logout = useCallback(async () => {
        const synced = await syncData();
        if (!synced) localStorage.setItem(offlineBackupKey(userId), JSON.stringify(readLocalData()));
        await signOut();
        localDataKeys.forEach(key => localStorage.removeItem(key));
        localStorage.removeItem(localOwnerKey);
        // preserved user's display theme preference
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
    hasAppConfig
        ? <ClerkSessionBridge>{children}</ClerkSessionBridge>
        : <AuthContext.Provider value={{ ...defaultContext, configured: false }}>
            {children}
        </AuthContext.Provider>
);