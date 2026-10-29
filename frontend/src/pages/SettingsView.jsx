import { useEffect, useState, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SignIn, SignUp } from '@clerk/react';
import { AuthContext } from '../context/AuthState';
import {
    Trash2,
    EyeOff,
    Eye,
    ExternalLink,
    Moon,
    Bell,
    Globe,
    HardDrive,
    Info,
    ShieldCheck,
    Check,
    ChevronRight,
    X,
    Download,
    Upload,
    Share2,
    Copy,
    MessageCircle,
    Link2,
    LoaderCircle,
    RefreshCw,
    Sparkles,
    User,
    LogIn,
    UserPlus,
    LogOut,
    Camera
} from 'lucide-react';
import {
    applyAppTheme,
    getStoredTheme,
    subscribeWorkspaceChange,
    getStoredUserProfile,
    setStoredUserProfile,
    getStoredAccounts,
    saveStoredAccount
} from '../utils/workspaceEvents';
import { canInstallProgressApp, promptInstallProgressApp } from '../utils/appInstall';
import { checkForAppUpdate } from '../utils/appUpdates';
import {
    getPersistentStorageInfo,
    PERSISTENT_STORAGE_CHANGE_EVENT,
    PERSISTENT_STORAGE_ERROR_EVENT
} from '../utils/persistentStorage';
import {
    getCustomGeminiApiKey,
    setCustomGeminiApiKey,
    testGeminiApiKey
} from '../ai/agentEngine';

const backupFormat = 'progress-workspace-backup';

const clerkAuthAppearance = {
    layout: {
        socialButtonsPlacement: 'top',
        showOptionalFields: true,
    },
    variables: {
        colorPrimary: '#3b82f6',
        borderRadius: '12px',
        fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif"
    }
};
// Clean iOS Toggle Switch component matching Image 1 & Image 2
function IOSSwitch({ checked, onChange, activeColor = '#22c55e', id, ariaLabel }) {
    return (
        <label className="ios-toggle-label" htmlFor={id}>
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="ios-toggle-input"
                aria-label={ariaLabel}
            />
            <span
                className="ios-toggle-slider"
                style={checked ? { backgroundColor: activeColor } : undefined}
            />
        </label>
    );
}

