/**
 * app-quality.js — Kurdish Subtitle Quality Analysis, Orthography Auditing, Overlap Repair, and Naturalization.
 * Exposes AppQuality as a global module.
 */
const AppQuality = (() => {
  let appBridge = null;
  let lastQualityIssues = [];
  let currentQualityFilter = 'all';
  let currentQualityQuery = '';

  function getElements() {
    return {
      qualityModalBackdrop: document.getElementById('qualityModalBackdrop'),
      closeQualityModalBtn: document.getElementById('closeQualityModalBtn'),
      doneQualityModalBtn: document.getElementById('doneQualityModalBtn'),
      qualityScoreVal: document.getElementById('qualityScoreVal'),
      qualityIssuesCount: document.getElementById('qualityIssuesCount'),
      qualityOverlapCount: document.getElementById('qualityOverlapCount'),
      qualityAdvancedCount: document.getElementById('qualityAdvancedCount'),
      qualityCategoryTabs: document.getElementById('qualityCategoryTabs'),
      qualitySearchInput: document.getElementById('qualitySearchInput'),
      qualitySearchClear: document.getElementById('qualitySearchClear'),
      qualityIssuesList: document.getElementById('qualityIssuesList'),
      fixAllQualityBtn: document.getElementById('fixAllQualityBtn'),
      fixOverlapsNowBtn: document.getElementById('fixOverlapsNowBtn'),
      edQualityBadge: document.getElementById('edQualityBadge'),
      edQualityCheckBtn: document.getElementById('edQualityCheckBtn'),
      kurdishDigitsToggle: document.getElementById('kurdishDigitsToggle'),
    };
  }

  function getI18nText(key, fallback) {
    if (typeof UI_I18N !== 'undefined' && UI_I18N.getText) {
      return UI_I18N.getText(key) || fallback;
    }
    return fallback;
  }

  function getUiLang() {
    if (typeof UI_I18N !== 'undefined' && UI_I18N.getCurrentLang) {
      return UI_I18N.getCurrentLang();
    }
    return 'en';
  }

  function init(bridge) {
    appBridge = bridge;
    bindEvents();
  }

  function openQualityModal() {
    const els = getElements();
    if (!els.qualityModalBackdrop) return;
    runQualityInspection();
    els.qualityModalBackdrop.classList.remove('hidden');
    if (els.qualitySearchInput) {
      els.qualitySearchInput.value = '';
      currentQualityQuery = '';
    }
  }

  function closeQualityModal() {
    const els = getElements();
    if (els.qualityModalBackdrop) {
      els.qualityModalBackdrop.classList.add('hidden');
    }
  }

  function runQualityInspection() {
    if (!appBridge) return;
    const cues = appBridge.getWorkCues();
    const origCues = appBridge.getOriginalCues();
    const els = getElements();

    if (!cues || !cues.length) {
      if (els.qualityScoreVal) els.qualityScoreVal.textContent = '100%';
      if (els.edQualityBadge) els.edQualityBadge.textContent = '100%';
      if (els.qualityIssuesCount) els.qualityIssuesCount.textContent = '0';
      if (els.qualityOverlapCount) els.qualityOverlapCount.textContent = '0';
      if (els.qualityAdvancedCount) els.qualityAdvancedCount.textContent = '0';
      lastQualityIssues = [];
      renderQualityIssuesList([]);
      return;
    }

    const issuesFound = [];
    let totalScore = 0;
    let overlapCount = 0;
    let advancedCount = 0;
    let orthoCount = 0;
    let prefixCount = 0;
    let timingCount = 0;
    let idiomsLineCount = 0;

    cues.forEach((cue, index) => {
      const origCue = origCues ? origCues[index] : null;
      const srcText = origCue ? origCue.text : cue.text;
      const kurdText = cue.text || '';

      const res = (typeof Translator !== 'undefined' && Translator.checkLineQuality)
        ? Translator.checkLineQuality(kurdText, srcText)
        : { score: 100, issues: [], issueDetails: [], suggestions: [] };

      // Advanced idiom expressions check
      const advAlts = (typeof Translator !== 'undefined' && Translator.getAdvancedAlternatives)
        ? Translator.getAdvancedAlternatives(srcText)
        : [];

      // Dialogue overlap check
      let hasOverlap = false;
      if (index > 0) {
        const prevCue = cues[index - 1];
        if (prevCue && prevCue.end > cue.start) {
          hasOverlap = true;
          overlapCount++;
          const overlapMs = prevCue.end - cue.start;
          res.issues.push(getUiLang() === 'ckb' ? `تێکەڵبوونی کات لەگەڵ دێڕی پێشوو (${overlapMs}ms)` : `Timing overlap with previous line (${overlapMs}ms)`);
          res.score = Math.max(10, res.score - 15);
        }
      }

      // Determine categories for this line
      const categories = new Set();
      if (res.issueDetails && res.issueDetails.length > 0) {
        res.issueDetails.forEach((d) => {
          if (d.category) categories.add(d.category);
        });
      }
      res.issues.forEach((iss) => {
        if (/ڕێنووس|پیت|Arabic|letter|alphabet|glyph|tatweel|hamza/i.test(iss)) categories.add('orthography');
        else if (/پێشگر|دیالۆگ|prefix|affix|verbal|dialogue/i.test(iss)) categories.add('prefix');
        else if (/کات|overlap|duration|timing|length|درێژی/i.test(iss)) categories.add('timing');
      });
      if (hasOverlap) categories.add('timing');
      if (advAlts.length > 0) {
        categories.add('idioms');
        advancedCount += advAlts.length;
      }

      totalScore += res.score;

      const hasLineIssues = res.issues.length > 0 || advAlts.length > 0 || hasOverlap;
      if (hasLineIssues) {
        if (categories.has('orthography')) orthoCount++;
        if (categories.has('prefix')) prefixCount++;
        if (categories.has('timing')) timingCount++;
        if (categories.has('idioms')) idiomsLineCount++;

        issuesFound.push({
          index: index + 1,
          cueIndex: index,
          start: cue.start,
          end: cue.end,
          srcText,
          kurdText,
          score: res.score,
          issues: res.issues,
          issueDetails: res.issueDetails || [],
          categories: Array.from(categories),
          suggestions: res.suggestions,
          advancedAlternatives: advAlts,
          hasOverlap,
        });
      }
    });

    const avgScore = Math.max(10, Math.min(100, Math.round(totalScore / Math.max(1, cues.length))));
    if (els.qualityScoreVal) els.qualityScoreVal.textContent = `${avgScore}%`;
    if (els.edQualityBadge) {
      els.edQualityBadge.textContent = `${avgScore}%`;
      els.edQualityBadge.classList.toggle('warning', avgScore < 85 && avgScore >= 60);
      els.edQualityBadge.classList.toggle('alert', avgScore < 60);
    }
    if (els.qualityIssuesCount) els.qualityIssuesCount.textContent = String(issuesFound.length);
    if (els.qualityOverlapCount) els.qualityOverlapCount.textContent = String(overlapCount);
    if (els.qualityAdvancedCount) els.qualityAdvancedCount.textContent = String(advancedCount);

    const qTabAllCount = document.getElementById('qTabAllCount');
    const qTabOrthoCount = document.getElementById('qTabOrthoCount');
    const qTabPrefixCount = document.getElementById('qTabPrefixCount');
    const qTabTimingCount = document.getElementById('qTabTimingCount');
    const qTabIdiomsCount = document.getElementById('qTabIdiomsCount');

    if (qTabAllCount) qTabAllCount.textContent = String(issuesFound.length);
    if (qTabOrthoCount) qTabOrthoCount.textContent = String(orthoCount);
    if (qTabPrefixCount) qTabPrefixCount.textContent = String(prefixCount);
    if (qTabTimingCount) qTabTimingCount.textContent = String(timingCount);
    if (qTabIdiomsCount) qTabIdiomsCount.textContent = String(idiomsLineCount);

    lastQualityIssues = issuesFound;
    renderQualityIssuesList(issuesFound);
  }

  function renderQualityIssuesList(issues) {
    const els = getElements();
    if (!els.qualityIssuesList) return;
    els.qualityIssuesList.innerHTML = '';

    const listToRender = issues || lastQualityIssues || [];
    const isCkb = getUiLang() === 'ckb';

    if (!listToRender.length) {
      els.qualityIssuesList.innerHTML = `<div class="char-empty-msg" style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
        <div style="font-weight: 600; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.25rem;">
          ${isCkb ? 'هەموو دێڕەکان بێ کێشەن و ستانداردن!' : 'All Lines Look Great!'}
        </div>
        <div>${isCkb ? 'هیچ کێشەیەکی ڕێزمانی، پیت، یان تێکەڵبوونی کات نەدۆزرایەوە.' : 'No punctuation anomalies, raw Arabic glyphs, or dialogue overlaps detected.'}</div>
      </div>`;
      return;
    }

    const query = (currentQualityQuery || '').trim().toLowerCase();
    const filterCat = currentQualityFilter || 'all';

    let visibleCount = 0;
    const frag = document.createDocumentFragment();

    listToRender.forEach((item) => {
      // Category filter check
      if (filterCat !== 'all') {
        if (filterCat === 'orthography' && !item.categories.includes('orthography')) return;
        if (filterCat === 'prefix' && !item.categories.includes('prefix')) return;
        if (filterCat === 'timing' && !item.categories.includes('timing')) return;
        if (filterCat === 'idioms' && !item.categories.includes('idioms')) return;
      }

      // Search query check
      if (query) {
        const textMatch = item.srcText.toLowerCase().includes(query) || item.kurdText.toLowerCase().includes(query);
        const issueMatch = item.issues.some((iss) => iss.toLowerCase().includes(query));
        const altMatch = (item.advancedAlternatives || []).some((alt) => alt.kurdish.toLowerCase().includes(query) || (alt.context && alt.context.toLowerCase().includes(query)));
        if (!textMatch && !issueMatch && !altMatch) return;
      }

      visibleCount++;

      const card = document.createElement('div');
      card.className = 'quality-issue-card';
      card.dataset.cueIndex = String(item.cueIndex);
      card.dataset.categories = item.categories.join(' ');

      const timeFmt = (typeof SubParser !== 'undefined') ? `${SubParser.fmtSRT(item.start)} ➔ ${SubParser.fmtSRT(item.end)}` : '';

      let tagsHtml = item.issues.map((iss) => {
        let tagClass = 'quality-issue-tag';
        if (/overlap|timing|تێکەڵبوونی/i.test(iss)) tagClass += ' warning';
        else if (/character|name|ناو/i.test(iss)) tagClass += ' info';
        return `<span class="${tagClass}">${iss}</span>`;
      }).join('');

      if (item.advancedAlternatives && item.advancedAlternatives.length > 0) {
        tagsHtml += `<span class="quality-issue-tag idiom">
          ⚡ ${isCkb ? 'دەستەواژەی پێشکەوتوو' : 'Advanced Expressions'}
        </span>`;
      }

      let altsHtml = '';
      if (item.advancedAlternatives && item.advancedAlternatives.length > 0) {
        altsHtml = `
          <div class="quality-alts-box" style="margin-top: 0.75rem; padding: 0.6rem 0.75rem; background: var(--surface-secondary, rgba(255,255,255,0.04)); border-radius: 8px; border: 1px dashed var(--border-color, rgba(255,255,255,0.15));">
            <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #94a3b8); margin-bottom: 0.4rem;">
              💡 ${isCkb ? 'پێشنیارە گونجاوەکانی کوردی (کلیک بکە بۆ جێبەجێکردن):' : 'Natural Kurdish alternatives (click to apply):'}
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
              ${item.advancedAlternatives.map((alt) => `
                <button type="button" class="alt-chip-btn" data-cue-index="${item.cueIndex}" data-rep="${alt.kurdish.replace(/"/g, '&quot;')}" style="font-size: 0.8rem; padding: 0.35rem 0.65rem; background: var(--bg-surface, #1e293b); border: 1px solid var(--accent-primary, #6366f1); border-radius: 6px; color: var(--accent-primary, #818cf8); cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; transition: all 0.15s ease;">
                  <span style="font-weight: bold;">+</span>
                  <span dir="rtl" style="font-weight: 600; font-family: 'Noto Naskh Arabic', sans-serif;">${alt.kurdish}</span>
                  ${alt.context ? `<span style="font-size: 0.7rem; opacity: 0.75;">(${alt.context})</span>` : ''}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="quality-issue-head" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: 700; font-size: 0.85rem; color: var(--accent-primary, #818cf8);">#${item.index}</span>
            <span style="font-size: 0.75rem; font-family: monospace; color: var(--text-muted, #94a3b8);">${timeFmt}</span>
          </div>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <button type="button" class="quick-fix-row-btn btn-xs" data-cue-index="${item.cueIndex}" style="font-size: 0.75rem; padding: 0.3rem 0.6rem; background: var(--accent-primary, #6366f1); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; transition: opacity 0.15s ease;">
              ⚡ ${isCkb ? 'چاکسازی خۆکار' : 'Auto Polish'}
            </button>
            <button type="button" class="goto-cue-btn btn-xs" data-cue-index="${item.cueIndex}" style="font-size: 0.75rem; padding: 0.3rem 0.6rem; background: var(--surface-secondary, rgba(255,255,255,0.06)); color: var(--text-primary, #f8fafc); border: 1px solid var(--border-color, rgba(255,255,255,0.12)); border-radius: 4px; cursor: pointer;">
              ${isCkb ? 'دەستکاری' : 'Edit'}
            </button>
          </div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.6rem;">
          ${tagsHtml}
        </div>
        <div class="quality-texts" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem;">
          <div style="padding: 0.6rem; background: var(--surface-secondary, rgba(255,255,255,0.03)); border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); color: var(--text-muted, #94a3b8); word-break: break-word;">
            <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; letter-spacing: 0.5px;">Original</div>
            <div style="line-height: 1.4;">${escapeHtml(item.srcText)}</div>
          </div>
          <div style="padding: 0.6rem; background: var(--bg-surface, rgba(0,0,0,0.25)); border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); word-break: break-word;" dir="rtl">
            <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; color: var(--text-muted, #94a3b8); letter-spacing: 0.5px;" dir="ltr">Kurdish Sorani</div>
            <div class="kurd-val-text" style="font-family: 'Noto Naskh Arabic', 'Vazirmatn', sans-serif; font-size: 14px; line-height: 1.5; color: var(--text-primary, #f8fafc);">${escapeHtml(item.kurdText)}</div>
          </div>
        </div>
        ${altsHtml}
      `;

      frag.appendChild(card);
    });

    if (visibleCount === 0) {
      els.qualityIssuesList.innerHTML = `<div class="char-empty-msg" style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted);">
        ${isCkb ? 'هیچ ئەنجامێک نەدۆزرایەوە بۆ ئەم فلتەرە.' : 'No issues found matching current filter/search.'}
      </div>`;
      return;
    }

    els.qualityIssuesList.appendChild(frag);

    // Bind item buttons
    els.qualityIssuesList.querySelectorAll('.alt-chip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cIdx = parseInt(btn.dataset.cueIndex, 10);
        const rep = btn.dataset.rep;
        if (!isNaN(cIdx) && rep && appBridge && typeof appBridge.applyCueEdit === 'function') {
          appBridge.applyCueEdit(cIdx, rep);
          btn.style.background = 'var(--accent-primary, #6366f1)';
          btn.style.color = '#fff';
          btn.textContent = '✓ Applied';
          setTimeout(() => runQualityInspection(), 250);
        }
      });
    });

    els.qualityIssuesList.querySelectorAll('.quick-fix-row-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cIdx = parseInt(btn.dataset.cueIndex, 10);
        if (!isNaN(cIdx) && appBridge) {
          const cues = typeof appBridge.getWorkCues === 'function' ? appBridge.getWorkCues() : [];
          if (cues && cues[cIdx]) {
            const kurdDigitsVal = els.kurdishDigitsToggle ? els.kurdishDigitsToggle.checked : false;
            const polished = (typeof Translator !== 'undefined' && Translator.postprocessSorani)
              ? Translator.postprocessSorani(cues[cIdx].text, { kurdishDigits: kurdDigitsVal })
              : cues[cIdx].text;
            if (typeof appBridge.applyCueEdit === 'function') {
              appBridge.applyCueEdit(cIdx, polished);
            }
            btn.textContent = '✓ Fixed';
            btn.disabled = true;
            setTimeout(() => runQualityInspection(), 250);
          }
        }
      });
    });

    els.qualityIssuesList.querySelectorAll('.goto-cue-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cIdx = parseInt(btn.dataset.cueIndex, 10);
        closeQualityModal();
        if (appBridge && typeof appBridge.scrollToCue === 'function') {
          appBridge.scrollToCue(cIdx);
        }
      });
    });
  }

  function filterQualityList() {
    const els = getElements();
    if (els.qualitySearchInput) {
      currentQualityQuery = els.qualitySearchInput.value;
      if (els.qualitySearchClear) {
        els.qualitySearchClear.classList.toggle('hidden', !currentQualityQuery);
      }
    }
    renderQualityIssuesList(lastQualityIssues);
  }

  function applyCuesToBridge(updatedCues) {
    if (!appBridge) return;
    if (typeof appBridge.setWorkCues === 'function') {
      appBridge.setWorkCues(updatedCues);
    } else if (typeof appBridge.updateCues === 'function') {
      appBridge.updateCues(updatedCues);
    } else if (typeof appBridge.applyQualityFixes === 'function') {
      appBridge.applyQualityFixes(updatedCues);
    }
  }

  function fixAllQuality() {
    if (!appBridge) return;
    const cues = typeof appBridge.getWorkCues === 'function' ? appBridge.getWorkCues() : [];
    const els = getElements();
    const isCkb = getUiLang() === 'ckb';

    if (!cues || !cues.length) {
      if (typeof Toast !== 'undefined') {
        Toast.show(isCkb ? 'هیچ ژێرنووسێک نییە بۆ چاکسازی.' : 'No subtitles to polish.', 'warning', 2000);
      }
      return;
    }

    const kurdDigitsVal = els.kurdishDigitsToggle ? els.kurdishDigitsToggle.checked : false;

    // 1. Polish all Kurdish text
    const updatedCues = cues.map((c) => {
      const pol = (typeof Translator !== 'undefined' && Translator.postprocessSorani)
        ? Translator.postprocessSorani(c.text, { kurdishDigits: kurdDigitsVal })
        : c.text;
      return { ...c, text: pol };
    });

    // 2. Fix overlaps
    let finalCues = updatedCues;
    if (typeof SubParser !== 'undefined' && SubParser.fixOverlaps) {
      finalCues = SubParser.fixOverlaps(finalCues, { mode: 'trim', minDurationMs: 600, gapMs: 20 });
    }

    applyCuesToBridge(finalCues);
    runQualityInspection();

    if (typeof Toast !== 'undefined') {
      Toast.show(
        isCkb
          ? '🎉 هەموو دێڕەکان بە ستانداردی کوردی چاککران و کاتەکان ڕێکخران!'
          : '🎉 Auto-polished all lines and resolved dialogue overlaps!',
        'success',
        3000
      );
    }
  }

  function fixDialogueOverlapsNow() {
    if (!appBridge) return;
    const cues = typeof appBridge.getWorkCues === 'function' ? appBridge.getWorkCues() : [];
    const isCkb = getUiLang() === 'ckb';

    if (!cues || !cues.length) {
      if (typeof Toast !== 'undefined') {
        Toast.show(isCkb ? 'هیچ ژێرنووسێک بارنەکراوە.' : 'No subtitles loaded.', 'warning', 2000);
      }
      return;
    }

    if (typeof SubParser !== 'undefined' && SubParser.fixOverlaps) {
      const fixed = SubParser.fixOverlaps(cues, { mode: 'trim', minDurationMs: 600, gapMs: 20 });
      applyCuesToBridge(fixed);
      runQualityInspection();
      if (typeof Toast !== 'undefined') {
        Toast.show(
          isCkb
            ? '✓ کاتی ژێرنووسە تێکەڵبووەکان بە سەرکەوتوویی ڕێکخرانەوە!'
            : '✓ Dialogue overlaps resolved and timed cleanly!',
          'success',
          2500
        );
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function bindEvents() {
    const els = getElements();

    if (els.edQualityCheckBtn) els.edQualityCheckBtn.addEventListener('click', openQualityModal);
    if (els.closeQualityModalBtn) els.closeQualityModalBtn.addEventListener('click', closeQualityModal);
    if (els.doneQualityModalBtn) els.doneQualityModalBtn.addEventListener('click', closeQualityModal);
    if (els.fixAllQualityBtn) els.fixAllQualityBtn.addEventListener('click', fixAllQuality);
    if (els.fixOverlapsNowBtn) els.fixOverlapsNowBtn.addEventListener('click', fixDialogueOverlapsNow);

    if (els.qualityCategoryTabs) {
      els.qualityCategoryTabs.querySelectorAll('.quality-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
          els.qualityCategoryTabs.querySelectorAll('.quality-tab').forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
          currentQualityFilter = tab.dataset.filter || 'all';
          renderQualityIssuesList(lastQualityIssues);
        });
      });
    }

    if (els.qualitySearchInput) {
      els.qualitySearchInput.addEventListener('input', () => filterQualityList());
    }

    if (els.qualitySearchClear) {
      els.qualitySearchClear.addEventListener('click', () => {
        if (els.qualitySearchInput) {
          els.qualitySearchInput.value = '';
          els.qualitySearchInput.focus();
        }
        filterQualityList();
      });
    }

    if (els.qualityModalBackdrop) {
      els.qualityModalBackdrop.addEventListener('click', (e) => {
        if (e.target === els.qualityModalBackdrop) closeQualityModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.qualityModalBackdrop && !els.qualityModalBackdrop.classList.contains('hidden')) {
        closeQualityModal();
      }
    });
  }

  return {
    init,
    openModal: openQualityModal,
    closeModal: closeQualityModal,
    runInspection: runQualityInspection,
    fixAll: fixAllQuality,
    fixOverlaps: fixDialogueOverlapsNow,
  };
})();
