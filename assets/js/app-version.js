/**
 * app-version.js — PWA lifecycle, Service Worker management, GitHub sync, multi-tier update detection, and diagnostics.
 * Exposes AppVersion as a global module.
 */
const AppVersion = (() => {
  const APP_VERSION = 'v168';
  const GITHUB_REPO = 'LOST-4EVER/kurdish-translator';
  const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/commits/main`;
  const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/main`;

  let initialized = false;
  let isRefreshing = false;
  let isSyncingGitHub = false;
  let isCheckingUpdates = false;
  let hasShownUpdateNotice = false;
  let hasUpdateAvailable = false;
  let latestDiscoveredVer = APP_VERSION;
  let lastCheckedTimestamp = Date.now();
  let timeTickerInterval = null;
  let latestGitHubMeta = null;
  let currentServiceWorkerReg = null;

  /**
   * Parses integer version number from strings like 'v168', '168', 'v1.6.8'.
   * @param {string|number} ver
   * @returns {number}
   */
  function parseVersionNumber(ver) {
    if (!ver) return 0;
    if (typeof ver === 'number') return ver;
    const match = String(ver).replace(/^v/i, '').match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Checks if candidate version is strictly newer than base version.
   * @param {string|number} remoteVer
   * @param {string|number} [currentVer=APP_VERSION]
   * @returns {boolean}
   */
  function isNewerVersion(remoteVer, currentVer = APP_VERSION) {
    if (!remoteVer) return false;
    const remoteNum = parseVersionNumber(remoteVer);
    const currentNum = parseVersionNumber(currentVer);
    if (remoteNum > 0 && currentNum > 0) {
      return remoteNum > currentNum;
    }
    return false;
  }

  function getElements() {
    return {
      currentVerTag: document.getElementById('currentVerTag'),
      menuVerNum: document.getElementById('menuVerNum'),
      refreshBtn: document.getElementById('refreshBtn'),
      refreshMenu: document.getElementById('refreshDropdown') || document.getElementById('refreshMenu'),
      refreshStatusTxt: document.getElementById('refreshStatusTxt'),
      refreshTimeTxt: document.getElementById('refreshTimeTxt'),
      refreshLiveDot: document.getElementById('refreshLiveDot'),
      apiLatencyVal: document.getElementById('apiLatencyVal'),
      networkStatusBadge: document.getElementById('networkStatusBadge'),
      networkStatusText: document.getElementById('networkStatusText'),
      updateBadgeDot: document.getElementById('updateBadgeDot'),
      githubMetaBox: document.getElementById('githubMetaBox'),
      ghCommitSha: document.getElementById('ghCommitSha'),
      ghCommitMsg: document.getElementById('ghCommitMsg'),
      ghCommitTime: document.getElementById('ghCommitTime'),
      ghSyncStatus: document.getElementById('ghSyncStatus'),
      btnQuickRefresh: document.getElementById('btnQuickRefresh'),
      btnForceRefresh: document.getElementById('btnForceRefresh'),
      btnSyncGitHub: document.getElementById('btnSyncGitHub'),
      btnCheckUpdate: document.getElementById('btnCheckUpdate'),
      btnToggleChangelog: document.getElementById('btnToggleChangelog'),
      changelogPanel: document.getElementById('changelogPanel'),
      updateBanner: document.getElementById('updateBanner'),
      bannerVerTag: document.getElementById('bannerVerTag'),
      bannerSubText: document.getElementById('bannerSubText'),
      bannerRefreshBtn: document.getElementById('bannerUpdateNowBtn') || document.getElementById('bannerRefreshBtn'),
      bannerSyncGhBtn: document.getElementById('bannerSyncGhBtn'),
      bannerForceRefreshBtn: document.getElementById('bannerForceRefreshBtn'),
      bannerDismissBtn: document.getElementById('bannerCloseBtn') || document.getElementById('bannerDismissBtn'),
      installBtn: document.getElementById('installBtn'),
    };
  }

  function getI18nText(key, fallback) {
    if (typeof UI_I18N !== 'undefined' && UI_I18N.getText) {
      return UI_I18N.getText(key, fallback) || fallback;
    }
    return fallback;
  }

  function formatRelativeTime(timestamp) {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (elapsedSeconds < 15) return getI18nText('timeJustNow', 'Just now');
    if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h ago`;
    const elapsedDays = Math.floor(elapsedHours / 24);
    return `${elapsedDays}d ago`;
  }

  let deferredInstallPrompt = null;

  /**
   * Set up PWA installation listeners and prompt.
   */
  function initInstallPrompt() {
    const installBtn = document.getElementById('installBtn');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (isStandalone && installBtn) {
      installBtn.hidden = true;
      installBtn.style.display = 'none';
      return;
    }

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
          }
        } catch {
          // Ignore prompt errors
        }
      });
    }

    window.addEventListener('appinstalled', () => {
      if (installBtn) {
        installBtn.hidden = true;
        installBtn.style.display = 'none';
      }
      deferredInstallPrompt = null;
      if (typeof Toast !== 'undefined') {
        Toast.show(getI18nText('appInstalled', 'App installed successfully!'), 'success', 3000);
      }
    });
  }

  /**
   * Update the UI labels for version, timestamp, and network status.
   */
  function updateUIState() {
    const els = getElements();
    const displayVer = latestDiscoveredVer || APP_VERSION;

    if (els.currentVerTag) {
      els.currentVerTag.textContent = displayVer;
    }
    if (els.menuVerNum) {
      els.menuVerNum.textContent = displayVer;
    }
    if (els.refreshTimeTxt) {
      els.refreshTimeTxt.textContent = formatRelativeTime(lastCheckedTimestamp);
    }
    if (els.updateBadgeDot) {
      els.updateBadgeDot.classList.toggle('active', hasUpdateAvailable);
    }
    if (els.refreshLiveDot) {
      els.refreshLiveDot.className = `live-dot ${navigator.onLine ? 'online' : 'offline'}`;
    }
    if (els.networkStatusText) {
      els.networkStatusText.textContent = navigator.onLine
        ? getI18nText('netOnline', 'Online & Synced')
        : getI18nText('netOffline', 'Offline (Cached Shell)');
    }

    // Render GitHub commit metadata if available
    if (latestGitHubMeta && els.githubMetaBox) {
      els.githubMetaBox.classList.remove('hidden');
      if (els.ghCommitSha) {
        els.ghCommitSha.textContent = latestGitHubMeta.sha || 'Latest';
      }
      if (els.ghCommitMsg) {
        els.ghCommitMsg.textContent = latestGitHubMeta.message || 'Synced with GitHub repository';
        els.ghCommitMsg.title = latestGitHubMeta.message || '';
      }
      if (els.ghCommitTime) {
        els.ghCommitTime.textContent = latestGitHubMeta.dateStr || 'Recent commit';
      }
      if (els.ghSyncStatus) {
        els.ghSyncStatus.textContent = hasUpdateAvailable
          ? getI18nText('updateAvailable', 'Update Ready')
          : getI18nText('githubUpToDate', 'GitHub Live (Up to date)');
        els.ghSyncStatus.style.color = hasUpdateAvailable ? '#fb7185' : '#38bdf8';
      }
    }
  }

  /**
   * Show the update available alert banner and badge if and only if a genuine newer version exists.
   */
  function showUpdateAvailable(versionOrSha) {
    // Strictly require that the candidate version is newer than the currently running version
    if (!isNewerVersion(versionOrSha, APP_VERSION)) {
      hasUpdateAvailable = false;
      const els = getElements();
      if (els.updateBadgeDot) els.updateBadgeDot.classList.remove('active');
      if (els.updateBanner) {
        els.updateBanner.classList.add('hidden');
        els.updateBanner.style.display = 'none';
      }
      return;
    }

    hasUpdateAvailable = true;
    if (versionOrSha && typeof versionOrSha === 'string') {
      latestDiscoveredVer = versionOrSha;
    }

    // Check if dismissed in this session
    let isDismissed = false;
    try {
      isDismissed = sessionStorage.getItem('kurdish_dismissed_update') === String(latestDiscoveredVer);
    } catch {}

    const els = getElements();
    if (els.updateBadgeDot) {
      els.updateBadgeDot.classList.add('active');
    }
    if (els.refreshStatusTxt) {
      els.refreshStatusTxt.textContent = getI18nText('newVersionAvailable', 'New version available!');
      els.refreshStatusTxt.style.color = '#fb7185';
    }
    if (els.bannerVerTag) {
      els.bannerVerTag.textContent = latestDiscoveredVer || APP_VERSION;
    }
    if (els.bannerSubText) {
      els.bannerSubText.textContent = latestGitHubMeta && latestGitHubMeta.message
        ? `${latestGitHubMeta.message.slice(0, 75)} — (${latestDiscoveredVer})`
        : getI18nText('updateAvailableSub', 'Update now to get the latest version and features.');
    }
    if (els.updateBanner && !isDismissed && !hasShownUpdateNotice) {
      els.updateBanner.classList.remove('hidden');
      els.updateBanner.style.display = 'flex';
      hasShownUpdateNotice = true;
    }

    updateUIState();
  }

  /**
   * Fetch commit metadata from GitHub API with fallback to raw GitHub content.
   */
  async function fetchGitHubCommitMeta() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(`${GITHUB_API_URL}?_t=${Date.now()}`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const shortSha = (data.sha || '').slice(0, 7);
        const commitMsg = data.commit && data.commit.message
          ? data.commit.message.split('\n')[0].trim()
          : 'Repository updated';
        const commitDate = data.commit && (data.commit.committer ? data.commit.committer.date : data.commit.author?.date);
        const dateStr = commitDate ? new Date(commitDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Today';

        latestGitHubMeta = {
          sha: shortSha,
          fullSha: data.sha,
          message: commitMsg,
          dateStr: dateStr,
          author: data.commit?.author?.name || 'Maintainer',
          url: data.html_url || `https://github.com/${GITHUB_REPO}`,
        };

        updateUIState();
        return latestGitHubMeta;
      }
    } catch {
      // Fall back to querying raw files
    }

    // Tier 2 Fallback: Fetch raw app-version.js to inspect remote version
    try {
      const rawRes = await fetch(`${GITHUB_RAW_BASE}/assets/js/app-version.js?_t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (rawRes.ok) {
        const text = await rawRes.text();
        const match = text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
        if (match && match[1]) {
          const remoteVer = match[1];
          latestGitHubMeta = {
            sha: remoteVer,
            fullSha: remoteVer,
            message: `Version ${remoteVer} on GitHub`,
            dateStr: 'Live',
            author: 'GitHub',
          };
          if (isNewerVersion(remoteVer, APP_VERSION)) {
            showUpdateAvailable(remoteVer);
          }
          updateUIState();
          return latestGitHubMeta;
        }
      }
    } catch {
      // Ignore network errors in fallback
    }

    return null;
  }

  /**
   * Diagnostic ping to estimate network latency to the translation endpoint.
   */
  async function measureApiLatency() {
    if (!navigator.onLine) {
      const els = getElements();
      if (els.apiLatencyVal) els.apiLatencyVal.textContent = 'Offline';
      return;
    }

    const startTime = performance.now();
    try {
      const pingUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ckb&dt=t&q=hi&_p=${Date.now()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(pingUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latency = Math.round(performance.now() - startTime);
      const els = getElements();
      if (els.apiLatencyVal) {
        if (res.ok) {
          els.apiLatencyVal.textContent = `${latency} ms`;
          els.apiLatencyVal.style.color = latency < 250 ? '#34d399' : latency < 700 ? '#facc15' : '#fb7185';
        } else {
          els.apiLatencyVal.textContent = 'Degraded';
          els.apiLatencyVal.style.color = '#facc15';
        }
      }
    } catch {
      const els = getElements();
      if (els.apiLatencyVal) {
        els.apiLatencyVal.textContent = 'Timeout';
        els.apiLatencyVal.style.color = '#fb7185';
      }
    }
  }

  /**
   * Check for application updates across all tiers:
   * 1. Service Worker registration byte check
   * 2. GitHub Commits API / Raw version check
   * 3. Same-origin sw.js cache version
   */
  async function checkForAppUpdates(manual = false) {
    if (isCheckingUpdates) return;
    isCheckingUpdates = true;

    const els = getElements();
    if (manual) {
      if (els.refreshStatusTxt) {
        els.refreshStatusTxt.textContent = getI18nText('checkingUpdate', 'Checking for updates…');
      }
      if (typeof Toast !== 'undefined') {
        Toast.show(getI18nText('checkingUpdate', 'Checking for updates…'), 'info', 2000);
      }
    }

    lastCheckedTimestamp = Date.now();

    // 1. Service Worker update check
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          currentServiceWorkerReg = reg;
          await reg.update();
        }
      } catch {
        // Continue checking other tiers
      }
    }

    // 2. GitHub Commits and Remote Version Check
    await fetchGitHubCommitMeta();

    // 3. Same-origin sw.js Version Check
    try {
      const swRes = await fetch(`./sw.js?_cb=${Date.now()}`, { cache: 'no-store' });
      if (swRes.ok) {
        const text = await swRes.text();
        const match = text.match(/CACHE\s*=\s*['"]kurdish-translator-(v\d+)['"]/);
        if (match && match[1]) {
          const remoteSwVer = match[1];
          if (isNewerVersion(remoteSwVer, APP_VERSION)) {
            showUpdateAvailable(remoteSwVer);
            if (manual && typeof Toast !== 'undefined') {
              Toast.show(getI18nText('newVersionAvailable', 'New version available!'), 'success', 4000);
            }
            isCheckingUpdates = false;
            return;
          }
        }
      }
    } catch {
      // Ignore
    }

    await measureApiLatency();

    if (!hasUpdateAvailable) {
      if (els.updateBadgeDot) els.updateBadgeDot.classList.remove('active');
      if (els.updateBanner) {
        els.updateBanner.classList.add('hidden');
        els.updateBanner.style.display = 'none';
      }
      if (els.refreshStatusTxt) {
        els.refreshStatusTxt.textContent = getI18nText('appUpToDate', 'App up to date');
        els.refreshStatusTxt.style.color = '';
      }
      if (manual && typeof Toast !== 'undefined') {
        Toast.show(getI18nText('appUpToDate', 'App is up to date') + ` (${APP_VERSION})`, 'success', 2500);
      }
    }

    updateUIState();
    isCheckingUpdates = false;
  }

  /**
   * Completely syncs the application with GitHub:
   * - Queries GitHub for the latest commit info
   * - Purges all Service Worker CacheStorage buckets
   * - Unregisters existing Service Workers
   * - Performs a hard cache-busted reload to guarantee 100% fresh assets
   */
  async function syncWithGitHub() {
    if (isSyncingGitHub) return;
    isSyncingGitHub = true;

    const els = getElements();
    if (els.btnSyncGitHub) {
      els.btnSyncGitHub.disabled = true;
      els.btnSyncGitHub.style.opacity = '0.7';
    }
    if (els.bannerSyncGhBtn) {
      els.bannerSyncGhBtn.disabled = true;
    }

    if (typeof Toast !== 'undefined') {
      Toast.show(getI18nText('syncingGitHub', 'Pulling latest code from GitHub…'), 'info', 4000);
    }

    try {
      // 1. Fetch latest commit metadata
      const meta = await fetchGitHubCommitMeta();
      if (meta && meta.sha) {
        try {
          localStorage.setItem('kurdish_installed_sha', meta.sha);
          localStorage.setItem('kurdish_installed_ver', APP_VERSION);
        } catch {}
      }

      // 2. Instruct active Service Worker to clear its caches and skip waiting
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL_CACHES' });
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }

      // 3. Purge all CacheStorage keys from main window context
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      // 4. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }

      if (typeof Toast !== 'undefined') {
        Toast.show(getI18nText('syncComplete', 'Synced with GitHub! Reloading…'), 'success', 2000);
      }

      // 5. Trigger clean, cache-busting hard reload
      setTimeout(() => {
        const targetUrl = new URL(window.location.origin + window.location.pathname);
        targetUrl.searchParams.set('_gh_sync', Date.now().toString());
        targetUrl.searchParams.set('_nocache', Date.now().toString());
        window.location.replace(targetUrl.toString());
      }, 500);

    } catch (err) {
      if (typeof Toast !== 'undefined') {
        Toast.show(getI18nText('syncError', 'GitHub sync completed with partial network bypass. Reloading…'), 'warning', 2500);
      }
      setTimeout(() => {
        window.location.reload();
      }, 600);
    }
  }

  /**
   * Fast refresh that activates waiting Service Worker and reloads.
   */
  async function performQuickRefresh() {
    if (isRefreshing) return;
    isRefreshing = true;

    if (typeof Toast !== 'undefined') {
      Toast.show(getI18nText('refreshingApp', 'Refreshing application…'), 'info', 1500);
    }

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });
        setTimeout(() => window.location.reload(), 600);
        return;
      }
    }

    window.location.reload();
  }

  /**
   * Force refresh: Purges all CacheStorage entries and reloads.
   */
  async function performForceRefresh() {
    if (isRefreshing) return;
    isRefreshing = true;

    if (typeof Toast !== 'undefined') {
      Toast.show(getI18nText('forceRefreshing', 'Purging cache & hard reloading…'), 'warning', 2000);
    }

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.unregister();
      }
    } catch {
      // Ignore
    }

    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('_force', Date.now().toString());
      window.location.replace(url.toString());
    }, 400);
  }

  /**
   * Register service worker and wire listeners.
   */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
        currentServiceWorkerReg = reg;

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              checkForAppUpdates(false);
            }
          });
        });

        // Periodic check for SW update every 15 minutes
        setInterval(() => {
          reg.update().catch(() => {});
        }, 15 * 60 * 1000);

      } catch (err) {
        // Ignore registration error
      }
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing && hasUpdateAvailable) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  /**
   * Initialize UI dropdown, changelog accordion, buttons, and timers.
   */
  function init() {
    if (initialized) return;
    initialized = true;

    initInstallPrompt();
    registerServiceWorker();

    const els = getElements();

    // Bind Refresh button dropdown toggle
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
          updateUIState();
          measureApiLatency();
          fetchGitHubCommitMeta();
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!els.refreshMenu.classList.contains('hidden') &&
            !els.refreshMenu.contains(e.target) &&
            !els.refreshBtn.contains(e.target)) {
          els.refreshMenu.classList.add('hidden');
          els.refreshBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Close dropdown on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !els.refreshMenu.classList.contains('hidden')) {
          els.refreshMenu.classList.add('hidden');
          els.refreshBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Bind Quick Refresh Button
    if (els.btnQuickRefresh) {
      els.btnQuickRefresh.addEventListener('click', () => performQuickRefresh());
    }

    // Bind Check for Updates Button
    if (els.btnCheckUpdate) {
      els.btnCheckUpdate.addEventListener('click', () => checkForAppUpdates(true));
    }

    // Bind Sync with GitHub Button
    if (els.btnSyncGitHub) {
      els.btnSyncGitHub.addEventListener('click', () => syncWithGitHub());
    }

    // Bind Force Refresh Button
    if (els.btnForceRefresh) {
      els.btnForceRefresh.addEventListener('click', () => performForceRefresh());
    }

    // Bind Changelog Toggle
    if (els.btnToggleChangelog && els.changelogPanel) {
      els.btnToggleChangelog.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = els.changelogPanel.classList.contains('hidden');
        els.changelogPanel.classList.toggle('hidden', !isCollapsed);
        els.btnToggleChangelog.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
      });
    }

    // Bind Update Banner Buttons
    if (els.bannerRefreshBtn) {
      els.bannerRefreshBtn.addEventListener('click', () => performQuickRefresh());
    }
    if (els.bannerSyncGhBtn) {
      els.bannerSyncGhBtn.addEventListener('click', () => syncWithGitHub());
    }
    if (els.bannerForceRefreshBtn) {
      els.bannerForceRefreshBtn.addEventListener('click', () => performForceRefresh());
    }
    if (els.bannerDismissBtn && els.updateBanner) {
      els.bannerDismissBtn.addEventListener('click', () => {
        try {
          sessionStorage.setItem('kurdish_dismissed_update', String(latestDiscoveredVer || APP_VERSION));
        } catch {}
        els.updateBanner.classList.add('hidden');
        els.updateBanner.style.display = 'none';
      });
    }

    // Network status listeners
    window.addEventListener('online', () => {
      updateUIState();
      measureApiLatency();
      checkForAppUpdates(false);
      if (typeof Toast !== 'undefined') {
        Toast.show(getI18nText('netOnline', 'Connection restored. Synced.'), 'success', 2500);
      }
    });

    window.addEventListener('offline', () => {
      updateUIState();
      if (typeof Toast !== 'undefined') {
        Toast.show(getI18nText('netOffline', 'Offline. App is running from cache.'), 'warning', 3000);
      }
    });

    // Start background relative time ticker
    if (timeTickerInterval) clearInterval(timeTickerInterval);
    timeTickerInterval = setInterval(() => {
      const el = document.getElementById('refreshTimeTxt');
      if (el) el.textContent = formatRelativeTime(lastCheckedTimestamp);
    }, 30000);

    // Initial check and background update check after 2 seconds
    setTimeout(() => {
      updateUIState();
      measureApiLatency();
      fetchGitHubCommitMeta();
      checkForAppUpdates(false);
    }, 2000);
  }

  // Auto-init on DOM ready when in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    init: () => init(),
    refreshTexts: () => updateUIState(),
    getVersion: () => APP_VERSION,
    getDiscoveredVersion: () => latestDiscoveredVer,
    hasUpdate: () => hasUpdateAvailable,
    checkForUpdates: (manual) => checkForAppUpdates(manual),
    syncWithGitHub: () => syncWithGitHub(),
    quickRefresh: () => performQuickRefresh(),
    forceRefresh: () => performForceRefresh(),
    showUpdateNotice: (ver) => showUpdateAvailable(ver),
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppVersion;
}

