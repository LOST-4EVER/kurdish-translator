/**
 * video-editor-hardware.js — Hardware Capabilities & Advanced PWA Sensor Engine.
 * Integrates Screen Wake Lock, CPU Concurrency detection, Device Memory profiling,
 * Haptic Vibration feedback, Native Mobile Web Share, App Badging, and Battery status.
 */
(() => {
  'use strict';

  class VideoEditorHardwareEngine {
    constructor() {
      this._wakeLock = null;
      this._wakeLockReasons = new Set();
      this._isWakeLockRequested = false;
      this._battery = null;

      this.cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4;
      this.deviceMemory = typeof navigator !== 'undefined' && navigator.deviceMemory ? navigator.deviceMemory : null;
      this.hasTouch = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));

      this._initVisibilityWatcher();
      this._initBatteryWatcher();
    }

    /**
     * Request Screen Wake Lock to prevent phone/desktop display from sleeping during playback or export.
     * @param {string} reason - e.g. 'playback' or 'export'
     */
    async requestWakeLock(reason = 'playback') {
      this._wakeLockReasons.add(reason);
      this._isWakeLockRequested = true;

      if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
        return false;
      }

      if (this._wakeLock !== null) {
        return true;
      }

      try {
        this._wakeLock = await navigator.wakeLock.request('screen');
        this._wakeLock.addEventListener('release', () => {
          this._wakeLock = null;
        });
        return true;
      } catch (err) {
        // Wake lock can fail if battery saver is on or page is hidden
        return false;
      }
    }

    /**
     * Release Screen Wake Lock when action finishes.
     * @param {string} reason - e.g. 'playback' or 'export'
     */
    async releaseWakeLock(reason = 'playback') {
      this._wakeLockReasons.delete(reason);
      if (this._wakeLockReasons.size === 0) {
        this._isWakeLockRequested = false;
        if (this._wakeLock) {
          try {
            await this._wakeLock.release();
          } catch (_) {}
          this._wakeLock = null;
        }
      }
    }

    _initVisibilityWatcher() {
      if (typeof document === 'undefined') return;
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && this._isWakeLockRequested && !this._wakeLock) {
          // Re-acquire wake lock after user switches back to tab
          try {
            if ('wakeLock' in navigator) {
              this._wakeLock = await navigator.wakeLock.request('screen');
            }
          } catch (_) {}
        }
      });
    }

    async _initBatteryWatcher() {
      if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
        try {
          this._battery = await navigator.getBattery();
        } catch (_) {}
      }
    }

    /**
     * Get real-time battery status if supported.
     */
    getBatteryInfo() {
      if (!this._battery) return null;
      return {
        level: Math.round(this._battery.level * 100),
        charging: this._battery.charging,
        chargingTime: this._battery.chargingTime,
        dischargingTime: this._battery.dischargingTime,
      };
    }

    /**
     * Mobile Haptic Feedback.
     * @param {'light'|'medium'|'heavy'|'success'|'warning'|number|number[]} type
     */
    haptic(type = 'light') {
      if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
      try {
        if (typeof type === 'number' || Array.isArray(type)) {
          navigator.vibrate(type);
          return;
        }
        switch (type) {
          case 'light':
            navigator.vibrate(10);
            break;
          case 'medium':
            navigator.vibrate(25);
            break;
          case 'heavy':
            navigator.vibrate(45);
            break;
          case 'success':
            navigator.vibrate([15, 40, 20]);
            break;
          case 'warning':
            navigator.vibrate([35, 30, 35]);
            break;
        }
      } catch (_) {}
    }

    /**
     * Native Mobile Web Share API for exported files or subtitles.
     */
    canShare(data) {
      if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
      if (data && data.files && typeof navigator.canShare === 'function') {
        try {
          return navigator.canShare(data);
        } catch (_) {
          return false;
        }
      }
      return true;
    }

    async share(data) {
      if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
        throw new Error('Web Share API not supported on this browser');
      }
      return navigator.share(data);
    }

    /**
     * PWA App Badging API for active cues or task status.
     */
    setBadge(count) {
      if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
        try {
          if (typeof count === 'number' && count > 0) {
            navigator.setAppBadge(count);
          } else {
            navigator.clearAppBadge();
          }
        } catch (_) {}
      }
    }

    clearBadge() {
      if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
        try { navigator.clearAppBadge(); } catch (_) {}
      }
    }

    /**
     * Returns a hardware capabilities descriptor string for display in Export UI badge.
     */
    getHardwareDescription() {
      const parts = [];
      parts.push(`${this.cores} CPU Cores`);
      if (this.deviceMemory) {
        parts.push(`${this.deviceMemory}GB RAM`);
      }
      if ('wakeLock' in navigator) {
        parts.push('Screen Lock Active');
      } else {
        parts.push('H/W Accelerated');
      }
      return parts.join(' · ');
    }
  }

  window.VideoEditorHardware = new VideoEditorHardwareEngine();
})();
