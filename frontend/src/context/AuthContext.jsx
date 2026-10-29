import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/react';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from './AuthState';
import {
    applyAppTheme,
    emitWorkspaceChange,
    subscribeWorkspaceChange,
    getStoredUserProfile,
    setStoredUserProfile
} from '../utils/workspaceEvents';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);
const hasAppConfig = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) && hasSupabaseConfig;

const localOwnerKey = 'clerkWorkspaceOwnerId';
const localDataKeys = ['hybridRoutineTasks', 'financeData', 'financeCategories'];
const offlineBackupKey = (userId) => `clerkOfflineBackup:${userId}`;

const defaultContext = {
    user: null,
    loading: false,
    configured: hasAppConfig,
    realtimeStatus: 'disconnected',
    lastSyncedAt: null,
    syncError: '',
    syncData: async () => {},
    logout: async () => {},
};

const readLocalData = () => ({
    routineTasks: JSON.parse(localStorage.getItem('hybridRoutineTasks') || '[]'),
    financeData: JSON.parse(localStorage.getItem('financeData') || '[]'),
    financeCategories: JSON.parse(localStorage.getItem('financeCategories') || '[]'),
    appTheme: localStorage.getItem('appTheme') || 'dark',
    userProfile: getStoredUserProfile() || null,
});

