/**
 * app-version.js — PWA lifecycle, cache management, update detection, and refresh controls.
 * Exposes AppVersion as a global module.
 */
const AppVersion = (() => {
  const APP_VERSION = 'v95';
  let isRefreshing = false;
  let hasShownUpdateNotice = false;
  let updateBannerTimeout = null;

  function getElements() {
    return {
      currentVerTag: document.getElementById('currentVerTag'),
      menuVerNum: document.getElementById('menuVerNum'),
      refreshBtn: document.getElementById('refreshBtn'),
      refreshMenu: document.getElementById('refreshMenu') || document.getElementById('refreshDropdown'),
      refreshStatusTxt: document.getElementById('refreshStatusTxt'),
      updateBadgeDot: document.getElementById('updateBadgeDot'),
      btnQuickRefresh: document.getElementById('btnQuickRefresh'),
      btnForceRefresh: document.getElementById('btnForceRefresh'),
      btnCheckUpdate: document.getElementById('btnCheckUpdate'),
      updateBanner: document.getElementById('updateBanner'),
      bannerVerTag: document.getElementById('bannerVerTag'),
      bannerRefreshBtn: document.getElementById('bannerRefreshBtn'),
      bannerForceRefreshBtn: document.getElementById('bannerForceRefreshBtn'),
      bannerDismissBtn: document.getElementById('bannerDismissBtn'),
    };
  }

  function getI18nText(key, fallback) {
    if (typeof UI_I18N !== 'undefined' && UI_I18N.getText) {
      return UI_I18N.getText(key) || fallback;
    }
    return fallback;
  }

  /**
   * Set up and bind version tags, update banners, and refresh buttons.
   */
  function init() {
    const els = getElements();
    if (els.currentVerTag) els.currentVerTag.textContent = APP_VERSION;
    if (els.menuVerNum) els.menuVerNum.textContent = APP_VERSION;

    registerSW();
    bindRefreshControls();
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
    const verDisplay = newVerStr || 'v92+';

    if (els.updateBadgeDot) els.updateBadgeDot.classList.remove('hidden');
    if (els.bannerVerTag) els.bannerVerTag.textContent = verDisplay;

    if (els.refreshStatusTxt) {
      els.refreshStatusTxt.textContent = `${getI18nText('newVersionAvailable', 'New version available')} (${verDisplay})`;
      els.refreshStatusTxt.style.color = 'var(--accent-glow, #3b82f6)';
    }

    if (els.updateBanner && !hasShownUpdateNotice) {
      els.updateBanner.classList.remove('hidden');
      hasShownUpdateNotice = true;
    }
  }

  /**
   * Scan sw.js for version changes and report status.
   */
  async function checkForAppUpdates(manual = false) {
    const els = getElements();
    if (manual) {
      if (typeof Toast !== 'undefined') {
        Toast.show(getI18nText('checkingForUpdates', 'Checking for updates...'), 'info', 2000);
      }
      if (els.refreshStatusTxt) {
        els.refreshStatusTxt.textContent = getI18nText('checkingForUpdates', 'Checking for updates...');
      }
    }

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      }

      const res = await fetch('./sw.js?_t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not fetch sw.js');
      const text = await res.text();

      const match = text.match(/const\s+CACHE\s*=\s*['"]([^'"]+)['"]/);
      let foundNew = false;
      let serverVer = '';

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
        if (els.refreshMenu) els.refreshMenu.classList.add('hidden');
        checkForAppUpdates(true);
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
    performQuickRefresh,
    performForceRefresh,
  };
})();