export default function SettingsView() {
    // AURA AI & GEMINI SETTINGS STATE
    const [customApiKey, setCustomApiKey] = useState(() => getCustomGeminiApiKey());
    const [inputApiKey, setInputApiKey] = useState('');
    const [showKeyText, setShowKeyText] = useState(false);
    const [testingKey, setTestingKey] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [aiStorageMode, setAiStorageMode] = useState(() => {
        try {
            return localStorage.getItem('aura_storage_mode') || 'local';
        } catch {
            return 'local';
        }
    });
    const [aiFeedbackMsg, setAiFeedbackMsg] = useState('');

    const handleOpenApiKeyModal = () => {
        setInputApiKey(customApiKey);
        setTestResult(null);
        setShowKeyText(false);
        setActiveModal('gemini_api');
    };

    const handleSaveApiKey = () => {
        const trimmed = inputApiKey.trim();
        setCustomGeminiApiKey(trimmed);
        setCustomApiKey(trimmed);
        setActiveModal(null);
        setAiFeedbackMsg(trimmed ? 'Personal Gemini API key saved! Aura AI will now use your key.' : 'API key removed. Reverted to standard AI.');
        setTimeout(() => setAiFeedbackMsg(''), 4000);
    };

    const handleRemoveApiKey = () => {
        setCustomGeminiApiKey('');
        setCustomApiKey('');
        setInputApiKey('');
        setActiveModal(null);
        setAiFeedbackMsg('Personal Gemini API key removed. Reverted to standard AI.');
        setTimeout(() => setAiFeedbackMsg(''), 4000);
    };

    const handleTestApiKey = async () => {
        const keyToTest = inputApiKey.trim() || customApiKey;
        if (!keyToTest) {
            setTestResult({ success: false, message: 'Please enter a Gemini API Key to test.' });
            return;
        }
        setTestingKey(true);
        setTestResult(null);
        try {
            const reply = await testGeminiApiKey(keyToTest);
            setTestResult({ success: true, message: `Connected to Gemini! AI Response: "${reply.slice(0, 40)}..."` });
        } catch (err) {
            setTestResult({ success: false, message: err.message || 'Connection test failed. Check key & internet.' });
        } finally {
            setTestingKey(false);
        }
    };

    const handleStorageModeChange = (mode) => {
        try {
            localStorage.setItem('aura_storage_mode', mode);
            setAiStorageMode(mode);
            if (mode === 'session') {
                const saved = localStorage.getItem('aura_conversations_v2');
                if (saved) {
                    sessionStorage.setItem('aura_conversations_v2', saved);
                    localStorage.removeItem('aura_conversations_v2');
                }
            }
            setAiFeedbackMsg(`Chat storage: ${mode === 'session' ? 'Session only' : mode === 'none' ? 'Not saved' : 'On this device'}`);
            setTimeout(() => setAiFeedbackMsg(''), 4000);
        } catch {}
    };

    const handleClearAiHistory = () => {
        if (!window.confirm('Delete all chats and reset AI memory?')) return;
        try {
            localStorage.removeItem('aura_conversations_v2');
            localStorage.removeItem('aura_active_conv_id_v2');
            localStorage.removeItem('aura_chat_history_v1');
            sessionStorage.removeItem('aura_conversations_v2');
            sessionStorage.removeItem('aura_active_conv_id_v2');
            sessionStorage.removeItem('aura_chat_history_v1');
            setAiFeedbackMsg('All AI conversations and memory have been wiped.');
            setTimeout(() => setAiFeedbackMsg(''), 4000);
        } catch {}
    };

    const handleExportAiData = () => {
        try {
            const raw = localStorage.getItem('aura_conversations_v2') || sessionStorage.getItem('aura_conversations_v2') || '[]';
            const parsed = JSON.parse(raw);
            const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `progress-aura-ai-chats-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setAiFeedbackMsg('AI chat history exported successfully.');
            setTimeout(() => setAiFeedbackMsg(''), 4000);
        } catch {
            setAiFeedbackMsg('Could not export chat history.');
            setTimeout(() => setAiFeedbackMsg(''), 4000);
        }
    };

    // General options (Image 1 & 2)
    const [theme, setTheme] = useState(() => getStoredTheme());
    const [notifications, setNotifications] = useState(() => localStorage.getItem('appNotifications') !== 'false');
    const [language, setLanguage] = useState(() => localStorage.getItem('appLanguage') || 'English (US)');

    // Storage calculation (Image 1)
    const [storageInfo, setStorageInfo] = useState(() => getPersistentStorageInfo());

    // User Profile & Authentication State (Image 1 place login/signup)
    const authContext = useContext(AuthContext);
    const clerkUser = authContext?.user;
    const clerkLogout = authContext?.logout;
    const realtimeStatus = authContext?.realtimeStatus || 'disconnected';
    const lastSyncedAt = authContext?.lastSyncedAt;
    const syncData = authContext?.syncData;
    const cloudSyncError = authContext?.syncError;
    const [authMethod, setAuthMethod] = useState('clerk'); // 'clerk' | 'username'
    const [isManualSyncing, setIsManualSyncing] = useState(false);
    const [syncFeedback, setSyncFeedback] = useState('');

    const [userProfile, setUserProfile] = useState(() => getStoredUserProfile());
    const [savedAccounts, setSavedAccounts] = useState(() => getStoredAccounts());
    const [authMode, setAuthMode] = useState('signup'); // 'signup' | 'login' | 'edit'
    const [authForm, setAuthForm] = useState({
        name: '',
        username: '',
        email: '',
        password: '',
        bio: '',
        avatarColor: 'gradient-blue',
        avatarPhoto: ''
    });
    const [showAuthPassword, setShowAuthPassword] = useState(false);
    const [authError, setAuthError] = useState('');
    const [authSuccessMsg, setAuthSuccessMsg] = useState('');
    const [activeModal, setActiveModal] = useState(null);

    // Active authenticated profile: uses Clerk profile if signed in, or saved local user profile
    const currentUser = useMemo(() => {
        if (clerkUser) {
            return {
                name: clerkUser.name || clerkUser.username || 'User',
                username: clerkUser.username || userProfile?.username || 'user',
                email: clerkUser.email || userProfile?.email || '',
                avatarPhoto: clerkUser.imageUrl || userProfile?.avatarPhoto || '',
                avatarColor: userProfile?.avatarColor || 'gradient-blue',
                bio: userProfile?.bio || '',
                isClerk: true,
            };
        }
        return userProfile || null;
    }, [clerkUser, userProfile]);

    // Automatically close modal when Clerk authentication succeeds
    useEffect(() => {
        if (clerkUser && activeModal === 'auth_modal') {
            setActiveModal(null);
        }
    }, [clerkUser, activeModal]);

    const handleManualSync = async () => {
        setIsManualSyncing(true);
        setSyncFeedback('');
        try {
            if (syncData) {
                const ok = await syncData();
                setSyncFeedback(ok ? 'Synced with Supabase Realtime Database!' : 'Sync completed locally.');
            } else {
                setSyncFeedback('Workspace saved locally.');
            }
        } catch (err) {
            setSyncFeedback('Sync notice: ' + (err.message || 'Check connection'));
        } finally {
            setIsManualSyncing(false);
            setTimeout(() => setSyncFeedback(''), 3500);
        }
    };

    const AVATAR_COLOR_OPTIONS = [
        { id: 'gradient-blue', label: 'Ocean Blue', bg: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' },
        { id: 'gradient-purple', label: 'Vibrant Purple', bg: 'linear-gradient(135deg, #a855f7, #ec4899)' },
        { id: 'gradient-emerald', label: 'Emerald Mint', bg: 'linear-gradient(135deg, #10b981, #06b6d4)' },
        { id: 'gradient-amber', label: 'Sunset Amber', bg: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
        { id: 'gradient-rose', label: 'Rose Pink', bg: 'linear-gradient(135deg, #f43f5e, #fb7185)' },
        { id: 'gradient-indigo', label: 'Deep Indigo', bg: 'linear-gradient(135deg, #6366f1, #3b82f6)' }
    ];

    const getProfileGradient = (colorId) => {
        const opt = AVATAR_COLOR_OPTIONS.find(o => o.id === colorId);
        return opt ? opt.bg : 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
    };

    const getProfileInitials = (name, username) => {
        if (name && name.trim()) {
            const parts = name.trim().split(/\s+/);
            if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
            return parts[0].slice(0, 2).toUpperCase();
        }
        if (username && username.trim()) {
            return username.trim().slice(0, 2).toUpperCase();
        }
        return 'P';
    };

    const handleOpenAuthModal = (mode = 'signup') => {
        setAuthError('');
        setAuthSuccessMsg('');
        setShowAuthPassword(false);
        setSavedAccounts(getStoredAccounts());
        if (mode === 'edit' && userProfile) {
            setAuthMode('edit');
            setAuthForm({
                name: userProfile.name || '',
                username: userProfile.username || '',
                email: userProfile.email || '',
                password: userProfile.password || '',
                bio: userProfile.bio || '',
                avatarColor: userProfile.avatarColor || 'gradient-blue',
                avatarPhoto: userProfile.avatarPhoto || ''
            });
        } else {
            setAuthMode(mode);
            setAuthForm({
                name: '',
                username: '',
                email: '',
                password: '',
                bio: '',
                avatarColor: 'gradient-blue',
                avatarPhoto: ''
            });
        }
        setActiveModal('auth_modal');
    };

    const handlePhotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setAuthError('Avatar image must be smaller than 2MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            setAuthForm(prev => ({ ...prev, avatarPhoto: reader.result }));
            setAuthError('');
        };
        reader.onerror = () => setAuthError('Failed to read image file.');
        reader.readAsDataURL(file);
    };

    const handleRemovePhoto = () => {
        setAuthForm(prev => ({ ...prev, avatarPhoto: '' }));
    };

    const handleAuthSubmit = (e) => {
        e.preventDefault();
        setAuthError('');
        setAuthSuccessMsg('');

        if (authMode === 'signup') {
            const cleanUsername = authForm.username.trim().replace(/^@+/, '');
            const cleanName = authForm.name.trim();
            const cleanEmail = authForm.email.trim().toLowerCase();
            const cleanPassword = authForm.password;

            if (!cleanUsername) {
                setAuthError('Please choose a username.');
                return;
            }
            if (!cleanName) {
                setAuthError('Please enter your full name.');
                return;
            }
            if (!cleanPassword || cleanPassword.length < 4) {
                setAuthError('Password must be at least 4 characters long.');
                return;
            }

            const accounts = getStoredAccounts();
            const existing = accounts.find(a =>
                (a.username && a.username.toLowerCase() === cleanUsername.toLowerCase()) ||
                (cleanEmail && a.email && a.email.toLowerCase() === cleanEmail)
            );
            if (existing) {
                setAuthError('Username or email already in use. Please log in instead or use another.');
                return;
            }

            const newProfile = {
                id: 'usr_' + Date.now(),
                name: cleanName,
                username: cleanUsername,
                email: cleanEmail,
                password: cleanPassword,
                bio: authForm.bio.trim(),
                avatarColor: authForm.avatarColor || 'gradient-blue',
                avatarPhoto: authForm.avatarPhoto || '',
                createdAt: new Date().toISOString()
            };

            setStoredUserProfile(newProfile);
            setUserProfile(newProfile);
            if (syncData) {
                syncData({ userProfile: newProfile }).catch(() => {});
            }
            setAuthSuccessMsg('Account created successfully!');
            setTimeout(() => setActiveModal(null), 800);

        } else if (authMode === 'login') {
            const loginQuery = authForm.username.trim().replace(/^@+/, '').toLowerCase();
            const cleanPassword = authForm.password;

            if (!loginQuery) {
                setAuthError('Please enter your username or email.');
                return;
            }
            if (!cleanPassword) {
                setAuthError('Please enter your password.');
                return;
            }

            const accounts = getStoredAccounts();
            const match = accounts.find(a =>
                (a.username && a.username.toLowerCase() === loginQuery) ||
                (a.email && a.email.toLowerCase() === loginQuery)
            );

            if (!match) {
                setAuthError('Account not found with this username/email. Tap "Sign Up" to create one!');
                return;
            }

            if (match.password && match.password !== cleanPassword) {
                setAuthError('Incorrect password. Please try again.');
                return;
            }

            setStoredUserProfile(match);
            setUserProfile(match);
            if (syncData) {
                syncData({ userProfile: match }).catch(() => {});
            }
            setAuthSuccessMsg(`Welcome back, ${match.name || match.username}!`);
            setTimeout(() => setActiveModal(null), 800);

        } else if (authMode === 'edit') {
            const cleanUsername = authForm.username.trim().replace(/^@+/, '');
            const cleanName = authForm.name.trim();

            if (!cleanUsername) {
                setAuthError('Username cannot be empty.');
                return;
            }
            if (!cleanName) {
                setAuthError('Name cannot be empty.');
                return;
            }

            const updatedProfile = {
                ...(currentUser || userProfile || {}),
                name: cleanName,
                username: cleanUsername,
                email: authForm.email.trim().toLowerCase(),
                password: authForm.password || userProfile?.password || '',
                bio: authForm.bio.trim(),
                avatarColor: authForm.avatarColor || 'gradient-blue',
                avatarPhoto: authForm.avatarPhoto || ''
            };

            setStoredUserProfile(updatedProfile);
            setUserProfile(updatedProfile);
            if (syncData) {
                syncData({ userProfile: updatedProfile }).catch(() => {});
            }
            setAuthSuccessMsg('Profile details saved!');
            setTimeout(() => setActiveModal(null), 800);
        }
    };

    const handleLogOut = async () => {
        if (!window.confirm('Log out from this account? You will return to Guest mode.')) return;
        if (clerkLogout) {
            await clerkLogout();
        }
        setStoredUserProfile(null);
        setUserProfile(null);
        setActiveModal(null);
    };

    const handleSelectSavedAccount = (acc) => {
        setAuthForm(prev => ({
            ...prev,
            username: acc.username || acc.email || '',
            password: ''
        }));
        setAuthError('');
    };

    // Modals state: null | 'language' | 'about' | 'privacy' | 'auth_modal'
    const [shareStatus, setShareStatus] = useState('');
    // Backup state
    const [backupFile, setBackupFile] = useState(null);
    const [backupMessage, setBackupMessage] = useState('');
    const [backupError, setBackupError] = useState(false);
    const [installPromptAvailable, setInstallPromptAvailable] = useState(canInstallProgressApp);
    const [installMessage, setInstallMessage] = useState('');
    const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false);
    const [updateMessage, setUpdateMessage] = useState('');
    const [isAppInstalled, setIsAppInstalled] = useState(() => (
        window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
    ));

    // Listen for theme and user profile changes across the workspace
    useEffect(() => {
        const unsubscribe = subscribeWorkspaceChange((e) => {
            if (e?.type === 'theme') {
                setTheme(e.theme || getStoredTheme());
            }
            if (e?.type === 'user_profile') {
                setUserProfile(e.profile || getStoredUserProfile());
                setSavedAccounts(getStoredAccounts());
            }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        const handleInstallAvailable = () => setInstallPromptAvailable(canInstallProgressApp());
        const handleInstalled = () => {
            setInstallPromptAvailable(false);
            setIsAppInstalled(true);
            setInstallMessage('Progress has been installed on this device.');
        };
        window.addEventListener('progressappinstallavailable', handleInstallAvailable);
        window.addEventListener('appinstalled', handleInstalled);
        return () => {
            window.removeEventListener('progressappinstallavailable', handleInstallAvailable);
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, []);

    useEffect(() => {
        const refreshStorageInfo = () => setStorageInfo(getPersistentStorageInfo());
        refreshStorageInfo();
        window.addEventListener(PERSISTENT_STORAGE_CHANGE_EVENT, refreshStorageInfo);
        window.addEventListener(PERSISTENT_STORAGE_ERROR_EVENT, refreshStorageInfo);
        return () => {
            window.removeEventListener(PERSISTENT_STORAGE_CHANGE_EVENT, refreshStorageInfo);
            window.removeEventListener(PERSISTENT_STORAGE_ERROR_EVENT, refreshStorageInfo);
        };
    }, [theme, notifications, language]);

    // Handlers
    const toggleTheme = (isLight) => {
        const next = isLight ? 'light' : 'dark';
        applyAppTheme(next);
        setTheme(next);
    };

    const handleInstallApp = async () => {
        setInstallMessage('');
        try {
            const installChoice = await promptInstallProgressApp();
            if (installChoice) {
                setInstallPromptAvailable(false);
                setIsAppInstalled(installChoice.outcome === 'accepted');
                setInstallMessage(installChoice.outcome === 'accepted'
                    ? 'Progress is being installed on this device.'
                    : 'Installation was cancelled.');
                return;
            }

            const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
                || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            setInstallMessage(isAppInstalled
                ? 'Progress is already installed on this device.'
                : isIOS
                    ? 'To install, tap Share in Safari, then choose Add to Home Screen.'
                    : 'Open your browser menu and choose Install app or Add to Home Screen.');
        } catch (error) {
            console.error('Progress app installation failed:', error);
            setInstallMessage(error.message || 'Could not start installation. Please try again.');
        }
    };

    const handleDownloadUpdate = async () => {
        setIsCheckingForUpdate(true);
        setUpdateMessage('Checking for updates…');
        try {
            const updateAvailable = await checkForAppUpdate();
            setUpdateMessage(updateAvailable
                ? 'A new update is ready. Open notifications to explore the latest features.'
                : 'You are using the latest version.');
        } catch (error) {
            console.error('Progress update check failed:', error);
            setUpdateMessage(error.message || 'Could not check for updates. Please try again.');
        } finally {
            setIsCheckingForUpdate(false);
        }
    };

    const toggleNotifications = (val) => {
        setNotifications(val);
        localStorage.setItem('appNotifications', val ? 'true' : 'false');
    };

    const shareUrl = new URL('/', window.location.origin).href;
    const shareText = 'Check out Progress Tracker — a personal routine, habit, and finance tracker.';
    const encodedShareUrl = encodeURIComponent(shareUrl);
    const encodedShareText = encodeURIComponent(shareText);

    const handleCopyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setShareStatus('Link copied to clipboard.');
        } catch {
            setShareStatus('Could not copy the link. You can select and copy it below.');
        }
    };

    const handleNativeShare = async () => {
        if (!navigator.share) {
            setShareStatus('Device sharing is not available in this browser. Choose a social app below.');
            return;
        }
        try {
            await navigator.share({ title: 'Progress Tracker', text: shareText, url: shareUrl });
            setShareStatus('');
        } catch (error) {
            if (error.name !== 'AbortError') {
                setShareStatus('Sharing failed. Please choose a social app below.');
            }
        }
    };

    const handleSelectLanguage = (lang) => {
        setLanguage(lang);
        localStorage.setItem('appLanguage', lang);
        setActiveModal(null);
    };

    // Backup & Restore
    const downloadBackup = () => {
        const backup = {
            format: backupFormat,
            version: 1,
            exportedAt: new Date().toISOString(),
            data: {
                hybridRoutineTasks: JSON.parse(localStorage.getItem('hybridRoutineTasks') || '[]'),
                financeData: JSON.parse(localStorage.getItem('financeData') || '[]'),
                financeCategories: JSON.parse(localStorage.getItem('financeCategories') || '[]'),
                appTheme: localStorage.getItem('appTheme') || 'dark',
            },
        };
        const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = `progress-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        setBackupError(false);
        setBackupMessage('Backup downloaded successfully.');
    };

    const restoreBackup = async () => {
        if (!backupFile) return;
        setBackupMessage('');
        setBackupError(false);
        try {
            const backup = JSON.parse(await backupFile.text());
            const data = backup?.data;
            if (
                backup?.format !== backupFormat ||
                backup.version !== 1 ||
                !data ||
                !Array.isArray(data.hybridRoutineTasks) ||
                !Array.isArray(data.financeData) ||
                !Array.isArray(data.financeCategories) ||
                !['dark', 'light'].includes(data.appTheme)
            ) {
                throw new Error('This file is not a supported Progress backup.');
            }
            if (!window.confirm('Restore this backup? Current routine and finance data will be replaced.')) return;
            localStorage.setItem('hybridRoutineTasks', JSON.stringify(data.hybridRoutineTasks));
            localStorage.setItem('financeData', JSON.stringify(data.financeData));
            localStorage.setItem('financeCategories', JSON.stringify(data.financeCategories));
            localStorage.setItem('appTheme', data.appTheme);
            window.location.reload();
        } catch (error) {
            setBackupError(true);
            setBackupMessage(error.message || 'Could not restore backup file.');
        }
    };

    return (
        <>
        <div className="view-section active">
            <div className="ios-settings-page">
                {/* SETTINGS LARGE TITLE (IMAGE 1 STYLE) */}
                <header className="ios-settings-header">
                    <h1 className="ios-settings-title">Settings</h1>
                </header>

                {/* USER PROFILE CARD (DYNAMIC REAL-TIME DATABASE & AUTH) */}
                {currentUser ? (
                    <section
                        className="ios-card ios-profile-card ios-profile-interactive"
                        onClick={() => handleOpenAuthModal('edit')}
                        role="button"
                        tabIndex={0}
                        aria-label="Edit Profile Details"
                    >
                        <div className="ios-profile-content">
                            {currentUser.avatarPhoto ? (
                                <img src={currentUser.avatarPhoto} alt={currentUser.name} className="ios-profile-avatar-img" />
                            ) : (
                                <div
                                    className="ios-profile-avatar-initials"
                                    style={{ background: getProfileGradient(currentUser.avatarColor) }}
                                >
                                    {getProfileInitials(currentUser.name, currentUser.username)}
                                </div>
                            )}
                            <div className="ios-profile-text">
                                <div className="ios-profile-title-row">
                                    <h2 className="ios-profile-name">{currentUser.name}</h2>
                                    {realtimeStatus === 'connected' ? (
                                        <span className="ios-profile-badge realtime" title="Live Supabase Realtime Database active">
                                            <span className="ios-badge-pulse-dot" /> Live DB
                                        </span>
                                    ) : (
                                        <span className="ios-profile-badge">Active</span>
                                    )}
                                </div>
                                <p className="ios-profile-email">
                                    <span className="ios-profile-username">@{currentUser.username}</span>
                                    {currentUser.email && <span className="ios-profile-dot">•</span>}
                                    {currentUser.email && <span>{currentUser.email}</span>}
                                </p>
                                {currentUser.bio && (
                                    <p className="ios-profile-bio-preview">{currentUser.bio}</p>
                                )}
                                {lastSyncedAt && (
                                    <p className="ios-profile-sync-status">
                                        ⚡ Realtime synced: {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                            <div className="ios-profile-arrow-wrap">
                                <span className="ios-profile-edit-hint">Edit</span>
                                <ChevronRight size={18} className="ios-profile-arrow" />
                            </div>
                        </div>

                        {/* QUICK ACTION BAR FOR LOGGED-IN USERS */}
                        <div className="ios-profile-logged-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                className="ios-profile-quick-action-btn sync"
                                onClick={handleManualSync}
                                disabled={isManualSyncing}
                                title="Sync with Real-Time Database"
                            >
                                <RefreshCw size={13} className={isManualSyncing ? 'spin-icon' : ''} />
                                <span>{isManualSyncing ? 'Syncing...' : 'Sync Database'}</span>
                            </button>
                            <button
                                type="button"
                                className="ios-profile-quick-action-btn logout"
                                onClick={handleLogOut}
                                title="Sign out from workspace"
                            >
                                <LogOut size={13} />
                                <span>Log Out</span>
                            </button>
                        </div>
                        {syncFeedback && (
                            <p className="ios-profile-sync-feedback" role="status">
                                {syncFeedback}
                            </p>
                        )}
                    </section>
                ) : (
                    <section className="ios-card ios-profile-card ios-profile-guest">
                        <div className="ios-profile-content">
                            <div className="ios-profile-avatar-initials guest-avatar">
                                <User size={28} />
                            </div>
                            <div className="ios-profile-text">
                                <h2 className="ios-profile-name">Personal Workspace</h2>
                                <p className="ios-profile-email">Set up your username & profile details</p>
                            </div>
                        </div>
                        <div className="ios-profile-auth-actions">
                            <button
                                type="button"
                                className="ios-profile-auth-btn secondary"
                                onClick={() => handleOpenAuthModal('login')}
                            >
                                <LogIn size={15} />
                                <span>Log In</span>
                            </button>
                            <button
                                type="button"
                                className="ios-profile-auth-btn primary"
                                onClick={() => handleOpenAuthModal('signup')}
                            >
                                <UserPlus size={15} />
                                <span>Sign Up</span>
                            </button>
                        </div>
                    </section>
                )}

                {/* SECTION 1: GENERAL (IMAGE 2 OPTIONS INSIDE IMAGE 1 CARD) */}
                <div className="ios-section-label">General</div>
                <section className="ios-card ios-card-grouped">
                    {/* Dark Mode toggle (Image 1 style) */}
                    <div className="ios-row">
                        <div className="ios-row-left">
                            <span className="ios-icon-box dark-mode-icon">
                                <Moon size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">Dark Mode</span>
                            </div>
                        </div>
                        <div className="ios-row-right">
                            <IOSSwitch
                                id="toggle-dark-mode"
                                checked={theme === 'dark'}
                                onChange={(checked) => toggleTheme(!checked)}
                                activeColor="#3b82f6"
                                ariaLabel="Toggle dark mode"
                            />
                        </div>
                    </div>

                    <div className="ios-divider" />

                    {/* Notifications toggle (Image 1 & 2) */}
                    <div className="ios-row">
                        <div className="ios-row-left">
                            <span className="ios-icon-box notif-icon">
                                <Bell size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">Notifications</span>
                            </div>
                        </div>
                        <div className="ios-row-right">
                            <IOSSwitch
                                id="toggle-notifications"
                                checked={notifications}
                                onChange={toggleNotifications}
                                activeColor="#18181b"
                                ariaLabel="Toggle notifications"
                            />
                        </div>
                    </div>

                    <div className="ios-divider" />

                    {/* Language selector (Image 2) */}
                    <button
                        type="button"
                        onClick={() => setActiveModal('language')}
                        className="ios-row ios-row-btn"
                    >
                        <div className="ios-row-left">
                            <span className="ios-icon-box globe-icon">
                                <Globe size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">Language</span>
                            </div>
                        </div>
                        <div className="ios-row-right">
                            <span className="ios-row-value">{language}</span>
                            <ChevronRight size={17} className="ios-chevron" />
                        </div>
                    </button>
                </section>

                {/* SECTION 3: STORAGE & BACKUP (IMAGE 1 TEMPLATE) */}
                <div className="ios-section-label">Storage & Data</div>
                <section className="ios-card ios-storage-card">
                    <div className="ios-storage-header">
                        <div className="ios-row-left">
                            <span className="ios-icon-box storage-icon">
                                <HardDrive size={18} />
                            </span>
                            <span className="ios-row-title">Storage</span>
                        </div>
                    </div>

                    {/* Horizontal Progress Bar matching Image 1 */}
                    <div className="ios-storage-track">
                        <div
                            className="ios-storage-fill"
                            style={{ width: `${storageInfo.percent}%` }}
                        />
                    </div>

                    <div className="ios-storage-meta">
                        <span>{storageInfo.percent}% used — {storageInfo.usedText} of {storageInfo.quotaText}</span>
                    </div>
                    <p className="ios-storage-note">
                        {storageInfo.backend === 'indexedDB'
                            ? 'Saved on this device using expanded app storage.'
                            : 'Expanded storage is unavailable; this browser is using its smaller local storage limit.'}
                    </p>
                    {storageInfo.warning && (
                        <p className="ios-storage-warning" role="alert">{storageInfo.warning}</p>
                    )}

                    {/* Data Backup & Restore */}
                    <div className="ios-backup-actions">
                        <button
                            type="button"
                            onClick={downloadBackup}
                            className="ios-backup-btn"
                        >
                            <Download size={15} /> Download Backup
                        </button>

                        <label className="ios-backup-btn upload">
                            <Upload size={15} /> Restore Backup
                            <input
                                type="file"
                                accept=".json,application/json"
                                onChange={(e) => {
                                    setBackupFile(e.target.files?.[0] || null);
                                    setBackupMessage('');
                                }}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>

                    {backupFile && (
                        <div className="ios-restore-confirm-row">
                            <span className="ios-file-name">{backupFile.name}</span>
                            <button
                                type="button"
                                onClick={restoreBackup}
                                className="ios-restore-apply-btn"
                            >
                                Apply Restore
                            </button>
                        </div>
                    )}

                    {backupMessage && (
                        <p className={`ios-backup-msg ${backupError ? 'error' : 'success'}`}>
                            {backupMessage}
                        </p>
                    )}
                </section>

                <div className="ios-section-label">App &amp; Updates</div>
                <section className="ios-card ios-app-updates-card">
                    <p className="ios-app-updates-description">
                        Install Progress on your phone and keep the latest version.
                    </p>
                    <div className="ios-app-update-actions">
                        <button
                            type="button"
                            onClick={handleInstallApp}
                            className="ios-app-update-btn"
                            disabled={isAppInstalled}
                        >
                            <Download size={17} />
                            {isAppInstalled ? 'Installed' : installPromptAvailable ? 'Install app' : 'Install on device'}
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadUpdate}
                            className="ios-app-update-btn is-primary"
                            disabled={isCheckingForUpdate}
                        >
                            {isCheckingForUpdate
                                ? <LoaderCircle size={17} className="ios-app-update-spinner" />
                                : <RefreshCw size={17} />}
                            {isCheckingForUpdate ? 'Checking…' : 'Check for updates'}
                        </button>
                    </div>
                    {installMessage && <p className="ios-app-update-message" role="status">{installMessage}</p>}
                    {updateMessage && <p className="ios-app-update-message" role="status">{updateMessage}</p>}
                </section>


                {/* SECTION: AURA AI & PRIVACY */}
                <div className="ios-section-label" id="ai-settings">AI &amp; Privacy</div>
                <section className="ios-card ios-card-grouped">
                    {/* GEMINI ENGINE & API KEY ROW */}
                    <div className="ios-row">
                        <div className="ios-row-left">
                            <span className="ios-icon-box" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))', color: '#a855f7' }}>
                                <Sparkles size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">Gemini API Key</span>
                                <span className="ios-row-subtitle">
                                    {customApiKey ? (
                                        <span style={{ color: 'var(--success, #10b981)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <Check size={12} /> Personal key active (••••{customApiKey.slice(-4)})
                                        </span>
                                    ) : (
                                        'Using default AI'
                                    )}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleOpenApiKeyModal}
                            className="ios-badge-btn"
                            style={{
                                background: 'rgba(59, 130, 246, 0.14)',
                                color: 'var(--primary, #3b82f6)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            {customApiKey ? 'Manage key' : 'Add API key'}
                        </button>
                    </div>

                    <div className="ios-divider" />

                    {/* DATA PRIVACY & STORAGE MODE ROW */}
                    <div className="ios-row">
                        <div className="ios-row-left">
                            <span className="ios-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                <ShieldCheck size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">Chat storage</span>
                                <span className="ios-row-subtitle">
                                    {aiStorageMode === 'session' ? 'Session only' : aiStorageMode === 'none' ? 'Not saved' : 'Saved on this device'}
                                </span>
                            </div>
                        </div>
                        <select
                            value={aiStorageMode}
                            onChange={(e) => handleStorageModeChange(e.target.value)}
                            className="ios-select-dropdown"
                            style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-main)',
                                borderRadius: 8,
                                padding: '6px 10px',
                                fontSize: '0.82rem',
                                fontWeight: 500,
                                cursor: 'pointer'
                            }}
                        >
                            <option value="local">On this device</option>
                            <option value="session">Session only</option>
                            <option value="none">Do not save</option>
                        </select>
                    </div>

                    <div className="ios-divider" />

                    {/* EXPORT AI CHAT DATA */}
                    <button
                        type="button"
                        onClick={handleExportAiData}
                        className="ios-row ios-row-btn"
                    >
                        <div className="ios-row-left">
                            <span className="ios-icon-box" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                                <Download size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">Export AI chats</span>
                                <span className="ios-row-subtitle">Download a chat backup</span>
                            </div>
                        </div>
                        <div className="ios-row-right">
                            <ChevronRight size={17} className="ios-chevron" />
                        </div>
                    </button>

                    <div className="ios-divider" />

                    {/* CLEAR AI MEMORY & HISTORY */}
                    <button
                        type="button"
                        onClick={handleClearAiHistory}
                        className="ios-row ios-row-btn"
                    >
                        <div className="ios-row-left">
                            <span className="ios-icon-box" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                                <Trash2 size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title" style={{ color: 'var(--danger, #ef4444)' }}>Clear AI chats</span>
                                <span className="ios-row-subtitle">Delete chats and reset AI memory</span>
                            </div>
                        </div>
                        <div className="ios-row-right">
                            <ChevronRight size={17} className="ios-chevron" />
                        </div>
                    </button>
                </section>
                {aiFeedbackMsg && (
                    <div style={{
                        padding: '10px 14px',
                        margin: '-4px 0 16px',
                        borderRadius: 10,
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#60a5fa',
                        fontSize: '0.84rem',
                        fontWeight: 500
                    }}>
                        {aiFeedbackMsg}
                    </div>
                )}

                {/* SECTION 4: ABOUT, PRIVACY & SHARING */}

                <section className="ios-card ios-card-grouped">
                    {/* About row (Image 1 style) */}
                    <button
                        type="button"
                        onClick={() => setActiveModal('about')}
                        className="ios-row ios-row-btn"
                    >
                        <div className="ios-row-left">
                            <span className="ios-icon-box info-icon">
                                <Info size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">About Progress</span>
                            </div>
                        </div>
                        <div className="ios-row-right">
                            <span className="ios-row-value">v2.4.0</span>
                            <ChevronRight size={17} className="ios-chevron" />
                        </div>
                    </button>

                    <div className="ios-divider" />

                    {/* Privacy Policy row (Image 1 style) */}
                    <button
                        type="button"
                        onClick={() => setActiveModal('privacy')}
                        className="ios-row ios-row-btn"
                    >
                        <div className="ios-row-left">
                            <span className="ios-icon-box shield-icon">
                                <ShieldCheck size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">Privacy Policy</span>
                            </div>
                        </div>
                        <div className="ios-row-right">
                            <ChevronRight size={17} className="ios-chevron" />
                        </div>
                    </button>

                    <div className="ios-divider" />

                    <button
                        type="button"
                        onClick={() => {
                            setShareStatus('');
                            setActiveModal('share');
                        }}
                        className="ios-row ios-row-btn"
                    >
                        <div className="ios-row-left">
                            <span className="ios-icon-box share-icon">
                                <Share2 size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">Share Progress</span>
                            </div>
                        </div>
                        <div className="ios-row-right">
                            <ChevronRight size={17} className="ios-chevron" />
                        </div>
                    </button>

                </section>

                <footer className="ios-settings-footer">
                    <span>Progress App • Personal AI Productivity</span>
                </footer>
            </div>
        </div>

        {activeModal && createPortal(
            <>

            {/* MODAL: PERSONAL GEMINI API KEY */}
            {activeModal === 'gemini_api' && (
                <div className="ios-modal-overlay" onClick={() => setActiveModal(null)}>
                    <div className="ios-modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="ios-modal-header">
                            <h3>Personal Google Gemini API Key</h3>
                            <button type="button" onClick={() => setActiveModal(null)} className="ios-modal-close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="ios-modal-body" style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                                Keep your conversations 100% private and unlock unlimited direct intelligence by linking your personal Google Gemini API key.
                            </p>

                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    color: 'var(--primary, #3b82f6)',
                                    fontSize: '0.84rem',
                                    fontWeight: 600,
                                    textDecoration: 'none'
                                }}
                            >
                                <span>Get free key from Google AI Studio</span>
                                <ExternalLink size={13} />
                            </a>

                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type={showKeyText ? 'text' : 'password'}
                                    placeholder="AIzaSy..."
                                    value={inputApiKey}
                                    onChange={(e) => setInputApiKey(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 42px 10px 12px',
                                        borderRadius: 10,
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-dark)',
                                        color: 'var(--text-main)',
                                        fontSize: '0.88rem',
                                        fontFamily: 'monospace'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKeyText(prev => !prev)}
                                    style={{
                                        position: 'absolute',
                                        right: 10,
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'grid',
                                        placeItems: 'center'
                                    }}
                                    title={showKeyText ? 'Hide key' : 'Show key'}
                                >
                                    {showKeyText ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {testResult && (
                                <div style={{
                                    padding: '9px 12px',
                                    borderRadius: 8,
                                    fontSize: '0.82rem',
                                    lineHeight: 1.4,
                                    background: testResult.success ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                                    border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                                    color: testResult.success ? '#10b981' : '#ef4444'
                                }}>
                                    {testResult.message}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                <button
                                    type="button"
                                    onClick={handleTestApiKey}
                                    disabled={testingKey}
                                    style={{
                                        flex: 1,
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        border: '1px solid var(--border)',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        color: 'var(--text-main)',
                                        fontSize: '0.86rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {testingKey ? 'Testing Connection...' : 'Test Connection'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveApiKey}
                                    style={{
                                        flex: 1,
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        border: 'none',
                                        background: 'var(--primary, #3b82f6)',
                                        color: '#ffffff',
                                        fontSize: '0.86rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Save Key
                                </button>
                            </div>

                            {customApiKey && (
                                <button
                                    type="button"
                                    onClick={handleRemoveApiKey}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        background: 'transparent',
                                        color: 'var(--danger, #ef4444)',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        marginTop: 4
                                    }}
                                >
                                    Remove Custom Key
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: LANGUAGE SELECTOR */}

            {activeModal === 'language' && (
                <div className="ios-modal-overlay" onClick={() => setActiveModal(null)}>
                    <div className="ios-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="ios-modal-header">
                            <h3>Select Language</h3>
                            <button type="button" onClick={() => setActiveModal(null)} className="ios-modal-close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="ios-modal-list">
                            {[
                                'English (US)',
                                'English (UK)',
                                'Español (Spanish)',
                                'Français (French)',
                                'Deutsch (German)',
                                'हिन्दी (Hindi)',
                                '日本語 (Japanese)'
                            ].map((lang) => (
                                <button
                                    key={lang}
                                    type="button"
                                    onClick={() => handleSelectLanguage(lang)}
                                    className={`ios-modal-list-item ${language === lang ? 'active' : ''}`}
                                >
                                    <span>{lang}</span>
                                    {language === lang && <Check size={18} color="#3b82f6" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: ABOUT PROGRESS */}
            {activeModal === 'about' && (
                <div className="ios-modal-overlay" onClick={() => setActiveModal(null)}>
                    <div className="ios-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="ios-modal-header">
                            <h3>About Progress</h3>
                            <button type="button" onClick={() => setActiveModal(null)} className="ios-modal-close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="ios-about-body">
                            <div className="ios-about-logo">
                                <img src="/pwa-icon.png" alt="Progress target logo" />
                            </div>
                            <h4>Progress Tracker & Habit Engine</h4>
                            <span className="ios-about-version">Version 2.4.0 (Build 2026.10)</span>
                            <p>
                                A private, local-first daily habit, routine tracker, and finance manager powered by Google Gemini AI assistant.
                            </p>
                            <div className="ios-about-credits">
                                <div><strong>Framework:</strong> React 19 + Vite</div>
                                <div><strong>Storage:</strong> Private local workspace on this device</div>
                                <div><strong>AI Engine:</strong> Google Gemini 2.5 Flash</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: PRIVACY POLICY */}
            {activeModal === 'privacy' && (
                <div className="ios-modal-overlay" onClick={() => setActiveModal(null)}>
                    <div className="ios-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="ios-modal-header">
                            <h3>Privacy Policy</h3>
                            <button type="button" onClick={() => setActiveModal(null)} className="ios-modal-close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="ios-privacy-body">
                            <div className="ios-privacy-item">
                                <strong>1. Local-First Storage</strong>
                                <p>All your routines, daily completions, streaks, and finance records reside directly in your browser on this device.</p>
                            </div>
                            <div className="ios-privacy-item">
                                <strong>2. Zero Tracking & No Ads</strong>
                                <p>Progress does not track your personal activities across other websites or sell your behavioral data.</p>
                            </div>
                            <div className="ios-privacy-item">
                                <strong>3. Backups Are Under Your Control</strong>
                                <p>Export a backup from Settings to keep a copy or move your data to another device.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'share' && (
                <div className="ios-modal-overlay" onClick={() => setActiveModal(null)}>
                    <div
                        className="ios-modal-box ios-share-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="share-progress-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="ios-modal-header">
                            <h3 id="share-progress-title">Share Progress</h3>
                            <button type="button" onClick={() => setActiveModal(null)} className="ios-modal-close" aria-label="Close share dialog">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="ios-modal-desc">Invite someone to try the Progress routine, habit, and finance tracker.</p>
                        <button type="button" className="ios-share-native-btn" onClick={handleNativeShare}>
                            <Share2 size={17} />
                            Share with an app
                        </button>
                        <div className="ios-share-options" aria-label="Social sharing options">
                            <a
                                className="ios-share-option whatsapp"
                                href={`https://wa.me/?text=${encodedShareText}%20${encodedShareUrl}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <MessageCircle size={18} />
                                WhatsApp
                            </a>
                            <a
                                className="ios-share-option facebook"
                                href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Facebook
                            </a>
                            <a
                                className="ios-share-option x-social"
                                href={`https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedShareUrl}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Post on X
                            </a>
                            <a
                                className="ios-share-option telegram"
                                href={`https://t.me/share/url?url=${encodedShareUrl}&text=${encodedShareText}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Telegram
                            </a>
                        </div>
                        <div className="ios-share-link-row">
                            <Link2 size={16} />
                            <input aria-label="Application share link" value={shareUrl} readOnly onFocus={(e) => e.target.select()} />
                            <button type="button" onClick={handleCopyShareLink} aria-label="Copy application link">
                                <Copy size={16} />
                                <span>Copy</span>
                            </button>
                        </div>
                        {shareStatus && <p className="ios-share-status" role="status">{shareStatus}</p>}
                    </div>
                </div>
            )}

            {/* MODAL: AUTHENTICATION & USER PROFILE (LOGIN / SIGN UP / EDIT) */}
            {activeModal === 'auth_modal' && (
                <div className="ios-modal-overlay" onClick={() => setActiveModal(null)}>
                    <div
                        className="ios-modal-box ios-auth-modal-sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="auth-modal-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="ios-modal-header">
                            <div className="ios-auth-header-info">
                                <h3 id="auth-modal-title">
                                    {authMode === 'signup' ? 'Create Account' : authMode === 'login' ? 'Log In' : 'Edit Profile'}
                                </h3>
                                <p className="ios-modal-desc">
                                    {authMode === 'signup'
                                        ? 'Set up your username, details, and personal avatar'
                                        : authMode === 'login'
                                        ? 'Sign in to access your customized profile'
                                        : 'Update your account name, username, and appearance'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveModal(null)}
                                className="ios-modal-close"
                                aria-label="Close dialog"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* TAB SELECTOR: LOGIN vs SIGN UP (hidden in edit mode) */}
                        {authMode !== 'edit' && (
                            <>
                                <div className="ios-auth-tabs">
                                    <button
                                        type="button"
                                        className={`ios-auth-tab ${authMode === 'login' ? 'active' : ''}`}
                                        onClick={() => { setAuthMode('login'); setAuthError(''); }}
                                    >
                                        <LogIn size={15} />
                                        <span>Log In</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`ios-auth-tab ${authMode === 'signup' ? 'active' : ''}`}
                                        onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                                    >
                                        <UserPlus size={15} />
                                        <span>Sign Up</span>
                                    </button>
                                </div>

                                {/* AUTH METHOD TOGGLE: CLERK REALTIME vs USERNAME FORM */}
                                <div className="ios-auth-method-tabs">
                                    <button
                                        type="button"
                                        className={`ios-auth-method-pill ${authMethod === 'clerk' ? 'active' : ''}`}
                                        onClick={() => setAuthMethod('clerk')}
                                    >
                                        <Sparkles size={13} />
                                        <span>Live Database & Clerk</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`ios-auth-method-pill ${authMethod === 'username' ? 'active' : ''}`}
                                        onClick={() => setAuthMethod('username')}
                                    >
                                        <User size={13} />
                                        <span>Custom Username</span>
                                    </button>
                                </div>
                            </>
                        )}

                        {/* CLERK EMBEDDED AUTH (SUPABASE REALTIME SYNCED) */}
                        {authMode !== 'edit' && authMethod === 'clerk' ? (
                            <div className="ios-clerk-container">
                                {authMode === 'login' ? (
                                    <SignIn appearance={clerkAuthAppearance} routing="virtual" />
                                ) : (
                                    <SignUp appearance={clerkAuthAppearance} routing="virtual" />
                                )}
                            </div>
                        ) : (
                            /* CUSTOM USERNAME & PROFILE FORM */
                            <>
                                {authError && (
                                    <div className="ios-auth-alert error" role="alert">
                                        {authError}
                                    </div>
                                )}
                                {authSuccessMsg && (
                                    <div className="ios-auth-alert success" role="status">
                                        <Check size={16} />
                                        <span>{authSuccessMsg}</span>
                                    </div>
                                )}

                                <form onSubmit={handleAuthSubmit} className="ios-auth-form">
                                    {/* SIGN UP & EDIT: FULL NAME */}
                                    {(authMode === 'signup' || authMode === 'edit') && (
                                        <div className="ios-auth-field">
                                            <label className="ios-auth-label">Full Name</label>
                                            <input
                                                type="text"
                                                className="ios-auth-input"
                                                placeholder="e.g. John Kenly"
                                                value={authForm.name}
                                                onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                    )}

                                    {/* USERNAME FIELD */}
                                    <div className="ios-auth-field">
                                        <label className="ios-auth-label">
                                            {authMode === 'login' ? 'Username or Email' : 'Username'}
                                        </label>
                                        <div className="ios-auth-input-group">
                                            {authMode !== 'login' && <span className="ios-auth-addon">@</span>}
                                            <input
                                                type="text"
                                                className="ios-auth-input"
                                                placeholder={authMode === 'login' ? 'Enter @username or email' : 'john_kenly'}
                                                value={authForm.username}
                                                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                                                required
                                                autoCapitalize="none"
                                                autoCorrect="off"
                                            />
                                        </div>
                                    </div>

                                    {/* EMAIL FIELD (SIGN UP & EDIT) */}
                                    {(authMode === 'signup' || authMode === 'edit') && (
                                        <div className="ios-auth-field">
                                            <label className="ios-auth-label">Email Address (Optional)</label>
                                            <input
                                                type="email"
                                                className="ios-auth-input"
                                                placeholder="john@example.com"
                                                value={authForm.email}
                                                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                                            />
                                        </div>
                                    )}

                                    {/* PASSWORD FIELD */}
                                    <div className="ios-auth-field">
                                        <label className="ios-auth-label">
                                            {authMode === 'edit' ? 'Password (Leave blank to keep current)' : 'Password'}
                                        </label>
                                        <div className="ios-auth-input-group">
                                            <input
                                                type={showAuthPassword ? 'text' : 'password'}
                                                className="ios-auth-input"
                                                placeholder={authMode === 'edit' ? 'Enter new password (optional)' : 'Enter password'}
                                                value={authForm.password}
                                                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                                                required={authMode !== 'edit'}
                                            />
                                            <button
                                                type="button"
                                                className="ios-auth-toggle-pwd"
                                                onClick={() => setShowAuthPassword(!showAuthPassword)}
                                                aria-label="Toggle password visibility"
                                            >
                                                {showAuthPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* AVATAR & APPEARANCE (SIGN UP & EDIT) */}
                                    {(authMode === 'signup' || authMode === 'edit') && (
                                        <div className="ios-auth-field">
                                            <label className="ios-auth-label">Profile Avatar & Color</label>
                                            <div className="ios-avatar-customizer">
                                                {/* Live Avatar Preview */}
                                                <div className="ios-avatar-preview-box">
                                                    {authForm.avatarPhoto ? (
                                                        <img
                                                            src={authForm.avatarPhoto}
                                                            alt="Avatar Preview"
                                                            className="ios-avatar-preview-img"
                                                        />
                                                    ) : (
                                                        <div
                                                            className="ios-avatar-preview-initials"
                                                            style={{ background: getProfileGradient(authForm.avatarColor) }}
                                                        >
                                                            {getProfileInitials(authForm.name, authForm.username)}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Color Palette Swatches */}
                                                <div className="ios-avatar-swatches-wrap">
                                                    <span className="ios-swatches-title">Color Theme</span>
                                                    <div className="ios-color-swatches" role="radiogroup">
                                                        {AVATAR_COLOR_OPTIONS.map((opt) => (
                                                            <button
                                                                key={opt.id}
                                                                type="button"
                                                                className={`ios-swatch-circle ${authForm.avatarColor === opt.id ? 'active' : ''}`}
                                                                style={{ background: opt.bg }}
                                                                title={opt.label}
                                                                onClick={() => setAuthForm({ ...authForm, avatarColor: opt.id })}
                                                            >
                                                                {authForm.avatarColor === opt.id && <Check size={14} color="#fff" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Photo Upload Option */}
                                            <div className="ios-photo-upload-row">
                                                <label className="ios-photo-upload-btn">
                                                    <Camera size={15} />
                                                    <span>{authForm.avatarPhoto ? 'Change Photo' : 'Upload Photo'}</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handlePhotoUpload}
                                                        style={{ display: 'none' }}
                                                    />
                                                </label>
                                                {authForm.avatarPhoto && (
                                                    <button
                                                        type="button"
                                                        className="ios-photo-remove-btn"
                                                        onClick={handleRemovePhoto}
                                                    >
                                                        <Trash2 size={14} />
                                                        <span>Remove Photo</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* BIO (SIGN UP & EDIT) */}
                                    {(authMode === 'signup' || authMode === 'edit') && (
                                        <div className="ios-auth-field">
                                            <label className="ios-auth-label">Status / Bio (Optional)</label>
                                            <input
                                                type="text"
                                                className="ios-auth-input"
                                                placeholder="e.g. Focus on habits, finance, and goals"
                                                value={authForm.bio}
                                                onChange={(e) => setAuthForm({ ...authForm, bio: e.target.value })}
                                                maxLength={80}
                                            />
                                        </div>
                                    )}

                                    {/* SAVED PROFILES LIST (ON LOGIN) */}
                                    {authMode === 'login' && savedAccounts.length > 0 && (
                                        <div className="ios-saved-accounts-section">
                                            <span className="ios-saved-accounts-title">Saved accounts on this device:</span>
                                            <div className="ios-saved-accounts-list">
                                                {savedAccounts.map((acc, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        className="ios-saved-account-pill"
                                                        onClick={() => handleSelectSavedAccount(acc)}
                                                    >
                                                        <div
                                                            className="ios-saved-account-avatar"
                                                            style={{ background: getProfileGradient(acc.avatarColor) }}
                                                        >
                                                            {acc.avatarPhoto ? (
                                                                <img src={acc.avatarPhoto} alt="" />
                                                            ) : (
                                                                getProfileInitials(acc.name, acc.username)
                                                            )}
                                                        </div>
                                                        <span className="ios-saved-account-name">@{acc.username}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* SUBMIT BUTTON */}
                                    <button type="submit" className="ios-auth-submit-btn">
                                        {authMode === 'signup' ? (
                                            <>
                                                <UserPlus size={18} />
                                                <span>Create Account & Sign In</span>
                                            </>
                                        ) : authMode === 'login' ? (
                                            <>
                                                <LogIn size={18} />
                                                <span>Log In to Workspace</span>
                                            </>
                                        ) : (
                                            <>
                                                <Check size={18} />
                                                <span>Save Profile Changes</span>
                                            </>
                                        )}
                                    </button>

                                    {/* LOG OUT / SWITCH ACCOUNT (EDIT MODE) */}
                                    {authMode === 'edit' && (
                                        <button
                                            type="button"
                                            className="ios-auth-logout-btn"
                                            onClick={handleLogOut}
                                        >
                                            <LogOut size={16} />
                                            <span>Log Out & Switch to Guest</span>
                                        </button>
                                    )}

                                    {/* BOTTOM SWITCH LINK */}
                                    {authMode === 'login' && (
                                        <p className="ios-auth-switch-prompt">
                                            Don't have an account yet?{' '}
                                            <button
                                                type="button"
                                                className="ios-auth-inline-link"
                                                onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                                            >
                                                Sign Up with your details
                                            </button>
                                        </p>
                                    )}
                                    {authMode === 'signup' && (
                                        <p className="ios-auth-switch-prompt">
                                            Already have an account?{' '}
                                            <button
                                                type="button"
                                                className="ios-auth-inline-link"
                                                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                                            >
                                                Log In here
                                            </button>
                                        </p>
                                    )}
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}

            </>,
            document.body,
        )}
        </>
    );
}
