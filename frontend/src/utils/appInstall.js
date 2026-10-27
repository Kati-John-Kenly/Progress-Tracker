let installPromptEvent = null;

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        installPromptEvent = event;
        window.dispatchEvent(new Event('progressappinstallavailable'));
    });

    window.addEventListener('appinstalled', () => {
        installPromptEvent = null;
    });
}

export const canInstallProgressApp = () => Boolean(installPromptEvent);

export const promptInstallProgressApp = async () => {
    if (!installPromptEvent) return null;

    const promptEvent = installPromptEvent;
    installPromptEvent = null;
    await promptEvent.prompt();
    return promptEvent.userChoice;
};
