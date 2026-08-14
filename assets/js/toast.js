/**
 * toast.js — Refined, lightweight notification system for Kurdî Subtitle Translator
 */
const Toast = (() => {
  let containerEl = null;
  const activeToasts = [];

  function ensureContainer() {
    if (!containerEl || !document.body.contains(containerEl)) {
      containerEl = document.getElementById('toastContainer');
      if (!containerEl) {
        containerEl = document.createElement('div');
        containerEl.id = 'toastContainer';
        containerEl.className = 'toast-container';
        document.body.appendChild(containerEl);
      }
    }
    return containerEl;
  }

  const ICONS = {
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    translating: `<svg class="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
    editing: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  };

  /**
   * Show a toast message.
   * @param {string} title
   * @param {string} [type='info'] - 'info' | 'success' | 'error' | 'warning' | 'translating' | 'editing'
   * @param {object} [options] - { subtext, duration, actionLabel, onAction }
   */
  function show(title, type = 'info', options = {}) {
    const parent = ensureContainer();
    const duration = options.duration || (type === 'error' ? 4200 : 2800);

    // Limit active toasts to max 2 to prevent stacking and screen clutter
    while (activeToasts.length >= 2) {
      const oldest = activeToasts.shift();
      if (oldest && oldest.dismiss) oldest.dismiss();
    }

    const toastCard = document.createElement('div');
    toastCard.className = `toast-card toast-${type}`;
    if (options.subtext) toastCard.classList.add('has-subtext');

    const iconHtml = ICONS[type] || ICONS.info;

    let actionBtnHtml = '';
    if (options.actionLabel) {
      actionBtnHtml = `<button type="button" class="toast-action-btn">${options.actionLabel}</button>`;
    }

    toastCard.innerHTML = `
      <div class="toast-icon-wrap">${iconHtml}</div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${options.subtext ? `<div class="toast-subtext">${options.subtext}</div>` : ''}
      </div>
      ${actionBtnHtml}
      <button type="button" class="toast-close-btn" aria-label="Close notification">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="toast-progress"><div class="toast-progress-bar" style="animation-duration: ${duration}ms"></div></div>
    `;

    parent.appendChild(toastCard);

    let dismissTimer = null;
    let startTime = Date.now();
    let remaining = duration;
    let isDismissed = false;

    const dismiss = () => {
      if (isDismissed) return;
      isDismissed = true;
      clearTimeout(dismissTimer);
      const idx = activeToasts.indexOf(toastHandle);
      if (idx !== -1) activeToasts.splice(idx, 1);

      toastCard.classList.add('dismissing');
      setTimeout(() => {
        if (toastCard.parentNode) toastCard.parentNode.removeChild(toastCard);
      }, 220);
    };

    const toastHandle = { dismiss };
    activeToasts.push(toastHandle);

    const startTimer = () => {
      clearTimeout(dismissTimer);
      startTime = Date.now();
      dismissTimer = setTimeout(dismiss, remaining);
    };

    const pauseTimer = () => {
      clearTimeout(dismissTimer);
      remaining -= Date.now() - startTime;
      if (remaining < 0) remaining = 0;
    };

    toastCard.addEventListener('mouseenter', pauseTimer);
    toastCard.addEventListener('mouseleave', startTimer);

    const closeBtn = toastCard.querySelector('.toast-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', dismiss);

    const actionBtn = toastCard.querySelector('.toast-action-btn');
    if (actionBtn && typeof options.onAction === 'function') {
      actionBtn.addEventListener('click', () => {
        options.onAction();
        dismiss();
      });
    }

    startTimer();

    return toastHandle;
  }

  function dismissAll() {
    while (activeToasts.length) {
      const t = activeToasts.shift();
      if (t && t.dismiss) t.dismiss();
    }
  }

  function success(title, subtext, actionLabel, onAction) {
    return show(title, 'success', { subtext, actionLabel, onAction });
  }

  function error(title, subtext, actionLabel, onAction) {
    return show(title, 'error', { subtext, actionLabel, onAction, duration: 4800 });
  }

  return {
    show,
    dismissAll,
    success,
    error,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Toast;
}
