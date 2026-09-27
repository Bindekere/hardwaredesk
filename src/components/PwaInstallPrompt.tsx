'use client';

import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Check, Share, PlusSquare, ArrowDown, ExternalLink } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function triggerInstallGuide() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-pwa-guide'));
  }
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker safely
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('HardwareDesk ServiceWorker active:', reg.scope);
            reg.update().catch(() => {});
          })
          .catch((err) => console.warn('ServiceWorker registration skipped:', err));
      } catch (_) {}
    }

    // 2. Check if already running in standalone mode (installed app)
    try {
      const isStandalone =
        (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        (typeof navigator !== 'undefined' && (navigator as any).standalone === true);

      if (isStandalone) {
        setIsInstalled(true);
        return;
      }
    } catch (_) {}

    // 3. Detect iOS Safari (iPhone, iPad, iPod)
    try {
      if (typeof window !== 'undefined' && window.navigator) {
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice =
          /iphone|ipad|ipod/.test(userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        setIsIos(isIosDevice);
      }
    } catch (_) {}

    // 4. Capture beforeinstallprompt for Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Track if user successfully installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowModal(false);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // 6. Listen for custom open-pwa-guide event
    const handleOpenGuide = () => setShowModal(true);
    window.addEventListener('open-pwa-guide', handleOpenGuide);

    // Check if dismissed previously in session
    try {
      if (sessionStorage.getItem('hd_pwa_dismissed') === 'true') {
        setDismissedBanner(true);
      }
    } catch (_) {}

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('open-pwa-guide', handleOpenGuide);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      setShowModal(false);
    } else {
      setShowModal(true);
    }
  };

  const handleDismissBanner = () => {
    setDismissedBanner(true);
    try {
      sessionStorage.setItem('hd_pwa_dismissed', 'true');
    } catch (_) {}
  };

  // If already installed, don't show prompt
  if (isInstalled) return null;

  return (
    <>
      {/* 1. iOS Safari Dedicated Bottom Callout */}
      {isIos && !dismissedBanner && (
        <div className="fixed bottom-2 inset-x-2 sm:inset-x-auto sm:right-4 sm:max-w-sm z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-amber-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <img
                  src="/icons/icon-192x192.png"
                  alt="HardwareDesk"
                  className="w-9 h-9 rounded-xl shadow-md border border-amber-500/30 shrink-0"
                />
                <div>
                  <div className="text-xs font-black text-white flex items-center space-x-1">
                    <span>HardwareDesk for iPhone</span>
                    <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                      App
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300">
                    Install as dedicated full-screen phone app
                  </div>
                </div>
              </div>
              <button
                onClick={handleDismissBanner}
                className="text-slate-400 hover:text-white p-1"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-800/90 rounded-xl p-2.5 border border-slate-700/80 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-[11px] text-slate-200">
                <div className="w-7 h-7 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4 text-blue-400" />
                </div>
                <span>
                  Tap <strong>Share</strong> below & tap <strong>&quot;Add to Home Screen&quot;</strong>
                </span>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg shrink-0 shadow-xs transition"
              >
                Steps
              </button>
            </div>

            {/* Little indicator arrow pointing downward toward Safari toolbar */}
            <div className="flex justify-center -mb-3 pt-0.5">
              <div className="w-3 h-3 bg-slate-900 border-b border-r border-amber-500/40 transform rotate-45" />
            </div>
          </div>
        </div>
      )}

      {/* 2. Android / Other Mobile Banner */}
      {!isIos && !dismissedBanner && (
        <div className="lg:hidden fixed top-16 inset-x-2 z-40 bg-slate-900 text-white p-2.5 rounded-xl shadow-xl border border-amber-500/30 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center space-x-2.5">
            <img
              src="/icons/icon-192x192.png"
              alt="HardwareDesk"
              className="w-8 h-8 rounded-lg shadow-xs shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-100 flex items-center space-x-1">
                <span>HardwareDesk App</span>
                <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                  Fast
                </span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                Install as dedicated app on your phone
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg shadow-xs transition flex items-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
            <button
              onClick={handleDismissBanner}
              className="text-slate-400 hover:text-white p-1"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Comprehensive Installation Instructions Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-100 text-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div className="flex items-center space-x-3">
                <img
                  src="/icons/icon-192x192.png"
                  alt="HardwareDesk"
                  className="w-12 h-12 rounded-2xl shadow-md border border-slate-200 shrink-0"
                />
                <div>
                  <h3 className="font-black text-base text-slate-900 leading-tight">Install HardwareDesk</h3>
                  <p className="text-xs text-slate-500 font-medium">Dedicated POS & Inventory App</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIos ? (
              <div className="space-y-3.5 text-xs text-slate-700">
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-amber-950 font-medium text-[11px] leading-relaxed">
                  Apple Safari requires 3 quick taps to install web applications to your iPhone home screen:
                </div>

                <ol className="space-y-3 pl-0.5">
                  <li className="flex items-start space-x-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 block">Tap the Safari Share Button</span>
                      <span className="text-slate-600 leading-relaxed">
                        At the bottom of your Safari screen, tap the{' '}
                        <strong className="text-blue-600 inline-flex items-center gap-0.5 font-bold">
                          Share <Share className="w-3.5 h-3.5 inline text-blue-600" />
                        </strong>{' '}
                        icon (square with upward arrow).
                      </span>
                    </div>
                  </li>

                  <li className="flex items-start space-x-3">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 block">Select &quot;Add to Home Screen&quot;</span>
                      <span className="text-slate-600 leading-relaxed">
                        Scroll down through the share menu options and tap{' '}
                        <strong className="text-slate-900 inline-flex items-center gap-0.5 font-bold">
                          Add to Home Screen <PlusSquare className="w-3.5 h-3.5 inline text-slate-700" />
                        </strong>.
                      </span>
                    </div>
                  </li>

                  <li className="flex items-start space-x-3">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-800 font-bold flex items-center justify-center shrink-0 text-xs">
                      3
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 block">Tap &quot;Add&quot;</span>
                      <span className="text-slate-600 leading-relaxed">
                        In the top-right corner of your screen, tap <strong>Add</strong>. HardwareDesk will now appear as an app icon on your home screen!
                      </span>
                    </div>
                  </li>
                </ol>

                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span>Benefits of Installing on iPhone:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                    <li>Full-screen POS with zero browser bars or tabs</li>
                    <li>Instant launch directly from your iPhone home screen</li>
                    <li>Automatic updates in background with no App Store needed</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-700">
                <p className="text-slate-600 leading-relaxed">
                  Install HardwareDesk as a permanent app on your device:
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2 text-slate-800">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span>Dedicated full-screen POS without browser URL bar</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-800">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span>Instant launch directly from your home screen</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-800">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span>Automatic background updates with zero downloads</span>
                  </div>
                </div>

                {deferredPrompt ? (
                  <button
                    onClick={handleInstallClick}
                    className="w-full mt-2 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-xs flex items-center justify-center space-x-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install App on Device</span>
                  </button>
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                    <p>
                      In Chrome/Edge on Android: Tap the <strong>three dots (⋮)</strong> in the top-right and select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Compact Button exported for Navbar, Sidebar, and LoginScreen
export function InstallAppButton({ className = '' }: { className?: string }) {
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    try {
      const isStandalone =
        (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        (typeof navigator !== 'undefined' && (navigator as any).standalone === true);

      if (isStandalone) {
        setCanInstall(false);
        return;
      }

      setCanInstall(true);

      const handlePrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      window.addEventListener('beforeinstallprompt', handlePrompt);
      return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
    } catch (_) {
      setCanInstall(true);
    }
  }, []);

  if (!canInstall) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      triggerInstallGuide();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${className}`}
      title="Install HardwareDesk on your phone or computer"
    >
      <Smartphone className="w-3.5 h-3.5 text-amber-400" />
      <span>Install App</span>
    </button>
  );
}
