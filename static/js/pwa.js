/**
 * Hydra PWA & Native Desktop/Mobile Integration
 */
(function () {
    let deferredPrompt = null;

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((reg) => {
                    console.log('[PWA] Service Worker registrado exitosamente con scope:', reg.scope);
                })
                .catch((err) => {
                    console.error('[PWA] Error al registrar Service Worker:', err);
                });
        });
    }

    // Detectar si ya está corriendo en modo App Nativa / Standalone
    function isStandaloneMode() {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true ||
            document.referrer.includes('android-app://');
    }

    // Detectar si es iOS (iPhone, iPad, iPod)
    function isIOS() {
        const ua = window.navigator.userAgent;
        return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const installBtnSidebar = document.getElementById('pwaInstallBtnSidebar');
        const installBtnMobile = document.getElementById('pwaInstallBtnMobile');
        const iosModal = document.getElementById('iosInstallModal');
        const closeIosModalBtn = document.getElementById('closeIosModalBtn');

        // Si ya está instalada o en standalone, ocultar botones de instalación
        if (isStandaloneMode()) {
            document.body.classList.add('is-standalone');
            if (installBtnSidebar) installBtnSidebar.style.display = 'none';
            if (installBtnMobile) installBtnMobile.style.display = 'none';
            return;
        }

        // Mostrar botón para iOS si es Safari móvil y no está instalada
        if (isIOS()) {
            if (installBtnSidebar) installBtnSidebar.style.display = 'flex';
            if (installBtnMobile) installBtnMobile.style.display = 'flex';
        }

        // Capturar evento 'beforeinstallprompt' en Chrome/Android/Edge/Windows/macOS Chrome
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;

            // Mostrar los botones de instalación en la interfaz
            if (installBtnSidebar) installBtnSidebar.style.display = 'flex';
            if (installBtnMobile) installBtnMobile.style.display = 'flex';
        });

        // Función para ejecutar instalación
        async function triggerInstall() {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`[PWA] Resultado de instalación: ${outcome}`);
                if (outcome === 'accepted') {
                    if (installBtnSidebar) installBtnSidebar.style.display = 'none';
                    if (installBtnMobile) installBtnMobile.style.display = 'none';
                }
                deferredPrompt = null;
            } else if (isIOS()) {
                // En iOS Safari, abrir modal instructivo
                if (iosModal) {
                    iosModal.classList.add('active');
                }
            } else {
                alert('Para anclar la aplicación a su escritorio o pantalla de inicio:\n\n' +
                    '• En Google Chrome / Edge: Haga clic en el ícono ⊕ en la barra de direcciones o menú > "Instalar Hydra".\n' +
                    '• En celular: Seleccione "Agregar a la pantalla principal".');
            }
        }

        if (installBtnSidebar) {
            installBtnSidebar.addEventListener('click', triggerInstall);
        }
        if (installBtnMobile) {
            installBtnMobile.addEventListener('click', triggerInstall);
        }
        if (closeIosModalBtn && iosModal) {
            closeIosModalBtn.addEventListener('click', () => {
                iosModal.classList.remove('active');
            });
            iosModal.addEventListener('click', (e) => {
                if (e.target === iosModal) iosModal.classList.remove('active');
            });
        }

        // Escuchar cuando la app se instala con éxito
        window.addEventListener('appinstalled', () => {
            console.log('[PWA] Aplicación Hydra instalada correctamente.');
            if (installBtnSidebar) installBtnSidebar.style.display = 'none';
            if (installBtnMobile) installBtnMobile.style.display = 'none';
        });

        // Detección de Estado de Red (Online / Offline)
        function updateNetworkStatus() {
            const offlineBanner = document.getElementById('offlineBanner');
            if (!offlineBanner) return;

            if (navigator.onLine) {
                offlineBanner.classList.remove('active');
            } else {
                offlineBanner.classList.add('active');
            }
        }

        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        updateNetworkStatus();
    });
})();
