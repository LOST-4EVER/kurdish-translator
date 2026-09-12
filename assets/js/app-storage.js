/**
 * app-storage.js — Local storage and application preferences manager.
 */
const AppStorage = (() => {
  const DEFAULT_OPTIONS = {
    includeOriginal: false,
    accuracyToggle: false,
    keepOnly: false,
    kurdishDigitsToggle: false,
    contextAwareToggle: true,
    fixOverlapToggle: false,
    addBomToggle: false,
    crlfToggle: false,
  };

  function get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      console.warn(`AppStorage.get("${key}") failed:`, e);
      return fallback;
    }
  }

  function set(key, val) {
    try {
      localStorage.setItem(key, String(val));
    } catch (e) {
      console.warn(`AppStorage.set("${key}") failed:`, e);
      if (typeof Toast !== 'undefined') {
        Toast.show('Storage Warning', 'warning', { subtext: 'Could not save settings to local storage.' });
      }
    }
  }

  function loadOptions() {
    return {
      includeOriginal: get('opt_includeOriginal', '0') === '1',
      accuracyToggle: get('opt_accuracyToggle', '0') === '1',
      keepOnly: get('opt_keepOnly', '0') === '1',
      kurdishDigitsToggle: get('opt_kurdishDigitsToggle', '0') === '1',
      contextAwareToggle: get('opt_contextAwareToggle', '1') !== '0',
      fixOverlapToggle: get('opt_fixOverlapToggle', '0') === '1',
      addBomToggle: get('opt_addBomToggle', '0') === '1',
      crlfToggle: get('opt_crlfToggle', '0') === '1',
    };
  }

  function saveOption(key, val) {
    set('opt_' + key, val ? '1' : '0');
  }

  return {
    get,
    set,
    loadOptions,
    saveOption,
    DEFAULT_OPTIONS,
  };
})();

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined' && typeof window === 'undefined') {
  module.exports = AppStorage;
}
