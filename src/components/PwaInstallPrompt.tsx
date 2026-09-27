'use client';

import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Check, Share, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
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
            console.log('HardwareDesk ServiceWorker registered:', reg.scope);
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

    // 3. Detect iOS Safari
    try {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIos(isIosDevice);
    } catch (_) {}

    // 4. Capture beforeinstallprompt for Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Track if user successfully installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowModal(false);
    });

    // Check if dismissed previously in session
    try {
      if (sessionStorage.getItem('hd_pwa_dismissed') === 'true') {
        setDismissedBanner(true);
      }
    } catch (_) {}

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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
      // If iOS or unsupported trigger, show step-by-step modal
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
      {/* Discreet Mobile Floating App Banner when not yet installed */}
      {!dismissedBanner && (
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

      {/* Installation Instructions Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-100 text-slate-900">
            <div className="flex justify-between items-start border-b pb-3">
              <div className="flex items-center space-x-3">
                <img
                  src="/icons/icon-192x192.png"
                  alt="HardwareDesk"
                  className="w-12 h-12 rounded-xl shadow-md border border-slate-200"
                />
                <div>
                  <h3 className="font-black text-base text-slate-900">Install HardwareDesk</h3>
                  <p className="text-xs text-slate-500">Uganda Hardware POS & Inventory</p>
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
              <div className="space-y-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">
                  To install on your iPhone or iPad:
                </p>
                <ol className="space-y-2.5 pl-1">
                  <li className="flex items-start space-x-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </span>
                    <span>
                      Tap the <strong>Share</strong> button <Share className="w-3.5 h-3.5 inline text-blue-600 mb-0.5" /> at the bottom of Safari.
                    </span>
                  </li>
                  <li className="flex items-start space-x-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </span>
                    <span>
                      Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline text-slate-700 mb-0.5" />.
                    </span>
                  </li>
                  <li className="flex items-start space-x-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0 text-xs">
                      3
                    </span>
                    <span>
                      Tap <strong>Add</strong> in the top-right corner to finish.
                    </span>
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-700">
                <p className="text-slate-600 leading-relaxed">
                  Install HardwareDesk as a permanent app on your device for:
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2 text-slate-800">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>Dedicated full-screen POS without browser URL bar</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-800">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>Instant launch directly from your home screen</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-800">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>Automatic background updates with zero downloads</span>
                  </div>
                </div>

                {deferredPrompt ? (
                  <button
                    onClick={handleInstallClick}
                    className="w-full mt-2 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-xs flex items-center justify-center space-x-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install App on Device</span>
                  </button>
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                    <p>
                      In Chrome/Edge on Android: Tap the <strong>three dots (⋮)</strong> in the top-right and select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Compact Button exported for Navbar or Sidebar
export function InstallAppButton({ className = '' }: { className?: string }) {
  const [canInstall, setCanInstall] = useState(false);
  const [showModal, setShowModal] = useState(false);
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
      setCanInstall(false);
    }
  }, []);

  if (!canInstall) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${className}`}
        title="Install HardwareDesk on your phone or computer"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-100 text-slate-900">
            <div className="flex justify-between items-start border-b pb-3">
              <div className="flex items-center space-x-3">
                <img
                  src="/icons/icon-192x192.png"
                  alt="HardwareDesk"
                  className="w-10 h-10 rounded-xl shadow-xs"
                />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Install HardwareDesk</h3>
                  <p className="text-[11px] text-slate-500">Dedicated Mobile & Desktop POS</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <p>
                <strong>On Android:</strong> Tap the browser menu (⋮) and tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
              </p>
              <p>
                <strong>On iPhone / iPad:</strong> Tap the <strong>Share</strong> button <Share className="w-3 h-3 inline text-blue-600" /> in Safari, then tap <strong>"Add to Home Screen"</strong>.
              </p>
              <p>
                <strong>On Windows / Mac:</strong> Look for the install icon in your browser URL bar (near the bookmark star).
              </p>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
