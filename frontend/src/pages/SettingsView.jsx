import { useContext, useEffect, useState } from 'react';
import { SignIn, SignUp } from '@clerk/react';
import {
    Check,
    Cloud,
    Download,
    LogOut,
    Moon,
    Palette,
    ShieldCheck,
    Sun,
    Upload,
    UserRound,
} from 'lucide-react';
import { AuthContext } from '../context/AuthState';

const backupFormat = 'progress-workspace-backup';

export default function SettingsView() {
    const { user, logout, loading, configured, syncError, syncData } = useContext(AuthContext);
    const [authMode, setAuthMode] = useState('sign-in');
    const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'dark');
    const [backupFile, setBackupFile] = useState(null);
    const [backupMessage, setBackupMessage] = useState('');
    const [backupError, setBackupError] = useState(false);

    useEffect(() => {
        document.body.classList.toggle('light-theme', theme === 'light');
        localStorage.setItem('appTheme', theme);
    }, [theme]);

    const changeTheme = (nextTheme) => {
        setTheme(nextTheme);
        void syncData({ appTheme: nextTheme });
    };

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
        setBackupMessage('Backup downloaded. Account credentials are not included.');
    };

    const restoreBackup = async () => {
        if (!backupFile) return;
        setBackupMessage('');
        setBackupError(false);
        try {
            const backup = JSON.parse(await backupFile.text());
            const data = backup?.data;
            if (backup?.format !== backupFormat || backup.version !== 1 || !data
                || !Array.isArray(data.hybridRoutineTasks)
                || !Array.isArray(data.financeData)
                || !Array.isArray(data.financeCategories)
                || !['dark', 'light'].includes(data.appTheme)) {
                throw new Error('This file is not a supported Progress backup.');
            }
            if (!window.confirm('Restore this backup? Current routine, finance, and theme data will be replaced.')) return;
            localStorage.setItem('hybridRoutineTasks', JSON.stringify(data.hybridRoutineTasks));
            localStorage.setItem('financeData', JSON.stringify(data.financeData));
            localStorage.setItem('financeCategories', JSON.stringify(data.financeCategories));
            localStorage.setItem('appTheme', data.appTheme);
            if (user) {
                const synced = await syncData({
                    routineTasks: data.hybridRoutineTasks,
                    financeData: data.financeData,
                    financeCategories: data.financeCategories,
                    appTheme: data.appTheme,
                });
                if (!synced) throw new Error('Backup restored on this device, but cloud sync failed. Try Sync now before leaving.');
            }
            window.location.reload();
        } catch (error) {
            setBackupError(true);
            setBackupMessage(error.message || 'Could not read this backup file.');
        }
    };

    const switchAuthMode = (mode) => {
        setAuthMode(mode);
    };

    const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';

    return (
        <div className="view-section active">
            <div className="settings-page">
                <div className="settings-intro">
                    <p className="settings-eyebrow">PREFERENCES & ACCOUNT</p>
                    <h2>Make it yours</h2>
                    <p>Manage your account, appearance, and personal data from one place.</p>
                </div>

                <section className="card settings-panel settings-account" aria-labelledby="settings-account-title">
                    <div className="settings-section-heading">
                        <span className="settings-icon"><UserRound size={19} aria-hidden="true" /></span>
                        <div>
                            <h3 id="settings-account-title">Account</h3>
                            <p>Sign in details and account access</p>
                        </div>
                    </div>

                    {loading ? (
                        <p className="settings-notice" role="status">Checking saved account…</p>
                    ) : user ? (
                        <div className="account-content">
                            <div className="account-identity">
                                <div className="account-avatar" aria-hidden="true">{initials}</div>
                                <div className="account-copy">
                                    <strong>{user.name || 'Progress user'}</strong>
                                    <span>{user.email || 'No email address on file'}</span>
                                </div>
                                <span className="account-status"><Check size={14} aria-hidden="true" /> Signed in</span>
                            </div>
                            <div className="account-note">
                                <Cloud size={17} aria-hidden="true" />
                                <p>Your account is connected. Routine and finance records sync securely to your workspace.</p>
                            </div>
                            {syncError && <p className="settings-notice is-error" role="alert">{syncError}</p>}
                            <button type="button" className="settings-button settings-button-secondary" onClick={syncData}>
                                <Cloud size={17} aria-hidden="true" /> Sync now
                            </button>
                            <button type="button" className="settings-button settings-button-danger" onClick={logout}>
                                <LogOut size={17} aria-hidden="true" /> Sign out
                            </button>
                        </div>
                    ) : (
                        <div className="account-content">
                            {!configured ? (
                                <p className="settings-notice is-error" role="status">Account sign-in is unavailable until this deployment is configured with Clerk. Your local data remains available on this device.</p>
                            ) : (
                                <>
                                    <p className="settings-description">Sign in to your Progress account or create one. Your personal data will sync after your account is ready.</p>
                                    <div className="settings-segmented" role="tablist" aria-label="Account action">
                                        <button type="button" role="tab" aria-selected={authMode === 'sign-in'} className={authMode === 'sign-in' ? 'selected' : ''} onClick={() => switchAuthMode('sign-in')}>Sign in</button>
                                        <button type="button" role="tab" aria-selected={authMode === 'sign-up'} className={authMode === 'sign-up' ? 'selected' : ''} onClick={() => switchAuthMode('sign-up')}>Create account</button>
                                    </div>
                                    <div className="clerk-auth-panel">
                                        {authMode === 'sign-in'
                                            ? <SignIn routing="virtual" />
                                            : <SignUp routing="virtual" />}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </section>

                <section className="card settings-panel" aria-labelledby="settings-appearance-title">
                    <div className="settings-section-heading">
                        <span className="settings-icon"><Palette size={19} aria-hidden="true" /></span>
                        <div>
                            <h3 id="settings-appearance-title">Appearance</h3>
                            <p>Choose how Progress looks on this device</p>
                        </div>
                    </div>
                    <div className="theme-options" role="group" aria-label="Theme">
                        <button type="button" className={`theme-option ${theme === 'dark' ? 'selected' : ''}`} aria-pressed={theme === 'dark'} onClick={() => changeTheme('dark')}>
                            <Moon size={20} aria-hidden="true" />
                            <span><strong>OLED dark</strong><small>Low-light workspace</small></span>
                            {theme === 'dark' && <Check className="theme-check" size={17} aria-hidden="true" />}
                        </button>
                        <button type="button" className={`theme-option ${theme === 'light' ? 'selected' : ''}`} aria-pressed={theme === 'light'} onClick={() => changeTheme('light')}>
                            <Sun size={20} aria-hidden="true" />
                            <span><strong>Light</strong><small>Bright workspace</small></span>
                            {theme === 'light' && <Check className="theme-check" size={17} aria-hidden="true" />}
                        </button>
                    </div>
                </section>

                <section className="card settings-panel settings-data" aria-labelledby="settings-data-title">
                    <div className="settings-section-heading">
                        <span className="settings-icon"><ShieldCheck size={19} aria-hidden="true" /></span>
                        <div>
                            <h3 id="settings-data-title">Data & privacy</h3>
                            <p>Export or restore this device’s local data</p>
                        </div>
                    </div>
                    <div className="data-includes">
                        <span>Included in backup</span>
                        <p>Routine tasks <i /> Finance records <i /> Categories <i /> Theme</p>
                    </div>
                    <button type="button" className="settings-button settings-button-secondary" onClick={downloadBackup}>
                        <Download size={17} aria-hidden="true" /> Download backup
                    </button>
                    <label className="settings-field settings-file-field">
                        <span>Choose a Progress backup (.json)</span>
                        <input type="file" accept=".json,application/json" onChange={event => { setBackupFile(event.target.files?.[0] || null); setBackupMessage(''); }} />
                    </label>
                    <button type="button" className="settings-button settings-button-primary" onClick={restoreBackup} disabled={!backupFile}>
                        <Upload size={17} aria-hidden="true" /> Restore backup
                    </button>
                    <p className="settings-privacy-note">Account credentials are never included in backups. Restoring replaces the local data listed above.</p>
                    {backupMessage && <p className={`settings-notice ${backupError ? 'is-error' : ''}`} role={backupError ? 'alert' : 'status'}>{backupMessage}</p>}
                </section>
            </div>
        </div>
    );
}