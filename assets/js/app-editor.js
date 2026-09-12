/**
 * app-editor.js — Subtitle preview editor & DOM list manager.
 */
const AppEditor = (() => {
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function stripTags(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '');
  }

  /**
   * Calculates quality metrics for current work cues.
   * @param {Array} cues
   * @returns {object}
   */
  function calculateQualityStats(cues) {
    if (!Array.isArray(cues) || !cues.length) {
      return { total: 0, issues: 0, empty: 0, overlapping: 0, nonKurdish: 0, longLines: 0 };
    }

    let issues = 0;
    let empty = 0;
    let overlapping = 0;
    let nonKurdish = 0;
    let longLines = 0;

    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      const text = (cue.text || '').trim();

      if (!text) {
        empty++;
        issues++;
        continue;
      }

      if (i > 0) {
        const prev = cues[i - 1];
        if (prev && cue.start < prev.end) {
          overlapping++;
          issues++;
        }
      }

      if (typeof TranslatorOrthography !== 'undefined' && TranslatorOrthography.checkLineQuality) {
        const qual = TranslatorOrthography.checkLineQuality(text);
        if (qual.isUnnatural || qual.hasEnglishLeftovers) {
          nonKurdish++;
          issues++;
        }
      }

      if (text.length > 85) {
        longLines++;
        issues++;
      }
    }

    return {
      total: cues.length,
      issues,
      empty,
      overlapping,
      nonKurdish,
      longLines,
    };
  }

  return {
    escapeHtml,
    stripTags,
    calculateQualityStats,
  };
})();

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined' && typeof window === 'undefined') {
  module.exports = AppEditor;
}