const writeLocalData = (data) => {
    if (!data) return;
    if (Array.isArray(data.routineTasks)) {
        localStorage.setItem('hybridRoutineTasks', JSON.stringify(data.routineTasks));
    }
    if (Array.isArray(data.financeData)) {
        localStorage.setItem('financeData', JSON.stringify(data.financeData));
    }
    if (Array.isArray(data.financeCategories)) {
        localStorage.setItem('financeCategories', JSON.stringify(data.financeCategories));
    }
    const activeTheme = localStorage.getItem('appTheme') || data.appTheme || 'dark';
    applyAppTheme(activeTheme);
    if (data.userProfile) {
        setStoredUserProfile(data.userProfile);
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
    const [realtimeStatus, setRealtimeStatus] = useState('disconnected');
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const syncQueueRef = useRef(Promise.resolve());
    const isHydratingRef = useRef(false);

    // Initialized Supabase client with Clerk JWT token
    const supabase = useMemo(() => {
        if (!supabaseUrl || !supabasePublishableKey) return null;
        return createClient(supabaseUrl, supabasePublishableKey, {
            accessToken: async () => {
                try {
                    const token = await getToken({ template: 'supabase' }).catch(() => null);
                    if (token) return token;
                } catch {}
                try {
                    return await getToken();
                } catch {
                    return null;
                }
            },
            realtime: {
                params: {
                    eventsPerSecond: 10,
                },
            },
        });
    }, [getToken]);

    // Construct unified user profile object with username prominently featured
    const user = useMemo(() => {
        if (!clerkUser) return null;
        const cleanUsername = clerkUser.username ||
            clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] ||
            clerkUser.firstName?.toLowerCase() ||
            'user';
        return {
            id: userId,
            name: clerkUser.fullName || clerkUser.firstName || cleanUsername,
            username: cleanUsername,
            email: clerkUser.primaryEmailAddress?.emailAddress || '',
            imageUrl: clerkUser.imageUrl || '',
        };
    }, [clerkUser, userId]);

    // Hydrate User Data from Supabase Realtime Database
    useEffect(() => {
        if (!isLoaded || !isSignedIn || !userId || !supabase) return;
        let active = true;
        isHydratingRef.current = true;

        const storedOwnerId = localStorage.getItem(localOwnerKey);
        if (storedOwnerId && storedOwnerId !== userId) {
            localDataKeys.forEach(key => localStorage.removeItem(key));
            localStorage.removeItem(localOwnerKey);
        }

        const hydrateUserData = async () => {
            const { data: record, error: loadError } = await supabase
                .from('user_workspace_data')
                .select('data')
                .eq('clerk_user_id', userId)
                .maybeSingle();

            if (loadError) {
                console.warn('Supabase initial fetch notice:', loadError.message);
            }

            const browserData = readLocalData();
            const offlineData = readOfflineBackup(userId);
            const localData = {
                routineTasks: mergeById(browserData.routineTasks, offlineData?.routineTasks),
                financeData: mergeById(browserData.financeData, offlineData?.financeData),
                financeCategories: [...new Set([...browserData.financeCategories, ...(offlineData?.financeCategories || [])])],
                appTheme: offlineData?.appTheme || browserData.appTheme,
                userProfile: browserData.userProfile || {
                    name: clerkUser?.fullName || clerkUser?.firstName || 'User',
                    username: clerkUser?.username || clerkUser?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'user',
                    email: clerkUser?.primaryEmailAddress?.emailAddress || '',
                    avatarPhoto: clerkUser?.imageUrl || '',
                },
            };

            const data = record?.data ? {
                ...record.data,
                routineTasks: mergeById(localData.routineTasks, record.data.routineTasks),
                financeData: mergeById(localData.financeData, record.data.financeData),
                financeCategories: [...new Set([...(record.data.financeCategories || []), ...localData.financeCategories])],
                userProfile: record.data.userProfile || localData.userProfile,
            } : localData;

            // Upsert merged data back to Supabase
            const { error: saveError } = await supabase
                .from('user_workspace_data')
                .upsert({
                    clerk_user_id: userId,
                    data,
                    updated_at: new Date().toISOString()
                });

            if (saveError) {
                console.warn('Supabase initial upsert notice:', saveError.message);
            }

            if (active) {
                writeLocalData(data);
                localStorage.setItem(localOwnerKey, userId);
                localStorage.removeItem(offlineBackupKey(userId));
                setSyncError('');
                setLastSyncedAt(new Date());
                emitWorkspaceChange({ type: 'cloud_sync', source: 'hydrate' });
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
                    setSyncError(error.message || 'Cloud database could not be loaded.');
                }
            })
            .finally(() => {
                if (active) {
                    setHydratedUserId(userId);
                    isHydratingRef.current = false;
                }
            });

        return () => { active = false; };
    }, [clerkUser, isLoaded, isSignedIn, supabase, userId]);

    // Live Real-Time Database Subscription (Supabase Realtime Channel)
    useEffect(() => {
        if (!isLoaded || !isSignedIn || !userId || !supabase) {
            setRealtimeStatus('disconnected');
            return;
        }

        const channel = supabase
            .channel(`realtime:workspace:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_workspace_data',
                    filter: `clerk_user_id=eq.${userId}`
                },
                (payload) => {
                    if (isHydratingRef.current) return;
                    if (payload.new && payload.new.data) {
                        writeLocalData(payload.new.data);
                        setLastSyncedAt(new Date());
                        emitWorkspaceChange({ type: 'cloud_sync', source: 'realtime' });
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setRealtimeStatus('connected');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setRealtimeStatus('error');
                } else {
                    setRealtimeStatus('connecting');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isLoaded, isSignedIn, supabase, userId]);

    // Sync Data to Supabase Realtime Database
    const syncData = useCallback(async (updates = {}) => {
        if (!isSignedIn || !userId || !supabase) return false;
        syncQueueRef.current = syncQueueRef.current.catch(() => {}).then(async () => {
            try {
                const data = { ...readLocalData(), ...updates };
                const { error } = await supabase
                    .from('user_workspace_data')
                    .upsert({
                        clerk_user_id: userId,
                        data,
                        updated_at: new Date().toISOString()
                    });
                if (error) throw error;
                setSyncError('');
                setLastSyncedAt(new Date());
                return true;
            } catch (error) {
                setSyncError(error.message || 'Real-time sync failed. Changes remain saved locally.');
                return false;
            }
        });
        return syncQueueRef.current;
    }, [isSignedIn, supabase, userId]);

    // Listen to local workspace changes and auto-sync to Supabase Realtime Database
    useEffect(() => {
        if (!isSignedIn || !userId) return;
        let timeoutId = null;

        const handleWorkspaceChange = (e) => {
            if (e?.source === 'realtime' || e?.source === 'hydrate') return;
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                syncData();
            }, 800);
        };

        const unsubscribe = subscribeWorkspaceChange(handleWorkspaceChange);
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            unsubscribe();
        };
    }, [isSignedIn, syncData, userId]);

    const logout = useCallback(async () => {
        if (userId) {
            const synced = await syncData();
            if (!synced) {
                localStorage.setItem(offlineBackupKey(userId), JSON.stringify(readLocalData()));
            }
        }
        await signOut();
        localDataKeys.forEach(key => localStorage.removeItem(key));
        localStorage.removeItem(localOwnerKey);
        setStoredUserProfile(null);
        setHydratedUserId(null);
        setRealtimeStatus('disconnected');
        emitWorkspaceChange({ type: 'logout' });
        return true;
    }, [signOut, syncData, userId]);

    const loading = !isLoaded || (Boolean(isSignedIn) && hydratedUserId !== userId);
    const value = useMemo(() => ({
        user,
        loading,
        configured: true,
        realtimeStatus,
        lastSyncedAt,
        syncError,
        syncData,
        logout,
    }), [user, loading, realtimeStatus, lastSyncedAt, syncError, syncData, logout]);

    return (
        <AuthContext.Provider value={value}>
            {children}
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

