import { useContext, useEffect, useState, useMemo } from 'react';
import { SignIn, SignUp } from '@clerk/react';
import {
    Moon,
    Sun,
    Bell,
    Globe,
    Smile,
    Smartphone,
    KeyRound,
    ArrowLeftRight,
    HardDrive,
    Info,
    ShieldCheck,
    LogOut,
    Check,
    ChevronRight,
    X,
    Cloud,
    Download,
    Upload,
    UserRound,
    Lock,
    Sparkles,
    Shield,
    Share2,
    Copy,
    MessageCircle,
    Link2
} from 'lucide-react';
import { AuthContext } from '../context/AuthState';
import { applyAppTheme, getStoredTheme, subscribeWorkspaceChange } from '../utils/workspaceEvents';
import {
    hasSavedDeviceBiometric,
    registerDeviceBiometric,
    removeDeviceBiometric,
    verifyDeviceBiometric
} from '../utils/deviceBiometrics';
import {
    isLocalPasscodeConfigured,
    removeLocalPasscode,
    saveLocalPasscode,
    verifyLocalPasscode
} from '../utils/localPasscode';

const backupFormat = 'progress-workspace-backup';

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
    const { user, logout, loading, configured, syncError, syncData } = useContext(AuthContext);

    // General options (Image 1 & 2)
    const [theme, setTheme] = useState(() => getStoredTheme());
    const [notifications, setNotifications] = useState(() => localStorage.getItem('appNotifications') !== 'false');
    const [language, setLanguage] = useState(() => localStorage.getItem('appLanguage') || 'English (US)');

    // Security options (Image 2)
    const [faceId, setFaceId] = useState(() => (
        localStorage.getItem('appFaceId') === 'true' && hasSavedDeviceBiometric()
    ));
    const [passcode, setPasscode] = useState(() => isLocalPasscodeConfigured());
    const [txConfirmation, setTxConfirmation] = useState(() => localStorage.getItem('appTxConfirm') !== 'false');
    const [securityMessage, setSecurityMessage] = useState('');
    const [securityError, setSecurityError] = useState(false);
    const [passcodeError, setPasscodeError] = useState('');

    // Storage calculation (Image 1)
    const [storageInfo, setStorageInfo] = useState({ percent: 12, usedText: '620KB', quotaText: '5.0MB' });

    // Modals state: null | 'language' | 'passcode' | 'devices' | 'about' | 'privacy' | 'auth'
    const [activeModal, setActiveModal] = useState(null);
    const [shareStatus, setShareStatus] = useState('');
    const [currentPin, setCurrentPin] = useState('');
    const [tempPin, setTempPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [authMode, setAuthMode] = useState('sign-in');

    // Backup state
    const [backupFile, setBackupFile] = useState(null);
    const [backupMessage, setBackupMessage] = useState('');
    const [backupError, setBackupError] = useState(false);

    // Listen for theme changes across the workspace
    useEffect(() => {
        const unsubscribe = subscribeWorkspaceChange((e) => {
            if (e?.type === 'theme') {
                setTheme(e.theme || getStoredTheme());
            }
        });
        return unsubscribe;
    }, []);

    // Calculate real localStorage usage
    useEffect(() => {
        try {
            let totalChars = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                const v = localStorage.getItem(k) || '';
                totalChars += k.length + v.length;
            }
            const bytes = totalChars * 2; // UTF-16
            const quota = 5 * 1024 * 1024; // 5MB standard HTML5 localStorage
            const usedMB = (bytes / (1024 * 1024)).toFixed(1);
            const usedKB = Math.round(bytes / 1024);
            const percent = Math.min(100, Math.max(8, Math.round((bytes / quota) * 100)));
            setStorageInfo({
                percent,
                usedText: bytes > 1024 * 1024 ? `${usedMB}MB` : `${usedKB}KB`,
                quotaText: '5.0MB',
            });
        } catch {
            setStorageInfo({ percent: 25, usedText: '1.2MB', quotaText: '5.0MB' });
        }
    }, [theme, notifications, language, faceId, passcode]);

    // Handlers
    const toggleTheme = (isLight) => {
        const next = isLight ? 'light' : 'dark';
        applyAppTheme(next);
        setTheme(next);
        void syncData({ appTheme: next });
    };

    const toggleNotifications = (val) => {
        setNotifications(val);
        localStorage.setItem('appNotifications', val ? 'true' : 'false');
    };

    const toggleFaceId = async (val) => {
        setSecurityMessage('');
        setSecurityError(false);
        if (!val) {
            removeDeviceBiometric();
            localStorage.setItem('appFaceId', 'false');
            setFaceId(false);
            setSecurityMessage('Biometric unlock has been turned off.');
            return;
        }
        if (!passcode) {
            setSecurityError(true);
            setSecurityMessage('Set a passcode first so you can still unlock if biometric verification is unavailable.');
            return;
        }
        try {
            await registerDeviceBiometric(user?.email || user?.name || 'Progress user');
            localStorage.setItem('appFaceId', 'true');
            setFaceId(true);
            setSecurityMessage('Biometric unlock is enabled. Your device will use Face ID, fingerprint, or its supported screen lock.');
        } catch (error) {
            if (error.name !== 'NotAllowedError') {
                setSecurityError(true);
                setSecurityMessage(error.message || 'Could not set up biometric unlock on this device.');
            }
        }
    };

    const handleTestBiometric = async () => {
        setSecurityMessage('');
        setSecurityError(false);
        try {
            await verifyDeviceBiometric();
            setSecurityMessage('Biometric verification succeeded.');
        } catch (error) {
            setSecurityError(true);
            setSecurityMessage(error.message || 'Biometric verification failed.');
        }
    };

    const toggleTxConfirmation = (val) => {
        setTxConfirmation(val);
        localStorage.setItem('appTxConfirm', val ? 'true' : 'false');
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

    const handleSavePasscode = async (e) => {
        e.preventDefault();
        setPasscodeError('');
        if (passcode) {
            try {
                if (!(await verifyLocalPasscode(currentPin))) {
                    setPasscodeError('The current passcode is incorrect.');
                    return;
                }
            } catch (error) {
                setPasscodeError(error.message || 'Could not verify the current passcode.');
                return;
            }
        }
        if (tempPin.length !== 4 || confirmPin !== tempPin) {
            setPasscodeError('Enter a 4-digit passcode and confirm it correctly.');
            return;
        }
        try {
            await saveLocalPasscode(tempPin);
            setPasscode(true);
            setCurrentPin('');
            setTempPin('');
            setConfirmPin('');
            setActiveModal(null);
        } catch (error) {
            setPasscodeError(error.message || 'Could not save the passcode.');
        }
    };

    const handleRemovePasscode = async () => {
        setPasscodeError('');
        try {
            if (!(await verifyLocalPasscode(currentPin))) {
                setPasscodeError('The current passcode is incorrect.');
                return;
            }
        } catch (error) {
            setPasscodeError(error.message || 'Could not verify the current passcode.');
            return;
        }
        removeLocalPasscode();
        setPasscode(false);
        setCurrentPin('');
        setTempPin('');
        setConfirmPin('');
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
            if (user) {
                await syncData({
                    routineTasks: data.hybridRoutineTasks,
                    financeData: data.financeData,
                    financeCategories: data.financeCategories,
                    appTheme: data.appTheme,
                });
            }
            window.location.reload();
        } catch (error) {
            setBackupError(true);
            setBackupMessage(error.message || 'Could not restore backup file.');
        }
    };

    // User details & initials
    const initials = user?.name
        ? user.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join('')
              .toUpperCase()
        : 'U';

    const displayName = user?.name || 'Workspace User';
    const displayEmail = user?.email || 'Local Offline Account';

    return (
        <div className="view-section active">
            <div className="ios-settings-page">
                {/* SETTINGS LARGE TITLE (IMAGE 1 STYLE) */}
                <header className="ios-settings-header">
                    <h1 className="ios-settings-title">Settings</h1>
                </header>

                {/* USER PROFILE CARD (IMAGE 1 TEMPLATE) */}
                <section className="ios-card ios-profile-card">
                    <div className="ios-profile-content">
                        {user?.imageUrl ? (
                            <img
                                src={user.imageUrl}
                                alt={displayName}
                                className="ios-profile-avatar-img"
                            />
                        ) : (
                            <div className="ios-profile-avatar-initials">
                                {initials}
                            </div>
                        )}
                        <div className="ios-profile-text">
                            <h2 className="ios-profile-name">{displayName}</h2>
                            <p className="ios-profile-email">{displayEmail}</p>
                        </div>
                    </div>

                    <div className="ios-profile-actions">
                        {user ? (
                            <div className="ios-profile-sync-row">
                                <span className="ios-status-badge">
                                    <Check size={13} strokeWidth={2.5} /> Connected to Cloud
                                </span>
                                <button
                                    type="button"
                                    onClick={syncData}
                                    className="ios-sync-btn"
                                    title="Synchronize records with cloud"
                                >
                                    <Cloud size={14} /> Sync
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setActiveModal('auth')}
                                className="ios-connect-btn"
                            >
                                <Cloud size={14} /> Connect Clerk Account
                            </button>
                        )}
                    </div>

                    {syncError && <p className="ios-sync-error">{syncError}</p>}
                </section>

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

                {/* SECTION 2: SECURITY (IMAGE 2 OPTIONS INSIDE IMAGE 1 CARD) */}
                <div className="ios-section-label">Security</div>
                <section className="ios-card ios-card-grouped">
                    {/* Device biometric unlock (Face ID or fingerprint, depending on the device) */}
                    <div className="ios-row">
                        <div className="ios-row-left">
                            <span className="ios-icon-box face-id-icon">
                                <Smile size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">Biometric Unlock</span>
                            </div>
                        </div>
                        <div className="ios-row-right">
                            {faceId && (
                                <button type="button" className="ios-biometric-test-btn" onClick={handleTestBiometric}>
                                    Verify
                                </button>
                            )}
                            <IOSSwitch
                                id="toggle-face-id"
                                checked={faceId}
                                onChange={toggleFaceId}
                                activeColor="#22c55e"
                                ariaLabel="Toggle biometric unlock using Face ID or fingerprint"
                            />
                        </div>
                    </div>
                    <p className={`ios-security-message ${securityError ? 'error' : ''}`} role="status">
                        {securityMessage || 'Uses your device biometrics (Face ID or fingerprint). Set a passcode first for recovery.'}
                    </p>

                    <div className="ios-divider" />

                    {/* Linked Devices (Image 2) */}
                    <button
                        type="button"
                        onClick={() => setActiveModal('devices')}
                        className="ios-row ios-row-btn"
                    >
                        <div className="ios-row-left">
                            <span className="ios-icon-box phone-icon">
                                <Smartphone size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">Linked Devices</span>
                            </div>
                        </div>
                        <div className="ios-row-right">
                            <span className="ios-row-value">1 Active</span>
                            <ChevronRight size={17} className="ios-chevron" />
                        </div>
                    </button>

                    <div className="ios-divider" />

                    {/* Passcode (Image 2) */}
                    <button
                        type="button"
                        onClick={() => {
                            setCurrentPin('');
                            setTempPin('');
                            setConfirmPin('');
                            setPasscodeError('');
                            setActiveModal('passcode');
                        }}
                        className="ios-row ios-row-btn"
                    >
                        <div className="ios-row-left">
                            <span className="ios-icon-box key-icon">
                                <KeyRound size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">Passcode</span>
                            </div>
                        </div>
                        <div className="ios-row-right">
                            <span className="ios-row-value">{passcode ? 'Enabled' : 'Not set'}</span>
                            <ChevronRight size={17} className="ios-chevron" />
                        </div>
                    </button>

                    <div className="ios-divider" />

                    {/* Transaction Confirmation (Image 2) */}
                    <div className="ios-row">
                        <div className="ios-row-left">
                            <span className="ios-icon-box tx-icon">
                                <ArrowLeftRight size={18} />
                            </span>
                            <div className="ios-row-text">
                                <span className="ios-row-title">Transaction Confirmation</span>
                            </div>
                        </div>
                        <div className="ios-row-right">
                            <IOSSwitch
                                id="toggle-tx-confirm"
                                checked={txConfirmation}
                                onChange={toggleTxConfirmation}
                                activeColor="#3b82f6"
                                ariaLabel="Require confirmation for financial transactions"
                            />
                        </div>
                    </div>
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

                {/* SECTION 4: ABOUT, PRIVACY & LOGOUT (IMAGE 1 TEMPLATE) */}
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

                    <div className="ios-divider" />

                    {/* Logout row (Image 1 style - Red color) */}
                    {user ? (
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm('Sign out of your Progress workspace?')) {
                                    logout();
                                }
                            }}
                            className="ios-row ios-row-btn ios-logout-row"
                        >
                            <div className="ios-row-left">
                                <span className="ios-icon-box logout-icon">
                                    <LogOut size={18} />
                                </span>
                                <div className="ios-row-text">
                                    <span className="ios-row-title logout-text">Logout</span>
                                </div>
                            </div>
                            <div className="ios-row-right">
                                <ChevronRight size={17} className="ios-chevron logout-chevron" />
                            </div>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setActiveModal('auth')}
                            className="ios-row ios-row-btn"
                        >
                            <div className="ios-row-left">
                                <span className="ios-icon-box info-icon">
                                    <UserRound size={18} />
                                </span>
                                <div className="ios-row-text">
                                    <span className="ios-row-title">Sign in to Progress</span>
                                </div>
                            </div>
                            <div className="ios-row-right">
                                <ChevronRight size={17} className="ios-chevron" />
                            </div>
                        </button>
                    )}
                </section>

                <footer className="ios-settings-footer">
                    <span>Progress App • Personal AI Productivity</span>
                </footer>
            </div>

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

            {/* MODAL: PASSCODE SETUP */}
            {activeModal === 'passcode' && (
                <div className="ios-modal-overlay" onClick={() => setActiveModal(null)}>
                    <div className="ios-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="ios-modal-header">
                            <h3>{passcode ? 'Security Passcode' : 'Set 4-Digit Passcode'}</h3>
                            <button type="button" onClick={() => setActiveModal(null)} className="ios-modal-close">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSavePasscode} className="ios-passcode-form">
                            <p className="ios-modal-desc">
                                {passcode
                                    ? 'Verify your current passcode before changing or removing it.'
                                    : 'Enter a 4-digit PIN for quick app protection.'}
                            </p>
                            {passcode && (
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    autoComplete="current-password"
                                    maxLength={4}
                                    pattern="[0-9]{4}"
                                    value={currentPin}
                                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Current passcode"
                                    aria-label="Current passcode"
                                    className="ios-passcode-input"
                                />
                            )}
                            <input
                                type="password"
                                inputMode="numeric"
                                autoComplete="new-password"
                                maxLength={4}
                                pattern="[0-9]{4}"
                                value={tempPin}
                                onChange={(e) => setTempPin(e.target.value.replace(/\D/g, ''))}
                                placeholder={passcode ? 'New 4-digit passcode' : '4-digit passcode'}
                                aria-label={passcode ? 'New passcode' : 'Passcode'}
                                className="ios-passcode-input"
                            />
                            <input
                                type="password"
                                inputMode="numeric"
                                autoComplete="new-password"
                                maxLength={4}
                                pattern="[0-9]{4}"
                                value={confirmPin}
                                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                                placeholder="Confirm 4-digit passcode"
                                aria-label="Confirm passcode"
                                className="ios-passcode-input"
                            />
                            {passcodeError && <p className="ios-security-message error" role="alert">{passcodeError}</p>}
                            <div className="ios-modal-btn-row">
                                {passcode && (
                                    <button
                                        type="button"
                                        onClick={handleRemovePasscode}
                                        className="ios-btn-danger"
                                        disabled={currentPin.length !== 4}
                                    >
                                        Remove PIN
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={tempPin.length !== 4}
                                    className="ios-btn-primary"
                                >
                                    {passcode ? 'Update PIN' : 'Save PIN'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: LINKED DEVICES */}
            {activeModal === 'devices' && (
                <div className="ios-modal-overlay" onClick={() => setActiveModal(null)}>
                    <div className="ios-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="ios-modal-header">
                            <h3>Linked Devices</h3>
                            <button type="button" onClick={() => setActiveModal(null)} className="ios-modal-close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="ios-device-card">
                            <div className="ios-device-icon">
                                <Smartphone size={24} />
                            </div>
                            <div className="ios-device-info">
                                <h4>Current Session (This Device)</h4>
                                <p>Browser: {navigator.userAgent.includes('Chrome') ? 'Chrome / WebKit' : 'Modern Browser'}</p>
                                <span className="ios-device-active-tag">Active Now</span>
                            </div>
                        </div>
                        <p className="ios-modal-desc" style={{ marginTop: '12px' }}>
                            Your progress routine, habits, and finance transactions are kept in local storage and synced when signed into Clerk.
                        </p>
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
                                <Sparkles size={32} color="#3b82f6" />
                            </div>
                            <h4>Progress Tracker & Habit Engine</h4>
                            <span className="ios-about-version">Version 2.4.0 (Build 2026.10)</span>
                            <p>
                                A private, local-first daily habit, routine tracker, and finance manager powered by Google Gemini AI assistant.
                            </p>
                            <div className="ios-about-credits">
                                <div><strong>Framework:</strong> React 19 + Vite</div>
                                <div><strong>Cloud Sync:</strong> Clerk Authentication + Supabase</div>
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
                                <strong>3. Secure Cloud Backup</strong>
                                <p>When signed in with Clerk, your records are transmitted encrypted to your isolated workspace database.</p>
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

            {/* MODAL: CLERK AUTH */}
            {activeModal === 'auth' && (
                <div className="ios-modal-overlay" onClick={() => setActiveModal(null)}>
                    <div className="ios-modal-box ios-modal-auth" onClick={(e) => e.stopPropagation()}>
                        <div className="ios-modal-header">
                            <h3>{authMode === 'sign-in' ? 'Sign In to Progress' : 'Create an Account'}</h3>
                            <button type="button" onClick={() => setActiveModal(null)} className="ios-modal-close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="ios-auth-segmented">
                            <button
                                type="button"
                                className={authMode === 'sign-in' ? 'active' : ''}
                                onClick={() => setAuthMode('sign-in')}
                            >
                                Sign In
                            </button>
                            <button
                                type="button"
                                className={authMode === 'sign-up' ? 'active' : ''}
                                onClick={() => setAuthMode('sign-up')}
                            >
                                Create Account
                            </button>
                        </div>
                        <div className="ios-clerk-container">
                            {authMode === 'sign-in' ? (
                                <SignIn routing="virtual" />
                            ) : (
                                <SignUp routing="virtual" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
