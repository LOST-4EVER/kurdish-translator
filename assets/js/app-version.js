/**
 * app-version.js — PWA lifecycle, cache management, update detection, latency diagnostics, and refresh controls.
 * Exposes AppVersion as a global module.
 */
const AppVersion = (() => {
  const APP_VERSION = 'v110';
  let isRefreshing = false;
  let hasShownUpdateNotice = false;
  let lastCheckedTimestamp = Date.now();
  let timeTickerInterval = null;

  function getElements() {
    return {
      currentVerTag: document.getElementById('currentVerTag'),
      menuVerNum: document.getElementById('menuVerNum'),
      refreshBtn: document.getElementById('refreshBtn'),
      refreshMenu: document.getElementById('refreshMenu') || document.getElementById('refreshDropdown'),
      refreshStatusTxt: document.getElementById('refreshStatusTxt'),
      refreshTimeTxt: document.getElementById('refreshTimeTxt'),
      refreshLiveDot: document.getElementById('refreshLiveDot'),
      apiLatencyVal: document.getElementById('apiLatencyVal'),
      networkStatusBadge: document.getElementById('networkStatusBadge'),
      networkStatusText: document.getElementById('networkStatusText'),
      updateBadgeDot: document.getElementById('updateBadgeDot'),
      btnQuickRefresh: document.getElementById('btnQuickRefresh'),
      btnForceRefresh: document.getElementById('btnForceRefresh'),
      btnCheckUpdate: document.getElementById('btnCheckUpdate'),
      btnToggleChangelog: document.getElementById('btnToggleChangelog'),
      changelogPanel: document.getElementById('changelogPanel'),
      updateBanner: document.getElementById('updateBanner'),
      bannerVerTag: document.getElementById('bannerVerTag'),
      bannerRefreshBtn: document.getElementById('bannerUpdateNowBtn') || document.getElementById('bannerRefreshBtn'),
      bannerForceRefreshBtn: document.getElementById('bannerForceRefreshBtn'),
      bannerDismissBtn: document.getElementById('bannerCloseBtn') || document.getElementById('bannerDismissBtn'),
      installBtn: document.getElementById('installBtn'),
    };
  }

  function getI18nText(key, fallback) {
    if (typeof UI_I18N !== 'undefined' && UI_I18N.getText) {
      return UI_I18N.getText(key) || fallback;
    }
    return fallback;
  }

  let deferredInstallPrompt = null;

  /**
   * Set up PWA installation listeners and prompt.
   */
  function initInstallPrompt() {
    const installBtn = document.getElementById('installBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (installBtn) {
        installBtn.hidden = false;
        installBtn.classList.remove('hidden');
        installBtn.style.display = 'inline-flex';
      }
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) {
          const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
          if (isIos) {
            if (typeof Toast !== 'undefined') {
              Toast.show(getI18nText('iosInstallHint', 'Tap Share and then "Add to Home Screen" to install.'), 'info', 5000);
            }
          } else {
            if (typeof Toast !== 'undefined') {
              Toast.show(getI18nText('pwaInstallPrompt', 'Install from browser menu (Add to Home Screen).'), 'info', 4000);
            }
          }
          return;
        }

        deferredInstallPrompt.prompt();
        try {
          const { outcome } = await deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            installBtn.hidden = true;
            installBtn.style.display = 'none';
            deferredInstallPrompt = null;
            if (typeof Toast !== 'undefined') {
              Toast.show(getI18nText('installSuccess', 'App installed successfully!'), 'success', 3000);
            }
          }
        } catch (err) {
          console.warn('PWA install prompt error:', err);
        }
      });
    }

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      if (installBtn) {
        installBtn.hidden = true;
        installBtn.style.display = 'none';
      }
      if (typeof Toast !== 'undefined') {
        Toast.show(getI18nText('installSuccess', 'App installed successfully!'), 'success', 4000);
      }
    });
  }

  /**
   * Set up and bind version tags, update banners, and refresh buttons.
   */
  function init() {
    const els = getElements();
    if (els.currentVerTag) els.currentVerTag.textContent = APP_VERSION;
    if (els.menuVerNum) els.menuVerNum.textContent = APP_VERSION;

    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    startTimeTicker();
    measureLatency();
    registerSW();
    initInstallPrompt();
    bindRefreshControls();
  }

  function startTimeTicker() {
    if (timeTickerInterval) clearInterval(timeTickerInterval);
    timeTickerInterval = setInterval(() => {
      const els = getElements();
      if (!els.refreshTimeTxt) return;
      const sec = Math.floor((Date.now() - lastCheckedTimestamp) / 1000);
      if (sec < 10) {
        els.refreshTimeTxt.textContent = getI18nText('justNow', 'Just now');
      } else if (sec < 60) {
        els.refreshTimeTxt.textContent = `${sec}s ago`;
      } else {
        const min = Math.floor(sec / 60);
        els.refreshTimeTxt.textContent = `${min}m ago`;
      }
    }, 5000);
  }

  function updateNetworkStatus() {
    const els = getElements();
    const isOnline = navigator.onLine;

    if (els.refreshLiveDot) {
      els.refreshLiveDot.className = 'live-dot ' + (isOnline ? 'online' : 'offline');
    }
    if (els.networkStatusText) {
      els.networkStatusText.textContent = isOnline
        ? getI18nText('netOnline', 'Online & Synced')
        : getI18nText('netOffline', 'Offline (Cached Shell)');
    }
    if (els.networkStatusBadge) {
      els.networkStatusBadge.style.color = isOnline ? '#34d399' : '#94a3b8';
    }
  }

  /**
   * Measure latency to Google Translate endpoint or fallback.
   */
  async function measureLatency() {
    const els = getElements();
    if (!navigator.onLine) {
      if (els.apiLatencyVal) els.apiLatencyVal.textContent = 'Offline';
      return;
    }

    const t0 = performance.now();
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ckb&dt=t&q=hi', {
        method: 'GET',
        cache: 'no-store',
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      const elapsed = Math.round(performance.now() - t0);
      if (els.apiLatencyVal) {
        els.apiLatencyVal.textContent = `${elapsed} ms`;
        els.apiLatencyVal.style.color = elapsed < 350 ? '#34d399' : (elapsed < 800 ? '#fbbf24' : '#fb7185');
      }
    } catch {
      if (els.apiLatencyVal) {
        els.apiLatencyVal.textContent = 'Ready (PWA)';
        els.apiLatencyVal.style.color = '#38bdf8';
      }
    }
  }

  /**
   * Register service worker and listen for updates/controller changes.
   */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    // Prevent reload loops on controllerchange
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isRefreshing) return;
      isRefreshing = true;
      window.location.reload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          // Check for existing waiting worker
          if (reg.waiting) {
            showUpdateAvailable(reg);
          }

          // Listen for new worker installs
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateAvailable(reg);
              }
            });
          });

          // Check on window focus and periodically
          window.addEventListener('focus', () => {
            reg.update().catch(() => {});
            measureLatency();
          });

          setInterval(() => {
            reg.update().catch(() => {});
          }, 30 * 60 * 1000);
        })
        .catch((err) => {
          console.warn('Service worker registration failed:', err);
        });
    });
  }

  /**
   * Display update badge and notification banner.
   */
  function showUpdateAvailable(reg, newVerStr) {
    const els = getElements();
    const verDisplay = newVerStr || 'v96+';

    if (els.updateBadgeDot) els.updateBadgeDot.classList.remove('hidden');
    if (els.refreshBtn) els.refreshBtn.classList.add('has-update');
    if (els.bannerVerTag) els.bannerVerTag.textContent = verDisplay;

    if (els.refreshStatusTxt) {
      els.refreshStatusTxt.textContent = `${getI18nText('newVersionAvailable', 'New version available')} (${verDisplay})`;
      els.refreshStatusTxt.style.color = '#f43f5e';
    }

    if (els.updateBanner && !hasShownUpdateNotice) {
      els.updateBanner.classList.remove('hidden');
      hasShownUpdateNotice = true;
    }
  }

  /**
   * Fetch the latest version published to GitHub Pages / repository.
   */
  async function fetchLatestGitHubVersion() {
    if (!navigator.onLine) return null;
    const endpoints = [
      'https://lost-4ever.github.io/kurdish-translator/sw.js?_t=' + Date.now(),
      'https://raw.githubusercontent.com/LOST-4EVER/kurdish-translator/main/sw.js?_t=' + Date.now()
    ];

    for (const url of endpoints) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 3500);
        const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) continue;
        const text = await res.text();
        const match = text.match(/const\s+CACHE\s*=\s*['"](?:kurdish-translator-)?v?(\d+)['"]/i)
          || text.match(/CACHE\s*=\s*['"]([^'"]+)['"]/);
        if (match) {
          const vNum = parseInt(match[1], 10);
          return isNaN(vNum) ? match[1] : 'v' + vNum;
        }
      } catch {}
    }
    return null;
  }

  /**
   * Scan sw.js and GitHub Pages for version changes and report status.
   */
  async function checkForAppUpdates(manual = false) {
    const els = getElements();
    lastCheckedTimestamp = Date.now();
    if (els.refreshTimeTxt) els.refreshTimeTxt.textContent = getI18nText('justNow', 'Just now');

    if (els.refreshLiveDot) {
      els.refreshLiveDot.className = 'live-dot checking';
    }

    if (manual) {
      if (typeof Toast !== 'undefined') {
        Toast.show(getI18nText('checkingForUpdates', 'Checking for updates...'), 'info', 2000);
      }
      if (els.refreshStatusTxt) {
        els.refreshStatusTxt.textContent = getI18nText('checkingForUpdates', 'Checking for updates...');
      }
    }

    measureLatency();

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      }

      let foundNew = false;
      let serverVer = '';

      // 1. Check local Service Worker cache tag
      try {
        const res = await fetch('./sw.js?_t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const text = await res.text();
          const match = text.match(/const\s+CACHE\s*=\s*['"]([^'"]+)['"]/);
          if (match && match[1]) {
            const cacheTag = match[1];
            const vMatch = cacheTag.match(/v(\d+)/i);
            const currMatch = APP_VERSION.match(/v(\d+)/i);

            if (vMatch && currMatch) {
              const serverNum = parseInt(vMatch[1], 10);
              const currNum = parseInt(currMatch[1], 10);
              if (serverNum > currNum) {
                foundNew = true;
                serverVer = 'v' + serverNum;
              }
            } else if (!cacheTag.includes(APP_VERSION)) {
              foundNew = true;
              serverVer = cacheTag;
            }
          }
        }
      } catch {}

      // 2. Also check remote GitHub Pages / upstream repository if online
      if (!foundNew && navigator.onLine) {
        const ghVer = await fetchLatestGitHubVersion();
        if (ghVer) {
          const ghMatch = ghVer.match(/v(\d+)/i);
          const currMatch = APP_VERSION.match(/v(\d+)/i);
          if (ghMatch && currMatch) {
            const ghNum = parseInt(ghMatch[1], 10);
            const currNum = parseInt(currMatch[1], 10);
            if (ghNum > currNum) {
              foundNew = true;
              serverVer = ghVer;
            }
          }
        }
      }

      if (els.refreshLiveDot) {
        els.refreshLiveDot.className = 'live-dot ' + (navigator.onLine ? 'online' : 'offline');
      }

      if (foundNew) {
        showUpdateAvailable(null, serverVer);
        if (manual && typeof Toast !== 'undefined') {
          Toast.show(`${getI18nText('newVersionAvailable', 'New version available')}: ${serverVer}!`, 'success', 4000);
        }
      } else {
        if (els.refreshStatusTxt) {
          els.refreshStatusTxt.textContent = getI18nText('appUpToDate', 'App is up to date');
          els.refreshStatusTxt.style.color = '';
        }
        if (manual && typeof Toast !== 'undefined') {
          Toast.show(getI18nText('appUpToDate', 'App is up to date') + ` (${APP_VERSION})`, 'success', 3000);
        }
      }
    } catch (e) {
      if (els.refreshLiveDot) {
        els.refreshLiveDot.className = 'live-dot ' + (navigator.onLine ? 'online' : 'offline');
      }
      if (manual && typeof Toast !== 'undefined') {
        Toast.show(getI18nText('checkFailed', 'Update check failed. Working offline?'), 'warning', 3000);
      }
    }
  }

  /**
   * Perform a quick refresh: uses skipWaiting if available, else reloads smoothly.
   */
  async function performQuickRefresh() {
    const els = getElements();
    if (els.refreshBtn) {
      const icon = els.refreshBtn.querySelector('.refresh-icon');
      if (icon) icon.classList.add('spin-refresh');
    }

    if (typeof Toast !== 'undefined') {
      Toast.show(getI18nText('refreshingApp', 'Refreshing app...'), 'info', 2000);
    }

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          return;
        }
      }
    } catch {}

    setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  /**
   * Perform a force refresh: clear all caches, unregister service workers, and hard-reload.
   */
  async function performForceRefresh(customMsg) {
    if (typeof Toast !== 'undefined') {
      Toast.show(customMsg || getI18nText('clearingCache', 'Clearing cache & reloading...'), 'info', 3000);
    }

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
    } catch (e) {
      console.warn('Cache clearing error:', e);
    }

    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('_r', Date.now().toString());
      window.location.href = url.toString();
    }, 500);
  }

  /**
   * Wire up event listeners for the refresh popover menu and buttons.
   */
  function bindRefreshControls() {
    const els = getElements();

    if (els.refreshBtn && els.refreshMenu) {
      els.refreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !els.refreshMenu.classList.contains('hidden');
        if (isOpen) {
          els.refreshMenu.classList.add('hidden');
          els.refreshBtn.setAttribute('aria-expanded', 'false');
        } else {
          els.refreshMenu.classList.remove('hidden');
          els.refreshBtn.setAttribute('aria-expanded', 'true');
          measureLatency();
        }
      });

      document.addEventListener('click', (e) => {
        if (!els.refreshMenu.classList.contains('hidden')) {
          if (!els.refreshMenu.contains(e.target) && !els.refreshBtn.contains(e.target)) {
            els.refreshMenu.classList.add('hidden');
            els.refreshBtn.setAttribute('aria-expanded', 'false');
          }
        }
      });
    }

    if (els.btnQuickRefresh) {
      els.btnQuickRefresh.addEventListener('click', () => {
        if (els.refreshMenu) els.refreshMenu.classList.add('hidden');
        performQuickRefresh();
      });
    }

    if (els.btnForceRefresh) {
      els.btnForceRefresh.addEventListener('click', () => {
        if (els.refreshMenu) els.refreshMenu.classList.add('hidden');
        performForceRefresh();
      });
    }

    if (els.btnCheckUpdate) {
      els.btnCheckUpdate.addEventListener('click', () => {
        checkForAppUpdates(true);
      });
    }

    if (els.btnToggleChangelog && els.changelogPanel) {
      els.btnToggleChangelog.addEventListener('click', () => {
        const isClosed = els.changelogPanel.classList.contains('hidden');
        if (isClosed) {
          els.changelogPanel.classList.remove('hidden');
          els.btnToggleChangelog.setAttribute('aria-expanded', 'true');
        } else {
          els.changelogPanel.classList.add('hidden');
          els.btnToggleChangelog.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (els.bannerRefreshBtn) {
      els.bannerRefreshBtn.addEventListener('click', () => {
        performQuickRefresh();
      });
    }

    if (els.bannerForceRefreshBtn) {
      els.bannerForceRefreshBtn.addEventListener('click', () => {
        performForceRefresh();
      });
    }

    if (els.bannerDismissBtn && els.updateBanner) {
      els.bannerDismissBtn.addEventListener('click', () => {
        els.updateBanner.classList.add('hidden');
      });
    }
  }

  return {
    VERSION: APP_VERSION,
    init,
    checkForAppUpdates,
    fetchLatestGitHubVersion,
    performQuickRefresh,
    performForceRefresh,
  };
})();
