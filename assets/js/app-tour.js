/**
 * app-tour.js — Interactive Onboarding Welcome Tour & Live Subtitle Demo.
 * Exposes AppTour as a global module.
 */
const AppTour = (() => {
  let currentTourStep = 0;
  let isTourOpen = false;
  let isDemoLoaded = false;
  let appBridge = null;

  const DEMO_CUES = [
    { index: 1, start: 800, end: 4200, text: 'Welcome to Kurdish Subtitle Translator!\nبەخێربێن بۆ وەرگێڕی ژێرنووسی کوردی!' },
    { index: 2, start: 4700, end: 8800, text: 'Translate SRT, VTT, ASS, SSA, SUB & SAMI to Kurdish Sorani.\nوەرگێڕانی هەموو جۆرەکانی ژێرنووس بۆ زمانی کوردی سۆرانی.' },
    { index: 3, start: 9300, end: 13800, text: 'Live subtitle player synced with real-time playback.\nپێشاندەری ژێرنووس بە کاتی ڕاستەقینە و هاوکات لەگەڵ مۆڵەتەکان.' },
    { index: 4, start: 14300, end: 19000, text: 'Type to edit cues live, search lines instantly, and download anytime!\nدەستکاری دەقەکان بکە بە ڕاستەوخۆ و بە ئاسانی پاشەکەوتی بکە!' }
  ];

  const TOUR_STEP_ICONS = [
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`,
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>`,
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>`
  ];

  const TOUR_STEPS = [
    {
      targetSel: '#dropzone',
      titleKey: 'tourStep1Title',
      textKey: 'tourStep1Text',
      badge: '1 / 5',
      showPrev: false,
      nextKey: 'tourNext',
      ensureTab: 'translate',
      onEnter: () => {
        if (appBridge) {
          appBridge.showStep('upload');
          appBridge.switchTab('translate');
        }
      }
    },
    {
      targetSel: '#stepSettings',
      titleKey: 'tourStep2Title',
      textKey: 'tourStep2Text',
      badge: '2 / 5',
      showPrev: true,
      nextKey: 'tourNext',
      ensureTab: 'translate',
      onEnter: () => {
        if (appBridge) {
          isDemoLoaded = true;
          if (!appBridge.hasParsedData()) {
            appBridge.loadDemoCues(DEMO_CUES, 'demo_movie.srt');
          }
          appBridge.showStep('settings');
          appBridge.switchTab('translate');
        }
      }
    },
    {
      targetSel: '.player-card',
      titleKey: 'tourStep3Title',
      textKey: 'tourStep3Text',
      badge: '3 / 5',
      showPrev: true,
      nextKey: 'tourNext',
      ensureTab: 'preview',
      onEnter: () => {
        if (appBridge) {
          isDemoLoaded = true;
          appBridge.loadDemoCues(DEMO_CUES, 'demo_movie_subtitles.srt');
          appBridge.switchTab('preview');
          if (typeof SubtitlePlayer !== 'undefined') {
            SubtitlePlayer.seek(0);
            SubtitlePlayer.play();
          }
        }
      }
    },
    {
      targetSel: '.editor-card',
      titleKey: 'tourStep4Title',
      textKey: 'tourStep4Text',
      badge: '4 / 5',
      showPrev: true,
      nextKey: 'tourNext',
      ensureTab: 'preview',
      onEnter: () => {
        if (appBridge) {
          isDemoLoaded = true;
          if (!appBridge.hasParsedData()) {
            appBridge.loadDemoCues(DEMO_CUES, 'demo_movie_subtitles.srt');
          }
          appBridge.switchTab('preview');
        }
      }
    },
    {
      targetSel: '#edQualityCheckBtn',
      titleKey: 'tourStep5Title',
      textKey: 'tourStep5Text',
      badge: '5 / 5',
      showPrev: true,
      nextKey: 'tourDone',
      ensureTab: 'preview',
      onEnter: () => {
        if (appBridge) {
          isDemoLoaded = true;
          if (!appBridge.hasParsedData()) {
            appBridge.loadDemoCues(DEMO_CUES, 'demo_movie_subtitles.srt');
          }
          appBridge.switchTab('preview');
        }
      }
    }
  ];

  function getElements() {
    return {
      tourOverlay: document.getElementById('tourOverlay'),
      tourBackdrop: document.getElementById('tourBackdrop'),
      tourHighlight: document.getElementById('tourHighlight'),
      tourCard: document.getElementById('tourCard'),
      tourStepBadge: document.getElementById('tourStepBadge'),
      tourCloseBtn: document.getElementById('tourCloseBtn'),
      tourTitle: document.getElementById('tourTitle'),
      tourText: document.getElementById('tourText'),
      tourSkipBtn: document.getElementById('tourSkipBtn'),
      tourPrevBtn: document.getElementById('tourPrevBtn'),
      tourNextBtn: document.getElementById('tourNextBtn'),
      tourTriggerBtn: document.getElementById('tourTriggerBtn'),
    };
  }

  function getI18nText(key, fallback) {
    if (typeof UI_I18N !== 'undefined' && UI_I18N.getText) {
      return UI_I18N.getText(key) || fallback;
    }
    return fallback;
  }

  function init(bridge) {
    appBridge = bridge;
    bindTour();
    checkAutoStart();
  }

  function checkAutoStart() {
    try {
      const seen = localStorage.getItem('kurdish_tour_seen');
      if (!seen) {
        setTimeout(() => {
          if (!appBridge || !appBridge.isUserFileLoaded()) {
            openTour(0);
          }
        }, 1200);
      }
    } catch {}
  }

  function openTour(stepIndex = 0) {
    if (appBridge && appBridge.isUserFileLoaded() && !isDemoLoaded) {
      return;
    }
    const els = getElements();
    if (!els.tourOverlay) return;

    currentTourStep = stepIndex;
    isTourOpen = true;
    els.tourOverlay.classList.remove('hidden');
    els.tourOverlay.setAttribute('aria-hidden', 'false');
    renderTourStep(currentTourStep);

    window.addEventListener('resize', handleTourReposition);
    window.addEventListener('scroll', handleTourReposition, { passive: true });
    window.addEventListener('keydown', handleTourKeydown);
  }

  function closeTour(markSeen = true) {
    const els = getElements();
    if (!els.tourOverlay) return;

    isTourOpen = false;
    els.tourOverlay.classList.add('hidden');
    els.tourOverlay.setAttribute('aria-hidden', 'true');

    window.removeEventListener('resize', handleTourReposition);
    window.removeEventListener('scroll', handleTourReposition);
    window.removeEventListener('keydown', handleTourKeydown);

    if (markSeen) {
      try {
        localStorage.setItem('kurdish_tour_seen', '1');
      } catch {}
    }

    if (isDemoLoaded && appBridge) {
      isDemoLoaded = false;
      if (appBridge.resetTourDemo) {
        appBridge.resetTourDemo();
      } else if (appBridge.resetDemo) {
        appBridge.resetDemo();
      }
    }
    updateTourTriggerBtnState();
  }

  function refresh() {
    if (isTourOpen) {
      renderTourStep(currentTourStep);
    }
    updateTourTriggerBtnState();
  }

  function renderTourStep(index) {
    if (index < 0 || index >= TOUR_STEPS.length) {
      closeTour(true);
      return;
    }
    currentTourStep = index;
    const step = TOUR_STEPS[index];
    const els = getElements();

    if (step.onEnter) {
      step.onEnter();
    }

    if (els.tourTitle) els.tourTitle.textContent = getI18nText(step.titleKey, '');
    if (els.tourText) els.tourText.textContent = getI18nText(step.textKey, '');
    if (els.tourStepBadge) els.tourStepBadge.textContent = step.badge;

    const iconBadge = document.getElementById('tourIconBadge');
    if (iconBadge && TOUR_STEP_ICONS[index]) {
      iconBadge.innerHTML = TOUR_STEP_ICONS[index];
    }

    const dots = document.querySelectorAll('.tour-dot');
    dots.forEach((dot, dIdx) => {
      dot.classList.toggle('active', dIdx === index);
    });

    if (els.tourPrevBtn) {
      els.tourPrevBtn.classList.toggle('hidden', !step.showPrev);
      els.tourPrevBtn.textContent = getI18nText('tourPrev', 'Back');
    }
    if (els.tourNextBtn) {
      els.tourNextBtn.textContent = getI18nText(step.nextKey, index === TOUR_STEPS.length - 1 ? 'Got it!' : 'Next');
    }
    if (els.tourSkipBtn) {
      els.tourSkipBtn.textContent = getI18nText('tourSkip', 'Skip tour');
    }

    setTimeout(() => {
      positionTourElements(step.targetSel);
    }, 80);
  }

  function positionTourElements(targetSel) {
    const els = getElements();
    const target = document.querySelector(targetSel);
    if (!target || !els.tourHighlight || !els.tourCard) return;

    const rect = target.getBoundingClientRect();
    const isOutOfView = rect.top < 60 || rect.bottom > (window.innerHeight - 60);
    if (isOutOfView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => updateTourGeometry(target), 200);
    } else {
      updateTourGeometry(target);
    }
  }

  function updateTourGeometry(target) {
    const els = getElements();
    if (!target || !els.tourHighlight || !els.tourCard) return;
    const rect = target.getBoundingClientRect();
    const pad = 6;
    const isMobile = window.innerWidth <= 640;

    els.tourHighlight.style.top = `${Math.max(0, rect.top - pad)}px`;
    els.tourHighlight.style.left = `${Math.max(0, rect.left - pad)}px`;
    els.tourHighlight.style.width = `${rect.width + pad * 2}px`;
    els.tourHighlight.style.height = `${rect.height + pad * 2}px`;

    if (!isMobile) {
      const cardWidth = 360;
      const cardHeight = els.tourCard.offsetHeight || 210;

      let top = rect.bottom + 14;
      let left = rect.left + (rect.width / 2) - (cardWidth / 2);

      if (top + cardHeight > window.innerHeight - 16) {
        top = Math.max(16, rect.top - cardHeight - 14);
      }

      left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left));

      els.tourCard.style.top = `${top}px`;
      els.tourCard.style.left = `${left}px`;
      els.tourCard.style.bottom = 'auto';
      els.tourCard.style.right = 'auto';
    }
  }

  function handleTourReposition() {
    if (!isTourOpen) return;
    const step = TOUR_STEPS[currentTourStep];
    if (step) {
      const target = document.querySelector(step.targetSel);
      if (target) updateTourGeometry(target);
    }
  }

  function handleTourKeydown(e) {
    if (!isTourOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeTour(true);
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (currentTourStep < TOUR_STEPS.length - 1) {
        renderTourStep(currentTourStep + 1);
      } else {
        closeTour(true);
      }
    } else if (e.key === 'ArrowLeft') {
      if (currentTourStep > 0) {
        renderTourStep(currentTourStep - 1);
      }
    }
  }

  function updateTourTriggerBtnState() {
    const els = getElements();
    if (els.tourTriggerBtn && appBridge) {
      const isLoaded = appBridge.isUserFileLoaded();
      els.tourTriggerBtn.disabled = isLoaded;
      els.tourTriggerBtn.style.opacity = isLoaded ? '0.5' : '1';
      els.tourTriggerBtn.style.pointerEvents = isLoaded ? 'none' : 'auto';
    }
  }

  function bindTour() {
    const els = getElements();

    if (els.tourTriggerBtn) {
      els.tourTriggerBtn.addEventListener('click', () => {
        openTour(0);
      });
    }

    if (els.tourCloseBtn) {
      els.tourCloseBtn.addEventListener('click', () => closeTour(true));
    }

    if (els.tourSkipBtn) {
      els.tourSkipBtn.addEventListener('click', () => closeTour(true));
    }

    if (els.tourNextBtn) {
      els.tourNextBtn.addEventListener('click', () => {
        if (currentTourStep < TOUR_STEPS.length - 1) {
          renderTourStep(currentTourStep + 1);
        } else {
          closeTour(true);
        }
      });
    }

    if (els.tourPrevBtn) {
      els.tourPrevBtn.addEventListener('click', () => {
        if (currentTourStep > 0) {
          renderTourStep(currentTourStep - 1);
        }
      });
    }

    const dots = document.querySelectorAll('.tour-dot');
    dots.forEach((dot) => {
      dot.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.stepIndex, 10);
        if (!isNaN(idx)) renderTourStep(idx);
      });
    });

    if (els.tourBackdrop) {
      els.tourBackdrop.addEventListener('click', () => closeTour(true));
    }
  }

  function setDemoLoaded(loaded) {
    isDemoLoaded = !!loaded;
  }

  return {
    init,
    openTour,
    closeTour,
    renderTourStep,
    refresh,
    isOpen: () => isTourOpen,
    isDemoActive: () => isDemoLoaded,
    DEMO_CUES,
    setDemoLoaded,
    updateTriggerState: updateTourTriggerBtnState,
  };
})();
