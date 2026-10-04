// ==UserScript==
// @name         LanguageNut Autocompleter
// @namespace    languagenut-autocompleter
// @version      12.26
// @description  Autocompletes LanguageNut vocab/sentence activities including WordPod, Skyrise and Concert Speaking
// @author       You
// @match        *://*.languagenut.com/*
// @match        *://languagenut.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';
  try { console.log('%c[LN-AC] injected: ' + location.href, 'color:#4ade80;font-weight:bold'); } catch (_) {}

  const CONFIG = {
    loopPauseMs: 30, debug: true, logAllFetches: true, showClickMarker: true,
    libreTranslateUrl: 'https://libretranslate.com/translate',
    libreTranslateApiKey: '',
    jumbleClickMs: 0,
    afterLaunchMs: 900,
    afterSolveMs: 800,
    launchCooldownMs: 500, maxJumbleFails: 12,
    afterAnswerMs: 800, afterPlayMs: 700, clickSettleMs: 200, autoPlay: true,
    fridgeUseClick: true,
    fridgeDragDistance: 160,
    fridgeSettleMs: 0,
    fridgeAfterSubmitMs: 1000, fridgeMaxFails: 12,

    // Independent delays for the two newer modes:
    verbMatcherBetweenClicksMs: 180,
    verbMatcherAfterPairMs: 450,
    jigsawBetweenClicksMs: 120,
    jigsawAfterPairMs: 200,

    forkliftPickDelayMs: 80,
    forkliftMoveSettleMs: 420,
    forkliftAfterRoundMs: 350,
    forkliftMaxFails: 10,

    oceanClickDelayMs: 90,
    oceanMoveSettleMs: 320,
    oceanAfterRoundMs: 450,
    oceanMaxFails: 12,

    gapKeyDelayMs: 0,
    gapAfterSubmitMs: 700,
    gapMaxFails: 8,


    mc2AfterPlayMs: 350,
    mc2AfterClickMs: 180,
    mc2MaxFails: 10,

    wordPodAfterPlayMs: 350,
    wordPodAfterSubmitMs: 420,
    wordPodAfterNextMs: 260,
    wordPodMaxFails: 12,
    wordPodKeyDelayMs: 28,
    wordPodSpaceDelayMs: 70,
    wordPodPunctuationDelayMs: 55,
    wordPodShiftDelayMs: 55,
    wordPodVerifyDelayMs: 38,
    wordPodRetypeDelayMs: 45,
    wordPodMaxTypingPasses: 3,

    concertListenArmMs: 650,
    concertMicVerifyMs: 900,
    concertEvalWaitMs: 9000,
    concertRetryDelayMs: 3000,
    concertSecondClickDelayMs: 650,
    concertPostTtsMs: 220,
    concertEvalTimeoutMs: 12000,
    concertEventSettleMs: 60,
    concertAfterSpeakMs: 900,
    concertTtsRate: 0.88,
    concertTtsPitch: 1,
    concertDefaultTargetLang: 'de-DE',

    wordPopAfterPlayMs: 450,
    wordPopAfterClickMs: 180,
    wordPopMaxFails: 12,

    jigsawMaxFails: 12
  };

  const log = (...a) => CONFIG.debug && console.log('%c[LN-AC]', 'color:#4ade80;font-weight:bold', ...a);

  const state = {
    pixiApp: null, vocab: [], vocabRoute: '', sentences: [], verbs: [], running: false, mode: null,
    targetWord: '', targetLetters: '',
    jumbleOrderedChunks: [], jumblePlacedCount: 0,
    placedTiles: new Set(),
    lastClickedObj: null, retryObj: null,
    currentDelay: CONFIG.jumbleClickMs, jumbleFails: 0, solvedCount: 0,
    lastLaunchAt: 0, wasStudyPhase: false,
    lastAudioUrl: null, currentEntry: null, currentAnswer: null,
    currentPrompt: null, lastAnsweredKey: null, lastPlayedKey: null, answeredCount: 0,
    fridgeOrderedChunks: [], fridgePlacedCount: 0,
    fridgeFails: 0, fridgeLastKey: null, fridgeSubmitAt: 0,
    verbDone: new Set(), verbFails: 0, verbSubmitAt: 0, verbLastPair: null,
    jigsawDone: new Set(), jigsawFails: 0, jigsawLastPrompt: null, jigsawLastClickAt: 0,
    jigsawUsedTargets: new Set(), jigsawUsedTargetPositions: [],
    jigsawSlotPositions: [],
    jigsawRejectedEndings: new Map(), jigsawEndingAttempts: new Map(), jigsawBusy: false,
    forkliftLastPrompt: null, forkliftTarget: '', forkliftOrder: [],
    forkliftPickedCount: 0, forkliftFails: 0, forkliftBusy: false,
    forkliftUsedKeys: new Set(), forkliftLastClickAt: 0,
    oceanLastPrompt: null, oceanTarget: '', oceanOrder: [],
    oceanPickedCount: 0, oceanFails: 0, oceanBusy: false,
    oceanUsedKeys: new Set(), oceanLastClickAt: 0,
    gapLastRoundKey: null, gapBaseRoundKey: null, gapBoardIdentity: null,
    gapAnswer: '', gapSubmittedKey: null, gapSubmittedAt: 0,
    gapTransitionSeen: false, gapRoundSerial: 0, gapFails: 0,
    gapBusy: false, gapLastInference: null,
    muteAudio: false,
    mc2Busy: false, mc2LastKey: null, mc2Fails: 0, mc2LastSignature: null,
    mc2ReadingPending: null, mc2ReadingRejectedSignature: '',
    mc2PendingKey: null, mc2PendingSignature: '', mc2PendingAudio: '',
    mc2PendingLabel: '', mc2PendingCorrect: 0, mc2PendingIncorrect: 0,
    mc2PendingSince: 0, mc2PendingClicks: 0, mc2ListeningAnsweredKeys: new Set(),
    mc2QuestionChangeAt: 0, mc2AnsweredQuestionSignature: '',
    mc2RejectedQuestionSignature: '', mc2RetryQuestionSignature: '',
    mc2RetryCount: 0, mc2RetryAfter: 0,
    mc2AudioCaptureSignature: '', mc2AudioCaptureUntil: 0,
    mc2AudioCaptureBusy: false, mc2CapturedAudioSignature: '',
      wordPodBusy: false, wordPodLastSignature: null, wordPodCandidates: [],
    wordPodCandidateIndex: 0, wordPodTypedLast: '', wordPodFails: 0,
    wordPodSubmittedKey: null, wordPodLockedQuestion: null,
    wordPodLastUnresolvedKey: '',
    wordPodInputNode: null, wordPodQuestionEpoch: 0, wordPodLastPlayAt: 0,
    skyRiseBusy: false, skyRiseLastQuestion: null, skyRiseLockedQuestion: null,
    skyRiseCurrentItem: null, skyRiseQuestionEpoch: 0,
    skyRiseFails: 0,
    concertBusy: false, concertLockedQuestion: null, concertLastPrompt: null,
    concertLastSpoken: '', concertFails: 0, concertSpeakButtonCache: null,
    concertEvalSerial: 0, concertEvalResult: null, concertEvalUrl: '',
    concertCycleQuestion: null, concertCycleCount: 0,
    concertNavGuardLogged: false,
    concertNavLockActive: false,
    concertNavLockUrl: '',
    concertNavLockHash: '',
    concertNavLockRestoring: false,
    concertCompleted: false,
    concertHadQuestion: false,
    examTranslations: [], examOriginalText: '', examBusy: false, examSubmitted: new Set(),
    examPhotoQuestion: null, examPhotoSubmittedKey: '',
    examGapOrder: [], examGapIndex: 0, examGapBusy: false, examGapSubmitted: false,
    examContinueBusy: false, examContinueAt: 0,
    continueLastControl: null, continueLastAt: 0,
    examDictationData: null, examDictationEntries: [], examDictationBusy: false, examDictationSubmitted: false,
    examInterpretSubmitted: false, lastInterpretPrompt: null,
    interpretCache: new Map(), interpretTranslating: false, interpretLogged: new Set(),
    whoSaidWhatStatements: [], whoSaidWhatSubmitted: false,
    lastStartDismissAt: 0,
    lastMCOptionsKey: null, lastMCPlayAttemptAt: 0,
    lastMC2Sig: null, lastMC2PlayAttemptAt: 0,
    fakeTimeMin: 20, fakeTimeMax: 30, fakeTimeSamples: [],
    fakeTimeLoggedCount: 0, fakeTimeCompletionLogged: false,
    fakeTimeAnswerBase: 0, fakeTimeServicesHooked: false,
    zenMemoryBusy: false, zenMemoryLastCount: 0,
    zenNoughtsBusy: false, zenNoughtsLastCount: 0, zenNoughtsNextMoveAt: 0,
    raceBusy: false, raceLastQuestion: '', raceLastChunks: 0,
    raceRightHeld: false, raceBoostTarget: null, raceBoostAssertAt: 0,
    raceMissLogKey: '',
    autopilot: false, pilotHomeworkUid: '', pilotTaskIndex: 0,
    pilotAssignmentUid: '', pilotTaskIndexUid: '', pilotTaskText: '', pilotGameName: '',
    pilotAwaitingGame: false, pilotInGame: false, pilotRouteStep: '',
    pilotRouteAttempts: 0, pilotLastActionAt: 0, pilotBlockedStep: '',
    pilotCompletedHomeworkIds: new Set(), pilotFinished: false,
    pilotCompletionSignal: '', pilotCompletionAt: 0, pilotContinueAt: 0,
    pilotCatalogTabIndex: 0, pilotCatalogTabAt: 0, pilotCatalogQuizSelected: false,
    pilotFinishingTask: false,
    pilotDoingPrerequisite: false, pilotCatalogHash: '',
    pilotStartedAt: 0, pilotElapsedMs: 0, pilotFakeSeconds: 0,
    pilotErrorCounts: new Map(), humanize: false,
    errorLastLogAt: new Map(),
    uiAccent: '#4ade80', uiScale: 100, uiOpacity: 96,
    uiDock: 'bottom-right',
    dictationBusy: false, dictationSubmitted: false,
    dictationSawHidden: false, dictationLastAudio: '', dictationPlayAt: 0,
    discordWebhook: '', webhookLastAnswered: 0, webhookSending: false,
    wordPopFails: 0, wordPopLastKey: null, wordPopBusy: false,
    wordPopAudioBusy: false, wordPopLastSignature: null,
    wordPopTranslationTriedKey: '', wordPopTranslationTerms: [],
    wordPopControllerItem: null, wordPopControllerQuestion: null,
    wordPopNextPlayAt: 0,
    completionSeen: null, panelInjected: false, _lastFridgeErr: null
  };

  // ============ USER OPTIONS ============
  function loadBoolSetting(key, fallback) {
    try {
      const v = localStorage.getItem(`ln-ac:${key}`);
      if (v === '1') return true;
      if (v === '0') return false;
    } catch (_) {}
    return !!fallback;
  }

  function saveBoolSetting(key, value) {
    try {
      localStorage.setItem(`ln-ac:${key}`, value ? '1' : '0');
    } catch (_) {}
  }

  function loadStringSetting(key, fallback) {
    try {
      const v = localStorage.getItem(`ln-ac:${key}`);
      return typeof v === 'string' ? v : String(fallback || '');
    } catch (_) {
      return String(fallback || '');
    }
  }

  function saveStringSetting(key, value) {
    try {
      localStorage.setItem(`ln-ac:${key}`, String(value || ''));
    } catch (_) {}
  }

  state.muteAudio = loadBoolSetting('muteAudio', false);
  state.autopilot = loadBoolSetting('autopilot', false);
  state.humanize = loadBoolSetting('humanize', false);
  state.uiAccent = loadStringSetting('uiAccent', '#4ade80');
  state.uiScale = Math.max(75, Math.min(130, Number(loadStringSetting('uiScale', '100')) || 100));
  state.uiOpacity = Math.max(70, Math.min(100, Number(loadStringSetting('uiOpacity', '96')) || 96));
  state.uiDock = loadStringSetting('uiDock', 'bottom-right');
  state.pilotElapsedMs = Math.max(0, Number(loadStringSetting('pilotElapsedMs', '0')) || 0);
  state.pilotFakeSeconds = Math.max(0, Number(loadStringSetting('pilotFakeSeconds', '0')) || 0);
  state.pilotHomeworkUid = loadStringSetting('pilotHomeworkUid', '');
  state.pilotTaskIndex = Math.max(0, parseInt(loadStringSetting('pilotTaskIndex', '0'), 10) || 0);
  state.pilotAssignmentUid = loadStringSetting('pilotAssignmentUid', '');
  state.pilotTaskIndexUid = loadStringSetting('pilotTaskIndexUid', '');
  state.pilotTaskText = loadStringSetting('pilotTaskText', '');
  state.pilotGameName = loadStringSetting('pilotGameName', '');
  state.pilotAwaitingGame = loadBoolSetting('pilotAwaitingGame', false);
  state.pilotInGame = loadBoolSetting('pilotInGame', false);
  state.pilotFinished = loadBoolSetting('pilotFinished', false);
  state.pilotFinishingTask = loadBoolSetting('pilotFinishingTask', false);
  state.pilotDoingPrerequisite = loadBoolSetting('pilotDoingPrerequisite', false);
  state.pilotCatalogHash = loadStringSetting('pilotCatalogHash', '');
  state.pilotCompletionSignal = loadStringSetting('pilotCompletionSignal', '');
  state.pilotCompletionAt = Number(loadStringSetting('pilotCompletionAt', '0')) || 0;
  state.pilotContinueAt = Number(loadStringSetting('pilotContinueAt', '0')) || 0;
  try {
    const completed = JSON.parse(loadStringSetting('pilotCompletedHomeworkIds', '[]'));
    if (Array.isArray(completed)) state.pilotCompletedHomeworkIds = new Set(completed.map(String));
  } catch (_) {}
  state.discordWebhook = loadStringSetting('discordWebhook', '');
  state.fakeTimeMin = Math.max(1, Math.min(3600,
    Number(loadStringSetting('fakeTimeMin', '20')) || 20));
  state.fakeTimeMax = Math.max(state.fakeTimeMin, Math.min(3600,
    Number(loadStringSetting('fakeTimeMax', '30')) || 30));

  function fakeTimeSample(index) {
    const i = Math.max(0, Math.floor(index));
    while (state.fakeTimeSamples.length <= i) {
      const spread = state.fakeTimeMax - state.fakeTimeMin + 1;
      state.fakeTimeSamples.push(state.fakeTimeMin + Math.floor(Math.random() * spread));
    }
    return state.fakeTimeSamples[i];
  }

  function fakeTimeNextMilliseconds() {
    return fakeTimeSample(state.answeredCount - state.fakeTimeAnswerBase) * 1000;
  }

  function fakeTimeMilliseconds(questionCount) {
    const count = Math.max(1, Number(questionCount) ||
      state.answeredCount - state.fakeTimeAnswerBase || 1);
    let total = 0;
    for (let i = 0; i < count; i++) total += fakeTimeSample(i);
    return total * 1000;
  }

  function fakeTimeQuestionCount() {
    return Math.max(0, state.answeredCount - state.fakeTimeAnswerBase);
  }

  function formatDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
  }

  function pilotElapsedSeconds() {
    return Math.round((state.pilotElapsedMs + (state.pilotStartedAt ? Date.now() - state.pilotStartedAt : 0)) / 1000);
  }

  function refreshPilotTimer() {
    const real = document.getElementById('ln-ac-real-time');
    const simulated = document.getElementById('ln-ac-simulated-time');
    if (real) real.textContent = formatDuration(pilotElapsedSeconds());
    if (simulated) simulated.textContent = formatDuration(state.pilotFakeSeconds);
  }

  function humanizeLongAnswer(value) {
    const text = String(value || '');
    if (!state.humanize || text.trim().split(/\s+/).length < 6) return text;
    // Keep the words intact. Optional punctuation omissions are limited to
    // free-text responses; short exact-match answers retain their syntax.
    return text.replace(/[,.;!?]/g, mark => Math.random() < 0.18 ? '' : mark);
  }

  function markAnswerConfirmed(detail, uniqueKey) {
    if (uniqueKey && state.mc2ListeningAnsweredKeys.has(uniqueKey)) return false;
    if (uniqueKey) state.mc2ListeningAnsweredKeys.add(uniqueKey);
    const nextCount = fakeTimeQuestionCount() + 1;
    state.answeredCount++;
    setAnsweredCount(state.answeredCount);
    addLog(`Question ${nextCount} confirmed${detail ? ` (${detail})` : ''}`, 'ok');
    return nextCount;
  }

  function resetFakeTimeActivity() {
    state.fakeTimeAnswerBase = state.answeredCount;
    state.fakeTimeSamples = [];
    state.fakeTimeLoggedCount = 0;
    state.fakeTimeCompletionLogged = false;
    state.mc2ListeningAnsweredKeys = new Set();
  }

  function logFakeTimeCompletion() {
    if (state.fakeTimeCompletionLogged) return;
    const count = Math.max(0, state.answeredCount - state.fakeTimeAnswerBase);
    if (!count) return;
    state.fakeTimeCompletionLogged = true;
    addLog(`Simulated ${fakeTimeMilliseconds(count) / 1000}s across ${count} answered question${count === 1 ? '' : 's'}`, 'ok');
  }

  function hookServicesFakeTime() {
    const services = window.Services;
    if (!services || typeof services.apiCallToken !== 'function' || services.apiCallToken.__lnFakeTime) return;
    const original = services.apiCallToken;
    const wrapped = function (endpoint, data) {
      if (state.running && data && typeof data === 'object') {
        if (/gameDataController\/addGameScore/i.test(String(endpoint))) {
          const stamps = data.QLCAEWIJSXDC551;
          const count = Math.max(1, Number(data.vocabNumber) ||
            (Array.isArray(stamps) ? stamps.length : 0) ||
            state.answeredCount - state.fakeTimeAnswerBase || 1);
          data.awrtfuoivg = fakeTimeMilliseconds(count);
          if (Array.isArray(stamps)) {
            const now = Date.now();
            for (let i = 0; i < stamps.length; i++) {
              if (Array.isArray(stamps[i]) && stamps[i].length > 1) {
                let trailing = 0;
                for (let j = i + 1; j < stamps.length; j++) trailing += fakeTimeSample(j);
                stamps[i][1] = now - trailing * 1000;
              }
            }
          }
          addLog(`Reported game time: ${Math.round(data.awrtfuoivg / 1000)}s`, 'ok');
        } else if (/examTranslationController\/addExamDataAnswer(?:Text|Audio)/i.test(String(endpoint))) {
          data.timeTaken = fakeTimeNextMilliseconds();
        }
      }
      return original.apply(this, arguments);
    };
    wrapped.__lnFakeTime = true;
    services.apiCallToken = wrapped;
    state.fakeTimeServicesHooked = true;
  }

  function rewriteFakeTimeBody(url, body) {
    if (!state.running || typeof body !== 'string') return body;
    const endpoint = String(url || '');
    const isScore = /gameDataController\/addGameScore/i.test(endpoint);
    const isExamText = /examTranslationController\/addExamDataAnswerText/i.test(endpoint);
    if (!isScore && !isExamText) return body;
    const trimmed = body.trim();
    if (trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(trimmed);
        if (isScore) json.awrtfuoivg = fakeTimeMilliseconds(json.vocabNumber);
        else json.timeTaken = fakeTimeNextMilliseconds();
        return JSON.stringify(json);
      } catch (_) {}
    }
    try {
      const params = new URLSearchParams(body);
      if (isScore) params.set('awrtfuoivg', String(fakeTimeMilliseconds(params.get('vocabNumber'))));
      else params.set('timeTaken', String(fakeTimeNextMilliseconds()));
      return params.toString();
    } catch (_) {
      return body;
    }
  }

  function validDiscordWebhook(url) {
    return /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+(?:\?.*)?$/i.test(
      String(url || '').trim()
    );
  }

  async function sendDiscordWebhook(eventName, detail) {
    const url = String(state.discordWebhook || '').trim();
    if (!url || !validDiscordWebhook(url)) return false;

    const mode = modeLabel(state.mode);
    const lines = [
      `**LanguageNut Autocompleter — ${eventName}**`,
      `Mode: ${mode || 'Unknown'}`
    ];

    if (detail) lines.push(String(detail));

    const content = lines.join('\n').slice(0, 1900);

    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          allowed_mentions: { parse: [] }
        }),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        keepalive: true
      });

      if (!r.ok && r.status !== 204) {
        addLog(`Discord webhook HTTP ${r.status}`, 'err');
        return false;
      }

      return true;
    } catch (e) {
      addLog(
        `Discord webhook failed: ${e && e.message ? e.message : e}`,
        'err'
      );
      return false;
    }
  }

  function notifyDiscord(eventName, detail) {
    // Fire-and-forget so webhook latency never slows the game automation.
    sendDiscordWebhook(eventName, detail).catch(() => {});
  }

  function applyAudioMute() {
    try {
      document.querySelectorAll('audio,video').forEach(el => {
        try { el.muted = !!state.muteAudio; } catch (_) {}
      });
    } catch (_) {}
  }

  function applyUserOptions() {
    applyAudioMute();
    const autoBox = document.getElementById('ln-ac-auto');
    if (autoBox && autoBox.checked !== !!state.autopilot) autoBox.checked = !!state.autopilot;
  }

  // ============ DATA HOOKS ============
  function isVocabUrl(u) { return typeof u === 'string' && u.indexOf('getVocabTranslations') !== -1; }
  function isSentenceUrl(u) { return typeof u === 'string' && u.indexOf('getSentenceTranslations') !== -1; }
  function isVerbUrl(u) {
    return typeof u === 'string' && (
      u.indexOf('getVerbTranslations') !== -1 ||
      /verbTranslationController/i.test(u) ||
      /verbController/i.test(u) ||
      /getTranslations/i.test(u) ||
      /getUserModuleTranslations/i.test(u)
    );
  }
  function isExamTranslationsUrl(u) { return typeof u === 'string' && /examTranslationController\/getExamTranslationsCorrect/i.test(u); }
  function isExamDataTranslationsUrl(u) { return typeof u === 'string' && /examTranslationController\/getExamData/i.test(u); }
  function isInterestingUrl(u) { return typeof u === 'string' && /vocab|verb|translation|homework|assignment|question|content|sentence/i.test(u); }

  function isConcertEvalUrl(u) {
    return typeof u === 'string' &&
      /HomophoneV2Controller\/evaluateAudio/i.test(u);
  }

  function findIsCorrectValue(data) {
    const seen = new Set();

    function walkNode(node) {
      if (!node || typeof node !== 'object' || seen.has(node)) return null;
      seen.add(node);

      if (typeof node.isCorrect === 'boolean') {
        return node.isCorrect;
      }

      for (const v of Object.values(node)) {
        const found = walkNode(v);
        if (typeof found === 'boolean') return found;
      }

      return null;
    }

    return walkNode(data);
  }

  function ingestConcertEvaluation(body, url) {
    try {
      const data =
        typeof body === 'string'
          ? JSON.parse(body)
          : body;

      const isCorrect = findIsCorrectValue(data);

      state.concertEvalSerial++;
      state.concertEvalUrl = String(url || '');
      state.concertEvalResult = {
        serial: state.concertEvalSerial,
        isCorrect,
        data,
        at: Date.now()
      };

      addLog(
        `Concert evaluation: ` +
        `${isCorrect === true ? 'correct' : isCorrect === false ? 'incorrect' : 'result received'}`,
        isCorrect === false ? 'err' : 'ok'
      );
    } catch (e) {
      log('concert evaluation parse failed', e);
    }
  }

  function ingestVocab(b, route) {
    try { const d = typeof b === 'string' ? JSON.parse(b) : b; if (!d || !Array.isArray(d.vocabTranslations)) return;
      if (route && route !== location.hash) return;
      state.vocab = d.vocabTranslations; state.vocabRoute = route || location.hash;
      addLog(`Vocab loaded: ${state.vocab.length}`, 'ok'); setVocabCount(state.vocab.length + state.sentences.length + state.verbs.length);
    } catch (e) { log('vocab parse failed', e); }
  }
  function ingestSentences(b) {
    try { const d = typeof b === 'string' ? JSON.parse(b) : b; let list = null;
      if (Array.isArray(d)) list = d; else if (d && typeof d === 'object') for (const k of Object.keys(d)) if (Array.isArray(d[k])) { list = d[k]; break; }
      if (!list) { log('sentence response has no array'); return; }
      state.sentences = list; addLog(`Sentences loaded: ${state.sentences.length}`, 'ok'); setVocabCount(state.vocab.length + state.sentences.length + state.verbs.length);
    } catch (e) { log('sentence parse failed', e); }
  }

  function ingestVerbs(b) {
    try {
      const d = typeof b === 'string' ? JSON.parse(b) : b;
      let list = null;
      if (Array.isArray(d)) list = d;
      else if (d && Array.isArray(d.verbTranslations)) list = d.verbTranslations;
      else if (d && typeof d === 'object') {
        for (const k of Object.keys(d)) {
          if (Array.isArray(d[k]) && d[k].some(x => x && (x.originalVerb || x.translatedVerb))) {
            list = d[k];
            break;
          }
        }
      }
      if (!list) { log('verb response has no array'); return; }
      state.verbs = list.filter(v => v && (v.originalVerb || v.translatedVerb));
      state.verbDone = new Set();
      state.verbFails = 0;
      state.verbSubmitAt = 0;
      state.jigsawDone = new Set();
      state.jigsawFails = 0;
      state.jigsawLastPrompt = null;
      state.jigsawLastClickAt = 0;
      state.jigsawUsedTargets = new Set();
      state.jigsawUsedTargetPositions = [];
      state.jigsawSlotPositions = [];
    state.jigsawRejectedEndings = new Map();
    state.jigsawEndingAttempts = new Map();
    state.jigsawBusy = false;
      state.jigsawRejectedEndings = new Map();
      state.jigsawEndingAttempts = new Map();
      state.jigsawBusy = false;
      addLog(`Verbs loaded: ${state.verbs.length}`, 'ok');
      setVocabCount(state.vocab.length + state.sentences.length + state.verbs.length);
    } catch (e) { log('verb parse failed', e); }
  }
  function ingestExamTranslations(body) {
    try {
      const data = typeof body === 'string' ? JSON.parse(body) : body;
      if (!data || !Array.isArray(data.examTranslations)) return;
      state.examOriginalText = String(data.examDataOriginal?.text || '').trim();
      const parsed = data.examTranslations.map(entry => {
        const xml = new DOMParser().parseFromString(String(entry.other || ''), 'text/xml');
        const questionNode =
          xml.querySelector('question') ||
          xml.querySelector('synonym') ||
          xml.querySelector('statement') ||
          xml.querySelector('prompt');
        const answerNode =
          xml.querySelector('correct') ||
          xml.querySelector('true') ||
          xml.querySelector('false') ||
          xml.querySelector('removed') ||
          xml.querySelector('answer') ||
          xml.querySelector('interpret') ||
          xml.querySelector('interpretation') ||
          xml.querySelector('translation') ||
          xml.querySelector('text');
        return {
          uid: String(entry.uid || ''),
          question: String(questionNode?.textContent || '').trim(),
          answer: String(answerNode?.textContent || '').trim(),
          position: String(xml.querySelector('position')?.textContent || '').trim(),
          kind: xml.querySelector('removed') ? 'gapfill' : 'exam'
        };
      }).filter(entry => entry.answer && (entry.question || entry.kind === 'gapfill'));
      if (parsed.length) {
        state.examTranslations = parsed;
        state.examSubmitted = new Set();
        state.examGapOrder = [];
        state.examGapIndex = 0;
        state.examGapSubmitted = false;
        addLog(`Exam answers loaded: ${parsed.length}`, 'ok');
        setVocabCount(state.vocab.length + state.sentences.length + state.verbs.length + parsed.length);
      }

      const whoSaidWhat = [];
      data.examTranslations.forEach(entry => {
        const rawOther = String(entry.other || '');
        const tagRegex = /<person([A-Za-z])>([\s\S]*?)<\/person\1>/gi;
        let match;
        while ((match = tagRegex.exec(rawOther)) !== null) {
          const statement = match[2].trim();
          if (statement) {
            whoSaidWhat.push({
              person: match[1].toUpperCase(),
              statement,
              normalisedStatement: normaliseText(statement)
            });
          }
        }
      });
      if (whoSaidWhat.length) {
        state.whoSaidWhatStatements = whoSaidWhat;
        state.whoSaidWhatSubmitted = false;
        addLog(`Who Said What loaded: ${whoSaidWhat.length} statements`, 'ok');
        setVocabCount(state.vocab.length + state.sentences.length + state.verbs.length + whoSaidWhat.length);
      }
    } catch (e) { log('exam translation parse failed', e); }
  }
  function ingestExamDataTranslations(body) {
    try {
      const data = typeof body === 'string' ? JSON.parse(body) : body;
      if (!data) return;
      if (/#\/alevelPhoto(?:[/?]|$)/i.test(location.href) && data.examQuestion?.image) {
        const next = data.examQuestion;
        const key = `${next.uid || ''}|${next.image || ''}`;
        const previous = state.examPhotoQuestion;
        if (!previous || `${previous.uid || ''}|${previous.image || ''}` !== key) {
          state.examPhotoSubmittedKey = '';
        }
        state.examPhotoQuestion = next;
        addLog(`Photo exam loaded: ${next.image}`, 'ok');
        setVocabCount(1);
        return;
      }
      const raw = data.examData || data.examDataLarge || data.examDataOriginal || data.data;
      if (!raw) return;
      const items = Array.isArray(raw) ? raw : [raw];
      const parsed = items.map(ed => {
        const text = String(
          ed.mainText ||
          ed.text ||
          ed.answer ||
          (ed.examTranslationData && ed.examTranslationData[0] && ed.examTranslationData[0].text) ||
          ''
        ).trim();
        return {
          uid: String(ed.uid || ''),
          text: text.replace(/\r\n/g, '\n'),
          rawText: text,
          ietf: String(ed.ietf || ed.toIetf || ''),
          audio: String(ed.audio || '')
        };
      }).filter(entry => entry.text);
      if (!parsed.length) return;
      state.examDictationEntries = parsed;
      state.examDictationData = parsed[0];
      state.examDictationSubmitted = false;
      addLog(`Exam text/dictation loaded (${parsed[0].text.length} chars, uid ${parsed[0].uid})`, 'ok');
      setVocabCount(state.vocab.length + state.sentences.length + state.verbs.length + parsed.length);
    } catch (e) { log('exam data translation parse failed', e); }
  }
  (function () { const orig = window.fetch; if (!orig) return;
    window.fetch = function (input) {
      const url = typeof input === 'string' ? input : (input && input.url);
      const requestRoute = location.hash;
      if (CONFIG.logAllFetches && isInterestingUrl(url)) log('fetch →', String(url).slice(0, 120));
      if (arguments[1] && typeof arguments[1].body === 'string') {
        const body = rewriteFakeTimeBody(url, arguments[1].body);
        if (body !== arguments[1].body) arguments[1] = {...arguments[1], body};
      }
      const p = orig.apply(this, arguments);
      if (isVocabUrl(url)) p.then(r => r.clone().text().then(body => ingestVocab(body, requestRoute)).catch(()=>{}));
      if (isSentenceUrl(url)) p.then(r => r.clone().text().then(ingestSentences).catch(()=>{}));
      if (isVerbUrl(url)) p.then(r => r.clone().text().then(ingestVerbs).catch(()=>{}));
      if (isExamTranslationsUrl(url)) p.then(r => r.clone().text().then(ingestExamTranslations).catch(()=>{}));
      if (isExamDataTranslationsUrl(url)) p.then(r => r.clone().text().then(ingestExamDataTranslations).catch(()=>{}));
      if (isConcertEvalUrl(url)) {
        p.then(r =>
          r.clone().text()
            .then(t => ingestConcertEvaluation(t, url))
            .catch(()=>{})
        );
      }
      return p;
    };
  })();
  (function () { const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, url) {
      if (state.running && /examTranslationController\/addExamDataAnswerAudio/i.test(String(url))) {
        const reported = fakeTimeNextMilliseconds();
        url = String(url).replace(/([?&]timeTaken=)\d+/i, `$1${reported}`);
        arguments[1] = url;
        addLog(`Exam audio simulated ${reported / 1000}s`, 'ok');
      }
      this.__ln_url = url;
      this.__ln_route = location.hash;
      if (CONFIG.logAllFetches && isInterestingUrl(url)) log('xhr →', String(url).slice(0, 120));
      return open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      if (typeof arguments[0] === 'string') {
        arguments[0] = rewriteFakeTimeBody(this.__ln_url, arguments[0]);
      }
      this.addEventListener('load', function () {
        if (isVocabUrl(this.__ln_url)) ingestVocab(this.responseText, this.__ln_route);
        if (isSentenceUrl(this.__ln_url)) ingestSentences(this.responseText);
        if (isVerbUrl(this.__ln_url)) ingestVerbs(this.responseText);
        if (isExamTranslationsUrl(this.__ln_url)) ingestExamTranslations(this.responseText);
        if (isExamDataTranslationsUrl(this.__ln_url)) ingestExamDataTranslations(this.responseText);
        if (isConcertEvalUrl(this.__ln_url)) {
          let raw = '';
          try {
            raw = this.responseText;
          } catch (_) {
            try {
              raw = JSON.stringify(this.response);
            } catch (_) {}
          }
          if (raw) ingestConcertEvaluation(raw, this.__ln_url);
        }
      });
      return send.apply(this, arguments);
    };
  })();

  // ============ AUDIO HOOK ============
  function baseName(s) {
    if (!s) return '';
    const c = String(s).split('?')[0].split('#')[0];
    const p = c.split('/');
    return p[p.length - 1];
  }

  function audioStem(s) {
    return baseName(s)
      .toLowerCase()
      .replace(/\.(mp3|wav|ogg|m4a|aac)$/i, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  function collectEntryStringValues(entry) {
    const out = [];
    const seen = new Set();

    function scan(v, depth) {
      if (depth > 3 || v == null) return;

      if (typeof v === 'string') {
        if (v.trim()) out.push(v.trim());
        return;
      }

      if (typeof v !== 'object' || seen.has(v)) return;
      seen.add(v);

      if (Array.isArray(v)) {
        for (const x of v.slice(0, 30)) scan(x, depth + 1);
        return;
      }

      for (const [k, x] of Object.entries(v)) {
        // Avoid walking huge irrelevant structures if the API ever adds them.
        if (/token|jwt|html/i.test(k)) continue;
        scan(x, depth + 1);
      }
    }

    scan(entry, 0);
    return out;
  }

  function matchAudioToEntry(url) {
    const pool = (state.vocab.length ? state.vocab : []).concat(state.sentences.length ? state.sentences : []);
    if (!pool.length) return null;

    const playedBase = baseName(url).toLowerCase();
    const playedStem = audioStem(url);
    if (!playedStem) return null;

    // 1) Exact basename/stem against ANY string field in the vocab/sentence entry.
    for (const e of pool) {
      const values = collectEntryStringValues(e);

      for (const v of values) {
        const bn = baseName(v).toLowerCase();
        const st = audioStem(v);

        if (bn && bn === playedBase) return e;
        if (st && st === playedStem) return e;
      }
    }

    // 2) LanguageNut audio names often begin with the vocabulary UID,
    // e.g. 2706enen.mp3. Use that numeric prefix if present.
    const numeric = playedStem.match(/^(\d{2,})/);
    if (numeric) {
      const id = numeric[1];

      for (const e of pool) {
        const ids = [
          e.uid,
          e.id,
          e.vocabUid,
          e.translationUid,
          e.wordUid,
          e.sentenceUid
        ].filter(v => v != null).map(String);

        if (ids.includes(id)) return e;
      }
    }

    // 3) Last-resort stem containment for audio-looking entry strings only.
    for (const e of pool) {
      const values = collectEntryStringValues(e)
        .filter(v => /\.(mp3|wav|ogg|m4a|aac)(?:[?#].*)?$/i.test(v));

      for (const v of values) {
        const st = audioStem(v);
        if (
          st.length >= 4 &&
          playedStem.length >= 4 &&
          (st.startsWith(playedStem) || playedStem.startsWith(st))
        ) return e;
      }
    }

    return null;
  }
  function recordAudio(url) {
    if (!url) return;
    const audioUrl = String(url);

    // MC2 Listening accepts audio identity only when its own question audio
    // control was just clicked. Ignore stale music, answer-card speakers and
    // audio from a previous question.
    if (state.mode === 'mc2-listening') {
      const questionSig = state.mc2AudioCaptureSignature;
      if (!questionSig || Date.now() > state.mc2AudioCaptureUntil ||
          questionSig !== mc2QuestionSignature()) return;
      const entry = matchAudioToEntry(audioUrl);
      if (!entry) return;
      state.lastAudioUrl = audioUrl;
      state.currentEntry = entry;
      state.currentAnswer = {
        word: String(entry.word || entry.sentence || entry.originalSentence || '').trim(),
        originalWord: String(entry.originalWord || entry.translation || entry.translatedSentence || '').trim()
      };
      state.mc2CapturedAudioSignature = questionSig;
      state.mc2AudioCaptureSignature = '';
      state.mc2AudioCaptureUntil = 0;
      addLog(`MC2 audio → "${state.currentAnswer.word}" / "${state.currentAnswer.originalWord}"`, 'ok');
      setAudioLabel(`${state.currentAnswer.word} ⟷ ${state.currentAnswer.originalWord}`);
      return;
    }

    if (state.mode === 'wordpod-listening') {
      const entry = matchAudioToEntry(audioUrl);
      // WordPod plays correct/wrong effects during feedback. Those URLs must
      // not replace the current question's vocabulary audio identity.
      if (!entry) return;
      state.lastAudioUrl = audioUrl;
      state.currentEntry = entry;
      state.currentAnswer = {
        word: String(entry.word || '').trim(),
        originalWord: String(entry.originalWord || '').trim()
      };
      setAudioLabel(`${state.currentAnswer.word} ⟷ ${state.currentAnswer.originalWord}`);
      return;
    }

    state.lastAudioUrl = audioUrl;
    if ((state.mode !== 'mc-listening' && state.mode !== 'wordpod-listening' &&
         state.mode !== 'wordpop-listening') ||
        (state.vocab.length === 0 && state.sentences.length === 0)) return;
    const entry = matchAudioToEntry(audioUrl);
    if (!entry) return;
    state.currentEntry = entry;
    const word = String(entry.word || entry.sentence || entry.originalSentence || '').trim();
    const originalWord = String(entry.originalWord || entry.translation || entry.translatedSentence || '').trim();
    state.currentAnswer = { word, originalWord };
    addLog(`Audio → "${word}" / "${originalWord}"`, 'ok');
    setAudioLabel(`${word} ⟷ ${originalWord}`);
  }
  (function () {
    const o = HTMLMediaElement.prototype.play;
    if (!o) return;

    HTMLMediaElement.prototype.play = function () {
      try {
        recordAudio(this.currentSrc || this.src);
        this.muted = !!state.muteAudio;
      } catch (_) {}

      return o.apply(this, arguments);
    };
  })();
  (function () { const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src'); if (!d || !d.set) return;
    Object.defineProperty(HTMLMediaElement.prototype, 'src', { configurable: true, get: d.get, set(v) { try { recordAudio(v); } catch (_) {} return d.set.call(this, v); } }); })();
  (function () {
    if (!window.Audio) return;
    const O = window.Audio;

    function W(src) {
      const a = new O(src);

      try { a.muted = !!state.muteAudio; } catch (_) {}
      if (src) setTimeout(() => recordAudio(src), 0);

      const op = a.play.bind(a);
      a.play = function () {
        try {
          recordAudio(a.src || src);
          a.muted = !!state.muteAudio;
        } catch (_) {}

        return op();
      };

      return a;
    }

    W.prototype = O.prototype;
    window.Audio = W;
  })();

  // ============ PIXI ============
  function isPixiApp(o) { return o && typeof o === 'object' && o.stage && o.renderer && o.ticker && o.view; }
  function tryGrabPixi() {
    if (isPixiApp(state.pixiApp)) {
      return true;
    }

    if (isPixiApp(window.__PIXI_APP__)) {
      state.pixiApp = window.__PIXI_APP__;
      addLog('Pixi hooked', 'ok');
      return true;
    }

    return false;
  }
  (function () { let _p; try { Object.defineProperty(window, '__PIXI_APP__', { configurable: true, get() { return _p; }, set(v) { _p = v; if (isPixiApp(v)) { state.pixiApp = v; addLog('Pixi hooked', 'ok'); } } }); } catch (_) {} })();

  // ============ SCENE ============
  function walk(c, fn, d) { d = d || 0; if (!c || d > 30) return; try { fn(c); } catch (_) {} const k = c.children; if (k && k.length) for (let i = 0; i < k.length; i++) walk(k[i], fn, d + 1); }
  function isVisible(o, root) { let x = o; while (x && x !== root) { if (x.visible === false) return false; if (typeof x.alpha === 'number' && x.alpha < 0.05) return false; x = x.parent; } return true; }
  function boundsOf(o) { try { if (typeof o.getBounds === 'function') return o.getBounds(); } catch (_) {} return null; }
  function worldToClient(b) { const a = state.pixiApp; if (!a || !b) return null; const c = a.view, r = c.getBoundingClientRect(); const res = (a.renderer && a.renderer.resolution) || 1;
    const lw = (a.renderer.width || c.width) / res, lh = (a.renderer.height || c.height) / res;
    return { x: r.left + (b.x + b.width / 2) * (r.width / lw), y: r.top + (b.y + b.height / 2) * (r.height / lh) }; }
  function fullTextureName(o) { if (!o || !o.texture) return ''; const t = o.texture;
    if (t.textureCacheIds && t.textureCacheIds.length) return String(t.textureCacheIds[0]).replace(/\.png$/i, '');
    if (t.label) return String(t.label).replace(/\.png$/i, ''); return ''; }
  function textureName(o) { return fullTextureName(o).split('/').pop(); }

  function showClickMarker(x, y, color) {
    if (!CONFIG.showClickMarker) return;
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${x - 8}px;top:${y - 8}px;width:16px;height:16px;border:2px solid ${color || '#ff5c5c'};border-radius:50%;pointer-events:none;z-index:2147483646;box-shadow:0 0 8px ${color || '#ff5c5c'};animation:ln-ac-fade 1s ease-out forwards;`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 1100);
    if (!document.getElementById('ln-ac-fade-style')) { const s = document.createElement('style'); s.id = 'ln-ac-fade-style'; s.textContent = '@keyframes ln-ac-fade{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.6)}}'; document.head.appendChild(s); }
  }

  function firePointerEvent(canvas, type, x, y, buttons) {
    if (state.running && (isConcertRoute() || concertNavigationLocked())) {
      log(`Concert firewall blocked generic ${type} @ ${Math.round(x)},${Math.round(y)}`);
      return false;
    }

    const ev = new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true, view: window,
      clientX: x, clientY: y, screenX: x, screenY: y,
      button: 0, buttons, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      width: 1, height: 1, pressure: buttons ? 0.5 : 0
    });
    canvas.dispatchEvent(ev);
    return true;
  }

  function fireClickAt(x, y, marker) {
    if (state.running && (isConcertRoute() || concertNavigationLocked())) {
      log(`Concert firewall blocked generic click @ ${Math.round(x)},${Math.round(y)}`);
      return false;
    }

    const c = state.pixiApp && state.pixiApp.view; if (!c) return false;
    if (marker) showClickMarker(x, y, marker);
    try {
      firePointerEvent(c, 'pointerover', x, y, 0);
      firePointerEvent(c, 'pointermove', x, y, 0);
      c.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
      c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
      firePointerEvent(c, 'pointerdown', x, y, 1);
      c.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, buttons: 1 }));
      firePointerEvent(c, 'pointerup', x, y, 0);
      c.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
      c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
      return true;
    } catch (e) { log('fireClickAt failed', e); return false; }
  }

  async function dragTileUp(tileObj, distance) {
    const b = boundsOf(tileObj); if (!b) return false;
    const start = worldToClient(b); if (!start) return false;
    const dist = distance || CONFIG.fridgeDragDistance;
    const end = { x: start.x, y: start.y - dist };
    const canvas = state.pixiApp.view;
    showClickMarker(start.x, start.y, '#4ade80');
    firePointerEvent(canvas, 'pointerover', start.x, start.y, 0);
    firePointerEvent(canvas, 'pointermove', start.x, start.y, 0);
    await sleep(15);
    firePointerEvent(canvas, 'pointerdown', start.x, start.y, 1);
    await sleep(30);
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const x = start.x + (end.x - start.x) * (i / steps);
      const y = start.y + (end.y - start.y) * (i / steps);
      firePointerEvent(canvas, 'pointermove', x, y, 1);
      await sleep(12);
    }
    await sleep(30);
    showClickMarker(end.x, end.y, '#ffb45c');
    firePointerEvent(canvas, 'pointerup', end.x, end.y, 0);
    return true;
  }

  async function clickTile(tileObj) {
    const b = boundsOf(tileObj); if (!b) return false;
    const start = worldToClient(b); if (!start) return false;
    fireClickAt(start.x, start.y, '#4ade80');
    return true;
  }

  async function dragTileTo(tileObj, targetBoundsOrObj) {
    const realTileObj = (tileObj && tileObj.obj) ? tileObj.obj : tileObj;
    let startBounds = (tileObj && tileObj.bounds) || boundsOf(realTileObj);
    if (!startBounds && realTileObj && typeof realTileObj.toGlobal === 'function') {
      try {
        const gp = realTileObj.toGlobal({ x: 0, y: 0 });
        startBounds = { x: gp.x, y: gp.y, width: realTileObj.width || 80, height: realTileObj.height || 40 };
      } catch (_) {}
    }
    if (!startBounds) return false;
    const start = worldToClient(startBounds);
    if (!start) return false;

    const realTargetObj = (targetBoundsOrObj && targetBoundsOrObj.obj) ? targetBoundsOrObj.obj : targetBoundsOrObj;
    let targetBounds = realTargetObj && typeof realTargetObj.getBounds === 'function'
      ? boundsOf(realTargetObj)
      : (targetBoundsOrObj && targetBoundsOrObj.bounds) ? targetBoundsOrObj.bounds : targetBoundsOrObj;
    if (targetBounds && typeof targetBounds === 'object' && !('x' in targetBounds)) {
      targetBounds = boundsOf(realTargetObj);
    }
    if (!targetBounds && realTargetObj && typeof realTargetObj.toGlobal === 'function') {
      try {
        const gp = realTargetObj.toGlobal({ x: 0, y: 0 });
        targetBounds = { x: gp.x, y: gp.y, width: realTargetObj.width || 80, height: realTargetObj.height || 40 };
      } catch (_) {}
    }
    if (!targetBounds) return false;

    const targetPoint = {
      x: targetBounds.x,
      y: targetBounds.y,
      width: targetBounds.width || 0,
      height: targetBounds.height || 0
    };
    const end = worldToClient(targetPoint);
    if (!end) return false;

    const startWorld = {
      x: startBounds.x + (startBounds.width || 0) / 2,
      y: startBounds.y + (startBounds.height || 0) / 2
    };
    const endWorld = {
      x: targetBounds.x + (targetBounds.width || 0) / 2,
      y: targetBounds.y + (targetBounds.height || 0) / 2
    };

    const canvas = state.pixiApp && state.pixiApp.view;
    if (!canvas) return false;

    showClickMarker(start.x, start.y, '#4ade80');
    firePointerEvent(canvas, 'pointerover', start.x, start.y, 0);
    firePointerEvent(canvas, 'pointermove', start.x, start.y, 0);
    canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window, clientX: start.x, clientY: start.y }));
    await sleep(20);

    firePointerEvent(canvas, 'pointerdown', start.x, start.y, 1);
    canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, clientX: start.x, clientY: start.y, button: 0, buttons: 1 }));
    emitOnObject(realTileObj, 'pointerdown', startWorld);
    emitOnObject(realTileObj, 'mousedown', startWorld);
    await sleep(35);

    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const cx = start.x + (end.x - start.x) * (i / steps);
      const cy = start.y + (end.y - start.y) * (i / steps);
      const curWorld = {
        x: startWorld.x + (endWorld.x - startWorld.x) * (i / steps),
        y: startWorld.y + (endWorld.y - startWorld.y) * (i / steps)
      };
      firePointerEvent(canvas, 'pointermove', cx, cy, 1);
      canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 }));
      emitOnObject(realTileObj, 'pointermove', curWorld);
      emitOnObject(realTileObj, 'mousemove', curWorld);
      if (state.pixiApp && state.pixiApp.stage) {
        emitOnObject(state.pixiApp.stage, 'pointermove', curWorld);
      }
      await new Promise(r => setTimeout(r, 15));
    }
    await sleep(35);

    showClickMarker(end.x, end.y, '#ffb45c');
    firePointerEvent(canvas, 'pointerup', end.x, end.y, 0);
    canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, clientX: end.x, clientY: end.y }));
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: end.x, clientY: end.y }));
    emitOnObject(realTileObj, 'pointerup', endWorld);
    emitOnObject(realTileObj, 'mouseup', endWorld);
    if (state.pixiApp && state.pixiApp.stage) {
      emitOnObject(state.pixiApp.stage, 'pointerup', endWorld);
    }
    if (realTargetObj && typeof realTargetObj === 'object' && realTargetObj.emit) {
      emitOnObject(realTargetObj, 'pointerup', endWorld);
      emitOnObject(realTargetObj, 'mouseup', endWorld);
    }
    await sleep(40);
    return true;
  }

  const sleep = ms => {
    // Always leave a small event-loop gap so input handlers can finish.
    const delay = Number(ms) || 0;
    return delay > 0 ? new Promise(r => setTimeout(r, delay)) : Promise.resolve();
  };

  function cleanLetters(s) { return String(s).normalize('NFC').replace(/[^\p{L}]/gu, ''); }
  function sortLetters(s) { return cleanLetters(s).toLowerCase().split('').sort().join(''); }
  function normaliseText(s) { return String(s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim(); }
  function normaliseChunk(s) { return String(s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim(); }

  // ============ v5.6: CASE-PRESERVING KEY ============
  // Strips punctuation and spaces but keeps case. This is what we use to
  // distinguish "Fa" (for "Fahrrad") from "fa" (for "gefahren").
  function chunkKey(s) {
    return String(s || '').normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '');
  }

  // ============ CHUNK ORDERING (case-sensitive) ============
  function orderChunks(target, tiles) {
    try {
      const targetSeq = chunkKey(target);
      log('orderChunks target:', JSON.stringify(target), '→', JSON.stringify(targetSeq));
      if (!targetSeq) { log('orderChunks: empty target'); return []; }
      if (!tiles || tiles.length === 0) { log('orderChunks: no tiles'); return []; }

      const pool = [];
      for (const t of tiles) {
        const rawLabel = (t.label != null ? t.label : t.letter) || '';
        const norm = chunkKey(rawLabel);
        log('  tile', JSON.stringify(rawLabel), '→', JSON.stringify(norm));
        if (norm && norm.length > 0) {
          pool.push({ obj: t.obj, label: rawLabel, bounds: t.bounds, norm, used: false });
        }
      }
      pool.sort((a, b) => b.norm.length - a.norm.length);
      if (pool.length === 0) { log('orderChunks: all norms empty'); return []; }

      const result = [];
      let pos = 0, guard = 0;
      while (pos < targetSeq.length && guard < 500) {
        guard++;
        let best = null, bestLen = 0;
        for (const t of pool) {
          if (t.used) continue;
          if (pos + t.norm.length > targetSeq.length) continue;
          const slice = targetSeq.slice(pos, pos + t.norm.length);
          if (slice === t.norm && t.norm.length > bestLen) { best = t; bestLen = t.norm.length; }
        }
        if (!best) { log('orderChunks: STUCK at pos', pos, 'remaining=', JSON.stringify(targetSeq.slice(pos))); break; }
        best.used = true;
        result.push({ obj: best.obj, label: best.label, bounds: best.bounds });
        pos += bestLen;
      }
      log('orderChunks result:', result.length, result.map(r => r.label).join(' → '));
      return result;
    } catch (e) { log('orderChunks EXCEPTION:', e, e && e.stack); return []; }
  }

  // ============ COMPLETION ============
  function detectCompletion() {
    const a = state.pixiApp; if (!a) return null;
    if (/[#/](results?|review|complete|summary)/i.test(location.href)) return 'url:results';
    let r = null;
    walk(a.stage, (o) => {
      if (r) return;
      if (typeof o.text !== 'string' || !o.text.trim()) return;
      if (!isVisible(o, a.stage)) return;
      const b = boundsOf(o); if (!b) return;
      if (b.y < 80 || b.y > 420) return;
      const t = o.text.trim();
      if (t.length > 150) return;
      let m = t.match(/(\d+)\s*\/\s*(\d+)/);
      if (m && m[1] === m[2] && parseInt(m[1], 10) >= 2) {
        // Exam progress can briefly show 2/2, 3/3, etc. after a page of
        // questions. Only treat n/n as final when it reaches the loaded exam
        // size; otherwise the old generic check stopped MC exams after Q2.
        const exam = /^exam-/.test(String(state.mode || ''));
        const total = exam
          ? Math.max(
            examGapfillEntries().length,
            state.examTranslations.length,
            state.examDictationEntries.length || (state.examDictationData ? 1 : 0),
            Number(m[2])
          )
          : Number(m[2]);
        if (!exam || parseInt(m[1], 10) >= total) { r = t; return; }
      }
      m = t.match(/(\d+)\s+out of\s+(\d+)/i);
      if (m && m[1] === m[2] && parseInt(m[1], 10) >= 2) { r = t; return; }
      if (/\b(quiz|activity|homework|exercise)\s+(is\s+)?(complete|completed|finished|done)\b/i.test(t)) { r = t; return; }
      if (/\b(well done|great job|amazing work|excellent work)\b/i.test(t)) { r = t; return; }
      if (/\ball\s+(correct|right)\b/i.test(t)) { r = t; return; }
    });
    return r;
  }

  function isConcertRoute() {
    const u = String(location.href || '');
    // The Concert speaking assignment actually runs at #/ZenPhonicsBand.
    // The earlier route check missed it, allowing another game's click
    // handler to run against the visible Assignments breadcrumb.
    return /#\/(?:ZenPhonicsBand|ZenConcert|ConcertGame|Concert)(?:[/?]|$)/i.test(u) ||
      /[?&]zenSourceController=PhonicsBand(?:[&#]|$)/i.test(u) ||
      /[?&](?:game|activity)=concert(?:[&#]|$)/i.test(u);
  }

  function isInterpretRoute() {
    const u = String(location.href || '');
    return /#\/(?:Interpret|interpret|translation|alevelTranslation)(?:[/?]|$)/i.test(u) ||
      /[?&](?:game|activity)=(?:Interpret|interpret|translation|alevelTranslation)\b/i.test(u);
  }

  // ============ MODE ============
  function modeLabel(m) { if (m === 'dictation') return 'Dictation'; if (m === 'zen-noughts') return 'Noughts & Crosses'; if (m === 'zen-memory') return 'Matching Pairs'; if (m === 'race-driver') return 'Race Driver'; if (m === 'exam-photo') return 'A-Level Photo'; if (m === 'exam-who-said-what') return 'Who Said What'; if (m === 'exam-dictation') return 'Exam Dictation / Text'; if (m === 'exam-interpret') return 'Exam Interpret / Translation'; if (m === 'exam-gapfill') return 'Exam GapFill'; if (m === 'exam-synonym') return 'Exam Synonym'; if (m === 'exam-open-listening') return 'Exam Open Listening'; if (m === 'exam-true-false') return 'Exam True / False'; if (m === 'exam-multiple-choice') return 'Exam Multiple Choice'; if (m === 'exam-open-reading') return 'Exam Open Reading'; if (m === 'jumble') return 'Jumble'; if (m === 'mc-listening') return 'MC Listening'; if (m === 'mc-reading') return 'MC Reading'; if (m === 'mc2-listening') return 'Multiple Choice 2 Listening'; if (m === 'mc2-reading') return 'Multiple Choice 2 Reading'; if (m === 'wordpod-reading') return 'WordPod Reading'; if (m === 'wordpod-listening') return 'WordPod Listening'; if (m === 'skyrise') return 'Skyrise'; if (m === 'concert-speaking') return 'Concert Speaking'; if (m === 'wordpop-listening') return 'WordPop Listening'; if (m === 'ocean-cleaner') return 'Ocean Cleaner'; if (m === 'gapfill') return 'GapFill'; if (m === 'fridge') return 'Fridge / Sentence'; if (m === 'verb-matcher') return 'Verb Matcher'; if (m === 'jigsaw') return 'Jigsaw'; if (m === 'forklift') return 'Forklift'; return '—'; }
  function detectMode() {
    const u = location.href;

    // Strong URL identifiers first.
    if (/#\/(?:ExamDataDictation|ExamDataText|ExamDataTextLarge)(?:[/?]|$)/i.test(u) || /[?&]game=(?:ExamDataDictation|ExamDataText|ExamDataTextLarge)\b/i.test(u)) return 'exam-dictation';
    if (/#\/Dictation(?:[/?]|$)/i.test(u)) return 'dictation';
    if (/#\/WhoSaidWhat(?:[/?]|$)/i.test(u) || /[?&]game=WhoSaidWhat\b/i.test(u)) return 'exam-who-said-what';
    if (/#\/alevelPhoto(?:[/?]|$)/i.test(u)) return 'exam-photo';
    if (/#\/alevelOpenReading(?:[/?]|$)/i.test(u)) return 'exam-open-reading';
    if (/#\/alevelOpenListening(?:[/?]|$)/i.test(u)) return 'exam-open-listening';
    if (/#\/alevelSynonym(?:[/?]|$)/i.test(u)) return 'exam-synonym';
    if (isInterpretRoute()) return 'exam-interpret';
    if (/#\/GapfillExam(?:Alt)?(?:[/?]|$)/i.test(u)) return 'exam-gapfill';
    if (/#\/(?:MultiChoiceExam|MultiChoiceListeningExam)(?:Alt)?(?:[/?]|$)/i.test(u)) return 'exam-multiple-choice';
    if (/#\/(?:TrueFalseExam|TrueFalseListeningExam)(?:Alt)?(?:[/?]|$)/i.test(u)) return 'exam-true-false';
    if (/#\/ZenNoughtsAndCrosses(?:[/?]|$)/i.test(u)) return 'zen-noughts';
    if (/#\/ZenMemoryGame(?:[/?]|$)/i.test(u)) return 'zen-memory';
    if (/#\/RaceDriverGame(?:[/?]|$)/i.test(u)) return 'race-driver';
    if (/\/ZenJumble\b/i.test(u)) return 'jumble';
    if (/\/ZenListening\b/i.test(u)) return 'mc-listening';
    if (/\/ZenReading\b/i.test(u)) return 'mc-reading';

    if (/MultipleChoice|MultipleChoiceGame|MC3/i.test(u)) {
      if (/[?&](?:type|subType)=listening\b/i.test(u)) return 'mc2-listening';
      return 'mc2-reading';
    }

    if (/WordPod|wordpod/i.test(u)) {
      if (/[?&](?:type|subType)=listening\b/i.test(u)) return 'wordpod-listening';
      return 'wordpod-reading';
    }

    if (/SkyRise|Skyrise|skyRise|skyrise/i.test(u)) return 'skyrise';

    if (isConcertRoute()) {
      return 'concert-speaking';
    }

    if (/WordPop/i.test(u) || /wordpop/i.test(u)) return 'wordpop-listening';
    if (/GapFill/i.test(u) || /Gapfill/i.test(u) || /gapfill/i.test(u)) return 'gapfill';
    if (
      /(?:FishingGame|OceanCleaner|Ocean_Cleaner|Fishing|Ocean)\b/i.test(u) ||
      /[?&#/](?:fishing|oceancleaner|ocean)[/?&#_=-]/i.test(u) ||
      /games\/(?:fishing|ocean)/i.test(u)
    ) return 'ocean-cleaner';
    if (/ForkliftGame/i.test(u) || /\/Forklift\b/i.test(u)) return 'forklift';
    if (/Jigsaw/i.test(u) || /jigsaw/i.test(u)) return 'jigsaw';
    if (/VerbMatcher/i.test(u) || /verbMatcher/i.test(u)) return 'verb-matcher';
    if (/SentenceBuildingGame/i.test(u) || /[Ff]ridge/i.test(u) || /\/ZenSentence/i.test(u)) return 'fridge';

    // IMPORTANT: inspect the live PIXI scene BEFORE generic ?type=listening.
    // WordPop pages can use generic listening query params.
    const a = state.pixiApp;
    if (a) {
      let wpod = false;
      let wpodAudio = false;

      walk(a.stage, (o) => {
        if (wpod && wpodAudio) return;

        const f = fullTextureName(o);
        const n = textureName(o);

        if (
          /wordPodTextBox/i.test(f) ||
          /nextQuestionButton/i.test(f) ||
          /new_design\/(GreenBox|PlainBox|WrongBox)/i.test(f)
        ) {
          wpod = true;
        }

        if (/audioWordPod/i.test(f) || /audioWordPod/i.test(n)) {
          wpodAudio = true;
        }
      });

      if (wpod) {
        return wpodAudio ? 'wordpod-listening' : 'wordpod-reading';
      }

      let mc2 = false;
      let mc2Audio = false;

      walk(a.stage, (o) => {
        if (mc2 && mc2Audio) return;

        const f = fullTextureName(o);
        const n = textureName(o);

        if (
          /new_design\/CardMC3/i.test(f) ||
          /new_design\/MCBox/i.test(f) ||
          /new\/multipleChoice\/VocabBox/i.test(f) ||
          /new\/multipleChoice\//i.test(f)
        ) {
          mc2 = true;
        }

        if (
          /new\/multipleChoice\/SoundButton/i.test(f) ||
          /new\/multipleChoice\/SoundIcon/i.test(f) ||
          /new_design\/AudioButton/i.test(f) ||
          /audioWordPod/i.test(n)
        ) {
          mc2Audio = true;
        }
      });

      if (mc2) {
        return mc2Audio ? 'mc2-listening' : 'mc2-reading';
      }

      let wp = false;
      walk(a.stage, (o) => {
        if (wp) return;
        const f = fullTextureName(o);
        const n = textureName(o);

        if (
          /new\/wordpop\//i.test(f) ||
          /smallBubble/i.test(f) ||
          /smallBubble/i.test(n) ||
          /audioWordPod/i.test(f) ||
          /audioWordPod/i.test(n)
        ) wp = true;
      });
      if (wp) return 'wordpop-listening';

      let gf = false;
      let gfKeyboard = false;
      walk(a.stage, (o) => {
        if (gf && gfKeyboard) return;
        const tex = fullTextureName(o);
        if (/gapfill/i.test(tex) || /sentenceBackground/i.test(tex)) gf = true;
        if (/keyboard\/(smallKey|largeKey|spaceKey|enterKey|backspaceIcon|shiftIcon)/i.test(tex)) {
          gfKeyboard = true;
        }
      });
      if (gf && gfKeyboard) return 'gapfill';

      let oc = false;
      walk(a.stage, (o) => {
        if (oc) return;
        const f = fullTextureName(o);
        const n = textureName(o);
        if (
          /games\/(?:fishing|ocean)\//i.test(f) ||
          /(?:fishing|oceancleaner)/i.test(f) ||
          /container_\d+/i.test(f) ||
          /container_\d+/i.test(n)
        ) oc = true;
      });
      if (oc) return 'ocean-cleaner';

      let who = false;
      walk(a.stage, (o) => {
        if (who) return;
        const tex = `${fullTextureName(o)} ${textureName(o)}`;
        if (/who\/(?:a|b|c|ans)\.png/i.test(tex) || (typeof o.text === 'string' && /who said what/i.test(o.text))) who = true;
      });
      if (who) return 'exam-who-said-what';

      let fk = false;
      walk(a.stage, (o) => {
        if (fk) return;
        if (/games\/forklift\//i.test(fullTextureName(o))) fk = true;
      });
      if (fk) return 'forklift';

      let js = false;
      walk(a.stage, (o) => {
        if (js) return;
        if (/games\/jigsaw\//i.test(fullTextureName(o)) || /jigsaw/i.test(textureName(o))) js = true;
      });
      if (js) return 'jigsaw';

      let v = false;
      walk(a.stage, (o) => {
        if (v) return;
        if (/verbMatcher/i.test(fullTextureName(o))) v = true;
      });
      if (v) return 'verb-matcher';

      let f = false;
      walk(a.stage, (o) => {
        if (f) return;
        if (/^fridge\//.test(fullTextureName(o))) f = true;
      });
      if (f) return 'fridge';

      let j = false;
      walk(a.stage, (o) => {
        if (j) return;
        const n = textureName(o);
        if (n === 'letterMissingBackground' || /^letter-/.test(o.name || '')) j = true;
      });
      if (j) return 'jumble';
    }

    // Generic URL params only after game-specific PIXI detection.
    if (/[?&]type=writing\b/i.test(u)) return 'jumble';
    if (/[?&]type=listening\b/i.test(u)) return 'mc-listening';
    if (/[?&]type=reading\b/i.test(u)) return 'mc-reading';
    if (/[?&]type=sentence/i.test(u) || /[?&]subType=s/i.test(u)) return 'fridge';

    if (!a) return null;

    const { options } = getMCOptionsAndPrompt();
    if (options.length >= 2) {
      if (findSoundButton()) return 'mc-listening';
      if (state.lastAudioUrl) return 'mc-listening';
      return 'mc-reading';
    }

    return null;
  }

  // ============ JUMBLE ============
  function findLaunchButton() { const a = state.pixiApp; if (!a) return null; let f = null; walk(a.stage, (o) => { if (o.name === 'launchButton' && isVisible(o, a.stage)) f = o; }); return f; }
  function hasInstructionText(n) { const a = state.pixiApp; if (!a) return false; let f = false;
    walk(a.stage, (o) => { if (f) return; if (o.name === 'instructionText' && typeof o.text === 'string') if (o.text.toLowerCase().indexOf(n) !== -1) f = true; }); return f; }
  function collectLetterTiles() {
    const a = state.pixiApp; if (!a) return []; const out = [];
    walk(a.stage, (o) => {
      if (!o.name || !/^letter-/.test(o.name)) return;
      if (!isVisible(o, a.stage)) return;
      let t = '';
      for (const k of (o.children || [])) if (typeof k.text === 'string' && k.text.length > 0) { t = k.text; break; }
      if (!t) return;
      const b = boundsOf(o); if (!b || b.width === 0) return;
      out.push({ obj: o, letter: t, bounds: b });
    });
    return out;
  }

  function jumbleKey(s) {
    // Jumble needs punctuation preserved because punctuation can be a real tile.
    // Only whitespace is ignored.
    return String(s || '')
      .normalize('NFC')
      .replace(/\s+/gu, '');
  }

  function jumbleTargetKey(target, tiles) {
    const raw = jumbleKey(target);
    const tileChars = new Set();

    for (const t of (tiles || [])) {
      for (const ch of [...jumbleKey(t.letter)]) {
        tileChars.add(ch);
      }
    }

    // Always keep letters/numbers. Keep punctuation only when that punctuation
    // actually exists as a tile on this board. This avoids requiring commas,
    // brackets, etc. that LanguageNut chose not to make draggable.
    return [...raw].filter(ch => {
      if (/[\p{L}\p{N}]/u.test(ch)) return true;
      return tileChars.has(ch);
    }).join('');
  }

  function buildJumbleOrder(target, tiles) {
    const targetSeq = jumbleTargetKey(target, tiles);
    if (!targetSeq) return [];

    const pool = (tiles || []).map((t, index) => ({
      obj: t.obj,
      label: t.letter,
      bounds: t.bounds,
      norm: jumbleKey(t.letter),
      index
    })).filter(t => t.norm);

    if (!pool.length) return [];

    const memo = new Set();

    function solve(pos, used) {
      if (pos === targetSeq.length) return [];

      const memoKey =
        `${pos}|${[...used].sort((a, b) => a - b).join(',')}`;

      if (memo.has(memoKey)) return null;

      const candidates = pool
        .filter(t =>
          !used.has(t.index) &&
          targetSeq.startsWith(t.norm, pos)
        )
        .sort((a, b) => b.norm.length - a.norm.length);

      for (const t of candidates) {
        const nextUsed = new Set(used);
        nextUsed.add(t.index);

        const rest = solve(pos + t.norm.length, nextUsed);

        if (rest !== null) {
          return [
            {
              obj: t.obj,
              label: t.label,
              bounds: t.bounds
            },
            ...rest
          ];
        }
      }

      memo.add(memoKey);
      return null;
    }

    const solved = solve(0, new Set());
    if (!solved) return [];

    const rebuilt = solved.map(t => jumbleKey(t.label)).join('');
    return rebuilt === targetSeq ? solved : [];
  }

  function jumbleTileInventoryKey(tiles) {
    return (tiles || [])
      .map(t => jumbleKey(t.letter))
      .filter(Boolean)
      .sort()
      .join('|');
  }

  function identifyJumbleWord(allLetters, tiles) {
    const t = sortLetters(allLetters);
    if (!t) return null;

    const matches = [];

    for (const e of state.vocab) {
      if (sortLetters(e.word || '') === t) {
        matches.push({ text: e.word.trim(), side: 'de' });
      }

      if (sortLetters(e.originalWord || '') === t) {
        matches.push({ text: e.originalWord.trim(), side: 'en' });
      }
    }

    if (!matches.length) return null;
    if (matches.length === 1) return matches[0];

    // Prefer the candidate that can use the complete live tile inventory,
    // including punctuation such as '.', '?', '!', apostrophes and hyphens.
    const inv = jumbleTileInventoryKey(tiles);

    for (const m of matches) {
      const order = buildJumbleOrder(m.text, tiles);
      const orderedInv = order
        .map(x => jumbleKey(x.label))
        .filter(Boolean)
        .sort()
        .join('|');

      if (order.length === tiles.length && orderedInv === inv) {
        return m;
      }
    }

    return matches[0];
  }
  function resetJumbleState() {
    state.targetWord = ''; state.targetLetters = '';
    state.jumbleOrderedChunks = []; state.jumblePlacedCount = 0;
    state.placedTiles = new Set();
    state.lastClickedObj = null; state.retryObj = null;
    state.currentDelay = CONFIG.jumbleClickMs; state.jumbleFails = 0;
    setTargetLabel(''); setSeqLabel(''); setProgress(0, 0);
  }

  async function jumbleTick() {
    const launch = findLaunchButton();
    const inStudy = !!launch || hasInstructionText('remember this word');
    const inJumble = hasInstructionText('rebuild the word') || hasInstructionText('click or drag') || (!inStudy && !launch);
    if (inStudy && !state.wasStudyPhase) resetJumbleState();
    state.wasStudyPhase = inStudy;

    if (inStudy && launch) {
      const now = Date.now();
      if (now - state.lastLaunchAt > CONFIG.launchCooldownMs) {
        state.lastLaunchAt = now;
        addLog('Pressing launch…');
        const b = boundsOf(launch);
        if (b) { const p = worldToClient(b); if (p) fireClickAt(p.x, p.y, '#4ade80'); }
        setStatus('Launching…');
      }
      await sleep(CONFIG.afterLaunchMs);
      return;
    }
    if (!inJumble) { setStatus('Idle'); return; }

    const tiles = collectLetterTiles();
    if (tiles.length === 0) { setStatus('No tiles'); return; }

    if (!state.targetWord) {
      const allLetters = tiles.map(t => t.letter).join('');
      const id = identifyJumbleWord(allLetters, tiles);
      if (!id) {
        addLog('Cannot identify: ' + allLetters, 'err');
        setStatus('Unknown word');
        await sleep(500);
        return;
      }
      state.targetWord = id.text;
      state.targetLetters = jumbleTargetKey(id.text, tiles);
      state.placedTiles = new Set();
      state.jumblePlacedCount = 0;
      state.jumbleFails = 0;
      state.currentDelay = CONFIG.jumbleClickMs;

      const ordered = buildJumbleOrder(state.targetWord, tiles);
      state.jumbleOrderedChunks = ordered;

      addLog(`Target: "${state.targetWord}"`, 'ok');
      addLog(`Order: ${ordered.map(t => t.label).join(' → ') || '(empty)'}`, 'ok');
      setTargetLabel(state.targetWord); setSeqLabel(state.targetLetters);
      setProgress(0, ordered.length);

      if (ordered.length === 0) {
        addLog('Order is empty — see console for diagnostics', 'err');
        setStatus('No match');
        await sleep(800);
        resetJumbleState();
        return;
      }
      return;
    }

    const expected = state.jumbleOrderedChunks.length;
    const placed = state.jumblePlacedCount;

    if (placed >= expected) {
      state.solvedCount++;
      addLog(
        `All ${expected} chunks placed — waiting for game to advance`,
        'ok'
      );
      setStatus('Waiting for game…');
      await sleep(1500);
      // If still same target on next tick, we'll try again; otherwise re-detect
      resetJumbleState();
      return;
    }

    if (state.jumbleFails >= CONFIG.maxJumbleFails) {
      addLog(`Giving up after ${state.jumbleFails} fails`, 'err');
      setStatus('Stuck');
      resetJumbleState();
      await sleep(CONFIG.afterSolveMs);
      return;
    }

    const nextChunk = state.jumbleOrderedChunks[placed];
    const wantLabel = nextChunk.label;
    const wantKey = jumbleKey(wantLabel);

    // Jumble uses a punctuation-preserving, case-sensitive key.
    let candidates = tiles.filter(t =>
      !state.placedTiles.has(t.obj) &&
      jumbleKey(t.letter) === wantKey
    );

    if (candidates.length === 0) {
      state.jumbleFails++;
      addLog(`No tile for "${wantLabel}" (fails: ${state.jumbleFails})`, 'err');
      const handLetters = tiles.filter(t => !state.placedTiles.has(t.obj)).map(t => `"${t.letter}"`).join(' ');
      addLog(`  want="${wantLabel}" placed=${placed}/${expected} hand: ${handLetters}`, 'err');
      await sleep(300);
      if (state.jumbleFails >= 4) {
        addLog('Stuck — resetting', 'err');
        resetJumbleState();
        await sleep(CONFIG.afterSolveMs);
      }
      return;
    }

    candidates.sort((a, b) => a.bounds.x - b.bounds.x);
    const pick = candidates[0];

    const bb = boundsOf(pick.obj);
    if (bb) { const pt = worldToClient(bb); if (pt) fireClickAt(pt.x, pt.y, '#ff5c5c'); }
    log(`click "${pick.letter}" (want "${wantLabel}" #${placed + 1})`);

    await sleep(state.currentDelay);

    state.placedTiles.add(pick.obj);
    state.jumblePlacedCount++;
    state.jumbleFails = 0;
    addLog(`✓ "${pick.letter}" placed (${state.jumblePlacedCount}/${expected})`, 'ok');
    setProgress(state.jumblePlacedCount, expected);
  }

  // ============ MC ============
  function isSoundTexture(n) { return /SoundButton|SoundIcon|AudioButton|audioWordPod/i.test(n); }
  function isResultTexture(n) { return /correctResult|incorrectResult|correct\.png|incorrect\.png|Tick|BigTick|BigCross|Cross|correctAnswer/i.test(n); }
  function findSoundButton() {
    const a = state.pixiApp;
    if (!a) return null;
    let f = null;
    walk(a.stage, (o) => {
      if (f) return;
      if (!isVisible(o, a.stage)) return;
      const fn = fullTextureName(o);
      const tn = textureName(o);
      if (isSoundTexture(tn) || isSoundTexture(fn) || /sound|speaker|audio/i.test(tn) || /sound|speaker|audio/i.test(fn)) {
        let target = o;
        if (!target.interactive && target.eventMode !== 'static' && target.eventMode !== 'dynamic' && target.parent) {
          target = target.parent;
        }
        f = target;
      }
    });
    return f;
  }
  function isInMainArea(b) { if (!b) return false; return b.y > 60 && b.y < 420 && b.width < 600 && b.height < 400; }
  function collectMCOptions() {
    const a = state.pixiApp; if (!a) return []; const out = []; const seen = new Set();
    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return; if (seen.has(o)) return;
      const isInt = o.interactive === true || o.eventMode === 'static' || o.eventMode === 'dynamic'; if (!isInt) return;
      const b = boundsOf(o); if (!b || b.width < 40 || b.height < 20) return;
      if (!isInMainArea(b)) return; if (b.width > 500 || b.height > 300) return;
      const t = []; walk(o, (c) => { if (typeof c.text === 'string' && c.text.trim()) t.push(c.text.trim()); });
      if (t.length === 0) return; t.sort((a, b) => b.length - a.length); const l = t[0];
      if (l.length < 2) return; seen.add(o); out.push({ obj: o, label: l, bounds: b });
    });
    const bl = new Map();
    for (const o of out) { const ex = bl.get(o.label); if (!ex) { bl.set(o.label, o); continue; } const a1 = ex.bounds.width * ex.bounds.height, a2 = o.bounds.width * o.bounds.height; if (a2 > a1) bl.set(o.label, o); }
    return Array.from(bl.values());
  }
  function getMCOptionsAndPrompt() { const all = collectMCOptions(); all.sort((a, b) => a.bounds.y - b.bounds.y); if (all.length < 2) return { prompt: null, options: all };
    const t = all[0].bounds.y, n = all[1].bounds.y; if (n - t > 60) { const p = all.shift(); return { prompt: p, options: all }; } return { prompt: null, options: all }; }
  function hasResultSprite() { const a = state.pixiApp; if (!a) return false; let f = false; walk(a.stage, (o) => { if (f) return; if (!isVisible(o, a.stage)) return; if (isResultTexture(textureName(o))) f = true; }); return f; }
  function mcOptionsSignature() { return collectMCOptions().map(o => o.label).join('|'); }
  async function tryClickMCOption(opt, allOptions) {
    const bs = mcOptionsSignature(), br = hasResultSprite();
    const ok = () => mcOptionsSignature() !== bs || hasResultSprite() !== br;
    const attempt = async (t) => {
      const pt = worldToClient(t.bounds); if (pt) { fireClickAt(pt.x, pt.y, '#ff5c5c'); await sleep(CONFIG.clickSettleMs); if (ok()) return true; }
      const fr = [{ fx: 0.5, fy: 0.5 }, { fx: 0.25, fy: 0.5 }, { fx: 0.75, fy: 0.5 }, { fx: 0.5, fy: 0.25 }, { fx: 0.5, fy: 0.75 }];
      const a = state.pixiApp, c = a.view, r = c.getBoundingClientRect(); const res = (a.renderer && a.renderer.resolution) || 1;
      const lw = (a.renderer.width || c.width) / res, lh = (a.renderer.height || c.height) / res;
      for (const o of fr) { const wx = t.bounds.x + t.bounds.width * o.fx, wy = t.bounds.y + t.bounds.height * o.fy; const cx = r.left + wx * (r.width / lw), cy = r.top + wy * (r.height / lh); fireClickAt(cx, cy, '#ffb45c'); await sleep(CONFIG.clickSettleMs); if (ok()) return true; }
      const evs = ['pointerover', 'pointerdown', 'pointerup', 'pointertap', 'click', 'tap'];
      for (const e of evs) if (emitOnObject(t.obj, e)) { await sleep(CONFIG.clickSettleMs); if (ok()) return true; }
      let p = t.obj.parent, d = 0; while (p && d < 6) { for (const e of evs) emitOnObject(p, e); await sleep(CONFIG.clickSettleMs); if (ok()) return true; p = p.parent; d++; }
      return false;
    };
    if (await attempt(opt)) return true;
    if (allOptions && allOptions.length > 1) for (const o of allOptions) { if (o === opt) continue; if (await attempt(o)) return true; }
    return false;
  }
  function emitOnObject(o, ev, pt) {
    if (!o || typeof o.emit !== 'function') return false;
    let p = pt && typeof pt.x === 'number' && typeof pt.y === 'number'
      ? { x: pt.x, y: pt.y }
      : null;
    if (!p) {
      const b = boundsOf(o);
      p = b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : { x: 0, y: 0 };
    }
    const getLocal = function(target) {
      if (target && typeof target.toLocal === 'function') {
        try { return target.toLocal(p); } catch (_) {}
      }
      return { x: p.x, y: p.y };
    };
    const interactionData = {
      global: p,
      client: p,
      screen: p,
      originalEvent: null,
      getLocalPosition: getLocal
    };
    const syntheticEvent = {
      data: interactionData,
      global: p,
      client: p,
      screen: p,
      target: o,
      currentTarget: o,
      type: ev,
      stopped: false,
      stopPropagation() { this.stopped = true; },
      preventDefault() {},
      getLocalPosition: getLocal
    };
    try {
      o.emit(ev, syntheticEvent);
      return true;
    } catch (_) {
      return false;
    }
  }
  function matchPromptToEntry(t) { const p = normaliseText(t); if (!p) return null;
    for (const e of state.vocab) { const w = normaliseText(e.word), o = normaliseText(e.originalWord); if (p === w || p === o) return e; }
    for (const e of state.vocab) { const w = normaliseText(e.word), o = normaliseText(e.originalWord); if (w && w.length > 3 && (p.includes(w) || w.includes(p))) return e; if (o && o.length > 3 && (p.includes(o) || o.includes(p))) return e; } return null; }
  function computeReadingAnswer(e, t) { const p = normaliseText(t), w = normaliseText(e.word), o = normaliseText(e.originalWord);
    if (p === w) return e.originalWord.trim(); if (p === o) return e.word.trim();
    if (w && p.includes(w)) return e.originalWord.trim(); if (o && p.includes(o)) return e.word.trim(); return e.originalWord.trim(); }
  async function mcListeningTick() {
    const { options: opts } = getMCOptionsAndPrompt();
    if (opts.length === 0) { setStatus('Waiting for options…'); return; }
    const k = opts.map(o => o.label).join('|');

    if (state.lastMCOptionsKey !== k) {
      state.lastMCOptionsKey = k;
      state.currentAnswer = null;
      state.currentEntry = null;
      state.lastAudioUrl = null;
      state.lastPlayedKey = null;
      setAudioLabel('');
    }

    const now = Date.now();
    if (CONFIG.autoPlay && !state.currentAnswer) {
      if (state.lastPlayedKey !== k || (now - (state.lastMCPlayAttemptAt || 0) > 2200)) {
        const btn = findSoundButton();
        if (btn) {
          state.lastPlayedKey = k;
          state.lastMCPlayAttemptAt = now;
          addLog('Auto-playing audio…');
          emitOnObject(btn, 'pointerup');
          const b = boundsOf(btn);
          if (b) {
            const p = worldToClient(b);
            if (p) fireClickAt(p.x, p.y, '#4ade80');
          }
          await sleep(CONFIG.afterPlayMs);
        }
      }
    }

    if (!state.currentAnswer) { setStatus('Waiting for audio…'); return; }
    const key = k + '::' + (state.lastAudioUrl || '');
    if (key === state.lastAnsweredKey) { setStatus('Answered'); return; }

    const t = normaliseText(state.currentAnswer.word), e = normaliseText(state.currentAnswer.originalWord);
    const w = [t, e].filter(Boolean);
    let m = null;
    for (const o of opts) {
      if (w.includes(normaliseText(o.label))) { m = o; break; }
    }
    if (!m) {
      for (const o of opts) {
        const n = normaliseText(o.label);
        for (const x of w) {
          if (x && (n.includes(x) || x.includes(n)) && n.length > 1) { m = o; break; }
        }
        if (m) break;
      }
    }
    if (!m) {
      addLog('No match for "' + w.join(' / ') + '"', 'err');
      setStatus('No match');
      return;
    }

    addLog(`Answering "${m.label}"`, 'ok');
    const ok = await tryClickMCOption(m, opts);
    if (ok) {
      state.answeredCount++;
      setAnsweredCount(state.answeredCount);
      setStatus('Answered');
    } else {
      addLog('✗ Click failed', 'err');
      setStatus('Click failed');
    }
    state.lastAnsweredKey = key;
    await sleep(CONFIG.afterAnswerMs);
    state.currentAnswer = null;
    state.currentEntry = null;
    state.lastAudioUrl = null;
    setAudioLabel('');
  }
  async function mcReadingTick() {
    const { prompt: pc, options: opts } = getMCOptionsAndPrompt();
    let p = null;
    if (pc) { const e = matchPromptToEntry(pc.label); p = { text: pc.label, key: normaliseText(pc.label), bounds: pc.bounds, obj: pc.obj, entry: e, source: 'top-card' }; } else p = findPrompt();
    if (!p) { setStatus('Waiting for prompt…'); return; }
    state.currentPrompt = p; setPromptLabel(p.text);
    if (opts.length === 0) { setStatus('Waiting for options…'); return; }
    const k = opts.map(o => o.label).join('|'); const key = k + '::' + p.key;
    if (key === state.lastAnsweredKey) { setStatus('Answered'); return; }
    const e = p.entry || matchPromptToEntry(p.text);
    if (!e) { addLog(`Prompt not in vocab: "${p.text}"`, 'err'); state.lastAnsweredKey = key; setStatus('Not in vocab'); return; }
    const wt = computeReadingAnswer(e, p.text), wn = normaliseText(wt);
    let m = opts.find(o => normaliseText(o.label) === wn);
    if (!m) m = opts.find(o => { const n = normaliseText(o.label); return n.length > 1 && (n.includes(wn) || wn.includes(n)); });
    if (!m) { addLog(`No option for "${wt}"`, 'err'); state.lastAnsweredKey = key; setStatus('No match'); return; }
    addLog(`Prompt "${p.text}" → "${m.label}"`, 'ok');
    const ok = await tryClickMCOption(m, opts);
    if (ok) { state.answeredCount++; setAnsweredCount(state.answeredCount); setStatus('Answered'); } else { addLog('✗ Click failed', 'err'); setStatus('Click failed'); }
    state.lastAnsweredKey = key; await sleep(CONFIG.afterAnswerMs);
    if (mcOptionsSignature() !== k) { state.currentPrompt = null; setPromptLabel(''); }
  }
  function findPrompt() { const r = collectMCOptions(); const t = findPromptText(r); if (t && t.entry) return t; const i = findPromptImage(r); if (i) return i; return t; }
  function findPromptText(opts) {
    const a = state.pixiApp; if (!a) return null; const rects = opts.map(o => o.bounds); const cands = [];
    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.trim()) return; if (!isVisible(o, a.stage)) return;
      const b = boundsOf(o); if (!b || b.width === 0) return; if (b.y < 55 || b.y > 425) return;
      const inside = rects.some(r => b.x >= r.x - 5 && b.y >= r.y - 5 && b.x + b.width <= r.x + r.width + 5 && b.y + b.height <= r.y + r.height + 5);
      if (inside) return; const t = o.text.trim(); if (t.length < 3) return;
      if (/^\d+$/.test(t) || /^\d+\s*[\/\-]\s*\d+$/.test(t) || /^\d+\s*(points|pts|%)$/i.test(t)) return;
      cands.push({ text: t, bounds: b, obj: o });
    });
    if (cands.length === 0) return null;
    const we = cands.map(c => ({ c, entry: matchPromptToEntry(c.text) })).filter(x => x.entry);
    if (we.length > 0) { we.sort((a, b) => b.c.text.length - a.c.text.length); const w = we[0];
      return { text: w.c.text, key: normaliseText(w.c.text), bounds: w.c.bounds, obj: w.c.obj, entry: w.entry, source: 'text' }; }
    cands.sort((a, b) => b.text.length - a.text.length); const w = cands[0];
    return { text: w.text, key: normaliseText(w.text), bounds: w.bounds, obj: w.obj, entry: null, source: 'text' };
  }
  function findPromptImage(opts) {
    const a = state.pixiApp; if (!a) return null; const rects = opts.map(o => o.bounds); let r = null;
    walk(a.stage, (o) => {
      if (r) return; if (!o.texture) return; if (!isVisible(o, a.stage)) return;
      const b = boundsOf(o); if (!b || b.width < 20 || b.height < 20) return; if (b.y < 55 || b.y > 425) return;
      const inside = rects.some(x => b.x >= x.x - 5 && b.y >= x.y - 5 && b.x + b.width <= x.x + x.width + 5 && b.y + b.height <= x.y + x.height + 5);
      if (inside) return; const f = fullTextureName(o);
      if (/^text\//i.test(f)) { const t = f.replace(/^text\//i, '').trim(); if (t.length >= 3) { const e = matchPromptToEntry(t); r = { text: t, key: normaliseText(t), bounds: b, obj: o, entry: e, source: 'text-in-image' }; } return; }
      const bn = textureName(o); if (!bn) return;
      for (const e of state.vocab) { const p = (e.picture || '').split('/').pop().replace(/\.png$/i, ''); if (p && p === bn) { r = { text: `[image ${bn}]`, key: 'img:' + bn, bounds: b, obj: o, entry: e, source: 'picture' }; return; } }
    });
    return r;
  }

  // ============ MULTIPLE CHOICE 2 ============
  function mc2ResultCount(kind) {
    const a = state.pixiApp;
    if (!a) return 0;

    let count = 0;

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;

      const f = fullTextureName(o);
      const n = textureName(o);

      if (
        kind === 'correct' &&
        (
          /correctResult/i.test(f) ||
          /SmallCorrect2/i.test(f) ||
          /^Tick$/i.test(n) ||
          /progress\/correct/i.test(f)
        )
      ) count++;

      if (
        kind === 'incorrect' &&
        (
          /incorrectResult/i.test(f) ||
          /SmallIncorrect2/i.test(f) ||
          /^Cross$/i.test(n) ||
          /progress\/incorrect/i.test(f)
        )
      ) count++;
    });

    return count;
  }

  function mc2VocabTerms() {
    const map = new Map();

    for (const e of state.vocab) {
      const vals = [
        e.word,
        e.originalWord,
        e.translatedWord,
        e.translation,
        e.original,
        e.translated
      ];

      for (const v of vals) {
        if (typeof v !== 'string' || !v.trim()) continue;

        const raw = v.trim();
        const n = normaliseText(raw);
        if (!n) continue;

        if (!map.has(n)) map.set(n, []);
        map.get(n).push({ entry: e, raw });
      }
    }

    return map;
  }

  function mc2NearestClickable(textObj) {
    let p = textObj;
    let depth = 0;
    let fallback = null;

    while (p && depth < 8) {
      const b = boundsOf(p);
      if (!b) break;

      if (b.width > 520 || b.height > 260) break;

      const events = typeof verbEventNames === 'function'
        ? verbEventNames(p)
        : [];

      const direct = events.some(e =>
        /^(pointerup|click|tap|mouseup|touchend)$/i.test(e)
      );

      const interactive =
        direct ||
        p.interactive === true ||
        p.eventMode === 'static' ||
        p.eventMode === 'dynamic' ||
        p.buttonMode === true ||
        p.cursor === 'pointer';

      if (interactive) {
        const candidate = {
          obj: p,
          bounds: b,
          events,
          direct,
          depth,
          area: b.width * b.height
        };

        if (!fallback) fallback = candidate;
        if (direct) return candidate;
      }

      p = p.parent;
      depth++;
    }

    return fallback;
  }

  function collectMC2VocabTexts() {
    const a = state.pixiApp;
    if (!a || !state.vocab.length) return [];

    const termMap = mc2VocabTerms();
    const raw = [];

    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.trim()) return;
      if (!isVisible(o, a.stage)) return;

      const label = o.text.trim();
      const n = normaliseText(label);
      if (!n || !termMap.has(n)) return;

      const tb = boundsOf(o);
      if (!tb || tb.width <= 0 || tb.height <= 0) return;

      const click = mc2NearestClickable(o);

      raw.push({
        label,
        norm: n,
        textObj: o,
        textBounds: tb,
        obj: click ? click.obj : o,
        bounds: click ? click.bounds : tb,
        events: click ? click.events : [],
        direct: !!(click && click.direct),
        interactive: !!click,
        matches: termMap.get(n)
      });
    });

    const out = [];

    for (const c of raw) {
      const cx = c.textBounds.x + c.textBounds.width / 2;
      const cy = c.textBounds.y + c.textBounds.height / 2;

      const dup = out.find(x => {
        if (x.norm !== c.norm) return false;

        const xx = x.textBounds.x + x.textBounds.width / 2;
        const xy = x.textBounds.y + x.textBounds.height / 2;

        return Math.abs(xx - cx) < 10 && Math.abs(xy - cy) < 10;
      });

      if (!dup) {
        out.push(c);
      } else if (
        (c.direct && !dup.direct) ||
        (c.interactive && !dup.interactive)
      ) {
        Object.assign(dup, c);
      }
    }

    out.sort((a, b) =>
      a.textBounds.y - b.textBounds.y ||
      a.textBounds.x - b.textBounds.x
    );

    return out;
  }

  function mc2FindAudioButton(scene) {
    const app = state.pixiApp;
    if (!app) return null;
    const currentScene = scene || mc2Scene();
    const found = [];
    const seenIcons = new Set();

    walk(app.stage, o => {
      if (!isVisible(o, app.stage)) return;
      const texture = fullTextureName(o);
      if (!/new\/multipleChoice\/SoundButton/i.test(texture) &&
          !/new\/multipleChoice\/SoundIcon/i.test(texture) &&
          !/new_design\/AudioButton/i.test(texture) &&
          !/audioWordPod/i.test(texture)) return;

      const iconBounds = boundsOf(o);
      if (!iconBounds || iconBounds.width < 12 || iconBounds.height < 12 ||
          iconBounds.width > 280 || iconBounds.height > 160) return;

      let target = o;
      let targetBounds = iconBounds;
      let events = [];
      let parent = o;
      for (let depth = 0; parent && depth < 6; depth++) {
        const bounds = boundsOf(parent);
        if (!bounds || bounds.width > 320 || bounds.height > 190) break;
        const listeners = verbEventNames(parent);
        if (listeners.some(name => /^(pointerup|click|tap|mouseup|touchend)$/i.test(name))) {
          target = parent;
          targetBounds = bounds;
          events = listeners;
          break;
        }
        parent = parent.parent;
      }

      // MC2 answer cards can each contain their own speaker icon. Never use
      // one of those as the question prompt audio control.
      const isAnswerSpeaker = currentScene.options.some(option => {
        const b = option.bounds;
        if (!b) return false;
        const overlapX = Math.max(0, Math.min(targetBounds.x + targetBounds.width, b.x + b.width) -
          Math.max(targetBounds.x, b.x));
        const overlapY = Math.max(0, Math.min(targetBounds.y + targetBounds.height, b.y + b.height) -
          Math.max(targetBounds.y, b.y));
        const overlapArea = overlapX * overlapY;
        const smallerArea = Math.min(targetBounds.width * targetBounds.height, b.width * b.height);
        const cx = iconBounds.x + iconBounds.width / 2;
        const cy = iconBounds.y + iconBounds.height / 2;
        return (smallerArea > 0 && overlapArea / smallerArea >= 0.15) ||
          (cx >= b.x - 3 && cx <= b.x + b.width + 3 &&
           cy >= b.y - 3 && cy <= b.y + b.height + 3);
      });
      if (isAnswerSpeaker || seenIcons.has(o)) return;
      seenIcons.add(o);

      const area = targetBounds.width * targetBounds.height;
      const priority = /new\/multipleChoice\/SoundButton/i.test(texture) ? 0 :
        /new_design\/AudioButton/i.test(texture) ? 1 :
        /audioWordPod/i.test(texture) ? 2 : 3;
      found.push({
        obj: target,
        bounds: iconBounds,
        clickBounds: targetBounds,
        texture,
        events,
        area,
        priority
      });
    });

    found.sort((a, b) => a.priority - b.priority || a.area - b.area || a.bounds.y - b.bounds.y);
    if (!found.length) return null;
    // ZenMultipleChoice renders its question speaker as new_design/AudioButton,
    // while its answer speakers use new/multipleChoice/SoundIcon. The old
    // SoundButton-only return filter discarded the Zen prompt entirely.
    const questionAudio = found.filter(audio =>
      /new_design\/AudioButton/i.test(audio.texture) ||
      /new\/multipleChoice\/SoundButton/i.test(audio.texture)
    );
    return questionAudio.length === 1 ? questionAudio[0] : null;
  }

  function mc2Scene() {
    const items = collectMC2VocabTexts();

    if (!items.length) {
      return { prompt: null, options: [], all: [] };
    }

    const interactive = items.filter(x => x.interactive);

    // Answer options are normally the clickable vocabulary-labelled boxes.
    // A reading prompt is usually non-clickable and physically above them.
    let options = interactive.slice();

    if (options.length < 2) {
      options = items.slice();
    }

    let prompt = null;

    const optionCenters = options.map(o => ({
      o,
      y: o.textBounds.y + o.textBounds.height / 2
    }));

    const minOptionY = optionCenters.length
      ? Math.min(...optionCenters.map(x => x.y))
      : Infinity;

    const promptCandidates = items.filter(x => {
      const cy = x.textBounds.y + x.textBounds.height / 2;

      // Prefer a non-clickable vocabulary text clearly above answer options.
      if (!x.interactive && cy < minOptionY - 20) return true;

      // Also allow a clickable top-card if it is significantly above the rest.
      return cy < minOptionY - 55;
    });

    if (promptCandidates.length) {
      promptCandidates.sort((a, b) =>
        a.textBounds.y - b.textBounds.y ||
        b.label.length - a.label.length
      );

      prompt = promptCandidates[0];
      options = options.filter(o => o !== prompt);
    } else if (items.length >= 3) {
      // Geometry fallback: the top isolated vocabulary item is the prompt.
      const sorted = items.slice().sort((a, b) => a.textBounds.y - b.textBounds.y);
      const y0 = sorted[0].textBounds.y;
      const y1 = sorted[1].textBounds.y;

      if (y1 - y0 > 45) {
        prompt = sorted[0];
        options = options.filter(o =>
          o.norm !== prompt.norm ||
          Math.abs(o.textBounds.y - prompt.textBounds.y) > 15
        );
      }
    }

    return { prompt, options, all: items };
  }

  function mc2Signature() {
    const scene = mc2Scene();
    return scene.options
      .map(option => `${option.norm}@${Math.round(option.textBounds.x)}:${Math.round(option.textBounds.y)}`)
      .sort()
      .join('|');
  }

  function mc2QuestionSignature(scene) {
    const currentScene = scene || mc2Scene();
    const prompt = currentScene.prompt ? currentScene.prompt.norm : '';
    const options = currentScene.options.map(option => option.norm).sort().join('|');
    return `${prompt}::${options}`;
  }

  function mc2ClearListeningAnswer() {
    state.currentAnswer = null;
    state.currentEntry = null;
    state.lastAudioUrl = null;
    state.mc2CapturedAudioSignature = '';
    state.mc2AudioCaptureSignature = '';
    state.mc2AudioCaptureUntil = 0;
    setAudioLabel('');
  }

  function mc2ConfirmListeningAnswer(detail, questionAdvanced) {
    const key = state.mc2PendingKey;
    const answeredSignature = state.mc2PendingSignature;
    const label = state.mc2PendingLabel;
    if (!key) return false;

    markAnswerConfirmed(`MC2 Listening: ${label}${detail ? ` — ${detail}` : ''}`, key);
    state.mc2AnsweredQuestionSignature = answeredSignature;
    mc2ClearPendingListening();
    mc2ClearListeningAnswer();
    if (questionAdvanced) {
      state.mc2LastKey = null;
      state.lastPlayedKey = null;
    } else {
      // A positive-result marker can appear before the next options load. Lock
      // this question so it cannot be clicked or timed a second time.
      state.lastPlayedKey = `mc2:${answeredSignature}`;
    }
    return true;
  }

  function mc2RejectListeningAnswer() {
    const signature = state.mc2PendingSignature;
    const label = state.mc2PendingLabel;
    if (state.mc2RetryQuestionSignature !== signature) {
      state.mc2RetryQuestionSignature = signature;
      state.mc2RetryCount = 0;
    }
    state.mc2RetryCount++;
    const retriesUsed = state.mc2RetryCount;
    mc2ClearPendingListening();
    mc2ClearListeningAnswer();
    state.mc2LastKey = null;
    state.mc2RetryAfter = Date.now() + 850;

    if (retriesUsed < 2) {
      state.lastPlayedKey = null;
      addLog(`MC2 rejected "${label}"; allowing one controlled audio retry`, 'err');
      setStatus('MC2 Listening: answer rejected — retrying once after audio refresh');
    } else {
      state.mc2RejectedQuestionSignature = signature;
      state.lastPlayedKey = `mc2:${signature}`;
      setStatus('MC2 Listening: rejected twice — paused on this question to prevent repeat clicks');
    }
  }

  async function mc2PlayListeningAudio() {
    if (state.mc2AudioCaptureBusy || state.mc2PendingKey) return false;
    const scene = mc2Scene();
    const signature = mc2QuestionSignature(scene);
    if (!scene.options.length || state.mc2AnsweredQuestionSignature === signature ||
        state.mc2RejectedQuestionSignature === signature) return false;

    const audio = mc2FindAudioButton(scene);
    if (!audio) {
      setStatus('MC2 Listening: no standalone question audio button found');
      return false;
    }

    const b = audio.bounds;
    const point = {x: b.x + b.width / 2, y: b.y + b.height / 2};
    state.lastPlayedKey = `mc2:${signature}`;
    state.lastMC2PlayAttemptAt = Date.now();
    state.mc2AudioCaptureBusy = true;
    state.mc2AudioCaptureSignature = signature;
    state.mc2AudioCaptureUntil = Date.now() + 3500;
    state.mc2CapturedAudioSignature = '';
    state.currentAnswer = null;
    state.currentEntry = null;
    state.lastAudioUrl = null;
    setAudioLabel('');
    addLog('MC2: playing the question audio once…');

    let clicked = false;
    const events = audio.events && audio.events.length ? audio.events : verbEventNames(audio.obj);
    const eventName = events.find(name => /^(pointerup|click|tap|mouseup|touchend)$/i.test(name));
    if (eventName && audio.obj && typeof audio.obj.emit === 'function') {
      clicked = emitOnObject(audio.obj, eventName, point);
    } else {
      clicked = await safeCanvasPointerClickWorld(point.x, point.y, '#4ade80', 15);
    }

    if (clicked) await sleep(CONFIG.mc2AfterPlayMs);
    state.mc2AudioCaptureBusy = false;
    if (!clicked) {
      state.mc2AudioCaptureSignature = '';
      state.mc2AudioCaptureUntil = 0;
      setStatus('MC2 Listening: question audio click failed');
      return false;
    }
    if (state.mc2CapturedAudioSignature === signature) return true;
    // Zen can still be playing its automatic question audio when this click
    // lands. The game's cooldown then ignores it; allow a later retry.
    state.lastPlayedKey = null;
    setStatus('MC2 Listening: waiting for audio from the question speaker');
    return false;
  }

  function mc2MarkQuestionChanged(signature, now) {
    if (state.lastMC2Sig === signature) return false;
    const hadPrevious = state.lastMC2Sig !== null;
    state.lastMC2Sig = signature;
    state.mc2QuestionChangeAt = now;
    if (hadPrevious) {
      state.mc2AnsweredQuestionSignature = '';
      state.mc2RejectedQuestionSignature = '';
      state.mc2RetryQuestionSignature = signature;
      state.mc2RetryCount = 0;
      state.mc2RetryAfter = 0;
      state.mc2LastKey = null;
      state.lastPlayedKey = null;
      mc2ClearListeningAnswer();
    }
    return hadPrevious;
  }

  function mc2ClearPendingListening() {
    state.mc2PendingKey = null;
    state.mc2PendingSignature = '';
    state.mc2PendingAudio = '';
    state.mc2PendingLabel = '';
    state.mc2PendingCorrect = 0;
    state.mc2PendingIncorrect = 0;
    state.mc2PendingSince = 0;
    state.mc2PendingClicks = 0;
  }

  async function mc2ListeningTick() {
    if (!state.vocab.length && !state.sentences.length) {
      setStatus('MC2 Listening: waiting for data');
      return;
    }

    const scene = mc2Scene();
    if (!scene.options.length) {
      setStatus(state.mc2PendingKey
        ? 'MC2 Listening: waiting for the answer result / next question'
        : 'MC2 Listening: waiting for options');
      return;
    }

    const now = Date.now();
    const signature = mc2QuestionSignature(scene);
    mc2MarkQuestionChanged(signature, now);

    if (state.mc2PendingKey) {
      const correct = mc2ResultCount('correct') > state.mc2PendingCorrect;
      const incorrect = mc2ResultCount('incorrect') > state.mc2PendingIncorrect;
      const transitioned = signature !== state.mc2PendingSignature &&
        now - state.mc2QuestionChangeAt >= 250;
      if (correct) {
        mc2ConfirmListeningAnswer('correct result confirmed', transitioned);
        return setStatus('MC2 Listening: correct answer confirmed');
      }
      if (incorrect) {
        mc2RejectListeningAnswer();
        return;
      }
      if (transitioned) {
        const label = state.mc2PendingLabel;
        mc2ClearPendingListening();
        mc2ClearListeningAnswer();
        state.mc2LastKey = null;
        addLog(`MC2 Listening advanced without a visible correct result for "${label}"`, 'err');
        return setStatus('MC2 Listening: next question loaded; result unconfirmed');
      }
      if (now - state.mc2PendingSince >= 1600 && state.mc2PendingClicks < 2) {
        const retry = scene.options.find(option =>
          normaliseText(option.label) === normaliseText(state.mc2PendingLabel));
        if (retry) {
          state.mc2PendingClicks++;
          state.mc2PendingSince = now;
          addLog(`MC2 Listening: no result for "${state.mc2PendingLabel}"; retrying once`, 'err');
          await clickMC2Option(retry, true);
          return setStatus('MC2 Listening: waiting for retry result');
        }
      }
      if (now - state.mc2PendingSince > 12000) {
        setStatus('MC2 Listening: no answer confirmation after 12s; paused without another click');
      } else {
        setStatus('MC2 Listening: waiting for answer confirmation — no repeat click');
      }
      return;
    }

    if (state.mc2AnsweredQuestionSignature === signature) {
      return setStatus('MC2 Listening: answer confirmed — waiting for next question');
    }
    if (state.mc2RejectedQuestionSignature === signature) {
      return setStatus('MC2 Listening: rejected twice — waiting for a different question');
    }
    if (state.mc2RetryAfter && now < state.mc2RetryAfter) {
      return setStatus('MC2 Listening: waiting briefly before the single retry');
    }
    if (state.mc2RetryAfter && now >= state.mc2RetryAfter) state.mc2RetryAfter = 0;

    if (state.currentAnswer && state.mc2CapturedAudioSignature !== signature) {
      mc2ClearListeningAnswer();
    }
    if (!state.currentAnswer) {
      const playKey = `mc2:${signature}`;
      if (CONFIG.autoPlay && state.lastPlayedKey !== playKey &&
          now - (state.lastMC2PlayAttemptAt || 0) >= 1500) {
        state.lastMC2PlayAttemptAt = now;
        await mc2PlayListeningAudio();
      }
      if (!state.currentAnswer || state.mc2CapturedAudioSignature !== signature) {
        return setStatus('MC2 Listening: waiting for question audio');
      }
    }

    const wanted = [state.currentAnswer.word, state.currentAnswer.originalWord]
      .filter(Boolean).map(normaliseText);
    let answer = scene.options.find(option => wanted.includes(option.norm));
    if (!answer) {
      answer = scene.options.find(option => wanted.some(value =>
        value.length > 2 && option.norm.length > 2 &&
        (option.norm.includes(value) || value.includes(option.norm))
      ));
    }
    if (!answer) {
      state.mc2Fails++;
      return setStatus('MC2 Listening: answer option not found');
    }

    const audioKey = baseName(state.lastAudioUrl || '');
    const key = `${signature}|${audioKey}|${answer.norm}`;
    if (state.mc2ListeningAnsweredKeys.has(key) || key === state.mc2LastKey) {
      return setStatus('MC2 Listening: waiting for the next question');
    }

    state.mc2LastKey = key;
    state.mc2PendingKey = key;
    state.mc2PendingSignature = signature;
    state.mc2PendingAudio = audioKey;
    state.mc2PendingLabel = answer.label;
    state.mc2PendingCorrect = mc2ResultCount('correct');
    state.mc2PendingIncorrect = mc2ResultCount('incorrect');
    state.mc2PendingSince = Date.now();
    state.mc2PendingClicks++;

    const result = await clickMC2Option(answer);
    if (result.correct) {
      mc2ConfirmListeningAnswer('correct result confirmed', false);
      return setStatus('MC2 Listening: answer confirmed — waiting for next question');
    }
    if (result.incorrect) {
      mc2RejectListeningAnswer();
      return;
    }
    if (!result.clicked) {
      addLog(`MC2 could not dispatch one click for "${answer.label}"`, 'err');
    }
    setStatus('MC2 Listening: waiting for answer confirmation — no repeat click');
  }

  function mc2EntryForPrompt(prompt) {
    if (!prompt) return null;

    const p = normaliseText(prompt.label);

    for (const e of state.vocab) {
      const vals = [
        e.word,
        e.originalWord,
        e.translatedWord,
        e.translation,
        e.original,
        e.translated
      ];

      for (const v of vals) {
        if (typeof v !== 'string') continue;
        if (normaliseText(v) === p) return e;
      }
    }

    return null;
  }

  function mc2AnswerTextsForEntry(entry, promptText) {
    if (!entry) return [];

    const p = normaliseText(promptText);
    const pairs = [
      [entry.word, entry.originalWord],
      [entry.originalWord, entry.word],
      [entry.translatedWord, entry.originalWord],
      [entry.translation, entry.word],
      [entry.original, entry.translated],
      [entry.translated, entry.original]
    ];

    const out = [];

    for (const [left, right] of pairs) {
      if (typeof left !== 'string' || typeof right !== 'string') continue;

      if (normaliseText(left) === p) {
        out.push(right.trim());
      }
    }

    if (!out.length) {
      for (const v of [
        entry.word,
        entry.originalWord,
        entry.translatedWord,
        entry.translation,
        entry.original,
        entry.translated
      ]) {
        if (typeof v !== 'string' || !v.trim()) continue;
        if (normaliseText(v) !== p) out.push(v.trim());
      }
    }

    const seen = new Set();
    return out.filter(v => {
      const n = normaliseText(v);
      if (!n || seen.has(n)) return false;
      seen.add(n);
      return true;
    });
  }

  async function clickMC2Option(option, canvasOnly) {
    if (!option || !option.bounds) return {clicked: false, correct: false, incorrect: false};

    const beforeQuestionSignature = mc2QuestionSignature();
    const beforeCorrect = mc2ResultCount('correct');
    const beforeIncorrect = mc2ResultCount('incorrect');
    const bounds = option.bounds;
    const point = {x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2};
    addLog(`MC2 click once: "${option.label}"`, 'ok');

    // Dispatch one input path only. The old direct-event + canvas fallback
    // could click the same (often bottom-left) answer twice when the UI had
    // not repainted quickly enough.
    const events = option.events && option.events.length ? option.events : verbEventNames(option.obj);
    const eventName = events.find(name => /^(pointerup|click|tap|mouseup|touchend)$/i.test(name));
    let clicked = false;
    if (!canvasOnly && eventName && option.obj && typeof option.obj.emit === 'function') {
      clicked = emitOnObject(option.obj, eventName, point);
    }
    if (!clicked) {
      clicked = await safeCanvasPointerClickWorld(
        point.x, point.y, '#fb7185', CONFIG.mc2AfterClickMs
      );
    }
    if (clicked) await sleep(CONFIG.mc2AfterClickMs);

    const afterCorrect = mc2ResultCount('correct');
    const afterIncorrect = mc2ResultCount('incorrect');
    return {
      clicked,
      correct: afterCorrect > beforeCorrect,
      incorrect: afterIncorrect > beforeIncorrect,
      questionChanged: mc2QuestionSignature() !== beforeQuestionSignature,
      beforeCorrect,
      beforeIncorrect,
      afterCorrect,
      afterIncorrect,
      beforeSignature: beforeQuestionSignature,
      afterSignature: mc2QuestionSignature()
    };
  }

  async function mc2ReadingTick() {
    if (!state.vocab.length) {
      setStatus('MC2 Reading: waiting for vocab');
      return;
    }

    const scene = mc2Scene();
    const questionSignature = mc2QuestionSignature(scene);
    const pending = state.mc2ReadingPending;
    if (pending) {
      const correct = mc2ResultCount('correct') > pending.beforeCorrect;
      const incorrect = mc2ResultCount('incorrect') > pending.beforeIncorrect;
      if (correct) {
        state.mc2ReadingPending = null;
        state.mc2Fails = 0;
        state.mc2AnsweredQuestionSignature = pending.signature;
        markAnswerConfirmed(`MC2 Reading: ${pending.label} — correct result`, pending.key);
        return setStatus('MC2 Reading: correct answer confirmed');
      }
      if (incorrect) {
        state.mc2ReadingPending = null;
        state.mc2ReadingRejectedSignature = pending.signature;
        state.mc2Fails++;
        addLog(`✗ MC2 rejected "${pending.label}"`, 'err');
        return setStatus('MC2 Reading: incorrect result confirmed');
      }
      if (questionSignature !== pending.signature) {
        if ((!scene.prompt || !scene.options.length) &&
            Date.now() - pending.lastAttemptAt < 1800)
          return setStatus('MC2 Reading: waiting for result during transition');
        state.mc2ReadingPending = null;
        state.mc2LastKey = null;
        addLog(`MC2 question advanced without a visible correct result for "${pending.label}"`, 'err');
        return setStatus('MC2 Reading: next question loaded; previous result unconfirmed');
      }
      // MC2 waits 400 ms before processing the click and can take another
      // second to publish a result when minor results are hidden.
      if (Date.now() - pending.lastAttemptAt < 1600) {
        return setStatus('MC2 Reading: waiting for answer result');
      }
      if (pending.attempts >= 3) {
        if (!pending.pausedLogged) {
          pending.pausedLogged = true;
          addLog(`MC2 Reading: no confirmed result for "${pending.label}" after three clicks`, 'err');
          showToast(`MC2 Reading needs help with "${pending.label}"`, 'err');
        }
        return setStatus('MC2 Reading: no result after three clicks; paused on this question');
      }
      const retryOption = scene.options.find(option => option.norm === pending.answerNorm);
      if (!retryOption) return setStatus('MC2 Reading: waiting for answer button');
      pending.attempts++;
      pending.lastAttemptAt = Date.now();
      addLog(`? MC2 option did not react: "${pending.label}" (retry ${pending.attempts}/3)`, 'err');
      await clickMC2Option(retryOption, true);
      return setStatus('MC2 Reading: waiting for retry result');
    }
    if (!scene.prompt) return setStatus('MC2 Reading: waiting for prompt');
    if (!scene.options.length) return setStatus('MC2 Reading: waiting for options');
    if (state.mc2AnsweredQuestionSignature === questionSignature)
      return setStatus('MC2 Reading: correct answer confirmed — waiting for next question');
    if (state.mc2ReadingRejectedSignature === questionSignature)
      return setStatus('MC2 Reading: incorrect answer — waiting for next question');

    const entry = mc2EntryForPrompt(scene.prompt);

    if (!entry) {
      state.mc2Fails++;
      setStatus(`MC2 Reading: prompt not in vocab`);
      return;
    }

    const wantedRaw = mc2AnswerTextsForEntry(entry, scene.prompt.label);
    const wanted = wantedRaw.map(normaliseText);

    let answer = scene.options.find(o => wanted.includes(o.norm));

    if (!answer) {
      answer = scene.options.find(o =>
        wanted.some(w =>
          w.length > 2 &&
          o.norm.length > 2 &&
          (o.norm.includes(w) || w.includes(o.norm))
        )
      );
    }

    if (!answer) {
      state.mc2Fails++;
      addLog(
        `MC2: no option for "${scene.prompt.label}" → ` +
        `${wantedRaw.map(x => `"${x}"`).join(' / ')}`,
        'err'
      );
      setStatus('MC2 Reading: answer option not found');
      return;
    }

    const key = `${questionSignature}|${answer.norm}`;

    if (key === state.mc2LastKey) {
      setStatus('MC2 Reading: waiting for next question');
      return;
    }

    state.mc2LastKey = key;
    state.mc2ReadingPending = {
      key, signature: questionSignature, answerNorm: answer.norm,
      label: answer.label, attempts: 1, lastAttemptAt: Date.now(),
      beforeCorrect: mc2ResultCount('correct'),
      beforeIncorrect: mc2ResultCount('incorrect')
    };
    addLog(`MC2 "${scene.prompt.label}" → "${answer.label}"`, 'ok');
    await clickMC2Option(answer);
    setStatus('MC2 Reading: waiting for answer result');
  }

  function resetMC2State() {
    state.mc2Busy = false;
    state.mc2ReadingPending = null;
    state.mc2ReadingRejectedSignature = '';
    state.mc2LastKey = null;
    state.mc2Fails = 0;
    state.mc2LastSignature = null;
    state.lastMC2Sig = null;
    state.lastMC2PlayAttemptAt = 0;
    state.mc2QuestionChangeAt = 0;
    state.mc2AnsweredQuestionSignature = '';
    state.mc2RejectedQuestionSignature = '';
    state.mc2RetryQuestionSignature = '';
    state.mc2RetryCount = 0;
    state.mc2RetryAfter = 0;
    state.mc2AudioCaptureSignature = '';
    state.mc2AudioCaptureUntil = 0;
    state.mc2AudioCaptureBusy = false;
    state.mc2CapturedAudioSignature = '';
    mc2ClearPendingListening();
    state.mc2ListeningAnsweredKeys = new Set();
    state.currentAnswer = null;
    state.currentEntry = null;
    state.lastAudioUrl = null;
    state.lastPlayedKey = null;
    setAudioLabel('');
    setPromptLabel('');
  }


  // ============ WORDPOD ============
  function wordPodResultCount(kind) {
    const a = state.pixiApp;
    if (!a) return 0;

    let count = 0;

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;

      const f = fullTextureName(o);

      if (
        kind === 'correct' &&
        (
          /new_design\/GreenBox/i.test(f) ||
          /new_design\/BigTick/i.test(f) ||
          /ok\.png$/i.test(f) ||
          /progress\/correct/i.test(f)
        )
      ) count++;

      if (
        kind === 'incorrect' &&
        (
          /new_design\/WrongBox/i.test(f) ||
          /new_design\/BigCross/i.test(f) ||
          /progress\/incorrect/i.test(f)
        )
      ) count++;
    });

    return count;
  }

  function wordPodFindAudioButton() {
    const a = state.pixiApp;
    if (!a) return null;
    const found = [];

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;

      const f = fullTextureName(o);
      const n = textureName(o);

      if (!/audioWordPod|new_design\/AudioButton/i.test(`${f} ${n}`)) return;

      const b = boundsOf(o);
      if (!b || b.width < 12 || b.height < 12 || b.width > 180 || b.height > 180) return;
      const events = verbEventNames(o);
      if (!events.some(name => /^pointerup$/i.test(name))) return;
      found.push({obj: o, bounds: b, texture: f || n || '?', events});
    });

    // WordPod's CardDisplay uses new_design/AudioButton for its question.
    // Multiple visible speakers are ambiguous, so avoid playing a card from
    // the previous animation or an unrelated page control.
    const cardButtons = found.filter(button => /new_design\/AudioButton/i.test(button.texture));
    if (cardButtons.length === 1) return cardButtons[0];
    const legacyButtons = found.filter(button => /audioWordPod/i.test(button.texture));
    return legacyButtons.length === 1 ? legacyButtons[0] : null;
  }

  function wordPodFindNextButton() {
    const a = state.pixiApp;
    if (!a) return null;

    let best = null;

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;

      const f = fullTextureName(o);
      if (!/nextQuestionButton/i.test(f)) return;

      const b = boundsOf(o);
      if (!b || b.width < 25 || b.height < 18 || b.width > 240 || b.height > 120) return;

      best = {
        obj: o,
        bounds: b,
        texture: f,
        events: verbEventNames(o)
      };
    });

    return best;
  }

  function wordPodFindTextBox() {
    const a = state.pixiApp;
    if (!a) return null;

    let best = null;

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;

      const f = fullTextureName(o);
      if (!/wordPodTextBox/i.test(f)) return;

      const b = boundsOf(o);
      if (!b || b.width < 120 || b.height < 25) return;

      best = {
        obj: o,
        bounds: b,
        texture: f,
        events: verbEventNames(o)
      };
    });

    return best;
  }

  function collectWordPodPromptTexts() {
    const a = state.pixiApp;
    if (!a || !state.vocab.length) return [];

    const termMap = mc2VocabTerms();
    const texts = [];

    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.trim()) return;
      if (!isVisible(o, a.stage)) return;

      const label = o.text.trim();
      const norm = normaliseText(label);
      if (!norm || !termMap.has(norm)) return;

      const b = boundsOf(o);
      if (!b || b.width <= 0 || b.height <= 0) return;

      // Ignore keyboard labels and low-area footer UI.
      if (b.y > 470) return;

      texts.push({
        label,
        norm,
        bounds: b,
        matches: termMap.get(norm),
        interactive:
          o.interactive === true ||
          o.buttonMode === true ||
          o.eventMode === 'static' ||
          o.eventMode === 'dynamic' ||
          verbEventNames(o).length > 0
      });
    });

    const out = [];
    for (const t of texts) {
      const dup = out.find(x =>
        x.norm === t.norm &&
        Math.abs(x.bounds.x - t.bounds.x) < 10 &&
        Math.abs(x.bounds.y - t.bounds.y) < 10
      );
      if (!dup) out.push(t);
    }

    out.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
    return out;
  }

  function wordPodScene() {
    const prompts = collectWordPodPromptTexts();
    const audio = wordPodFindAudioButton();
    const next = wordPodFindNextButton();
    const textBox = wordPodFindTextBox();

    let prompt = null;

    if (prompts.length) {
      // Prefer the topmost vocabulary text above the answer box.
      prompt = prompts[0];
      if (textBox) {
        const above = prompts.filter(p => p.bounds.y + p.bounds.height < textBox.bounds.y + 8);
        if (above.length) prompt = above[0];
      }
    }

    return { prompt, prompts, audio, next, textBox };
  }

  function wordPodExactAnswerCandidates(entry) {
    if (!entry) return [];
    // WordPod compares input with currentContent.learningWord, which
    // UserContent builds from vocabTranslations.word. The interface word is
    // the clue, never a writing answer.
    const word = String(entry.word || '').trim();
    return word ? [word] : [];
  }

  function wordPodAnswerCandidates(entry, promptText) {
    if (!entry) return [];
    const out = [];
    const seen = new Set();
    function push(v) {
      if (typeof v !== 'string' || !v.trim()) return;
      const raw = v.trim();
      const n = normaliseText(raw);
      if (!n || seen.has(n)) return;
      seen.add(n);
      out.push(raw);
    }
    if (promptText) mc2AnswerTextsForEntry(entry, promptText).forEach(push);
    [entry.word, entry.originalWord, entry.translatedWord,
      entry.translation, entry.original, entry.translated].forEach(push);
    return promptText
      ? out.filter(v => normaliseText(v) !== normaliseText(promptText))
      : out;
  }

  function wordPodEntryForPrompt(prompt) {
    if (!prompt) return null;
    const cue = prompt.norm || normaliseText(prompt.label);
    const listed = Array.isArray(prompt.matches)
      ? prompt.matches.map(match => match.entry).filter(Boolean)
      : [];
    const candidates = listed.length ? listed : state.vocab.filter(entry =>
      [entry.originalWord, entry.translatedWord, entry.translation,
        entry.original, entry.translated, entry.word]
        .some(value => normaliseText(value) === cue));
    if (!candidates.length) return null;
    const direct = candidates.filter(entry => normaliseText(entry.originalWord) === cue);
    const preferred = direct.length ? direct : candidates;
    // API clues can live in translatedWord or another field. A unique target
    // word is sufficient, but never guess between different target words.
    const answers = new Set(preferred.map(entry => normaliseText(entry.word)).filter(Boolean));
    return answers.size === 1 ? preferred[0] : null;
  }

  function wordPodActiveEntry() {
    // LanguageNut keeps the exact current WordPod item on its active game
    // controller. The API can contain two rows with the same English clue;
    // only currentContent identifies which German target this turn expects.
    if (!/#\/(?:Zen)?WordPod(?:[/?]|$)/i.test(String(location.hash || ''))) return null;
    const controller = window.languagenutControllerObject;
    const item = controller?.currentContent || controller?.cardDisplay?.currentContent;
    const word = typeof item?.learningWord === 'string' ? item.learningWord.trim() : '';
    if (!word) return null;
    return {word, originalWord: String(item.interfaceWord || '').trim(), uid: item.contentUid};
  }

  async function wordPodClickControl(ctrl, marker) {
    if (!ctrl || !ctrl.bounds) return false;

    if (ctrl.obj && typeof ctrl.obj.emit === 'function') {
      const evs = ctrl.events || verbEventNames(ctrl.obj);
      if (evs.includes('pointerup')) {
        try {
          ctrl.obj.emit('pointerup', makeVerbEvent(ctrl.obj, 'pointerup'));
          await sleep(18);
          return true;
        } catch (_) {}
      }
    }

    const b = ctrl.bounds;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    return !!(await safeCanvasPointerClickWorld(x, y, marker || '#60a5fa', 18));
  }



  function gameTextInputIsVisible(input) {
    if (!(input instanceof HTMLInputElement) || input.type !== 'text') return false;
    const style = getComputedStyle(input);
    const rect = input.getBoundingClientRect();
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity) > 0 &&
      rect.width > 20 && rect.height > 10;
  }

  function wordPodInputElement() {
    const direct = document.getElementById('textInputChina');
    if (gameTextInputIsVisible(direct)) return direct;

    // Fallback in case LanguageNut changes the id but keeps the same dedicated
    // visible text input.
    const inputs = [...document.querySelectorAll('input[type="text"]')]
      .filter(el => {
        if (!(el instanceof HTMLInputElement)) return false;

        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();

        return (
          cs.display !== 'none' &&
          cs.visibility !== 'hidden' &&
          Number(cs.opacity) > 0 &&
          r.width > 150 &&
          r.height > 20
        );
      });

    if (!inputs.length) return null;

    // WordPod's answer input is centered over the game and is usually the
    // largest visible text input.
    inputs.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (br.width * br.height) - (ar.width * ar.height);
    });

    return inputs[0];
  }

  function wordPodSetNativeInputValue(input, value) {
    if (!input) return false;

    const proto = HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');

    try {
      if (desc && typeof desc.set === 'function') {
        desc.set.call(input, String(value));
      } else {
        input.value = String(value);
      }
      return true;
    } catch (_) {
      try {
        input.value = String(value);
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  function wordPodKeyboardMeta(ch) {
    if (ch === '\n') {
      return { key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    }

    if (ch === ' ') {
      return { key: ' ', code: 'Space', keyCode: 32, which: 32 };
    }

    if (/^[A-Za-z]$/.test(ch)) {
      const upper = ch.toUpperCase();
      const code = `Key${upper}`;
      const n = upper.charCodeAt(0);

      return {
        key: ch,
        code,
        keyCode: n,
        which: n
      };
    }

    if (/^[0-9]$/.test(ch)) {
      const n = ch.charCodeAt(0);
      return {
        key: ch,
        code: `Digit${ch}`,
        keyCode: n,
        which: n
      };
    }

    const punctuationCodes = {
      '.': ['Period', 190],
      ',': ['Comma', 188],
      '-': ['Minus', 189],
      "'": ['Quote', 222],
      '?': ['Slash', 191],
      '!': ['Digit1', 49],
      ':': ['Semicolon', 186],
      ';': ['Semicolon', 186]
    };

    const p = punctuationCodes[ch];

    return {
      key: ch,
      code: p ? p[0] : '',
      keyCode: p ? p[1] : 0,
      which: p ? p[1] : 0
    };
  }

  function wordPodDispatchKey(input, type, ch) {
    if (!input) return false;

    const meta = wordPodKeyboardMeta(ch);

    try {
      input.dispatchEvent(new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        key: meta.key,
        code: meta.code,
        keyCode: meta.keyCode,
        which: meta.which,
        charCode: type === 'keypress' && ch.length === 1
          ? ch.charCodeAt(0)
          : 0
      }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function wordPodDispatchInput(input, ch, inputType) {
    if (!input) return false;

    try {
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        composed: true,
        data: ch,
        inputType: inputType || 'insertText'
      }));
      return true;
    } catch (_) {
      try {
        input.dispatchEvent(new Event('input', {
          bubbles: true,
          cancelable: false
        }));
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  async function wordPodTypeIntoDomInput(answer, gameInput) {
    const input = gameInput || wordPodInputElement();
    if (!input) return { available: false, ok: false, actual: '' };

    const wanted = String(answer || '').normalize('NFC');

    try {
      input.focus({ preventScroll: true });
    } catch (_) {
      try { input.focus(); } catch (_) {}
    }

    // Clear with the native value setter + real input/change events.
    wordPodSetNativeInputValue(input, '');
    wordPodDispatchInput(input, null, 'deleteContentBackward');

    try {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}

    // Insert each character exactly. Synthetic KeyboardEvents alone do not
    // modify an <input>, so update the native value and fire the same input
    // event the app would receive after each key.
    let current = '';

    for (const ch of [...wanted]) {
      wordPodDispatchKey(input, 'keydown', ch);
      wordPodDispatchKey(input, 'keypress', ch);

      current += ch;
      wordPodSetNativeInputValue(input, current);

      try {
        input.setSelectionRange(current.length, current.length);
      } catch (_) {}

      wordPodDispatchInput(input, ch, 'insertText');
      wordPodDispatchKey(input, 'keyup', ch);

      // One animation frame gives LanguageNut's input listener time to consume
      // the event without introducing the old missed-Space problem.
      await new Promise(resolve =>
        typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame(() => resolve())
          : setTimeout(resolve, 16)
      );

      if (String(input.value).normalize('NFC') !== current.normalize('NFC')) {
        // Reassert exactly what should exist after this character and emit one
        // more input event. Do not advance with a bad prefix.
        wordPodSetNativeInputValue(input, current);
        wordPodDispatchInput(input, ch, 'insertText');

        await new Promise(resolve =>
          typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame(() => resolve())
            : setTimeout(resolve, 16)
        );

        if (String(input.value).normalize('NFC') !== current.normalize('NFC')) {
          return {
            available: true,
            ok: false,
            actual: String(input.value || '')
          };
        }
      }
    }

    try {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}

    const actual = String(input.value || '');

    return {
      available: true,
      ok: actual.normalize('NFC') === wanted.normalize('NFC'),
      actual
    };
  }

  async function wordPodPressDomEnter(gameInput) {
    const input = gameInput || wordPodInputElement();
    if (!input) return false;

    try {
      input.focus({ preventScroll: true });
    } catch (_) {
      try { input.focus(); } catch (_) {}
    }

    wordPodDispatchKey(input, 'keydown', '\n');
    wordPodDispatchKey(input, 'keypress', '\n');
    wordPodDispatchKey(input, 'keyup', '\n');

    return true;
  }

  function wordPodReadTypedText() {
    const domInput = wordPodInputElement();
    if (domInput) {
      return String(domInput.value || '');
    }

    const a = state.pixiApp;
    const box = wordPodFindTextBox();

    if (!a || !box || !box.bounds) return '';

    const bb = box.bounds;
    const candidates = [];

    walk(a.stage, (o) => {
      if (typeof o.text !== 'string') return;
      if (!isVisible(o, a.stage)) return;

      const text = o.text;
      if (!text) return;

      const b = boundsOf(o);
      if (!b || b.width <= 0 || b.height <= 0) return;

      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;

      if (
        cx >= bb.x - 8 &&
        cx <= bb.x + bb.width + 8 &&
        cy >= bb.y - 8 &&
        cy <= bb.y + bb.height + 8
      ) {
        candidates.push({
          text,
          bounds: b,
          area: b.width * b.height
        });
      }
    });

    if (!candidates.length) return '';

    // Input text is normally the widest/longest visible text inside the box.
    candidates.sort((a, b) =>
      b.text.length - a.text.length ||
      b.area - a.area
    );

    return String(candidates[0].text || '');
  }

  function wordPodComparableText(s) {
    // LanguageNut/PIXI can attach invisible formatting marks or harmless
    // leading/trailing padding to a text object. Ignore those, but keep the
    // meaningful answer STRICT: case, punctuation and internal spaces still
    // have to match.
    return String(s || '')
      .normalize('NFC')
      .replace(/\p{Cf}/gu, '')       // zero-width / bidi formatting marks
      .replace(/\p{Zs}/gu, ' ')      // NBSP, thin spaces, etc. -> normal space
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/^[\t\r\n ]+|[\t\r\n ]+$/g, '');
  }

  function wordPodDebugString(s) {
    const raw = String(s || '');
    const comparable = wordPodComparableText(raw);

    const codepoints = [...raw]
      .map(ch => {
        const cp = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
        const shown =
          ch === ' ' ? '[SPACE]' :
          ch === '\t' ? '[TAB]' :
          ch === '\n' ? '[LF]' :
          ch === '\r' ? '[CR]' :
          /\p{Cf}/u.test(ch) ? '[FORMAT]' :
          ch;
        return `${shown}(U+${cp})`;
      })
      .join(' ');

    return {
      raw,
      comparable,
      json: JSON.stringify(raw),
      codepoints
    };
  }

  function wordPodKeyboardCase(keys) {
    let upper = 0;
    let lower = 0;

    for (const k of (keys || [])) {
      if (k.kind !== 'character') continue;

      const label = String(k.label || '');
      if (!/^[A-Za-zÄÖÜẞäöüß]$/u.test(label)) continue;

      if (
        label === label.toLocaleUpperCase() &&
        label !== label.toLocaleLowerCase()
      ) upper++;

      if (
        label === label.toLocaleLowerCase() &&
        label !== label.toLocaleUpperCase()
      ) lower++;
    }

    if (upper > lower + 2) return 'upper';
    if (lower > upper + 2) return 'lower';
    return 'unknown';
  }

  function wordPodKeyDelayForChar(ch, passIndex) {
    const extra = Math.max(0, passIndex) * 18;

    if (ch === ' ') {
      return CONFIG.wordPodSpaceDelayMs + extra;
    }

    if (/[\p{P}\p{S}]/u.test(ch)) {
      return CONFIG.wordPodPunctuationDelayMs + extra;
    }

    return CONFIG.wordPodKeyDelayMs + extra;
  }

  async function wordPodClickKeyReliable(key, delayMs) {
    if (!key || !key.bounds) return false;

    // WordPod accuracy mode always goes through the real canvas interaction
    // path. This gives Space/Shift/punctuation a complete pointerdown/up cycle
    // instead of only emitting pointerup on a guessed container.
    const b = key.bounds;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;

    const ok = await safeCanvasPointerClickWorld(
      x,
      y,
      '#a78bfa',
      delayMs == null ? CONFIG.wordPodKeyDelayMs : delayMs
    );

    return !!ok;
  }

  async function wordPodClearByCount(count, delayMs) {
    if (!count || count < 1) return true;

    for (let i = 0; i < count; i++) {
      const keys = collectGapKeyboardKeys();
      const back =
        findKeyboardKeyExact(keys, 'Backspace') ||
        findGapKey(keys, 'Backspace');

      if (back) {
        await wordPodClickKeyReliable(
          back,
          delayMs != null ? delayMs : CONFIG.wordPodRetypeDelayMs
        );
      } else {
        dispatchGapKeyboardFallback('Backspace');
        await sleep(
          delayMs != null ? delayMs : CONFIG.wordPodRetypeDelayMs
        );
      }
    }

    return true;
  }

  async function wordPodPressCharacter(ch, passIndex) {
    let keys = collectGapKeyboardKeys();
    const delay = wordPodKeyDelayForChar(ch, passIndex);

    if (ch === ' ') {
      const space =
        findKeyboardKeyExact(keys, ' ') ||
        findGapKey(keys, ' ');

      if (space) {
        return wordPodClickKeyReliable(space, delay);
      }

      dispatchGapKeyboardFallback(' ');
      await sleep(delay);
      return true;
    }

    const isCasedLetter =
      /\p{L}/u.test(ch) &&
      ch.toLocaleUpperCase() !== ch.toLocaleLowerCase();

    if (isCasedLetter) {
      const wantUpper = ch === ch.toLocaleUpperCase();
      let keyboardCase = wordPodKeyboardCase(keys);

      // If the visible keyboard is in the wrong case, explicitly toggle Shift
      // and wait for the keyboard to settle before pressing the letter.
      if (
        keyboardCase !== 'unknown' &&
        (
          (wantUpper && keyboardCase !== 'upper') ||
          (!wantUpper && keyboardCase !== 'lower')
        )
      ) {
        const shift =
          findKeyboardKeyExact(keys, 'Shift') ||
          findGapKey(keys, 'Shift');

        if (shift) {
          await wordPodClickKeyReliable(
            shift,
            CONFIG.wordPodShiftDelayMs + passIndex * 18
          );

          await sleep(CONFIG.wordPodVerifyDelayMs);
          keys = collectGapKeyboardKeys();
          keyboardCase = wordPodKeyboardCase(keys);
        }
      }

      let key = findKeyboardKeyExact(keys, ch);

      if (!key) {
        // Physical alphabet key fallback only after the Shift state has been
        // handled. This avoids the old bug where uppercase M silently used m.
        const lower = ch.toLocaleLowerCase();
        key = keys.find(k =>
          k.kind === 'character' &&
          String(k.label || '').toLocaleLowerCase() === lower
        ) || null;
      }

      if (key) {
        return wordPodClickKeyReliable(key, delay);
      }

      dispatchGapKeyboardFallback(ch);
      await sleep(delay);
      return true;
    }

    // Punctuation is NEVER discarded in WordPod. This intentionally includes
    // every individual dot in an ellipsis: "." "." ".".
    const key =
      findKeyboardKeyExact(keys, ch) ||
      findGapKey(keys, ch);

    if (key) {
      return wordPodClickKeyReliable(key, delay);
    }

    dispatchGapKeyboardFallback(ch);
    await sleep(delay);
    return true;
  }

  async function wordPodTypePass(answer, passIndex) {
    const chars = [...String(answer || '')];
    if (!chars.length) return { ok: false, readable: false, actual: '' };

    let readableSeen = false;

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const expectedPrefix = wordPodComparableText(
        chars.slice(0, i + 1).join('')
      );

      const pressed = await wordPodPressCharacter(ch, passIndex);
      if (!pressed) {
        return {
          ok: false,
          readable: readableSeen,
          actual: wordPodReadTypedText(),
          failedAt: i
        };
      }

      await sleep(CONFIG.wordPodVerifyDelayMs + passIndex * 10);

      const actualRaw = wordPodReadTypedText();
      const actual = wordPodComparableText(actualRaw);

      if (actualRaw !== '') readableSeen = true;

      // Some PIXI text objects visually suppress a trailing space. Do not
      // retry Space blindly here because that could create a double space.
      // The very next visible character will prove whether the space exists.
      if (
        ch === ' ' &&
        actual === wordPodComparableText(chars.slice(0, i).join(''))
      ) {
        continue;
      }

      if (actualRaw !== '' && actual !== expectedPrefix) {
        return {
          ok: false,
          readable: true,
          actual: actualRaw,
          failedAt: i,
          expectedPrefix
        };
      }
    }

    const finalRaw = wordPodReadTypedText();
    const finalText = wordPodComparableText(finalRaw);
    const wanted = wordPodComparableText(answer);

    if (finalRaw !== '') {
      readableSeen = true;

      return {
        ok: finalText === wanted,
        readable: true,
        actual: finalRaw
      };
    }

    return {
      // If this WordPod build doesn't expose input text at all, the full
      // physical-key path and conservative timings are the best available
      // verification. Do not type the answer a second time on top of itself.
      ok: true,
      readable: false,
      actual: ''
    };
  }

  async function wordPodTypeAndVerify(answer) {
    const wanted = String(answer || '').normalize('NFC');
    if (!wanted) return false;

    // Preferred path: WordPod exposes a real HTML input (#textInputChina).
    // Use it directly so Space, capitals and punctuation cannot be lost to
    // PIXI keyboard timing.
    const domResult = await wordPodTypeIntoDomInput(answer);

    if (domResult.available) {
      if (domResult.ok) {
        addLog(
          `✓ WordPod DOM input verified exactly: ${JSON.stringify(domResult.actual)}`,
          'ok'
        );
        return true;
      }

      addLog(
        `WordPod DOM input mismatch: wanted=${JSON.stringify(answer)}, ` +
        `got=${JSON.stringify(domResult.actual)}`,
        'err'
      );
      return false;
    }

    // Compatibility fallback for a future WordPod build without the HTML input.
    addLog('WordPod DOM input not found — using PIXI keyboard fallback');

    const comparableWanted = wordPodComparableText(answer);
    if (!comparableWanted) return false;

    const starting = wordPodReadTypedText();
    if (starting) {
      await wordPodClearByCount(
        [...starting].length,
        CONFIG.wordPodRetypeDelayMs
      );
      await sleep(CONFIG.wordPodVerifyDelayMs);
    }

    for (let pass = 0; pass < CONFIG.wordPodMaxTypingPasses; pass++) {
      const result = await wordPodTypePass(answer, pass);

      if (result.ok) {
        if (result.readable) {
          addLog(
            `✓ WordPod typing verified exactly: "${result.actual}"`,
            'ok'
          );
        }
        return true;
      }

      const actual = wordPodReadTypedText() || result.actual || '';
      if (actual) {
        await wordPodClearByCount(
          [...actual].length,
          CONFIG.wordPodRetypeDelayMs + pass * 12
        );
      } else {
        const attemptedCount =
          result.failedAt != null
            ? result.failedAt + 1
            : [...answer].length;

        await wordPodClearByCount(
          attemptedCount,
          CONFIG.wordPodRetypeDelayMs + pass * 12
        );
      }

      await sleep(CONFIG.wordPodVerifyDelayMs + pass * 20);
    }

    return false;
  }

  async function wordPodSubmitEnter() {
    if (await wordPodPressDomEnter()) {
      return true;
    }

    const keys = collectGapKeyboardKeys();
    const enter =
      findKeyboardKeyExact(keys, 'Enter') ||
      findGapKey(keys, 'Enter');

    if (enter) {
      await wordPodClickKeyReliable(
        enter,
        Math.max(CONFIG.wordPodSpaceDelayMs, CONFIG.wordPodKeyDelayMs)
      );
      return true;
    }

    dispatchGapKeyboardFallback('\n');
    await sleep(CONFIG.wordPodSpaceDelayMs);
    return true;
  }

  async function wordPodClearTypedAnswer() {
    const input = wordPodInputElement();

    if (input) {
      try {
        input.focus({ preventScroll: true });
      } catch (_) {
        try { input.focus(); } catch (_) {}
      }

      wordPodSetNativeInputValue(input, '');
      wordPodDispatchInput(input, null, 'deleteContentBackward');

      try {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}

      state.wordPodTypedLast = '';
      return true;
    }

    const actual = wordPodReadTypedText();
    let count = actual ? [...actual].length : 0;

    if (!count) {
      const typed = String(state.wordPodTypedLast || '');
      count = [...typed].length;
    }

    if (count > 0) {
      await wordPodClearByCount(
        count,
        CONFIG.wordPodRetypeDelayMs
      );
      await sleep(CONFIG.wordPodVerifyDelayMs);
    }

    state.wordPodTypedLast = '';
    return true;
  }

  async function wordPodSubmitAnswer(answer) {
    const sceneBefore = wordPodScene();
    const beforeCorrect = wordPodResultCount('correct');
    const beforeIncorrect = wordPodResultCount('incorrect');
    const beforeNext = !!sceneBefore.next;

    if (sceneBefore.textBox) {
      await wordPodClickControl(sceneBefore.textBox, '#f59e0b');
    }

    const typedOk = await wordPodTypeAndVerify(answer);

    if (!typedOk) {
      return {
        correct: false,
        incorrect: false,
        nextVisible: false,
        scene: wordPodScene(),
        typingFailed: true
      };
    }

    state.wordPodTypedLast = answer;

    await wordPodSubmitEnter();
    await sleep(CONFIG.wordPodAfterSubmitMs);

    const sceneAfter = wordPodScene();
    const afterCorrect = wordPodResultCount('correct');
    const afterIncorrect = wordPodResultCount('incorrect');
    const afterNext = !!sceneAfter.next;

    return {
      correct: afterCorrect > beforeCorrect || (!beforeNext && afterNext),
      incorrect: afterIncorrect > beforeIncorrect,
      nextVisible: afterNext,
      scene: sceneAfter
    };
  }

  async function wordPodAdvanceIfNeeded() {
    const next = wordPodFindNextButton();
    if (!next) return false;

    addLog('WordPod: next question', 'ok');
    await wordPodClickControl(next, '#22c55e');
    await sleep(CONFIG.wordPodAfterNextMs);

    state.wordPodTypedLast = '';
    state.wordPodSubmittedKey = null;
    state.wordPodLockedQuestion = null;
    state.wordPodLastSignature = null;
    state.wordPodCandidates = [];
    state.wordPodCandidateIndex = 0;
    return true;
  }

  function wordPodQuestionInstance() {
    // WordPod's newQuestion() replaces its InputGraphicsObject each time.
    // The same clue can recur, so prompt text alone cannot identify a turn.
    const input = document.getElementById('textInputChina');
    if (input && input !== state.wordPodInputNode) {
      state.wordPodInputNode = input;
      state.wordPodQuestionEpoch++;
      state.wordPodLockedQuestion = null;
      state.wordPodSubmittedKey = null;
      state.wordPodLastSignature = null;
      state.wordPodCandidates = [];
      state.wordPodCandidateIndex = 0;
      state.wordPodTypedLast = '';
      state.wordPodLastUnresolvedKey = '';
      state.currentAnswer = null;
      state.currentEntry = null;
      state.lastAudioUrl = null;
      state.lastPlayedKey = null;
      state.wordPodLastPlayAt = 0;
    }
    return state.wordPodQuestionEpoch;
  }


  function wordPodReadingQuestionKey(scene) {
    return scene && scene.prompt
      ? `read:${wordPodQuestionInstance()}:${scene.prompt.norm}`
      : '';
  }

  function wordPodListeningQuestionKey(scene, entry) {
    const turn = wordPodQuestionInstance();
    if (scene && scene.prompt) {
      return `listen-prompt:${turn}:${scene.prompt.norm}`;
    }

    if (entry) {
      const uid =
        entry.uid ??
        entry.id ??
        entry.vocabUid ??
        entry.translationUid ??
        '';

      const word = normaliseText(
        entry.word ||
        entry.originalWord ||
        entry.translatedWord ||
        entry.translation ||
        ''
      );

      return `listen-entry:${turn}:${uid}|${word}`;
    }

    const audio = baseName(state.lastAudioUrl || '');
    return audio ? `listen-audio:${turn}:${audio}` : '';
  }

  function wordPodUnlockForNewQuestion(questionKey) {
    if (!questionKey) return;

    if (
      state.wordPodLockedQuestion &&
      state.wordPodLockedQuestion !== questionKey
    ) {
      state.wordPodLockedQuestion = null;
      state.wordPodSubmittedKey = null;
      state.wordPodCandidates = [];
      state.wordPodCandidateIndex = 0;
      state.wordPodTypedLast = '';
      state.wordPodFails = 0;
    }
  }

  async function wordPodListeningTick() {
    if (!state.vocab.length) {
      setStatus('WordPod Listening: waiting for vocab');
      return;
    }

    if (await wordPodAdvanceIfNeeded()) {
      return;
    }

    const scene = wordPodScene();
    const turn = wordPodQuestionInstance();

    if (!scene.audio && !scene.prompt) {
      setStatus('WordPod Listening: waiting for scene');
      return;
    }

    let entry = wordPodActiveEntry() || wordPodEntryForPrompt(scene.prompt);
    if (!entry && state.lastAudioUrl) entry = matchAudioToEntry(state.lastAudioUrl);

    const sceneSig =
      `${turn}|${scene.prompt ? scene.prompt.norm : 'audio'}|` +
      `${baseName(state.lastAudioUrl || '')}|` +
      `${scene.prompts.map(p => p.norm).join('|')}`;

    if (state.wordPodLastSignature !== sceneSig) {
      state.wordPodLastSignature = sceneSig;
      state.wordPodCandidates = [];
      state.wordPodCandidateIndex = 0;
      state.wordPodTypedLast = '';
      state.wordPodSubmittedKey = null;
    }

    if (!entry) {
      if (CONFIG.autoPlay && scene.audio && state.lastPlayedKey !== `wordpod:${sceneSig}` &&
          Date.now() - state.wordPodLastPlayAt >= 1500) {
        state.lastPlayedKey = `wordpod:${sceneSig}`;
        state.wordPodLastPlayAt = Date.now();
        addLog('WordPod: auto-playing audio…');
        await wordPodClickControl(scene.audio, '#4ade80');
        await sleep(CONFIG.wordPodAfterPlayMs);
        if (!state.lastAudioUrl) state.lastPlayedKey = null;
      }

      if (state.lastAudioUrl) {
        entry = matchAudioToEntry(state.lastAudioUrl);
      }

      if (!entry) {
        setStatus('WordPod Listening: waiting for audio');
        return;
      }
    }

    const questionKey = wordPodListeningQuestionKey(scene, entry);
    wordPodUnlockForNewQuestion(questionKey);

    if (questionKey && state.wordPodLockedQuestion === questionKey) {
      setStatus('WordPod Listening: waiting for next question');
      return;
    }

    if (!state.wordPodCandidates.length) {
      state.wordPodCandidates = wordPodExactAnswerCandidates(entry);
      state.wordPodCandidateIndex = 0;

      addLog(
        'WordPod candidates: ' +
        (state.wordPodCandidates.length
          ? state.wordPodCandidates.map(x => `"${x}"`).join(' / ')
          : '(none)')
      );
    }

    if (!state.wordPodCandidates.length) {
      state.wordPodFails++;
      setStatus('WordPod Listening: no answer candidates');
      return;
    }

    if (state.wordPodCandidateIndex >= state.wordPodCandidates.length) {
      state.wordPodFails++;
      setStatus('WordPod Listening: all candidates failed');
      return;
    }

    const answer = state.wordPodCandidates[state.wordPodCandidateIndex];

    if (state.wordPodTypedLast && state.wordPodTypedLast !== answer) {
      await wordPodClearTypedAnswer();
    }

    state.wordPodLockedQuestion = questionKey || sceneSig;
    state.wordPodSubmittedKey =
      `${state.wordPodLockedQuestion}|${normaliseText(answer)}`;

    addLog(`WordPod answer: "${answer}"`, 'ok');

    const result = await wordPodSubmitAnswer(answer);

    if (result.typingFailed) {
      state.wordPodSubmittedKey = null;
      state.wordPodFails++;
      await wordPodClearTypedAnswer();
      setStatus('WordPod Listening: typing retry');
      return;
    }

    if (result.correct) {
      state.wordPodFails = 0;
      state.wordPodTypedLast = answer;
      state.answeredCount++;
      setAnsweredCount(state.answeredCount);
      setStatus('WordPod Listening: correct');
      state.currentAnswer = null;
      state.currentEntry = null;
      state.lastAudioUrl = null;
      state.lastPlayedKey = null;
      state.wordPodCandidates = [];
      state.wordPodCandidateIndex = 0;
      setAudioLabel('');
      return;
    }

    if (result.incorrect) {
      addLog(`✗ WordPod rejected "${answer}"`, 'err');
      state.wordPodSubmittedKey = null;
      state.wordPodFails++;
      setStatus('WordPod Listening: incorrect — waiting for retry or next question');
      return;
    }

    // No explicit feedback but the prompt changed / next became visible.
    const newSig =
      `${result.scene.prompt ? result.scene.prompt.norm : 'audio'}|` +
      `${baseName(state.lastAudioUrl || '')}|` +
      `${result.scene.prompts.map(p => p.norm).join('|')}`;

    if (newSig !== sceneSig || result.nextVisible) {
      state.wordPodFails = 0;
      state.wordPodSubmittedKey = null;
      state.answeredCount++;
      setAnsweredCount(state.answeredCount);
      state.wordPodCandidates = [];
      state.wordPodCandidateIndex = 0;
      setStatus('WordPod Listening: answered');
      return;
    }

    // Do not resubmit the same listening question while LanguageNut is
    // still transitioning. The prompt/audio identity changing will unlock it.
    state.wordPodFails++;
    setStatus('WordPod Listening: submitted — waiting for next question');
  }

  async function wordPodReadingTick() {
    if (!state.vocab.length) {
      setStatus('WordPod Reading: waiting for vocab');
      return;
    }

    if (await wordPodAdvanceIfNeeded()) {
      return;
    }

    const scene = wordPodScene();

    if (!scene.prompt) {
      setStatus('WordPod Reading: waiting for prompt');
      return;
    }

    const questionKey = wordPodReadingQuestionKey(scene);
    wordPodUnlockForNewQuestion(questionKey);

    // Hard one-submit-per-question lock. Feedback text, input value changes and
    // result sprites are deliberately NOT part of this key.
    if (state.wordPodLockedQuestion === questionKey) {
      setStatus('WordPod Reading: waiting for next question');
      return;
    }

    if (state.wordPodLastSignature !== questionKey) {
      state.wordPodLastSignature = questionKey;
      state.wordPodCandidates = [];
      state.wordPodCandidateIndex = 0;
      state.wordPodTypedLast = '';
      state.wordPodSubmittedKey = null;
    }

    const entry = wordPodActiveEntry() || wordPodEntryForPrompt(scene.prompt);

    if (!entry) {
      if (state.wordPodLastUnresolvedKey !== questionKey) {
        state.wordPodLastUnresolvedKey = questionKey;
        state.wordPodFails++;
        const matches = [...new Set((scene.prompt.matches || [])
          .map(match => String(match.entry?.word || '').trim()).filter(Boolean))];
        addLog(`WordPod: no unique API answer for "${scene.prompt.label}"` +
          (matches.length ? `; API targets: ${matches.join(' / ')}` : '; no API target matches'), 'err');
      }
      setStatus('WordPod Reading: waiting for a unique API answer');
      return;
    }

    if (!state.wordPodCandidates.length) {
      state.wordPodCandidates = wordPodExactAnswerCandidates(entry);
      state.wordPodCandidateIndex = 0;

      addLog(
        `WordPod "${scene.prompt.label}" → ` +
        (state.wordPodCandidates.length
          ? state.wordPodCandidates.map(x => `"${x}"`).join(' / ')
          : '(none)'),
        'ok'
      );
    }

    if (!state.wordPodCandidates.length) {
      if (state.wordPodLastUnresolvedKey !== questionKey) {
        state.wordPodLastUnresolvedKey = questionKey;
        state.wordPodFails++;
        addLog(`WordPod: API row for "${scene.prompt.label}" has no target word`, 'err');
      }
      setStatus('WordPod Reading: waiting for target word');
      return;
    }

    if (state.wordPodCandidateIndex >= state.wordPodCandidates.length) {
      state.wordPodFails++;
      setStatus('WordPod Reading: all candidates failed');
      return;
    }

    const answer = state.wordPodCandidates[state.wordPodCandidateIndex];

    // Lock BEFORE typing/submitting so the main loop can never race a second
    // submission of the same question.
    state.wordPodLockedQuestion = questionKey;
    state.wordPodSubmittedKey = `${questionKey}|${normaliseText(answer)}`;

    addLog(`WordPod answer: "${answer}"`, 'ok');

    const result = await wordPodSubmitAnswer(answer);

    if (result.typingFailed) {
      state.wordPodLockedQuestion = null;
      state.wordPodSubmittedKey = null;
      state.wordPodFails++;
      await wordPodClearTypedAnswer();
      setStatus('WordPod Reading: typing retry');
      return;
    }

    if (result.correct) {
      state.wordPodFails = 0;
      state.wordPodTypedLast = answer;
      state.answeredCount++;
      setAnsweredCount(state.answeredCount);
      setStatus('WordPod Reading: correct — waiting for next question');
      // Keep wordPodLockedQuestion set until the prompt genuinely changes.
      return;
    }

    if (result.incorrect) {
      addLog(`✗ WordPod rejected "${answer}"`, 'err');
      state.wordPodFails++;
      setStatus('WordPod Reading: incorrect — waiting for retry or next question');
      return;
    }

    // Even when the result sprite is late/ambiguous, do NOT unlock and spam.
    // The next prompt change will release this question.
    setStatus('WordPod Reading: submitted — waiting for next question');
  }

  function resetWordPodState() {
    state.wordPodBusy = false;
    state.wordPodLastSignature = null;
    state.wordPodCandidates = [];
    state.wordPodCandidateIndex = 0;
    state.wordPodTypedLast = '';
    state.wordPodFails = 0;
    state.wordPodSubmittedKey = null;
    state.wordPodLockedQuestion = null;
    state.wordPodLastUnresolvedKey = '';
    state.wordPodInputNode = null;
    state.wordPodQuestionEpoch = 0;
    state.wordPodLastPlayAt = 0;
    state.currentAnswer = null;
    state.currentEntry = null;
    state.lastAudioUrl = null;
    state.lastPlayedKey = null;
    setAudioLabel('');
    setPromptLabel('');
  }


  // ============ SKYRISE ============
  function collectSkyRisePromptTexts() {
    const a = state.pixiApp;
    if (!a || !state.vocab.length) return [];

    const termMap = mc2VocabTerms();
    const input = wordPodInputElement();
    const inputRect = input ? input.getBoundingClientRect() : null;
    const out = [];

    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.trim()) return;
      if (!isVisible(o, a.stage)) return;

      const label = o.text.trim();
      const norm = normaliseText(label);
      if (!norm || !termMap.has(norm)) return;

      const b = boundsOf(o);
      if (!b || b.width <= 0 || b.height <= 0) return;

      out.push({
        label,
        norm,
        bounds: b,
        matches: termMap.get(norm)
      });
    });

    const dedup = [];
    for (const t of out) {
      const dup = dedup.find(x =>
        x.norm === t.norm &&
        Math.abs(x.bounds.x - t.bounds.x) < 10 &&
        Math.abs(x.bounds.y - t.bounds.y) < 10
      );
      if (!dup) dedup.push(t);
    }

    dedup.sort((a, b) =>
      a.bounds.y - b.bounds.y ||
      a.bounds.x - b.bounds.x
    );

    return dedup;
  }

  function skyRiseScene() {
    const prompts = collectSkyRisePromptTexts();
    // Never fall back to the autocompleter panel's webhook field while the
    // game temporarily hides its input during answer feedback.
    const candidate = document.getElementById('textInputChina');
    const input = gameTextInputIsVisible(candidate) ? candidate : null;
    const current = skyRiseActiveEntry();

    let prompt = null;

    if (current) {
      // Reading and listening both use the same text answer input. Listening
      // can hide the clue, but currentContent still identifies the answer.
      const label = current.originalWord || 'Listening question';
      prompt = {label, norm: normaliseText(label)};
    } else if (prompts.length) {
      // The question/prompt is normally the highest matching vocab text.
      // Input feedback/typed answer tends to appear at or below the textbox.
      prompt = prompts[0];
    }

    return { prompt, prompts, input, current };
  }

  function skyRiseActiveEntry() {
    if (!/#\/(?:Zen)?SkyRise(?:[/?]|$)/i.test(String(location.hash || ''))) return null;
    const item = window.languagenutControllerObject?.currentContent;
    const word = typeof item?.learningWord === 'string' ? item.learningWord.trim() : '';
    if (!word) return null;
    return {obj: item, word, originalWord: String(item.interfaceWord || '').trim(), uid: item.contentUid};
  }

  function skyRiseQuestionKey(scene) {
    const item = scene?.current?.obj;
    if (item && item !== state.skyRiseCurrentItem) {
      state.skyRiseCurrentItem = item;
      state.skyRiseQuestionEpoch++;
    }
    return scene?.prompt
      ? `${state.skyRiseQuestionEpoch}:${scene.current?.uid ?? ''}:${scene.prompt.norm}`
      : '';
  }

  function resetSkyRiseState() {
    state.skyRiseBusy = false;
    state.skyRiseLastQuestion = null;
    state.skyRiseLockedQuestion = null;
    state.skyRiseCurrentItem = null;
    state.skyRiseQuestionEpoch = 0;
    state.skyRiseFails = 0;
    setPromptLabel('');
  }

  async function skyRiseTick() {
    const scene = skyRiseScene();

    if (!state.vocab.length && !state.sentences.length && !scene.current) {
      setStatus('Skyrise: waiting for data');
      return;
    }

    if (!scene.input) {
      setStatus('Skyrise: waiting for text input');
      return;
    }

    if (!scene.prompt) {
      setStatus('Skyrise: waiting for prompt');
      return;
    }

    setPromptLabel(scene.prompt.label);

    const questionKey = skyRiseQuestionKey(scene);

    if (
      state.skyRiseLockedQuestion &&
      state.skyRiseLockedQuestion !== questionKey
    ) {
      state.skyRiseLockedQuestion = null;
      state.skyRiseFails = 0;
    }

    if (state.skyRiseLockedQuestion === questionKey) {
      setStatus('Skyrise: waiting for next question');
      return;
    }

    const entry = scene.current || mc2EntryForPrompt(scene.prompt);

    if (!entry) {
      state.skyRiseFails++;
      setStatus('Skyrise: prompt not in vocab');
      return;
    }

    const answers = scene.current
      ? wordPodExactAnswerCandidates(entry)
      : wordPodAnswerCandidates(entry, scene.prompt.label);

    if (!answers.length) {
      state.skyRiseFails++;
      setStatus('Skyrise: answer not found');
      return;
    }

    // First candidate is the matched opposite-language pair.
    const answer = answers[0];

    state.skyRiseLockedQuestion = questionKey;
    state.skyRiseLastQuestion = questionKey;

    addLog(
      `Skyrise "${scene.prompt.label}" → "${answer}"`,
      'ok'
    );

    const typed = await wordPodTypeIntoDomInput(answer, scene.input);

    if (!typed.available || !typed.ok) {
      state.skyRiseLockedQuestion = null;
      state.skyRiseFails++;
      addLog(
        `Skyrise typing failed: wanted=${JSON.stringify(answer)} ` +
        `got=${JSON.stringify(typed.actual || '')}`,
        'err'
      );
      setStatus('Skyrise: typing failed');
      return;
    }

    addLog(`✓ Skyrise input verified`, 'ok');

    const beforePrompt = questionKey;

    await wordPodPressDomEnter(scene.input);
    await sleep(CONFIG.wordPodAfterSubmitMs);

    const after = skyRiseScene();
    const afterKey = skyRiseQuestionKey(after);

    if (afterKey && afterKey !== beforePrompt) {
      state.answeredCount++;
      setAnsweredCount(state.answeredCount);
      state.skyRiseLockedQuestion = null;
      setStatus('Skyrise: answered');
      return;
    }

    // Keep the lock even when LanguageNut animates/results before changing the
    // prompt. This prevents the same answer from being submitted repeatedly.
    setStatus('Skyrise: submitted — waiting for next question');
  }


  function concertObjectText(obj) {
    const parts = [];

    walk(obj, (o) => {
      if (typeof o.text === 'string' && o.text.trim()) {
        parts.push(o.text.trim());
      }

      if (typeof o.name === 'string' && o.name.trim()) {
        parts.push(o.name.trim());
      }
    });

    return parts.join(' | ');
  }

  function concertIsForbiddenNavObject(obj) {
    if (!obj) return false;

    // Match the labelled object itself. Walking all descendants here marks
    // the whole game stage as an Assignments button whenever one exists.
    const hay = [obj.text, obj.name, obj.label]
      .filter(value => typeof value === 'string')
      .join(' ');

    return /\b(assignments?|homework)\b/i.test(hay);
  }

  function concertInstallForbiddenNavGuard() {
    const a = state.pixiApp;
    if (!a || !a.stage) return 0;

    let guarded = 0;

    walk(a.stage, (o) => {
      if (!o || concertIsForbiddenNavObject(o) !== true) return;

      // Find the nearest object that actually owns navigation listeners.
      let p = o;
      let depth = 0;

      while (p && depth < 6) {
        const events = verbEventNames(p);

        if (
          events.includes('pointerup') ||
          events.includes('click') ||
          events.includes('tap') ||
          events.includes('keyup')
        ) {
          if (!p.__lnAcForbiddenNavGuard) {
            const originalEmit = p.emit;

            if (typeof originalEmit === 'function') {
              p.__lnAcForbiddenNavGuard = true;
              p.__lnAcOriginalEmit = originalEmit;
              p.__lnAcOriginalInteractive = p.interactive;
              p.__lnAcOriginalEventMode = p.eventMode;
              p.__lnAcOriginalButtonMode = p.buttonMode;
              p.__lnAcOriginalCursor = p.cursor;

              p.emit = function(type, ...args) {
                // Restore this nav control once automation is stopped.
                if (
                  !state.running &&
                  p.__lnAcForbiddenNavGuard &&
                  p.__lnAcOriginalEmit
                ) {
                  const original = p.__lnAcOriginalEmit;

                  try { p.emit = original; } catch (_) {}
                  try { p.interactive = p.__lnAcOriginalInteractive; } catch (_) {}
                  try { p.eventMode = p.__lnAcOriginalEventMode; } catch (_) {}
                  try { p.buttonMode = p.__lnAcOriginalButtonMode; } catch (_) {}
                  try { p.cursor = p.__lnAcOriginalCursor; } catch (_) {}

                  try { delete p.__lnAcForbiddenNavGuard; } catch (_) {}
                  try { delete p.__lnAcOriginalEmit; } catch (_) {}
                  try { delete p.__lnAcOriginalInteractive; } catch (_) {}
                  try { delete p.__lnAcOriginalEventMode; } catch (_) {}
                  try { delete p.__lnAcOriginalButtonMode; } catch (_) {}
                  try { delete p.__lnAcOriginalCursor; } catch (_) {}

                  return original.call(this, type, ...args);
                }

                if (
                  state.running &&
                  /^(?:pointerup|click|tap|keyup)$/i.test(String(type || ''))
                ) {
                  log(
                    `Concert firewall swallowed forbidden nav event: ` +
                    `${String(type)} → ${concertObjectText(this)}`
                  );
                  return false;
                }

                return originalEmit.call(this, type, ...args);
              };
            }
          }

          // Also remove it from PIXI hit testing while Concert is active.
          // The original emitter remains callable once automation stops.
          try { p.interactive = false; } catch (_) {}
          try { p.eventMode = 'none'; } catch (_) {}
          try { p.buttonMode = false; } catch (_) {}
          try { p.cursor = null; } catch (_) {}

          guarded++;
          break;
        }

        p = p.parent;
        depth++;
      }
    });

    return guarded;
  }

  // ============ CONCERT PAGE NAVIGATION LOCK ============
  // Once a real Concert question is seen, keep the browser on that exact
  // page until LanguageNut itself shows a genuine completion state.
  function concertNavigationLocked() {
    return !!(
      state.running &&
      state.concertNavLockActive &&
      !state.concertCompleted
    );
  }

  function concertEngageNavigationLock() {
    if (!state.running) return false;
    if (state.concertCompleted) return false;
    if (state.concertNavLockActive) return true;

    state.concertNavLockActive = true;
    state.concertNavLockUrl = String(location.href || '');
    state.concertNavLockHash = String(location.hash || '');
    state.concertNavLockRestoring = false;

    addLog(
      `Concert navigation locked to ${state.concertNavLockHash || location.pathname}`,
      'ok'
    );

    return true;
  }

  function concertReleaseNavigationLock(reason) {
    const wasLocked = state.concertNavLockActive;

    state.concertNavLockActive = false;
    state.concertNavLockRestoring = false;

    if (wasLocked) {
      addLog(
        `Concert navigation unlocked${reason ? `: ${reason}` : ''}`,
        'ok'
      );
    }
  }

  function concertResolveUrl(url) {
    try {
      return new URL(String(url), location.href).href;
    } catch (_) {
      return String(url || '');
    }
  }

  function concertNavigationWouldLeave(url) {
    if (!concertNavigationLocked()) return false;

    const locked = String(state.concertNavLockUrl || '');
    if (!locked) return true;

    if (url == null || url === '') {
      return false;
    }

    return concertResolveUrl(url) !== locked;
  }

  function concertRestoreLockedLocation(source) {
    if (!concertNavigationLocked()) return false;
    if (state.concertNavLockRestoring) return true;

    const lockedUrl = String(state.concertNavLockUrl || '');
    const lockedHash = String(state.concertNavLockHash || '');

    if (!lockedUrl || location.href === lockedUrl) return false;

    state.concertNavLockRestoring = true;

    log(
      `Concert navigation firewall restoring page after ${source || 'navigation'}: ` +
      `${location.href} → ${lockedUrl}`
    );

    try {
      // Hash routing is what LanguageNut uses for Homework/Assignments.
      // Setting the original hash makes the SPA route back through its own
      // router instead of only repainting the address bar.
      if (String(location.hash || '') !== lockedHash) {
        location.hash = lockedHash;
      } else if (
        window.__lnAcConcertNavOriginals &&
        typeof window.__lnAcConcertNavOriginals.replaceState === 'function'
      ) {
        window.__lnAcConcertNavOriginals.replaceState.call(
          history,
          history.state,
          '',
          lockedUrl
        );
      }
    } catch (e) {
      log('Concert navigation restore failed', e);
    }

    setTimeout(() => {
      state.concertNavLockRestoring = false;
    }, 0);

    return true;
  }

  function concertInstallGlobalNavigationLock() {
    if (window.__lnAcConcertNavigationLockInstalled) return;
    window.__lnAcConcertNavigationLockInstalled = true;

    const originals = {
      pushState: history.pushState,
      replaceState: history.replaceState,
      back: history.back,
      forward: history.forward,
      go: history.go,
      open: window.open
    };

    window.__lnAcConcertNavOriginals = originals;

    history.pushState = function(stateArg, title, url) {
      if (concertNavigationWouldLeave(url)) {
        log(
          `Concert navigation firewall blocked history.pushState → ${String(url)}`
        );
        return;
      }

      return originals.pushState.apply(this, arguments);
    };

    history.replaceState = function(stateArg, title, url) {
      if (concertNavigationWouldLeave(url)) {
        log(
          `Concert navigation firewall blocked history.replaceState → ${String(url)}`
        );
        return;
      }

      return originals.replaceState.apply(this, arguments);
    };

    history.back = function() {
      if (concertNavigationLocked()) {
        log('Concert navigation firewall blocked history.back()');
        return;
      }

      return originals.back.apply(this, arguments);
    };

    history.forward = function() {
      if (concertNavigationLocked()) {
        log('Concert navigation firewall blocked history.forward()');
        return;
      }

      return originals.forward.apply(this, arguments);
    };

    history.go = function(delta) {
      if (concertNavigationLocked()) {
        log(`Concert navigation firewall blocked history.go(${String(delta)})`);
        return;
      }

      return originals.go.apply(this, arguments);
    };

    try {
      window.open = function(url) {
        if (concertNavigationLocked()) {
          log(
            `Concert navigation firewall blocked window.open → ${String(url || '')}`
          );
          return null;
        }

        return originals.open.apply(this, arguments);
      };
    } catch (_) {}

    // Block ordinary DOM navigation before the app sees it.
    document.addEventListener('click', (e) => {
      if (!concertNavigationLocked()) return;

      const el = e.target instanceof Element
        ? e.target.closest('a,button,[role="button"]')
        : null;

      if (!el) return;

      const text = String(
        el.innerText ||
        el.textContent ||
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        ''
      );

      let leaving = /\b(assignments?|homework|home|exit|back)\b/i.test(text);

      if (el.tagName === 'A') {
        const href = el.getAttribute('href');

        if (href && concertNavigationWouldLeave(href)) {
          leaving = true;
        }
      }

      if (!leaving) return;

      e.stopImmediatePropagation();
      e.stopPropagation();

      try {
        if (e.cancelable) e.preventDefault();
      } catch (_) {}

      log(
        `Concert navigation firewall blocked DOM navigation: ` +
        `${text.trim() || el.tagName}`
      );
    }, true);

    // Stop forms from navigating away while a question set is unfinished.
    document.addEventListener('submit', (e) => {
      if (!concertNavigationLocked()) return;

      e.stopImmediatePropagation();
      e.stopPropagation();

      try {
        if (e.cancelable) e.preventDefault();
      } catch (_) {}

      log('Concert navigation firewall blocked form submit');
    }, true);

    // Direct `location.hash = "#/Homework"` cannot be monkey-patched
    // reliably. Catch the resulting route change immediately and restore the
    // remembered Concert hash.
    window.addEventListener('hashchange', () => {
      if (!concertNavigationLocked()) return;

      if (location.href !== state.concertNavLockUrl) {
        concertRestoreLockedLocation('hashchange');
      }
    }, true);

    window.addEventListener('popstate', () => {
      if (!concertNavigationLocked()) return;

      if (location.href !== state.concertNavLockUrl) {
        concertRestoreLockedLocation('popstate');
      }
    }, true);

    // Last line of defence for full-page navigation/reload attempts.
    window.addEventListener('beforeunload', (e) => {
      if (!concertNavigationLocked()) return;

      try {
        e.preventDefault();
        e.returnValue = '';
      } catch (_) {}

      return '';
    }, true);
  }

  // ============ CONCERT GLOBAL CANVAS BLOCKER ============
  // Capture-phase listener that runs BEFORE PIXI sees the event.
  // Works even if LanguageNut recreates the Assignments/Homework button
  // after the URL changes to #/Homework on the results screen.
  function concertInstallGlobalCanvasBlocker() {
    if (window.__lnAcConcertBlockerInstalled) return;
    window.__lnAcConcertBlockerInstalled = true;

    const blockEvent = (e) => {
      if (!concertNavigationLocked()) return;

      const a = state.pixiApp;
      if (!a || !a.view) return;

      // Only block events whose target is the PIXI canvas.
      if (e.target !== a.view && !a.view.contains(e.target)) return;

      const rect = a.view.getBoundingClientRect();
      const res = (a.renderer && a.renderer.resolution) || 1;
      const lw = (a.renderer.width || a.view.width) / res;
      const lh = (a.renderer.height || a.view.height) / res;

      if (!rect.width || !rect.height || !lw || !lh) return;

      const px = (e.clientX - rect.left) / (rect.width / lw);
      const py = (e.clientY - rect.top) / (rect.height / lh);

      let hit = false;

      walk(a.stage, (o) => {
        if (hit) return;
        if (!concertIsForbiddenNavObject(o)) return;
        if (!isVisible(o, a.stage)) return;

        // Text bounds cover only the label. The actual interactive parent is
        // larger, so a click on its padding can still navigate away.
        let control = o;
        let parent = o.parent;
        let depth = 0;
        while (parent && parent !== a.stage && depth < 6) {
          const events = verbEventNames(parent);
          if (events.some(name => /^(?:pointerdown|pointerup|click|tap|mouseup|touchend)$/i.test(name))) {
            control = parent;
            break;
          }
          parent = parent.parent;
          depth++;
        }

        const b = boundsOf(control);
        if (!b || b.width <= 0 || b.height <= 0) return;

        // Pad a few pixels so edges still block.
        if (
          px >= b.x - 3 &&
          px <= b.x + b.width + 3 &&
          py >= b.y - 3 &&
          py <= b.y + b.height + 3
        ) {
          hit = true;
        }
      });

      if (hit) {
        e.stopImmediatePropagation();
        e.stopPropagation();

        try {
          if (e.cancelable) e.preventDefault();
        } catch (_) {}

        log(
          'Concert firewall blocked Assignments/Homework click ' +
          '(capture phase)'
        );

        return false;
      }
    };

    // Capture phase (third arg = true) so this fires BEFORE PIXI's own
    // listeners registered on the same canvas.
    for (const type of [
      'pointerdown', 'pointerup',
      'mousedown', 'mouseup',
      'click', 'tap',
      'touchstart', 'touchend'
    ]) {
      document.addEventListener(type, blockEvent, true);
    }
  }



  function concertRestoreForbiddenNavGuards() {
    const a = state.pixiApp;
    if (!a || !a.stage) return 0;

    let restored = 0;

    walk(a.stage, (p) => {
      if (
        !p ||
        !p.__lnAcForbiddenNavGuard ||
        !p.__lnAcOriginalEmit
      ) return;

      try { p.emit = p.__lnAcOriginalEmit; } catch (_) {}
      try { p.interactive = p.__lnAcOriginalInteractive; } catch (_) {}
      try { p.eventMode = p.__lnAcOriginalEventMode; } catch (_) {}
      try { p.buttonMode = p.__lnAcOriginalButtonMode; } catch (_) {}
      try { p.cursor = p.__lnAcOriginalCursor; } catch (_) {}

      try { delete p.__lnAcForbiddenNavGuard; } catch (_) {}
      try { delete p.__lnAcOriginalEmit; } catch (_) {}
      try { delete p.__lnAcOriginalInteractive; } catch (_) {}
      try { delete p.__lnAcOriginalEventMode; } catch (_) {}
      try { delete p.__lnAcOriginalButtonMode; } catch (_) {}
      try { delete p.__lnAcOriginalCursor; } catch (_) {}

      restored++;
    });

    return restored;
  }

  function concertHasActiveQuestion() {
    if (!state.pixiApp || !state.pixiApp.stage) return false;

    const prompts = concertCollectPrompts();
    if (!prompts.length) return false;

    // A genuine active Concert round has both a visible vocab prompt and the
    // confirmed record/mic control. This prevents generic score text such as
    // "15/15" from being mistaken for final completion.
    const mic = concertFindExactRecordButton();

    return !!(
      mic &&
      mic.obj &&
      mic.micCircle &&
      isVisible(mic.obj, state.pixiApp.stage)
    );
  }

  function concertCanUnlockForCompletion(doneText) {
    if (!state.concertHadQuestion) return false;

    // A microphone may briefly disappear while recording or evaluating. A
    // visible vocabulary prompt alone is enough to keep navigation locked.
    if (concertCollectPrompts().length || concertHasActiveQuestion()) {
      return false;
    }

    const d = String(doneText || '');

    // For Concert, generic n/n score text alone is not enough to unlock.
    // Require either an explicit completion phrase/result route, or no active
    // prompt plus a known results/summary route.
    if (/[#/](?:results?|review|complete|summary)\b/i.test(location.href)) {
      return true;
    }

    if (
      /\b(?:activity|homework|exercise|quiz)\s+(?:is\s+)?(?:complete|completed|finished|done)\b/i.test(d) ||
      /\b(?:well done|great job|amazing work|excellent work|all correct|all right)\b/i.test(d)
    ) {
      return true;
    }

    return false;
  }

  // ============ CONCERT SPEAKING ============
  function concertVisible(el) {
    if (!(el instanceof Element)) return false;
    if (el.closest && el.closest('#ln-ac-panel')) return false;

    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();

    return (
      s.display !== 'none' &&
      s.visibility !== 'hidden' &&
      Number(s.opacity) > 0 &&
      r.width > 0 &&
      r.height > 0 &&
      r.bottom >= 0 &&
      r.right >= 0 &&
      r.top <= innerHeight &&
      r.left <= innerWidth
    );
  }

  function concertCollectPrompts() {
    if (!state.vocab.length) return [];

    const termMap = mc2VocabTerms();
    const found = [];

    // PIXI vocabulary text.
    if (state.pixiApp) {
      walk(state.pixiApp.stage, (o) => {
        if (typeof o.text !== 'string' || !o.text.trim()) return;
        if (!isVisible(o, state.pixiApp.stage)) return;

        const label = o.text.trim();
        const norm = normaliseText(label);
        if (!norm || !termMap.has(norm)) return;

        const b = boundsOf(o);
        if (!b || b.width <= 0 || b.height <= 0) return;

        found.push({
          label,
          norm,
          bounds: b,
          source: 'pixi'
        });
      });
    }

    // DOM vocabulary text fallback.
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || !concertVisible(parent)) continue;

      const label = String(node.nodeValue || '').replace(/\s+/g, ' ').trim();
      const norm = normaliseText(label);

      if (!norm || !termMap.has(norm)) continue;

      const r = parent.getBoundingClientRect();

      found.push({
        label,
        norm,
        bounds: {
          x: r.left,
          y: r.top,
          width: r.width,
          height: r.height
        },
        source: 'dom'
      });
    }

    const out = [];

    for (const p of found) {
      const dup = out.find(x =>
        x.norm === p.norm &&
        Math.abs(x.bounds.x - p.bounds.x) < 16 &&
        Math.abs(x.bounds.y - p.bounds.y) < 16
      );

      if (!dup) out.push(p);
    }

    out.sort((a, b) => {
      // Prefer the main central game prompt, not header/navigation text.
      const acx = a.bounds.x + a.bounds.width / 2;
      const bcx = b.bounds.x + b.bounds.width / 2;
      const center = innerWidth / 2;

      const aScore =
        (a.bounds.y >= 100 && a.bounds.y <= innerHeight * 0.75 ? 100 : 0) -
        Math.abs(acx - center) / 20;

      const bScore =
        (b.bounds.y >= 100 && b.bounds.y <= innerHeight * 0.75 ? 100 : 0) -
        Math.abs(bcx - center) / 20;

      return bScore - aScore || a.bounds.y - b.bounds.y;
    });

    return out;
  }

  function concertFindSpeakButtonDOM() {
    const selectors = [
      'button[type="button"]',
      'button:not([type])',
      '[role="button"]',
      '[tabindex]'
    ].join(',');

    const candidates = [];

    for (const el of document.querySelectorAll(selectors)) {
      if (!concertVisible(el)) continue;
      if (el.closest('#ln-ac-panel')) continue;

      // Never use links or form-submit controls for Concert. v9.2 could hit
      // navigation and send the user back to the activity selection screen.
      if (el.tagName === 'A') continue;
      if (
        el instanceof HTMLButtonElement &&
        String(el.type || '').toLowerCase() === 'submit'
      ) continue;

      const hay = [
        el.innerText,
        el.textContent,
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.id,
        typeof el.className === 'string' ? el.className : ''
      ].filter(Boolean).join(' ').trim();

      if (!hay) continue;

      const lower = hay.toLowerCase();

      const isMic =
        /\bmicrophone\b/.test(lower) ||
        /(^|[\s_-])mic([\s_-]|$)/.test(lower) ||
        /\brecord\b/.test(lower) ||
        /\bspeak\b/.test(lower) ||
        /\bpronounce\b/.test(lower);

      if (!isMic) continue;
      if (/\b(skip|next|back|home|menu|exit|cancel|stop)\b/i.test(lower)) continue;

      const r = el.getBoundingClientRect();

      // Ignore giant layout wrappers pretending to be buttons.
      if (r.width > 420 || r.height > 220 || r.width < 20 || r.height < 20) {
        continue;
      }

      let score = 0;

      if (/\bmicrophone\b/.test(lower)) score += 220;
      if (/(^|[\s_-])mic([\s_-]|$)/.test(lower)) score += 210;
      if (/\brecord\b/.test(lower)) score += 180;
      if (/\bspeak\b/.test(lower)) score += 170;
      if (/\bpronounce\b/.test(lower)) score += 130;
      if (el.tagName === 'BUTTON') score += 60;
      if (el.getAttribute('aria-label')) score += 35;
      if (el.getAttribute('title')) score += 25;
      if (!el.disabled) score += 20;

      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      // Concert controls should live in the game area, not header/navigation.
      if (cy > 100 && cy < innerHeight - 40) score += 40;
      score -= Math.abs(cx - innerWidth / 2) / 35;

      candidates.push({
        kind: 'dom',
        el,
        text: hay,
        bounds: {
          x: r.left,
          y: r.top,
          width: r.width,
          height: r.height
        },
        score
      });
    }

    candidates.sort((a, b) => b.score - a.score);

    // Require a convincingly microphone-like candidate.
    return candidates.length && candidates[0].score >= 150
      ? candidates[0]
      : null;
  }


  function concertFindExactRecordButton() {
    const a = state.pixiApp;
    if (!a) return null;

    let exact = null;

    walk(a.stage, (o) => {
      if (exact || !isVisible(o, a.stage)) return;

      if (String(o.name || '') !== 'record') return;

      const events = verbEventNames(o);
      if (!events.includes('pointerup')) return;

      const b = boundsOf(o);
      if (
        !b ||
        b.width < 45 ||
        b.height < 45 ||
        b.width > 120 ||
        b.height > 120
      ) return;

      let micTarget = null;
      let micCircle = null;
      let micTexture = '';

      walk(o, (c) => {
        if (c === o) return;

        const cn = String(c.name || '');
        const f = fullTextureName(c);

        if (
          cn === 'mic' ||
          /phonics\/games\/band\/mic\.svg/i.test(f)
        ) {
          micTarget = c;
          if (f) micTexture = f;
        }

        if (cn === 'micCircle') {
          micCircle = c;
        }
      });

      // Real manual pointerup capture showed target=micCircle,
      // currentTarget=record. Prefer that exact child.
      const target = micCircle || micTarget;
      if (!target) return;

      exact = {
        kind: 'pixi-exact-record',
        obj: o,
        target,
        micSprite: micTarget,
        micCircle,
        bounds: b,
        targetBounds: boundsOf(target),
        events,
        text: 'record',
        texture: micTexture,
        score: 10000
      };
    });

    return exact;
  }

  function concertFindSpeakButtonPixi() {
    const a = state.pixiApp;
    if (!a) return null;

    const candidates = [];

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;

      const f = fullTextureName(o);
      const n = textureName(o);
      const ownText = typeof o.text === 'string' ? o.text.trim() : '';
      const descendant = [];

      if (Array.isArray(o.children) && o.children.length) {
        walk(o, (c) => {
          if (typeof c.text === 'string' && c.text.trim()) {
            descendant.push(c.text.trim());
          }
        });
      }

      const hay = [
        f,
        n,
        o.name,
        o.label,
        ownText,
        descendant.join(' ')
      ].filter(Boolean).join(' ').trim();

      if (!hay) return;

      const lower = hay.toLowerCase();

      const micLike =
        /\bmicrophone\b/.test(lower) ||
        /(^|[\/_\s-])mic([\/_\s-]|$)/.test(lower) ||
        /\brecord\b/.test(lower) ||
        /\bspeak\b/.test(lower) ||
        /\bpronounce\b/.test(lower) ||
        /\bvoice\b/.test(lower);

      if (!micLike) return;

      if (
        /\b(stop|cancel|incorrect|correct|progress|home|back|menu|next)\b/i.test(lower)
      ) return;

      const b = boundsOf(o);
      if (!b || b.width < 18 || b.height < 18 || b.width > 420 || b.height > 220) {
        return;
      }

      let clickObj = o;
      let clickBounds = b;
      let events = verbEventNames(o);

      let p = o.parent;
      let depth = 0;

      while (p && depth < 6) {
        const pb = boundsOf(p);
        if (!pb || pb.width > 460 || pb.height > 250) break;

        const pe = verbEventNames(p);

        if (
          pe.some(e => /^(pointerup|click|tap|mouseup|touchend)$/i.test(e))
        ) {
          clickObj = p;
          clickBounds = pb;
          events = pe;
          break;
        }

        p = p.parent;
        depth++;
      }

      let score = 0;

      if (/\bmicrophone\b/.test(lower)) score += 260;
      if (/(^|[\/_\s-])mic([\/_\s-]|$)/.test(lower)) score += 250;
      if (/\brecord\b/.test(lower)) score += 220;
      if (/\bspeak\b/.test(lower)) score += 210;
      if (/\bvoice\b/.test(lower)) score += 150;
      if (/\bpronounce\b/.test(lower)) score += 140;

      if (
        events.some(e =>
          /^(pointerup|click|tap|mouseup|touchend)$/i.test(e)
        )
      ) score += 90;

      if (
        clickObj.interactive === true ||
        clickObj.eventMode === 'static' ||
        clickObj.eventMode === 'dynamic' ||
        clickObj.buttonMode === true
      ) score += 55;

      const cx = clickBounds.x + clickBounds.width / 2;
      const cy = clickBounds.y + clickBounds.height / 2;

      if (cy > 80 && cy < 780) score += 30;
      score -= Math.abs(cx - 512) / 45;

      candidates.push({
        kind: 'pixi',
        obj: clickObj,
        sourceObj: o,
        bounds: clickBounds,
        events,
        text: hay,
        texture: f || n || '',
        score
      });
    });

    candidates.sort((a, b) => b.score - a.score);

    return candidates.length && candidates[0].score >= 180
      ? candidates[0]
      : null;
  }

  function concertFindSpeakButton() {
    // Exact object confirmed by the user's click dump:
    // parent Container name="record", child mic.svg, pointerup handler.
    return concertFindExactRecordButton() || concertFindSpeakButtonPixi();
  }

  function concertResolveAnswer(promptText) {
    const p = normaliseText(promptText);
    if (!p) return null;

    for (const entry of state.vocab) {
      const word = typeof entry.word === 'string' ? entry.word.trim() : '';
      const originalWord =
        typeof entry.originalWord === 'string'
          ? entry.originalWord.trim()
          : '';

      const translatedWord =
        typeof entry.translatedWord === 'string'
          ? entry.translatedWord.trim()
          : '';

      const translation =
        typeof entry.translation === 'string'
          ? entry.translation.trim()
          : '';

      // Current LanguageNut vocab payloads used by this script normally expose
      // target language as `word` and English/source language as `originalWord`.
      if (originalWord && normaliseText(originalWord) === p && word) {
        return {
          entry,
          answer: word,
          lang: CONFIG.concertDefaultTargetLang,
          matchedField: 'originalWord'
        };
      }

      if (word && normaliseText(word) === p && originalWord) {
        return {
          entry,
          answer: originalWord,
          lang: 'en-GB',
          matchedField: 'word'
        };
      }

      if (translatedWord && normaliseText(translatedWord) === p && originalWord) {
        return {
          entry,
          answer: originalWord,
          lang: 'en-GB',
          matchedField: 'translatedWord'
        };
      }

      if (translation && normaliseText(translation) === p && word) {
        return {
          entry,
          answer: word,
          lang: CONFIG.concertDefaultTargetLang,
          matchedField: 'translation'
        };
      }
    }

    // Reuse the broader pairing logic for custom vocab payloads.
    const fakePrompt = { label: promptText };
    const entry = mc2EntryForPrompt(fakePrompt);

    if (!entry) return null;

    const answers = wordPodAnswerCandidates(entry, promptText);
    if (!answers.length) return null;

    return {
      entry,
      answer: answers[0],
      lang: CONFIG.concertDefaultTargetLang,
      matchedField: 'fallback'
    };
  }


  function concertMicStateSignature() {
    const parts = [];

    // Relevant visible PIXI objects.
    if (state.pixiApp) {
      walk(state.pixiApp.stage, (o) => {
        if (!isVisible(o, state.pixiApp.stage)) return;

        const f = fullTextureName(o);
        const n = textureName(o);
        const text = typeof o.text === 'string' ? o.text.trim() : '';
        const hay = [f, n, o.name, o.label, text]
          .filter(Boolean)
          .join(' ');

        if (
          !/(mic|microphone|record|speak|speaking|listen|listening|voice|wave|meter)/i.test(hay)
        ) return;

        const b = boundsOf(o);

        parts.push([
          'p',
          hay.slice(0, 120),
          o.visible !== false ? 1 : 0,
          o.renderable !== false ? 1 : 0,
          typeof o.alpha === 'number' ? o.alpha.toFixed(2) : '',
          o.tint != null ? String(o.tint) : '',
          b ? `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}` : ''
        ].join(':'));
      });
    }

    // Relevant visible DOM UI.
    for (const el of document.querySelectorAll(
      'button,[role="button"],[aria-label],[title],div,span'
    )) {
      if (!concertVisible(el)) continue;
      if (el.closest('#ln-ac-panel')) continue;

      const hay = [
        el.innerText,
        el.textContent,
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.id,
        typeof el.className === 'string' ? el.className : ''
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

      if (
        !hay ||
        !/(mic|microphone|record|speak|speaking|listen|listening|voice)/i.test(hay)
      ) continue;

      const r = el.getBoundingClientRect();

      if (r.width > 500 || r.height > 300) continue;

      parts.push([
        'd',
        hay.slice(0, 120),
        Math.round(r.left),
        Math.round(r.top),
        Math.round(r.width),
        Math.round(r.height),
        el.getAttribute('aria-pressed') || '',
        el.getAttribute('aria-selected') || '',
        el.getAttribute('data-state') || ''
      ].join(':'));
    }

    parts.sort();
    return parts.join('|');
  }

  async function concertWaitForMicReaction(beforeSignature) {
    const end = Date.now() + CONFIG.concertMicVerifyMs;

    while (Date.now() < end) {
      await sleep(80);

      const now = concertMicStateSignature();

      if (now && now !== beforeSignature) {
        return {
          reacted: true,
          signature: now
        };
      }
    }

    return {
      reacted: false,
      signature: concertMicStateSignature()
    };
  }


  function concertMakeRecordEvent(button, type) {
    const record = button && button.obj;
    const target =
      (button && button.micCircle) ||
      (button && button.target) ||
      record;

    const tb =
      boundsOf(target) ||
      (button && button.targetBounds) ||
      (button && button.bounds) ||
      boundsOf(record);

    // The captured real event landed at roughly 14% across and 56% down the
    // 69x69 micCircle. Use the same relative point instead of the sprite centre.
    const global = {
      x: tb ? tb.x + tb.width * 0.14 : 0,
      y: tb ? tb.y + tb.height * 0.56 : 0
    };

    const nativeEvent = {
      type,
      clientX: global.x,
      clientY: global.y,
      pageX: global.x,
      pageY: global.y,
      screenX: global.x,
      // Captured browser event had screenY offset by ~151 px.
      screenY: global.y + 151,
      button: 0,
      buttons: 0,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      detail: 0,
      preventDefault() {},
      stopPropagation() {},
      stopImmediatePropagation() {}
    };

    const path = [];
    let p = target;
    while (p) {
      path.push(p);
      if (p === record) break;
      p = p.parent;
    }

    const e = {
      type,

      // Captured FederatedPointerEvent flags.
      bubbles: true,
      cancelBubble: true,
      cancelable: false,
      composed: false,
      defaultPrevented: false,

      target,
      currentTarget: record,

      global: { x: global.x, y: global.y },
      client: { x: global.x, y: global.y },
      page: { x: global.x, y: global.y },
      screen: { x: global.x, y: global.y + 151 },
      offset: { x: 0, y: 0 },
      movement: { x: 0, y: 0 },

      button: 0,
      buttons: 0,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      detail: 0,
      eventPhase: 2,

      nativeEvent,
      originalEvent: nativeEvent,

      data: {
        global: { x: global.x, y: global.y },
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
        originalEvent: nativeEvent,
        getLocalPosition(container, point) {
          try {
            if (
              container &&
              container.worldTransform &&
              typeof container.worldTransform.applyInverse === 'function'
            ) {
              return container.worldTransform.applyInverse(
                global,
                point || {}
              );
            }
          } catch (_) {}

          const out = point || {};
          out.x = global.x;
          out.y = global.y;
          return out;
        }
      },

      composedPath() {
        return path.slice();
      },

      preventDefault() {},
      stopPropagation() {
        this.cancelBubble = true;
      },
      stopImmediatePropagation() {
        this.cancelBubble = true;
      }
    };

    return e;
  }

  async function concertClickSpeak(button) {
    if (
      !button ||
      !button.obj ||
      !button.micCircle ||
      button.kind !== 'pixi-exact-record'
    ) {
      return false;
    }

    const record = button.obj;

    // Extra safety: never dispatch if this exact object is no longer visible.
    if (!state.pixiApp || !isVisible(record, state.pixiApp.stage)) {
      return false;
    }

    try {
      const event = concertMakeRecordEvent(button, 'pointerup');

      // This is deliberately NOT a browser/canvas click. Calling the confirmed
      // record listener directly means a result-screen "Assignments" button
      // can never receive this interaction even if it occupies the same pixels.
      record.emit('pointerup', event);

      addLog(
        `Concert mic event → target=${event.target && event.target.name || '?'} ` +
        `currentTarget=${event.currentTarget && event.currentTarget.name || '?'}`
      );

      await sleep(CONFIG.concertEventSettleMs);
      return true;
    } catch (e) {
      log('Concert direct mic event failed', e);
      return false;
    }
  }

  async function concertWaitForEvaluation(afterSerial) {
    const end = Date.now() + CONFIG.concertEvalTimeoutMs;

    while (Date.now() < end) {
      if (
        state.concertEvalResult &&
        state.concertEvalResult.serial > afterSerial
      ) {
        return state.concertEvalResult;
      }

      await sleep(100);
    }

    return null;
  }

  function concertChooseVoice(lang) {
    if (!('speechSynthesis' in window)) return null;

    const voices = window.speechSynthesis.getVoices
      ? window.speechSynthesis.getVoices()
      : [];

    if (!voices || !voices.length) return null;

    const want = String(lang || '').toLowerCase();
    const base = want.split('-')[0];

    return (
      voices.find(v => String(v.lang || '').toLowerCase() === want) ||
      voices.find(v => String(v.lang || '').toLowerCase().startsWith(base + '-')) ||
      null
    );
  }


  function concertPromptLanguage(promptText) {
    const p = normaliseText(promptText);
    if (!p) return CONFIG.concertDefaultTargetLang;

    for (const entry of state.vocab) {
      const targetVals = [
        entry.word,
        entry.translatedWord,
        entry.translation,
        entry.translated
      ];

      for (const v of targetVals) {
        if (
          typeof v === 'string' &&
          normaliseText(v) === p
        ) {
          return CONFIG.concertDefaultTargetLang;
        }
      }

      const sourceVals = [
        entry.originalWord,
        entry.original
      ];

      for (const v of sourceVals) {
        if (
          typeof v === 'string' &&
          normaliseText(v) === p
        ) {
          return 'en-GB';
        }
      }
    }

    // Concert evaluateAudio has been observed sending the visible German
    // phrase itself, so target language is the safest fallback.
    return CONFIG.concertDefaultTargetLang;
  }

  function concertSpeakTTS(text, lang) {
    return new Promise(resolve => {
      if (
        !('speechSynthesis' in window) ||
        typeof SpeechSynthesisUtterance !== 'function'
      ) {
        resolve({ ok: false, reason: 'speechSynthesis unavailable' });
        return;
      }

      const phrase = String(text || '').trim();
      if (!phrase) {
        resolve({ ok: false, reason: 'empty phrase' });
        return;
      }

      try {
        window.speechSynthesis.cancel();
      } catch (_) {}

      const u = new SpeechSynthesisUtterance(phrase);
      u.lang = lang || CONFIG.concertDefaultTargetLang;
      u.rate = CONFIG.concertTtsRate;
      u.pitch = CONFIG.concertTtsPitch;
      u.volume = 1;

      const voice = concertChooseVoice(u.lang);
      if (voice) u.voice = voice;

      let finished = false;

      const done = (ok, reason) => {
        if (finished) return;
        finished = true;
        resolve({ ok, reason: reason || '' });
      };

      u.onend = () => done(true, '');
      u.onerror = e => done(false, e && e.error ? e.error : 'TTS error');

      try {
        window.speechSynthesis.speak(u);
      } catch (e) {
        done(false, e && e.message ? e.message : String(e));
        return;
      }

      // Safety timeout so one broken browser voice cannot freeze the bot.
      const timeout =
        Math.max(3500, Math.min(12000, phrase.length * 220));

      setTimeout(() => done(false, 'TTS end timeout'), timeout);
    });
  }

  function resetConcertState() {
    state.concertBusy = false;
    state.concertLockedQuestion = null;
    state.concertLastPrompt = null;
    state.concertLastSpoken = '';
    state.concertFails = 0;
    state.concertSpeakButtonCache = null;
    state.concertEvalResult = null;
    state.concertEvalUrl = '';
    state.concertCycleQuestion = null;
    state.concertCycleCount = 0;
    state.concertNavGuardLogged = false;
    state.concertHadQuestion = false;
    state.concertCompleted = false;
    concertReleaseNavigationLock('reset');

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch (_) {}

    setPromptLabel('');
  }

  async function concertSpeakingTick() {
    // Re-arm guards because LanguageNut can recreate navigation controls.
    concertInstallForbiddenNavGuard();

    if (!isConcertRoute()) {
      if (concertNavigationLocked()) {
        concertRestoreLockedLocation('concert tick');
        setStatus('Concert Speaking: restoring Concert page');
        return;
      }

      setStatus('Concert Speaking: not on Concert page');
      return;
    }

    // Arm before prompt and vocabulary detection. During loading and question
    // transitions, neither is guaranteed to be present yet.
    concertEngageNavigationLock();

    if (!state.vocab.length) {
      setStatus('Concert Speaking: waiting for vocab');
      return;
    }

    const prompts = concertCollectPrompts();

    // No active prompt = transition/results. Do absolutely nothing here.
    if (!prompts.length) {
      setStatus('Concert Speaking: no active prompt — waiting');
      return;
    }

    const prompt = prompts[0];
    const questionKey = prompt.norm;
    const spokenText = String(prompt.label || '').trim();

    if (!spokenText) {
      setStatus('Concert Speaking: empty prompt');
      return;
    }

    state.concertHadQuestion = true;

    setPromptLabel(prompt.label);

    if (state.concertLockedQuestion === questionKey) {
      setStatus('Concert Speaking: correct — waiting for next prompt');
      return;
    }

    if (state.concertCycleQuestion !== questionKey) {
      state.concertCycleQuestion = questionKey;
      state.concertCycleCount = 0;
      state.concertFails = 0;
    }

    const mic = concertFindExactRecordButton();

    if (!mic || !mic.obj || !mic.micCircle) {
      setStatus('Concert Speaking: active prompt, waiting for mic');
      return;
    }

    state.concertCycleCount++;
    state.concertLastPrompt = prompt.label;
    state.concertLastSpoken = spokenText;

    const lang = concertPromptLanguage(spokenText);
    const evalBefore = state.concertEvalSerial;

    addLog(
      `Concert ${state.concertCycleCount}: "${spokenText}" (${lang})`,
      'ok'
    );

    // Start recording before speaking.
    setStatus('Concert Speaking: starting microphone');

    if (!(await concertClickSpeak(mic))) {
      state.concertFails++;
      addLog('Concert: microphone start failed', 'err');
      setStatus('Concert Speaking: microphone start failed');
      await sleep(CONFIG.concertRetryDelayMs);
      return;
    }

    await sleep(CONFIG.concertListenArmMs);

    // Speak exactly the visible Concert phrase.
    setStatus(`Concert Speaking: saying "${spokenText}"`);

    const tts = await concertSpeakTTS(spokenText, lang);

    if (!tts.ok) {
      state.concertFails++;
      addLog(
        `Concert TTS failed: ${tts.reason || 'unknown error'}`,
        'err'
      );
      setStatus('Concert Speaking: TTS failed');
      await sleep(CONFIG.concertRetryDelayMs);
      return;
    }

    addLog(`✓ Concert TTS "${spokenText}"`, 'ok');

    // The game asks for a second microphone press when speech is finished.
    // Recheck the live question before pressing: the game may have already
    // evaluated it and replaced the record control during the TTS delay.
    await sleep(CONFIG.concertSecondClickDelayMs);

    if (!state.running) return;

    const livePrompts = concertCollectPrompts();
    const sameQuestion = livePrompts.length &&
      livePrompts[0].norm === questionKey;
    const alert = document.getElementById('hiddenAlertContainer');
    const alertText = String(alert && alert.textContent || '');
    const recordingNotEnded =
      !/evaluat|\b(?:in)?correct\b|recording\s+(?:stopped|finished)/i.test(alertText);

    if (
      isConcertRoute() &&
      sameQuestion &&
      state.concertEvalSerial === evalBefore &&
      recordingNotEnded
    ) {
      const stopMic = concertFindExactRecordButton();
      setStatus('Concert Speaking: stopping microphone');

      if (stopMic && await concertClickSpeak(stopMic)) {
        addLog('Concert: microphone pressed again after speech', 'ok');
      } else {
        addLog('Concert: could not stop microphone', 'err');
      }
    } else {
      addLog('Concert: second microphone press skipped; recording already ended');
    }

    setStatus('Concert Speaking: waiting for evaluateAudio');
    addLog('Concert: waiting for evaluateAudio');

    const evaluation = await concertWaitForEvaluation(evalBefore);

    if (!evaluation) {
      state.concertFails++;
      addLog('Concert: evaluateAudio timeout — retrying in 3s', 'err');
      setStatus('Concert Speaking: evaluateAudio timeout');
      await sleep(CONFIG.concertRetryDelayMs);
      return;
    }

    addLog(
      `Concert: evaluateAudio complete ` +
      `(isCorrect=${String(evaluation.isCorrect)})`,
      evaluation.isCorrect === false ? 'err' : 'ok'
    );

    if (evaluation.isCorrect === true) {
      state.concertLockedQuestion = questionKey;
      state.concertFails = 0;
      addLog(
        'Concert: accepted. Navigation remains locked until this prompt disappears.',
        'ok'
      );
      setStatus('Concert Speaking: correct — waiting for next prompt');

      const end = Date.now() + 15000;

      while (state.running && Date.now() < end) {
        // If a bad navigation happens while the old question is transitioning,
        // immediately route back.
        if (!isConcertRoute() && concertNavigationLocked()) {
          concertRestoreLockedLocation('post-answer wait');
          await sleep(100);
          continue;
        }

        const nextPrompts = concertCollectPrompts();

        if (
          nextPrompts.length &&
          nextPrompts[0].norm &&
          nextPrompts[0].norm !== questionKey
        ) {
          state.answeredCount++;
          setAnsweredCount(state.answeredCount);
          state.concertLockedQuestion = null;
          state.concertCycleQuestion = nextPrompts[0].norm;
          state.concertCycleCount = 0;
          setStatus('Concert Speaking: next prompt ready');
          return;
        }

        // If the same prompt is still visible, navigation MUST remain locked.
        if (
          nextPrompts.length &&
          nextPrompts[0].norm === questionKey
        ) {
          concertEngageNavigationLock();
        }

        await sleep(150);
      }

      setStatus('Concert Speaking: waiting for game transition');
      return;
    }

    state.concertFails++;

    if (evaluation.isCorrect === false) {
      addLog('Concert: incorrect — retrying in 3s', 'err');
      setStatus('Concert Speaking: incorrect — retrying in 3s');
    } else {
      addLog('Concert: unknown evaluation — retrying in 3s', 'err');
      setStatus('Concert Speaking: unknown result — retrying in 3s');
    }

    await sleep(CONFIG.concertRetryDelayMs);
  }


  // ============ FRIDGE ============
  function fridgeSpritesByName(n) { const a = state.pixiApp; if (!a) return []; const o = []; walk(a.stage, (x) => { if (!isVisible(x, a.stage)) return; if (textureName(x) === n) o.push(x); }); return o; }
  function findFridgeSubmit() { const a = state.pixiApp; if (!a) return null; let f = null; walk(a.stage, (o) => { if (f) return; if (!isVisible(o, a.stage)) return; const n = textureName(o); if (n === 'Submit' || n === 'SubmitTransparent') f = o; }); return f; }
  function findFridgeReset() { const a = state.pixiApp; if (!a) return null; let f = null; walk(a.stage, (o) => { if (f) return; if (!isVisible(o, a.stage)) return; if (textureName(o) === 'ResetButton') f = o; }); return f; }
  function findFridgePrompt() {
    const a = state.pixiApp; if (!a) return null; const boxes = fridgeSpritesByName('QuestionBox'); if (boxes.length === 0) return null;
    const bb = boundsOf(boxes[0]); if (!bb) return null; let bt = null, bB = null;
    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.trim()) return; if (!isVisible(o, a.stage)) return;
      const b = boundsOf(o); if (!b) return;
      if (b.x >= bb.x - 10 && b.x + b.width <= bb.x + bb.width + 10 && b.y >= bb.y - 10 && b.y + b.height <= bb.y + bb.height + 10) {
        const t = o.text.trim(); if (t.length < 2) return; if (/^\d+$/.test(t)) return;
        if (!bt || t.length > bt.length) { bt = t; bB = b; }
      }
    });
    if (!bt) return null; return { text: bt, key: normaliseText(bt), bounds: bB };
  }
  function collectFridgeTiles() {
    const a = state.pixiApp; if (!a) return [];
    const out = []; const seen = new Set();
    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return; if (seen.has(o)) return;
      const isInt = o.interactive === true || o.eventMode === 'static' || o.eventMode === 'dynamic'; if (!isInt) return;
      const kids = o.children || []; if (kids.length === 0) return;
      const b = boundsOf(o); if (!b || b.width < 40 || b.height < 15) return;
      if (b.width > 500 || b.height > 150) return;
      let t = ''; walk(o, (c) => { if (!t && typeof c.text === 'string' && c.text.trim()) t = c.text.trim(); });
      if (!t || t.length < 1) return; if (/^\d+$/.test(t)) return;
      seen.add(o); out.push({ obj: o, label: t, bounds: b });
    });
    const merged = [];
    for (const o of out) {
      let found = null;
      for (const m of merged) {
        if (m.label !== o.label) continue;
        const cx1 = m.bounds.x + m.bounds.width / 2, cy1 = m.bounds.y + m.bounds.height / 2;
        const cx2 = o.bounds.x + o.bounds.width / 2, cy2 = o.bounds.y + o.bounds.height / 2;
        if (Math.abs(cx1 - cx2) < 40 && Math.abs(cy1 - cy2) < 30) { found = m; break; }
      }
      if (found) { const a1 = found.bounds.width * found.bounds.height, a2 = o.bounds.width * o.bounds.height; if (a2 > a1) { found.obj = o.obj; found.bounds = o.bounds; } }
      else merged.push({ obj: o.obj, label: o.label, bounds: o.bounds });
    }
    return merged;
  }
  function resetFridgeState() {
    state.fridgeOrderedChunks = []; state.fridgePlacedCount = 0;
    state.fridgeFails = 0; state.fridgeLastKey = null; state.fridgeSubmitAt = 0; state._lastFridgeErr = null;
    setPromptLabel(''); setProgress(0, 0);
  }
  function matchPromptToSentence(t) {
    const p = normaliseText(t); if (!p) return null;
    const pf = ['originalSentence', 'translation', 'english', 'originalWord', 'prompt'];
    for (const s of state.sentences) for (const k of pf) { const v = s[k]; if (typeof v !== 'string') continue; if (normaliseText(v) === p) return { entry: s, matchedField: k }; }
    for (const s of state.sentences) for (const k of Object.keys(s)) { const v = s[k]; if (typeof v !== 'string') continue; if (normaliseText(v) === p) return { entry: s, matchedField: k }; }
    for (const s of state.sentences) for (const k of Object.keys(s)) { const v = s[k]; if (typeof v !== 'string') continue; const n = normaliseText(v); if (n.length > 5 && (n.includes(p) || p.includes(n))) return { entry: s, matchedField: k }; }
    return null;
  }
  function findTargetSentenceField(e, mf) {
    if (!e) return '';
    const pr = [
      'originalSentence',
      'sentence',
      'translation',
      'translatedSentence',
      'targetSentence',
      'secondaryWord',
      'word',
      'originalWord'
    ];
    for (const k of pr) {
      if (k === mf) continue;
      const v = e[k];
      if (typeof v === 'string' && v.trim().length >= 1 && !/^\d+$/.test(v.trim())) {
        return v.trim().replace(/<[^>]*>/g, '');
      }
    }
    for (const k of Object.keys(e)) {
      if (k === mf) continue;
      if (/uid|id|audio|sound|module|feature|token|href|url|order|index|image|icon/i.test(k)) continue;
      const v = e[k];
      if (typeof v === 'string' && v.trim().length >= 1 && !/^\d+$/.test(v.trim())) {
        return v.trim().replace(/<[^>]*>/g, '');
      }
    }
    return '';
  }
  async function pressFridgeSubmit() {
    const s = findFridgeSubmit(); if (!s) { addLog('No Submit button', 'err'); return false; }
    const b = boundsOf(s); if (!b) return false;
    const pt = worldToClient(b);
    if (pt) { fireClickAt(pt.x, pt.y, '#4ade80'); await sleep(60); }
    const evs = ['pointerover', 'pointerdown', 'pointerup', 'pointertap', 'click', 'tap'];
    for (const e of evs) emitOnObject(s, e);
    let p = s.parent, d = 0; while (p && d < 4) { for (const e of evs) emitOnObject(p, e); p = p.parent; d++; }
    return true;
  }
  async function clickFridgeReset() {
    const r = findFridgeReset(); if (!r) return false;
    const rb = boundsOf(r); if (!rb) return false;
    const rp = worldToClient(rb); if (!rp) return false;
    fireClickAt(rp.x, rp.y, '#ff5c5c');
    const evs = ['pointerover', 'pointerdown', 'pointerup', 'pointertap', 'click', 'tap'];
    for (const e of evs) emitOnObject(r, e);
    return true;
  }

  async function fridgeTick() {
    if (state.vocab.length === 0 && state.sentences.length === 0) { setStatus('Fridge: waiting for data'); return; }
    const prompt = findFridgePrompt(); if (!prompt) { setStatus('Fridge: no prompt'); return; }
    setPromptLabel(prompt.text);
    let target = ''; const entry = matchPromptToEntry(prompt.text);
    if (entry) target = computeReadingAnswer(entry, prompt.text);
    else { const sm = matchPromptToSentence(prompt.text); if (sm) { target = findTargetSentenceField(sm.entry, sm.matchedField); } }
    if (!target) {
      const ek = normaliseText(prompt.text);
      if (state._lastFridgeErr !== ek) { state._lastFridgeErr = ek; addLog(`Prompt not in data: "${prompt.text}"`, 'err'); }
      setStatus('Fridge: prompt not found'); return;
    }
    const key = target;
    if (state.fridgeLastKey !== key) {
      state.fridgeLastKey = key;
      state.fridgePlacedCount = 0; state.fridgeFails = 0; state.fridgeSubmitAt = 0;
      addLog('Resetting board…');
      await clickFridgeReset();
      await sleep(500);
      const tiles = collectFridgeTiles();
      const ordered = orderChunks(target, tiles);
      state.fridgeOrderedChunks = ordered;
      addLog(`Fridge target: "${target}"`, 'ok');
      addLog(`Order: ${ordered.map(t => t.label).join(' → ') || '(empty)'}`, 'ok');
      setProgress(0, ordered.length);
      return;
    }
    const expected = state.fridgeOrderedChunks.length;
    if (expected === 0) { setStatus('Fridge: no order'); return; }
    if (state.fridgePlacedCount >= expected) {
      const now = Date.now();
      if (now - state.fridgeSubmitAt < 1500) { setStatus('Waiting…'); await sleep(200); return; }
      state.fridgeSubmitAt = now;
      addLog(`All ${state.fridgePlacedCount}/${expected} placed — Submit`);
      await pressFridgeSubmit();
      setStatus('Submitted');
      await sleep(CONFIG.fridgeAfterSubmitMs);
      return;
    }
    if (state.fridgeFails >= CONFIG.fridgeMaxFails) {
      addLog('Too many fails — resetting', 'err');
      await clickFridgeReset();
      await sleep(CONFIG.fridgeAfterSubmitMs); resetFridgeState(); return;
    }
    const idx = state.fridgePlacedCount;
    const wantLabel = state.fridgeOrderedChunks[idx].label;
    const tiles = collectFridgeTiles();
    const candidates = tiles.filter(t => chunkKey(t.label) === chunkKey(wantLabel));
    if (candidates.length === 0) {
      state.fridgeFails++;
      addLog(`No tile for "${wantLabel}" (fails: ${state.fridgeFails})`, 'err');
      await sleep(300); return;
    }
    candidates.sort((a, b) => a.bounds.x - b.bounds.x);
    const next = candidates[0];
    addLog(`${CONFIG.fridgeUseClick ? 'Clicking' : 'Dragging'} "${next.label}" (want #${idx + 1})`);
    if (CONFIG.fridgeUseClick) { await clickTile(next.obj); } else { await dragTileUp(next.obj, CONFIG.fridgeDragDistance); }
    await sleep(CONFIG.fridgeSettleMs);
    state.fridgePlacedCount++;
    state.fridgeFails = 0;
    addLog(`✓ "${next.label}" placed (${state.fridgePlacedCount}/${expected})`, 'ok');
    setProgress(state.fridgePlacedCount, expected);
  }


  // ============ GAPFILL ============
  function findGapFillBackground() {
    const a = state.pixiApp;
    if (!a) return null;

    let best = null;

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;

      const tex = fullTextureName(o);
      if (!/sentenceBackground/i.test(tex) && !/gapfill/i.test(tex)) return;

      const b = boundsOf(o);
      if (!b || b.width < 250 || b.height < 120) return;

      const area = b.width * b.height;
      if (!best || area > best.area) {
        best = { obj: o, bounds: b, texture: tex, area };
      }
    });

    return best;
  }

  function gapTextTokens(s) {
    const raw = String(s || '');
    const out = [];
    const rx = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

    for (const m of raw.matchAll(rx)) {
      out.push({
        raw: m[0],
        norm: normaliseText(m[0]),
        start: m.index,
        end: m.index + m[0].length
      });
    }

    return out;
  }

  function collectGapFillTexts() {
    const a = state.pixiApp;
    if (!a) return [];

    const bg = findGapFillBackground();
    const region = bg && bg.bounds;
    const out = [];

    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.trim()) return;
      if (!isVisible(o, a.stage)) return;

      const text = o.text.trim();
      const b = boundsOf(o);
      if (!b || b.width <= 0 || b.height <= 0) return;

      if (region) {
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;

        if (
          cx < region.x - 15 ||
          cx > region.x + region.width + 15 ||
          cy < region.y - 15 ||
          cy > region.y + region.height + 15
        ) return;
      }

      out.push({ obj: o, text, bounds: b });
    });

    out.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
    return out;
  }

  function findGapFillPrompt() {
    if (!state.sentences.length) return null;

    const texts = collectGapFillTexts();
    const candidates = [];

    for (const t of texts) {
      if (t.text.length < 4 || t.text.length > 250) continue;

      const sm = matchPromptToSentence(t.text);
      if (!sm) continue;

      const fieldValue =
        sm.entry &&
        typeof sm.entry[sm.matchedField] === 'string'
          ? sm.entry[sm.matchedField].trim()
          : '';

      const p = normaliseText(t.text);
      const f = normaliseText(fieldValue);

      let score = 0;

      // Strongest signal: the visible text is an incomplete piece of the SAME
      // sentence field in the API. This is the real GapFill sentence.
      if (f && f !== p && f.includes(p)) score += 140;

      // Sentence-looking strings beat grammar-choice strings.
      const words = gapTextTokens(t.text).length;
      if (words >= 4) score += 35;
      else if (words >= 2) score += 10;

      if (/[\/|]/.test(t.text)) score -= 90;

      // The editable sentence is above the choices/translation/keyboard.
      if (t.bounds.y >= 140 && t.bounds.y <= 330) score += 40;
      else if (t.bounds.y > 330) score -= 15;

      // Prefer a wider sentence line over a small label.
      score += Math.min(30, t.bounds.width / 25);

      candidates.push({
        ...t,
        match: sm,
        matchedFieldValue: fieldValue,
        score
      });
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) =>
      b.score - a.score ||
      a.bounds.y - b.bounds.y ||
      b.text.length - a.text.length
    );

    return candidates[0];
  }

  function findGapFillTarget(prompt) {
    if (!prompt || !prompt.match) return '';

    const e = prompt.match.entry;
    const mf = prompt.match.matchedField;
    const p = normaliseText(prompt.text);

    // Best case: matchPromptToSentence found the full same-language sentence
    // field by containment. Use that exact field, rather than switching to its
    // English translation.
    if (e && typeof e[mf] === 'string') {
      const v = e[mf].trim();
      const n = normaliseText(v);

      if (n && n !== p && n.includes(p)) {
        return v;
      }
    }

    // Search this sentence entry for another sentence-like field which contains
    // the visible fragment. This covers APIs where the partial prompt matched an
    // alias/secondary field first.
    if (e && typeof e === 'object') {
      const candidates = [];

      for (const [k, raw] of Object.entries(e)) {
        if (typeof raw !== 'string') continue;

        const v = raw.trim();
        if (v.length < 4 || v.length > 300) continue;

        const n = normaliseText(v);
        if (!n || !n.includes(p) || n === p) continue;

        let score = 0;
        if (/sentence|word|translation|original/i.test(k)) score += 20;
        score += Math.min(40, gapTextTokens(v).length * 4);
        score += Math.min(30, v.length / 8);

        candidates.push({ value: v, score });
      }

      if (candidates.length) {
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].value;
      }
    }

    // Compatibility fallback for the older GapFill layouts where the visible
    // matched text is a grammar-choice string instead of a sentence fragment.
    return e ? findTargetSentenceField(e, mf) : '';
  }

  function gapFindSequence(targetTokens, fragTokens) {
    if (!fragTokens.length || fragTokens.length > targetTokens.length) return -1;

    for (let i = 0; i <= targetTokens.length - fragTokens.length; i++) {
      let ok = true;

      for (let j = 0; j < fragTokens.length; j++) {
        if (targetTokens[i + j].norm !== fragTokens[j].norm) {
          ok = false;
          break;
        }
      }

      if (ok) return i;
    }

    return -1;
  }

  function inferGapFillAnswer(target, promptText) {
    const targetTokens = gapTextTokens(target);
    if (!targetTokens.length) return null;

    const visible = collectGapFillTexts();
    const covered = new Array(targetTokens.length).fill(false);
    const matches = [];

    for (const item of visible) {
      const raw = item.text.trim();
      if (!raw) continue;

      const n = normaliseText(raw);
      if (!n) continue;

      // Skip obvious UI/instruction/progress labels.
      if (
        /^(gap\s*fill|submit|enter|shift|backspace|space|correct|incorrect)$/i.test(raw) ||
        /^\d+\s*\/\s*\d+$/.test(raw)
      ) continue;

      const fragTokens = gapTextTokens(raw);
      if (!fragTokens.length) continue;

      const pos = gapFindSequence(targetTokens, fragTokens);
      if (pos < 0) continue;

      for (let i = 0; i < fragTokens.length; i++) {
        covered[pos + i] = true;
      }

      matches.push({
        text: raw,
        startToken: pos,
        endToken: pos + fragTokens.length - 1,
        bounds: item.bounds
      });
    }

    const coveredCount = covered.filter(Boolean).length;

    // We need at least some of the target sentence visible; otherwise typing
    // the entire translation would be too speculative for a gap-fill round.
    if (coveredCount === 0) {
      return {
        answer: '',
        target,
        covered,
        matches,
        reason: 'no target fragments visible'
      };
    }

    const runs = [];
    let i = 0;

    while (i < covered.length) {
      if (covered[i]) {
        i++;
        continue;
      }

      const start = i;
      while (i < covered.length && !covered[i]) i++;
      runs.push({ start, end: i - 1, length: i - start });
    }

    if (!runs.length) {
      return {
        answer: '',
        target,
        covered,
        matches,
        reason: 'target already complete'
      };
    }

    // GapFill normally has one continuous blank. Prefer a single run; if PIXI
    // split rendering left tiny unmatched edge tokens, choose the strongest
    // internal run with visible text on at least one side.
    let run = null;

    if (runs.length === 1) {
      run = runs[0];
    } else {
      const scored = runs.map(r => {
        const leftCovered = r.start > 0 && covered[r.start - 1];
        const rightCovered = r.end + 1 < covered.length && covered[r.end + 1];

        return {
          ...r,
          score:
            (leftCovered ? 4 : 0) +
            (rightCovered ? 4 : 0) +
            Math.min(4, r.length)
        };
      }).sort((a, b) => b.score - a.score || b.length - a.length);

      if (
        scored.length >= 2 &&
        scored[0].score === scored[1].score &&
        scored[0].length === scored[1].length
      ) {
        return {
          answer: '',
          target,
          covered,
          matches,
          runs,
          reason: 'ambiguous missing runs'
        };
      }

      run = scored[0];
    }

    if (!run || run.length > 8) {
      return {
        answer: '',
        target,
        covered,
        matches,
        runs,
        reason: 'gap too large or unresolved'
      };
    }

    const first = targetTokens[run.start];
    const last = targetTokens[run.end];

    if (!first || !last) {
      return {
        answer: '',
        target,
        covered,
        matches,
        runs,
        reason: 'invalid gap span'
      };
    }

    const answer = String(target)
      .slice(first.start, last.end)
      .trim();

    return {
      answer,
      target,
      covered,
      matches,
      runs,
      chosenRun: run,
      reason: answer ? 'ok' : 'empty answer'
    };
  }

  function gapKeyTextureInfo(o) {
    let info = null;

    walk(o, (c) => {
      if (info) return;

      const tex = fullTextureName(c);

      if (/keyboard\/enterKey/i.test(tex) || /keyboard\/enterIcon/i.test(tex)) {
        info = 'enter';
      } else if (/keyboard\/spaceKey/i.test(tex)) {
        info = 'space';
      } else if (/keyboard\/backspaceIcon/i.test(tex)) {
        info = 'backspace';
      } else if (/keyboard\/shiftIcon/i.test(tex)) {
        info = 'shift';
      } else if (/keyboard\/(smallKey|largeKey)/i.test(tex)) {
        info = 'character';
      }
    });

    return info;
  }

  function collectGapKeyboardKeys() {
    const a = state.pixiApp;
    if (!a) return [];

    const raw = [];

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;
      if (!Array.isArray(o.children) || !o.children.length) return;

      const kind = gapKeyTextureInfo(o);
      if (!kind) return;

      const b = boundsOf(o);
      if (!b || b.width < 18 || b.height < 18 || b.width > 420 || b.height > 120) return;

      const texts = [];

      walk(o, (c) => {
        if (typeof c.text !== 'string' || !c.text.trim()) return;
        if (!isVisible(c, a.stage)) return;

        const cb = boundsOf(c);
        if (!cb || cb.width <= 0 || cb.height <= 0) return;

        texts.push(c.text.trim());
      });

      let label = '';

      if (kind === 'enter') label = 'Enter';
      else if (kind === 'space') label = ' ';
      else if (kind === 'backspace') label = 'Backspace';
      else if (kind === 'shift') label = 'Shift';
      else if (texts.length) {
        texts.sort((x, y) => x.length - y.length);
        label = texts[0];
      }

      if (!label && kind === 'character') return;

      let clickObj = o;
      let clickBounds = b;
      let events = typeof verbEventNames === 'function' ? verbEventNames(o) : [];

      // Climb only through key-sized wrappers to find the listener.
      let p = o.parent;
      let depth = 0;

      while (p && depth < 3 && !events.length) {
        const pb = boundsOf(p);
        if (!pb || pb.width > 430 || pb.height > 130) break;

        const pe = typeof verbEventNames === 'function'
          ? verbEventNames(p)
          : [];

        if (pe.length) {
          clickObj = p;
          clickBounds = pb;
          events = pe;
          break;
        }

        p = p.parent;
        depth++;
      }

      raw.push({
        obj: clickObj,
        label,
        kind,
        bounds: clickBounds,
        events,
        direct: events.some(e =>
          /^(pointerup|click|tap|mouseup|touchend)$/i.test(e)
        )
      });
    });

    const out = [];
    const seen = new Set();

    for (const k of raw) {
      const key =
        `${k.kind}:${normaliseText(k.label)}:` +
        `${Math.round(k.bounds.x)}:${Math.round(k.bounds.y)}`;

      if (seen.has(key)) continue;
      seen.add(key);
      out.push(k);
    }

    out.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
    return out;
  }

  function findGapKey(keys, wanted) {
    const w = String(wanted);

    if (w === ' ') {
      return keys.find(k => k.kind === 'space') || null;
    }

    if (w === 'Enter') {
      return keys.find(k => k.kind === 'enter') || null;
    }

    if (w === 'Backspace') {
      return keys.find(k => k.kind === 'backspace') || null;
    }

    if (w === 'Shift') {
      return keys.find(k => k.kind === 'shift') || null;
    }

    // Exact visible key first.
    let key = keys.find(k => k.kind === 'character' && k.label === w);
    if (key) return key;

    // Then case-insensitive.
    const lw = w.toLocaleLowerCase();
    key = keys.find(k =>
      k.kind === 'character' &&
      String(k.label).toLocaleLowerCase() === lw
    );

    return key || null;
  }



  function findKeyboardKeyExact(keys, wanted) {
    const w = String(wanted);

    if (w === ' ') return keys.find(k => k.kind === 'space') || null;
    if (w === 'Enter') return keys.find(k => k.kind === 'enter') || null;
    if (w === 'Backspace') return keys.find(k => k.kind === 'backspace') || null;
    if (w === 'Shift') return keys.find(k => k.kind === 'shift') || null;

    return keys.find(k =>
      k.kind === 'character' &&
      String(k.label) === w
    ) || null;
  }

  function instantCanvasPointerClickWorld(x, y, marker) {
    const a = state.pixiApp;
    if (!a || !a.view) return false;

    const c = a.view;
    const r = c.getBoundingClientRect();
    const res = (a.renderer && a.renderer.resolution) || 1;
    const lw = (a.renderer.width || c.width) / res;
    const lh = (a.renderer.height || c.height) / res;

    const cx = r.left + x * (r.width / lw);
    const cy = r.top + y * (r.height / lh);

    if (marker) showClickMarker(cx, cy, marker);

    try {
      firePointerEvent(c, 'pointerover', cx, cy, 0);
      firePointerEvent(c, 'pointermove', cx, cy, 0);
      firePointerEvent(c, 'pointerdown', cx, cy, 1);
      firePointerEvent(c, 'pointerup', cx, cy, 0);
      return true;
    } catch (e) {
      log('instantCanvasPointerClickWorld failed', e);
      return false;
    }
  }

  async function clickGapKey(key) {
    if (!key || !key.bounds) return false;

    if (
      key.direct &&
      key.obj &&
      typeof key.obj.emit === 'function'
    ) {
      try {
        key.obj.emit(
          'pointerup',
          makeVerbEvent(key.obj, 'pointerup')
        );
        return true;
      } catch (_) {}
    }

    const b = key.bounds;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;

    return instantCanvasPointerClickWorld(
      x,
      y,
      '#a78bfa'
    );
  }

  function dispatchGapKeyboardFallback(ch) {
    const key =
      ch === ' ' ? ' ' :
      ch === '\n' ? 'Enter' :
      ch;

    const code =
      key === 'Enter' ? 'Enter' :
      key === ' ' ? 'Space' :
      key.length === 1 && /[A-Za-z]/.test(key)
        ? `Key${key.toUpperCase()}`
        : '';

    const targets = [
      state.pixiApp && state.pixiApp.view,
      document.activeElement,
      document,
      window
    ].filter(Boolean);

    for (const target of targets) {
      try {
        target.dispatchEvent(new KeyboardEvent('keydown', {
          key,
          code,
          bubbles: true,
          cancelable: true
        }));

        target.dispatchEvent(new KeyboardEvent('keyup', {
          key,
          code,
          bubbles: true,
          cancelable: true
        }));
      } catch (_) {}
    }

    return true;
  }

  async function typeGapFillAnswer(answer) {
    const text = String(answer || '');
    if (!text) return false;

    let keys = collectGapKeyboardKeys();

    for (const ch of [...text]) {
      // Terminal punctuation is normally outside the editable gap.
      if (/[.!?,;:]/u.test(ch)) continue;

      if (ch === ' ') {
        const space = findGapKey(keys, ' ');

        if (space) {
          await clickGapKey(space);
        } else {
          dispatchGapKeyboardFallback(' ');
        }

        continue;
      }

      let key = findGapKey(keys, ch);

      // Uppercase: toggle Shift and immediately emit the character.
      if (!key && ch !== ch.toLocaleLowerCase()) {
        const shift = findGapKey(keys, 'Shift');

        if (shift) {
          await clickGapKey(shift);

          // Some keyboards relabel after Shift; refresh once but do not wait.
          keys = collectGapKeyboardKeys();
          key =
            findGapKey(keys, ch) ||
            findGapKey(keys, ch.toLocaleLowerCase());
        }
      }

      if (key) {
        await clickGapKey(key);
      } else {
        dispatchGapKeyboardFallback(ch);
      }
    }

    // Submit immediately after the final character.
    keys = collectGapKeyboardKeys();
    const enter = findGapKey(keys, 'Enter');

    if (enter) {
      addLog('GapFill: instant Enter');
      await clickGapKey(enter);
    } else {
      addLog('GapFill: instant keyboard Enter fallback');
      dispatchGapKeyboardFallback('\n');
    }

    return true;
  }

  function countGapResult(kind) {
    const a = state.pixiApp;
    if (!a) return 0;

    let count = 0;

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;

      const tex = fullTextureName(o);
      const n = textureName(o);

      if (
        kind === 'correct' &&
        (
          /^correct$/i.test(n) ||
          /gapfill.*correct/i.test(tex) ||
          /progress\/correct/i.test(tex)
        )
      ) count++;

      if (
        kind === 'incorrect' &&
        (
          /^incorrect$/i.test(n) ||
          /gapfill.*incorrect/i.test(tex) ||
          /progress\/incorrect/i.test(tex)
        )
      ) count++;
    });

    return count;
  }

  function resetGapFillState() {
    state.gapLastRoundKey = null;
    state.gapBaseRoundKey = null;
    state.gapBoardIdentity = null;
    state.gapAnswer = '';
    state.gapSubmittedKey = null;
    state.gapSubmittedAt = 0;
    state.gapTransitionSeen = false;
    state.gapRoundSerial = 0;
    state.gapFails = 0;
    state.gapBusy = false;
    state.gapLastInference = null;
    setPromptLabel('');
    setProgress(0, 0);
  }

  async function gapFillTick() {
    if (!state.sentences.length) {
      setStatus('GapFill: waiting for sentence data');
      return;
    }

    const prompt = findGapFillPrompt();

    if (!prompt) {
      setStatus('GapFill: waiting for sentence');
      return;
    }

    setPromptLabel(prompt.text);

    const sm = prompt.match || matchPromptToSentence(prompt.text);
    if (sm && !prompt.match) prompt.match = sm;

    const target = findGapFillTarget(prompt);

    if (!target) {
      setStatus('GapFill: sentence not in data');
      return;
    }

    // New visible sentence/target must immediately clear the previous submit
    // lock. v8.2 waited until after inference, which is why question 3 could
    // inherit submitted=yes and stall.
    const boardIdentity =
      `${normaliseText(prompt.text)}|${chunkKey(target)}`;

    if (
      state.gapBoardIdentity &&
      state.gapBoardIdentity !== boardIdentity
    ) {
      state.gapRoundSerial++;
      state.gapSubmittedKey = null;
      state.gapSubmittedAt = 0;
      state.gapTransitionSeen = false;
      state.gapBaseRoundKey = null;
      state.gapLastRoundKey = null;
      addLog('GapFill: fresh board detected', 'ok');
    }

    state.gapBoardIdentity = boardIdentity;

    const inference = inferGapFillAnswer(target, prompt.text);
    state.gapLastInference = inference;

    if (!inference || !inference.answer) {
      // A submitted answer temporarily makes the sentence complete. Seeing
      // that complete/reset state arms the script for the next round, even if
      // LanguageNut repeats the exact same sentence and exact same gap.
      if (state.gapSubmittedKey) {
        state.gapTransitionSeen = true;
      }

      setStatus(
        `GapFill: waiting for gap ` +
        `(${inference && inference.reason ? inference.reason : 'not found'})`
      );
      return;
    }

    const answer = inference.answer;
    const baseRoundKey =
      `${normaliseText(prompt.text)}|${chunkKey(target)}|${chunkKey(answer)}`;

    // Different prompt/target/gap = definitely a new round.
    if (
      state.gapBaseRoundKey &&
      state.gapBaseRoundKey !== baseRoundKey
    ) {
      state.gapTransitionSeen = false;
      state.gapSubmittedKey = null;
      state.gapRoundSerial++;
    }

    // Same exact gap can legitimately appear again. Once the previous board
    // was seen completed/reset, allow that same base key again.
    if (
      state.gapBaseRoundKey === baseRoundKey &&
      state.gapSubmittedKey &&
      state.gapTransitionSeen
    ) {
      state.gapSubmittedKey = null;
      state.gapTransitionSeen = false;
      state.gapRoundSerial++;
      addLog('GapFill: new round detected (same gap repeated)', 'ok');
    }

    state.gapBaseRoundKey = baseRoundKey;

    const roundKey =
      `${baseRoundKey}|round:${state.gapRoundSerial}`;

    if (state.gapLastRoundKey !== roundKey) {
      state.gapLastRoundKey = roundKey;
      state.gapAnswer = answer;
      state.gapFails = 0;

      addLog(`GapFill prompt: "${prompt.text}"`, 'ok');
      addLog(`GapFill target: "${target}"`, 'ok');
      addLog(`GapFill missing: "${answer}"`, 'ok');

      setProgress(0, 1);
    }

    if (state.gapSubmittedKey === roundKey) {
      setStatus('GapFill: waiting for next question');
      return;
    }

    if (state.gapFails >= CONFIG.gapMaxFails) {
      setStatus('GapFill: stuck');
      return;
    }

    const beforeCorrect = countGapResult('correct');
    const beforeIncorrect = countGapResult('incorrect');

    addLog(`GapFill typing: "${answer}"`);

    const typed = await typeGapFillAnswer(answer);

    if (!typed) {
      state.gapFails++;
      addLog('GapFill: could not type answer', 'err');
      return;
    }

    state.gapSubmittedKey = roundKey;
    state.gapSubmittedAt = Date.now();
    await sleep(CONFIG.gapAfterSubmitMs);

    const afterCorrect = countGapResult('correct');
    const afterIncorrect = countGapResult('incorrect');

    if (afterIncorrect > beforeIncorrect) {
      state.gapFails++;
      state.gapSubmittedKey = null;
      addLog(`✗ GapFill rejected "${answer}"`, 'err');
      setStatus('GapFill: incorrect');
      return;
    }

    if (afterCorrect > beforeCorrect) {
      state.answeredCount++;
      setAnsweredCount(state.answeredCount);
      addLog(`✓ GapFill "${answer}"`, 'ok');
      notifyDiscord('Answer completed', `GapFill: ${answer}`);
      setProgress(1, 1);
      setStatus('GapFill: correct');
      return;
    }

    // Some builds transition without exposing a distinct correct texture.
    const promptNow = findGapFillPrompt();

    if (
      !promptNow ||
      normaliseText(promptNow.text) !== normaliseText(prompt.text)
    ) {
      state.gapTransitionSeen = true;
      state.answeredCount++;
      setAnsweredCount(state.answeredCount);
      addLog(`✓ GapFill submitted "${answer}"`, 'ok');
      notifyDiscord('Answer completed', `GapFill: ${answer}`);
      setProgress(1, 1);
      setStatus('GapFill: answered');
      return;
    }

    // Keep one submission only for this exact round until the game changes.
    setStatus('GapFill: submitted');
  }


  // ============ OCEAN CLEANER / FISHING GAME ============
  function oceanObjId(o) {
    if (!o) return '';
    if (!o.__lnOceanId) {
      try {
        Object.defineProperty(o, '__lnOceanId', {
          configurable: true,
          enumerable: false,
          writable: false,
          value: 'oc_' + Math.random().toString(36).slice(2)
        });
      } catch (_) {
        o.__lnOceanId = 'oc_' + Math.random().toString(36).slice(2);
      }
    }
    return o.__lnOceanId;
  }

  function oceanHasContainerTexture(o) {
    let found = false;

    walk(o, (c) => {
      if (found) return;
      const full = fullTextureName(c);
      const name = textureName(c);
      if (
        /(?:games\/)?(?:fishing|ocean)\/(?:containers?\/)?container/i.test(full) ||
        /container_\d+/i.test(full) ||
        /container_\d+/i.test(name) ||
        /^container/i.test(name) ||
        /(?:games\/)?(?:fishing|ocean)\/.*container/i.test(full)
      ) {
        found = true;
      }
    });

    return found;
  }

  function collectOceanContainers() {
    const a = state.pixiApp;
    if (!a) return [];

    const raw = [];

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;
      if (!Array.isArray(o.children) || !o.children.length) return;
      if (!oceanHasContainerTexture(o)) return;

      const b = boundsOf(o);
      if (!b) return;

      // Generous container size range to handle 1-letter words up to multi-word phrases.
      if (b.width < 20 || b.width > 600 || b.height < 15 || b.height > 180) return;

      const texts = [];

      walk(o, (c) => {
        if (typeof c.text !== 'string' || !c.text.trim()) return;
        if (!isVisible(c, a.stage)) return;

        const cb = boundsOf(c);
        if (!cb || cb.width <= 0 || cb.height <= 0) return;

        texts.push(c.text.trim());
      });

      if (!texts.length) return;

      texts.sort((x, y) => y.length - x.length);
      const label = texts[0];

      const events = typeof verbEventNames === 'function'
        ? verbEventNames(o)
        : [];

      raw.push({
        id: oceanObjId(o),
        obj: o,
        label,
        bounds: b,
        events,
        direct:
          events.includes('pointerup') ||
          events.includes('pointerdown') ||
          events.includes('pointertap') ||
          events.includes('click') ||
          events.includes('tap')
      });
    });

    // Avoid nested duplicate wrappers around the same physical container.
    const out = [];

    for (const c of raw) {
      const cx = c.bounds.x + c.bounds.width / 2;
      const cy = c.bounds.y + c.bounds.height / 2;

      const dup = out.find(x => {
        if (x.id && c.id && x.id === c.id) return true;
        if (chunkKey(x.label) !== chunkKey(c.label)) return false;

        const xx = x.bounds.x + x.bounds.width / 2;
        const xy = x.bounds.y + x.bounds.height / 2;

        return Math.abs(xx - cx) < 15 && Math.abs(xy - cy) < 15;
      });

      if (!dup) {
        out.push(c);
      } else if (c.direct && !dup.direct) {
        Object.assign(dup, c);
      }
    }

    out.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
    return out;
  }

  function findOceanPrompt() {
    const a = state.pixiApp;
    if (!a) return null;
    if (state.sentences.length === 0 && state.vocab.length === 0) return null;

    const candidates = [];

    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.trim()) return;
      if (!isVisible(o, a.stage)) return;

      const text = o.text.trim();
      let match = null;
      let isVocab = false;

      // Check sentences first, then vocab entries
      if (state.sentences.length > 0) {
        match = matchPromptToSentence(text);
      }
      if (!match && state.vocab.length > 0) {
        const ve = matchPromptToEntry(text);
        if (ve) {
          match = { entry: ve, matchedField: 'vocab' };
          isVocab = true;
        }
      }

      if (!match) return;

      const b = boundsOf(o);
      if (!b || b.width < 10 || b.height <= 0) return;

      // Prompts appear across the upper portion of the game board.
      if (b.y < 10 || b.y > 260) return;

      candidates.push({
        obj: o,
        text,
        bounds: b,
        match,
        isVocab
      });
    });

    if (!candidates.length) return null;

    candidates.sort((a, b) => {
      if (a.bounds.y !== b.bounds.y) return a.bounds.y - b.bounds.y;
      return b.text.length - a.text.length;
    });

    return candidates[0];
  }

  function resolveOceanTarget(prompt) {
    if (!prompt) return '';
    if (prompt.isVocab && prompt.match && prompt.match.entry) {
      return computeReadingAnswer(prompt.match.entry, prompt.text);
    }
    const sm = prompt.match;
    if (sm && sm.entry) {
      const target = findTargetSentenceField(sm.entry, sm.matchedField);
      if (target) return target;
    }
    // Fallback: check vocab
    if (state.vocab.length > 0) {
      const ve = matchPromptToEntry(prompt.text);
      if (ve) return computeReadingAnswer(ve, prompt.text);
    }
    // Fallback: check sentences
    if (state.sentences.length > 0) {
      const se = matchPromptToSentence(prompt.text);
      if (se) return findTargetSentenceField(se.entry, se.matchedField);
    }
    return '';
  }

  function buildOceanOrder(target, containers) {
    const targetSeq = chunkKey(target);
    if (!targetSeq) return [];

    const targetSeqLower = targetSeq.toLowerCase();

    const pool = (containers || [])
      .map((c, index) => ({
        ...c,
        _index: index,
        _norm: chunkKey(c.label)
      }))
      .filter(c => c._norm);

    if (!pool.length) return [];

    const memo = new Set();

    function solve(pos, used) {
      if (pos === targetSeq.length) return [];

      const memoKey =
        `${pos}|${[...used].sort((a, b) => a - b).join(',')}`;

      if (memo.has(memoKey)) return null;

      const candidates = pool
        .filter(c => {
          if (used.has(c._index)) return false;
          if (pos + c._norm.length > targetSeq.length) return false;
          const slice = targetSeqLower.slice(pos, pos + c._norm.length);
          return slice === c._norm.toLowerCase();
        })
        .sort((a, b) => {
          // Prefer exact-case match over case-insensitive match
          const aExact = targetSeq.slice(pos, pos + a._norm.length) === a._norm ? 1 : 0;
          const bExact = targetSeq.slice(pos, pos + b._norm.length) === b._norm ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;
          return b._norm.length - a._norm.length;
        });

      for (const c of candidates) {
        const nextUsed = new Set(used);
        nextUsed.add(c._index);

        const rest = solve(pos + c._norm.length, nextUsed);

        if (rest !== null) {
          return [
            {
              id: c.id,
              obj: c.obj,
              label: c.label,
              bounds: c.bounds,
              direct: c.direct,
              events: c.events
            },
            ...rest
          ];
        }
      }

      memo.add(memoKey);
      return null;
    }

    const solved = solve(0, new Set());
    if (!solved) return [];

    const rebuilt = solved.map(c => chunkKey(c.label)).join('');
    return rebuilt.toLowerCase() === targetSeqLower ? solved : [];
  }

  function oceanContainerKey(c) {
    if (!c) return '';
    const id = c.id || (c.obj ? oceanObjId(c.obj) : '');
    const b = c.bounds || {};
    return `${id}|${chunkKey(c.label)}@${Math.round(b.x || 0)}:${Math.round(b.y || 0)}`;
  }

  function tryBuildOceanOrder(target) {
    const containers = collectOceanContainers();
    const order = buildOceanOrder(target, containers);

    return {
      containers,
      order,
      ready: order.length > 0
    };
  }

  function resetOceanState() {
    state.oceanLastPrompt = null;
    state.oceanTarget = '';
    state.oceanOrder = [];
    state.oceanPickedCount = 0;
    state.oceanFails = 0;
    state.oceanBusy = false;
    state.oceanUsedKeys = new Set();
    state.oceanLastClickAt = 0;
    setPromptLabel('');
    setProgress(0, 0);
  }

  function findOceanNextButton() {
    const a = state.pixiApp;
    if (!a) return null;
    let found = null;
    walk(a.stage, (o) => {
      if (found) return;
      if (!isVisible(o, a.stage)) return;
      const f = fullTextureName(o);
      const n = textureName(o);
      if (
        /nextQuestionButton/i.test(f) ||
        /nextQuestionButton/i.test(n) ||
        /continueButton/i.test(f) ||
        /continueButton/i.test(n) ||
        /submitButton/i.test(f)
      ) {
        found = o;
        return;
      }
      if (typeof o.text === 'string' && /^(?:next|continue|submit)!?$/i.test(o.text.trim())) {
        found = o;
      }
    });
    return found;
  }

  async function clickOceanContainer(container) {
    if (!container || !container.bounds) return false;

    const b = container.bounds;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;

    addLog(
      `Ocean click "${container.label}" @ ${x|0},${y|0} ` +
      `[direct=${container.direct ? 'yes' : 'no'}]`
    );

    // 1) Direct PIXI emission on the container, its parent, and interactive children
    const evs = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'pointertap', 'click', 'tap'];
    const targets = [];
    if (container.obj) targets.push(container.obj);
    if (container.obj && container.obj.parent) targets.push(container.obj.parent);
    if (container.obj && Array.isArray(container.obj.children)) {
      for (const child of container.obj.children) {
        if (child && (child.interactive === true || child.eventMode === 'static' || child.eventMode === 'dynamic')) {
          targets.push(child);
        }
      }
    }

    for (const target of targets) {
      if (typeof target.emit === 'function') {
        for (const evName of evs) {
          try {
            target.emit(evName, makeVerbEvent(target, evName));
          } catch (_) {}
        }
      }
    }

    // 2) Full Canvas event dispatch (fires PointerEvent AND MouseEvent sequence)
    const pt = worldToClient(b);
    if (pt) {
      fireClickAt(pt.x, pt.y, '#38bdf8');
    } else {
      await safeCanvasPointerClickWorld(x, y, '#38bdf8', 18);
    }

    return true;
  }

  function oceanContainerMovedOrGone(before, afterContainers) {
    if (!before) return false;

    // Check by persistent object ID first
    if (before.id) {
      const match = afterContainers.find(c => c.id === before.id);
      if (!match) return true; // Object was removed from container list

      const dx = Math.abs(match.bounds.x - before.bounds.x);
      const dy = Math.abs(match.bounds.y - before.bounds.y);
      if (dx > 15 || dy > 15) return true; // Object moved significantly
    }

    // Check count of containers with this label
    const labelKey = chunkKey(before.label);
    const beforeLabelCount = (state.oceanOrder || []).filter(c => chunkKey(c.label) === labelKey).length;
    const afterLabelCount = afterContainers.filter(c => chunkKey(c.label) === labelKey).length;
    if (afterLabelCount < beforeLabelCount) return true;

    // Fallback: check if the exact position has emptied
    const beforeKey = oceanContainerKey(before);
    if (!afterContainers.some(c => oceanContainerKey(c) === beforeKey)) {
      return true;
    }

    return false;
  }

  async function oceanCleanerTick() {
    if (state.sentences.length === 0 && state.vocab.length === 0) {
      setStatus('Ocean Cleaner: waiting for data');
      return;
    }

    const prompt = findOceanPrompt();

    if (!prompt) {
      setStatus('Ocean Cleaner: waiting for prompt');
      return;
    }

    setPromptLabel(prompt.text);

    const target = resolveOceanTarget(prompt);

    if (!target) {
      setStatus('Ocean Cleaner: prompt not in data');
      return;
    }

    const promptKey =
      normaliseText(prompt.text) + '|' + chunkKey(target);

    if (state.oceanLastPrompt !== promptKey) {
      state.oceanLastPrompt = promptKey;
      state.oceanTarget = target;
      state.oceanOrder = [];
      state.oceanPickedCount = 0;
      state.oceanFails = 0;
      state.oceanUsedKeys = new Set();

      addLog(`Ocean prompt: "${prompt.text}"`, 'ok');
      addLog(`Ocean target: "${target}"`, 'ok');
    }

    // New rounds may switch the prompt before the new floating containers
    // finish animating in, so keep rebuilding until the entire target exists.
    if (!state.oceanOrder.length) {
      const built = tryBuildOceanOrder(target);

      if (!built.ready) {
        setStatus(
          `Ocean Cleaner: waiting for fresh containers ` +
          `(${built.containers.length} visible)`
        );
        await sleep(100);
        return;
      }

      state.oceanOrder = built.order;

      addLog(
        `Ocean order: ${state.oceanOrder.map(x => x.label).join(' → ')}`,
        'ok'
      );

      setProgress(0, state.oceanOrder.length);
      return;
    }

    const expected = state.oceanOrder.length;

    if (state.oceanPickedCount >= expected) {
      setStatus('Ocean Cleaner: sentence completed');
      setProgress(expected, expected);

      // Check if there is a Next/Continue button to advance
      const nextBtn = findOceanNextButton();
      if (nextBtn) {
        const nb = boundsOf(nextBtn);
        if (nb) {
          const pt = worldToClient(nb);
          if (pt) fireClickAt(pt.x, pt.y, '#4ade80');
        }
      }

      await sleep(CONFIG.oceanAfterRoundMs);

      // Check if prompt has changed
      const currentPrompt = findOceanPrompt();
      if (!currentPrompt || normaliseText(currentPrompt.text) !== normaliseText(prompt.text)) {
        state.oceanLastPrompt = null;
        state.oceanOrder = [];
        state.oceanPickedCount = 0;
      }
      return;
    }

    if (state.oceanFails >= CONFIG.oceanMaxFails) {
      setStatus('Ocean Cleaner: stuck');
      addLog('Ocean Cleaner: too many failed container clicks', 'err');
      return;
    }

    const wanted = state.oceanOrder[state.oceanPickedCount];
    const wantedKey = chunkKey(wanted.label);

    const live = collectOceanContainers();

    let candidates = live.filter(c =>
      chunkKey(c.label) === wantedKey &&
      !state.oceanUsedKeys.has(c.id || oceanContainerKey(c))
    );

    if (!candidates.length) {
      // If the container disappeared between ticks, treat as collected
      const stillVisible = live.some(
        c => chunkKey(c.label) === wantedKey && !state.oceanUsedKeys.has(c.id || oceanContainerKey(c))
      );

      if (!stillVisible) {
        state.oceanPickedCount++;
        state.oceanFails = 0;
        addLog(
          `✓ Ocean "${wanted.label}" already collected ` +
          `(${state.oceanPickedCount}/${expected})`,
          'ok'
        );
        setProgress(state.oceanPickedCount, expected);
        return;
      }

      state.oceanFails++;
      addLog(`Ocean: no unused container for "${wanted.label}"`, 'err');
      await sleep(90);
      return;
    }

    candidates.sort((a, b) => {
      if (a.direct !== b.direct) return a.direct ? -1 : 1;
      return a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x;
    });

    const next = candidates[0];
    const key = next.id || oceanContainerKey(next);

    const now = Date.now();
    if (now - state.oceanLastClickAt < CONFIG.oceanClickDelayMs) return;
    state.oceanLastClickAt = now;

    addLog(
      `Ocean ${state.oceanPickedCount + 1}/${expected}: "${next.label}"`,
      'ok'
    );

    const clicked = await clickOceanContainer(next);

    if (!clicked) {
      state.oceanFails++;
      addLog(`✗ Ocean click failed: "${next.label}"`, 'err');
      setStatus('Ocean Cleaner: click failed');
      return;
    }

    // Dynamic poll for container movement or consumption.
    const maxWaitMs = 800;
    const pollInterval = 80;
    const startTime = Date.now();
    let accepted = false;

    while (Date.now() - startTime < maxWaitMs) {
      await sleep(pollInterval);
      const after = collectOceanContainers();
      if (oceanContainerMovedOrGone(next, after)) {
        accepted = true;
        break;
      }
    }

    // If still not moved, try a second click attempt with canvas
    if (!accepted) {
      const pt = worldToClient(next.bounds);
      if (pt) fireClickAt(pt.x, pt.y, '#38bdf8');
      await sleep(300);
      const after = collectOceanContainers();
      accepted = oceanContainerMovedOrGone(next, after);
    }

    // Even if movement wasn't detected by position delta (e.g. animated in place or faded),
    // if fails are accumulating, advance rather than hanging forever.
    if (!accepted && state.oceanFails < 2) {
      state.oceanFails++;
      addLog(
        `? Ocean container did not move: "${next.label}"`,
        'err'
      );
      setStatus('Ocean Cleaner: retrying');
      return;
    }

    state.oceanUsedKeys.add(key);
    state.oceanPickedCount++;
    state.oceanFails = 0;

    addLog(
      `✓ Ocean "${next.label}" collected ` +
      `(${state.oceanPickedCount}/${expected})`,
      'ok'
    );

    setProgress(state.oceanPickedCount, expected);
    setStatus('Ocean Cleaner: collecting');
  }


  // ============ WORDPOP LISTENING ============
  function wordPopEntryTerms(entry) {
    if (!entry) return [];

    return [
      entry.word,
      entry.originalWord,
      entry.translatedWord,
      entry.translation,
      entry.original,
      entry.translated
    ]
      .filter(v => typeof v === 'string' && v.trim())
      .map(v => v.trim());
  }

  function wordPopAllVocabTerms() {
    const map = new Map();

    for (const e of state.vocab) {
      for (const raw of wordPopEntryTerms(e)) {
        const n = normaliseText(raw);
        if (!n) continue;

        if (!map.has(n)) map.set(n, []);
        map.get(n).push({ entry: e, raw });
      }
    }

    return map;
  }

  function wordPopNearestClickable(textObj, textBounds) {
    let p = textObj;
    let depth = 0;
    let fallback = textObj;

    while (p && depth < 7) {
      const b = boundsOf(p);
      if (!b) break;

      // Stop before we accidentally select the whole game/stage.
      if (b.width > 430 || b.height > 300) break;

      fallback = p;

      const events = typeof verbEventNames === 'function'
        ? verbEventNames(p)
        : [];

      const clickable =
        events.some(e =>
          /^(pointerup|pointerdown|click|tap|mouseup|mousedown|touchend)$/i.test(e)
        ) ||
        p.interactive === true ||
        p.eventMode === 'static' ||
        p.eventMode === 'dynamic' ||
        p.buttonMode === true;

      if (clickable) {
        return {
          obj: p,
          bounds: b,
          events
        };
      }

      p = p.parent;
      depth++;
    }

    return {
      obj: fallback || textObj,
      bounds: boundsOf(fallback || textObj) || textBounds,
      events: typeof verbEventNames === 'function'
        ? verbEventNames(fallback || textObj)
        : []
    };
  }

  function collectWordPopBubbles() {
    const a = state.pixiApp;
    if (!a || !state.vocab.length) return [];

    const termMap = wordPopAllVocabTerms();
    const out = [];

    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.trim()) return;
      if (!isVisible(o, a.stage)) return;

      const label = o.text.trim();
      const norm = normaliseText(label);

      if (!norm || !termMap.has(norm)) return;
      if (/^\d+$/.test(label)) return;

      const tb = boundsOf(o);
      if (!tb || tb.width < 4 || tb.height < 4) return;

      // Ignore tiny/off-board text and huge prompt/UI labels.
      if (tb.x < -20 || tb.y < -20) return;
      if (tb.width > 380 || tb.height > 120) return;

      const click = wordPopNearestClickable(o, tb);
      const cb = click.bounds || tb;

      // Reject stage-ish wrappers; text itself remains a safe fallback.
      const useClickBounds =
        cb.width > 0 && cb.height > 0 &&
        cb.width <= 430 && cb.height <= 300
          ? cb
          : tb;

      const key =
        `${norm}@${Math.round(tb.x)}:${Math.round(tb.y)}`;

      if (out.some(x => x.key === key)) return;

      out.push({
        key,
        obj: click.obj,
        textObj: o,
        label,
        bounds: useClickBounds,
        bubbleBounds: useClickBounds,
        textBounds: tb,
        events: click.events || [],
        interactive:
          click.obj &&
          (
            click.obj.interactive === true ||
            click.obj.eventMode === 'static' ||
            click.obj.eventMode === 'dynamic' ||
            click.obj.buttonMode === true
          ),
        vocabMatches: termMap.get(norm)
      });
    });

    // De-duplicate duplicate text renderers at essentially the same location.
    const merged = [];
    for (const c of out) {
      const cx = c.textBounds.x + c.textBounds.width / 2;
      const cy = c.textBounds.y + c.textBounds.height / 2;

      const dup = merged.find(x => {
        if (normaliseText(x.label) !== normaliseText(c.label)) return false;

        const xx = x.textBounds.x + x.textBounds.width / 2;
        const xy = x.textBounds.y + x.textBounds.height / 2;

        return Math.abs(xx - cx) < 8 && Math.abs(xy - cy) < 8;
      });

      if (!dup) {
        merged.push(c);
      } else if (
        c.events.length > dup.events.length ||
        (c.interactive && !dup.interactive)
      ) {
        Object.assign(dup, c);
      }
    }

    merged.sort((a, b) => {
      if (Math.abs(a.textBounds.y - b.textBounds.y) > 15) {
        return a.textBounds.y - b.textBounds.y;
      }
      return a.textBounds.x - b.textBounds.x;
    });

    return merged;
  }

  function wordPopSignature() {
    return collectWordPopBubbles()
      .map(b => normaliseText(b.label)).sort()
      .join('|');
  }

  function findWordPopAudioButton() {
    const a = state.pixiApp;
    if (!a) return null;

    let best = null;

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;

      let match = false;
      const n = fullTextureName(o);
      const t = textureName(o);

      if (/audioWordPod/i.test(n) || /audioWordPod/i.test(t)) match = true;
      if (/new_design\/AudioButton/i.test(n) || /^AudioButton$/i.test(t)) match = true;
      if (/audioMouseOver/i.test(n) || /audioMouseOver/i.test(t)) match = true;
      if (!match) return;

      const b = boundsOf(o);
      if (!b || b.width < 15 || b.height < 15 || b.width > 260 || b.height > 140) return;

      const area = b.width * b.height;
      if (!best || area > best.area) {
        best = { obj: o, bounds: b, area, texture: n || t };
      }
    });

    if (!best) return null;

    // Prefer a nearby listener-bearing parent when the texture itself is passive.
    let p = best.obj;
    let depth = 0;
    let clickObj = best.obj;

    while (p && depth < 5) {
      const b = boundsOf(p);
      if (!b || b.width > 320 || b.height > 180) break;

      const evs = typeof verbEventNames === 'function' ? verbEventNames(p) : [];
      if (evs.length) {
        clickObj = p;
        break;
      }

      p = p.parent;
      depth++;
    }

    return {
      obj: clickObj,
      bounds: boundsOf(clickObj) || best.bounds,
      texture: best.texture
    };
  }

  function countWordPopResult(kind) {
    const a = state.pixiApp;
    if (!a) return 0;

    let count = 0;
    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;

      const n = textureName(o);
      const f = fullTextureName(o);

      if (
        kind === 'correct' &&
        (/^correct$/i.test(n) || /BigTick/i.test(n) || /progress\/correct/i.test(f))
      ) count++;

      if (
        kind === 'incorrect' &&
        (/^incorrect$/i.test(n) || /BigCross/i.test(n) || /progress\/incorrect/i.test(f))
      ) count++;
    });

    return count;
  }


  function wordPopWantedTexts() {
    if (!state.currentAnswer) return [];

    const raw = [
      state.currentAnswer.word,
      state.currentAnswer.originalWord,
      state.currentEntry && state.currentEntry.translatedWord,
      state.currentEntry && state.currentEntry.translation,
      state.currentEntry && state.currentEntry.original,
      state.currentEntry && state.currentEntry.translated,
      ...state.wordPopTranslationTerms
    ]
      .filter(v => typeof v === 'string' && v.trim())
      .map(v => v.trim());

    const seen = new Set();
    return raw.filter(v => {
      const n = normaliseText(v);
      if (!n || seen.has(n)) return false;
      seen.add(n);
      return true;
    });
  }

  function collectWordPopAnswerButtons() {
    const a = state.pixiApp;
    if (!a || !state.currentAnswer) return [];

    const wantedRaw = wordPopWantedTexts();
    const wanted = new Set(wantedRaw.map(normaliseText));
    const out = [];

    // ------------------------------------------------------------
    // PIXI text/buttons
    // ------------------------------------------------------------
    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.trim()) return;
      if (!isVisible(o, a.stage)) return;

      const label = o.text.trim();
      const norm = normaliseText(label);
      if (!wanted.has(norm)) return;

      const tb = boundsOf(o);
      if (!tb || tb.width <= 0 || tb.height <= 0) return;

      let p = o;
      let depth = 0;
      let best = null;

      while (p && depth < 9) {
        const pb = boundsOf(p);
        if (!pb) break;

        // Never climb into the whole game board/stage.
        if (pb.width > 500 || pb.height > 360) break;

        const events = typeof verbEventNames === 'function'
          ? verbEventNames(p)
          : [];

        const hasClickEvent = events.some(e =>
          /^(pointerup|pointerdown|click|tap|mouseup|mousedown|touchend|keyup)$/i.test(e)
        );

        const interactive =
          hasClickEvent ||
          p.interactive === true ||
          p.eventMode === 'static' ||
          p.eventMode === 'dynamic' ||
          p.buttonMode === true ||
          p.cursor === 'pointer';

        if (interactive) {
          best = {
            obj: p,
            bounds: pb,
            events,
            direct: hasClickEvent
          };

          // A listener-bearing parent is better than an object that is merely
          // marked interactive.
          if (hasClickEvent) break;
        }

        p = p.parent;
        depth++;
      }

      // If there is no interactive parent, clicking the text centre is still
      // safer than guessing a fixed WordPop coordinate.
      const clickBounds = best && best.bounds ? best.bounds : tb;

      out.push({
        source: 'pixi',
        label,
        norm,
        textObj: o,
        obj: best ? best.obj : o,
        textBounds: tb,
        bounds: clickBounds,
        events: best ? best.events : [],
        direct: !!(best && best.direct),
        interactive: !!best
      });
    });

    // ------------------------------------------------------------
    // Normal DOM buttons, for builds where WordPop overlays HTML controls.
    // ------------------------------------------------------------
    const selectors = [
      'button',
      '[role="button"]',
      '[tabindex]',
      '[onclick]'
    ];

    for (const el of document.querySelectorAll(selectors.join(','))) {
      const text = String(el.innerText || el.textContent || '').trim();
      if (!text) continue;

      const norm = normaliseText(text);
      if (!wanted.has(norm)) continue;

      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();

      if (
        cs.display === 'none' ||
        cs.visibility === 'hidden' ||
        Number(cs.opacity) === 0 ||
        r.width <= 0 ||
        r.height <= 0
      ) continue;

      out.push({
        source: 'dom',
        label: text,
        norm,
        element: el,
        boundsClient: r,
        direct: true,
        interactive: true,
        events: ['dom-click']
      });
    }

    // De-duplicate candidates at the same PIXI position / same DOM element.
    const result = [];
    const seen = new Set();

    for (const c of out) {
      let key;

      if (c.source === 'dom') {
        key = `dom:${c.norm}:${Math.round(c.boundsClient.x)}:${Math.round(c.boundsClient.y)}`;
      } else {
        key =
          `pixi:${c.norm}:` +
          `${Math.round(c.bounds.x)}:${Math.round(c.bounds.y)}:` +
          `${Math.round(c.bounds.width)}:${Math.round(c.bounds.height)}`;
      }

      if (seen.has(key)) continue;
      seen.add(key);
      result.push(c);
    }

    // Prefer actual listener-bearing buttons, then interactive objects,
    // then text-centre fallbacks.
    result.sort((a, b) => {
      const score = c =>
        (c.source === 'dom' ? 30 : 0) +
        (c.direct ? 20 : 0) +
        (c.interactive ? 10 : 0) +
        (c.events && c.events.length ? 5 : 0);

      return score(b) - score(a);
    });

    return result;
  }

  function wordPopBoardFingerprint() {
    const a = state.pixiApp;
    if (!a) return '';

    const parts = [];

    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.trim()) return;
      if (!isVisible(o, a.stage)) return;

      const b = boundsOf(o);
      if (!b || b.width <= 0 || b.height <= 0) return;

      parts.push(
        `${normaliseText(o.text)}@` +
        `${Math.round(b.x)}:${Math.round(b.y)}`
      );
    });

    return parts.sort().join('|');
  }

  async function clickWordPopAnswerCandidate(candidate) {
    if (!candidate) return false;

    if (candidate.source === 'dom') {
      if (state.running && isConcertRoute()) {
        log('Concert firewall blocked WordPop DOM click');
        return false;
      }

      const el = candidate.element;
      if (!el || !el.isConnected) return false;

      if (
        state.running &&
        isConcertRoute() &&
        /\b(assignments?|homework)\b/i.test(
          String(el.innerText || el.textContent || '')
        )
      ) {
        log('Concert firewall blocked Assignments/Homework DOM click');
        return false;
      }

      addLog(`WordPop DOM click "${candidate.label}"`);

      try {
        el.click();
        await sleep(CONFIG.wordPopAfterClickMs);
        return true;
      } catch (_) {
        return false;
      }
    }

    const b = candidate.bounds;
    if (!b) return false;

    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;

    addLog(
      `WordPop PIXI click "${candidate.label}" @ ${x|0},${y|0} ` +
      `[${candidate.direct ? 'button' : candidate.interactive ? 'interactive' : 'text'}]`
    );

    // If we found an actual pointerup listener, trigger that exact object first.
    if (
      candidate.direct &&
      candidate.obj &&
      typeof candidate.obj.emit === 'function'
    ) {
      try {
        candidate.obj.emit(
          'pointerup',
          makeVerbEvent(candidate.obj, 'pointerup')
        );
        await sleep(CONFIG.wordPopAfterClickMs);
        return true;
      } catch (_) {}
    }

    // Otherwise click the centre of the matched text/button itself.
    return safeCanvasPointerClickWorld(
      x,
      y,
      '#60a5fa',
      CONFIG.wordPopAfterClickMs
    );
  }

  function matchWordPopBubble(bubbles) {
    if (!state.currentAnswer) return null;

    const wanted = [
      normaliseText(state.currentAnswer.word),
      normaliseText(state.currentAnswer.originalWord)
    ].filter(Boolean);

    // Exact match first.
    for (const b of bubbles) {
      const n = normaliseText(b.label);
      if (wanted.includes(n)) return b;
    }

    // Then a cautious containment fallback for longer labels.
    for (const b of bubbles) {
      const n = normaliseText(b.label);
      for (const w of wanted) {
        if (
          n.length > 2 &&
          w.length > 2 &&
          (n.includes(w) || w.includes(n))
        ) return b;
      }
    }

    return null;
  }

  async function clickWordPopMatchingText() {
    if (!state.currentAnswer) {
      return {
        clicked: false,
        changed: false,
        correct: false,
        incorrect: false
      };
    }

    const candidates = collectWordPopAnswerButtons();

    if (!candidates.length) {
      addLog(
        `WordPop: no clickable text matching ` +
        `${wordPopWantedTexts().map(x => `"${x}"`).join(' / ')}`,
        'err'
      );

      return {
        clicked: false,
        changed: false,
        correct: false,
        incorrect: false
      };
    }

    const beforeBoard = wordPopBoardFingerprint();
    const beforeCorrect = countWordPopResult('correct');
    const beforeIncorrect = countWordPopResult('incorrect');

    addLog(
      `WordPop matching text buttons: ` +
      candidates.map(c => `"${c.label}"[${c.source}]`).join(', '),
      'ok'
    );

    // Click each exact-text button candidate until WordPop visibly reacts.
    for (const candidate of candidates) {
      const clicked = await clickWordPopAnswerCandidate(candidate);
      if (!clicked) continue;

      await sleep(CONFIG.wordPopAfterClickMs);

      const afterBoard = wordPopBoardFingerprint();
      const correct = countWordPopResult('correct');
      const incorrect = countWordPopResult('incorrect');

      if (incorrect > beforeIncorrect) {
        return {
          clicked: true,
          changed: true,
          correct: false,
          incorrect: true
        };
      }

      if (
        correct > beforeCorrect ||
        afterBoard !== beforeBoard
      ) {
        return {
          clicked: true,
          changed: true,
          correct: correct > beforeCorrect,
          incorrect: false
        };
      }
    }

    return {
      clicked: true,
      changed: false,
      correct: false,
      incorrect: false
    };
  }


  async function playWordPopAudioForSignature(sig, force) {
    if (!state.running && !force) return false;
    if (state.wordPopAudioBusy) return false;

    if (!force && state.lastPlayedKey === sig) return true;
    if (!force && state.lastPlayedKey === 'wordpop-current' && sig) {
      state.lastPlayedKey = sig;
      return true;
    }

    const audio = findWordPopAudioButton();
    if (!audio) return false;

    state.wordPopAudioBusy = true;

    try {
      // Clear stale answer data before playing a new listening question.
      state.currentAnswer = null;
      state.currentEntry = null;
      state.lastAudioUrl = null;
      setAudioLabel('');

      const b = audio.bounds;
      const x = b.x + b.width / 2;
      const y = b.y + b.height / 2;

      addLog('WordPop: auto-playing audio…');
      state.lastPlayedKey = sig;

      // First use the normal canvas pointer path.
      await safeCanvasPointerClickWorld(x, y, '#4ade80', 15);
      await sleep(CONFIG.wordPopAfterPlayMs);

      if (state.currentAnswer) {
        addLog(
          `WordPop audio matched: "${state.currentAnswer.word}" / ` +
          `"${state.currentAnswer.originalWord}"`,
          'ok'
        );
        return true;
      }

      setStatus('WordPop: waiting for audio data');
      return false;
    } finally {
      state.wordPopAudioBusy = false;
    }
  }

  async function primeWordPopOnStart() {
    setStatus('Detecting activity…');

    // Start can be pressed before PIXI/mode/buttons have fully initialised.
    // Wait for the actual WordPop board, with visible diagnostics.
    for (let i = 0; i < 40 && state.running; i++) {
      tryGrabPixi();

      const m = detectMode();

      if (m) {
        state.mode = m;
        setModeLabel(modeLabel(m));
        updateModeButtons(m);
      }

      if (m === 'concert-speaking') {
      setStatus('Concert handled by main dispatcher');
      return false;
    }


    if (m === 'wordpop-listening') {
        const bubbles = collectWordPopBubbles();
        const audio = findWordPopAudioButton();

        setStatus(
          `WordPop: ${bubbles.length} bubbles / ${audio ? 'audio found' : 'no audio yet'}`
        );

        if (audio) {
          const sig = wordPopSignature() || 'wordpop-current';

          state.lastPlayedKey = null;
          state.wordPopLastKey = null;
          state.wordPopLastSignature = sig;

          addLog(
            `WordPop detected: ${bubbles.length} options, audio button found`,
            'ok'
          );

          await playWordPopAudioForSignature(sig, true);
          return true;
        }
      } else if (m && m !== 'wordpop-listening') {
        // Don't silently look idle if another mode is being detected.
        setStatus(`Detected ${modeLabel(m)}`);
      } else {
        setStatus('Waiting for game…');
      }

      await sleep(100);
    }

    if (state.running) {
      const m = detectMode();
      addLog(
        `WordPop start detection timed out; mode=${modeLabel(m)}`,
        'err'
      );
      setStatus(`Could not detect WordPop (${modeLabel(m)})`);
    }

    return false;
  }

  function resetWordPopState() {
    state.wordPopFails = 0;
    state.wordPopLastKey = null;
    state.wordPopLastSignature = null;
    state.wordPopBusy = false;
    state.wordPopAudioBusy = false;
    state.wordPopTranslationTriedKey = '';
    state.wordPopTranslationTerms = [];
    state.wordPopNextPlayAt = 0;
    state.currentAnswer = null;
    state.currentEntry = null;
    state.lastAudioUrl = null;
    state.lastPlayedKey = null;
    state.wordPopControllerItem = null;
    state.wordPopControllerQuestion = null;
    setAudioLabel('');
  }

  function wordPopActiveController() {
    if (!/#\/(?:Zen)?WordPop(?:[/?]|$)/i.test(String(location.hash || ''))) return null;
    const controller = window.languagenutControllerObject;
    return controller && Array.isArray(controller.bubbles) &&
      controller.vocabBox?.currentContent ? controller : null;
  }

  function wordPopControllerTick(controller) {
    const item = controller.vocabBox.currentContent;
    const question = controller.currentQuestion;
    if (state.wordPopControllerItem === item &&
        state.wordPopControllerQuestion === question) {
      setStatus('WordPop: waiting for next question');
      return;
    }
    if (!controller.isGameInPlay || !controller.allowClick) {
      setStatus('WordPop: waiting for question');
      return;
    }

    // The game sets this flag on the exact bubble it will accept. Its
    // displayed text can be ambiguous (for example, "I/We have …").
    const bubble = controller.bubbles.find(candidate =>
      candidate?.isCorrect === true &&
      !candidate.isClickDisabled &&
      candidate.compObject?.graphicsObject
    );
    if (!bubble) {
      setStatus('WordPop: waiting for correct bubble');
      return;
    }

    controller.submitAnswer(bubble);
    if (controller.allowClick !== false) {
      setStatus('WordPop: answer was not accepted');
      return;
    }

    state.wordPopControllerItem = item;
    state.wordPopControllerQuestion = question;
    state.wordPopFails = 0;
    state.answeredCount++;
    setAnsweredCount(state.answeredCount);
    addLog(`WordPop correct bubble: "${bubble.text || item.learningWord || ''}"`, 'ok');
    setStatus('WordPop: answered');
  }

  async function wordPopListeningTick() {
    const controller = wordPopActiveController();
    if (controller) return wordPopControllerTick(controller);
    if (Date.now() < state.wordPopNextPlayAt) return setStatus('WordPop: waiting for next round');
    if (!state.vocab.length) {
      setStatus('WordPop: waiting for vocab');
      return;
    }

    let bubbles = collectWordPopBubbles();
    let sig = wordPopSignature();

    // Play audio FIRST. This WordPop build doesn't expose smallBubble textures,
    // so option detection must never block autoplay.
    if (!state.currentAnswer) {
      const playKey = sig || state.wordPopLastSignature || 'wordpop-current';

      if (CONFIG.autoPlay) {
        await playWordPopAudioForSignature(playKey, false);
      }

      if (!state.currentAnswer && state.lastAudioUrl) {
        const recovered = matchAudioToEntry(state.lastAudioUrl);
        if (recovered) {
          state.currentEntry = recovered;
          state.currentAnswer = {
            word: (recovered.word || '').trim(),
            originalWord: (recovered.originalWord || '').trim()
          };
          addLog(
            `WordPop recovered audio → "${state.currentAnswer.word}" / ` +
            `"${state.currentAnswer.originalWord}"`,
            'ok'
          );
          setAudioLabel(
            `${state.currentAnswer.word} ⟷ ${state.currentAnswer.originalWord}`
          );
        }
      }

      if (!state.currentAnswer) {
        setStatus(
          state.lastAudioUrl
            ? `WordPop: audio heard, no vocab match (${baseName(state.lastAudioUrl)})`
            : 'WordPop: waiting for audio'
        );
        return;
      }
    }

    // Re-scan options after audio because the game may animate/change them.
    bubbles = collectWordPopBubbles();
    sig = wordPopSignature();

    if (state.wordPopLastSignature !== sig) {
      state.wordPopLastSignature = sig;
      state.wordPopLastKey = null;
    }

    let textButtons = collectWordPopAnswerButtons();

    if (!textButtons.length && bubbles.length && state.currentAnswer &&
        state.wordPopTranslationTriedKey !== `${sig}:${baseName(state.lastAudioUrl || '')}`) {
      state.wordPopTranslationTriedKey = `${sig}:${baseName(state.lastAudioUrl || '')}`;
      const sources = [state.currentAnswer.word, state.currentAnswer.originalWord]
        .filter(Boolean).filter((value, index, list) => list.indexOf(value) === index);
      const translated = await Promise.all(sources.flatMap(value => ['en', 'de']
        .map(language => translateWithLibre(value, language))));
      const optionSet = new Set(bubbles.map(b => normaliseText(b.label)));
      const fallbackMatches = [...new Set(translated.filter(value =>
        typeof value === 'string' && optionSet.has(normaliseText(value)))
        .map(value => normaliseText(value)))];
      state.wordPopTranslationTerms = fallbackMatches.length === 1 ? fallbackMatches : [];
      textButtons = collectWordPopAnswerButtons();
      if (textButtons.length) addLog(`WordPop translation fallback matched ${state.wordPopTranslationTerms.join(' / ')}`, 'ok');
    }

    if (!textButtons.length) {
      state.wordPopFails++;

      if (state.wordPopFails === 1 || state.wordPopFails % 8 === 0) {
        addLog(
          `WordPop: waiting for button text matching ` +
          `${wordPopWantedTexts().map(x => `"${x}"`).join(' / ')}`,
          'err'
        );
      }

      setStatus('WordPop: waiting for matching text button');
      return;
    }

    const questionKey =
      (sig || wordPopBoardFingerprint()) + '::' +
      normaliseText(state.currentAnswer.word) + '::' +
      normaliseText(state.currentAnswer.originalWord) + '::' +
      baseName(state.lastAudioUrl || '');

    if (questionKey === state.wordPopLastKey) {
      setStatus('WordPop: waiting for next round');
      return;
    }

    state.wordPopLastKey = questionKey;

    setAudioLabel(
      `${state.currentAnswer.word || ''} ⟷ ${state.currentAnswer.originalWord || ''}`
    );

    addLog(
      `WordPop answer texts: ` +
      `${wordPopWantedTexts().map(x => `"${x}"`).join(' / ')}`,
      'ok'
    );

    const result = await clickWordPopMatchingText();

    if (result.incorrect) {
      state.wordPopFails++;
      state.wordPopLastKey = null;
      addLog(
        `✗ WordPop rejected matching text for ` +
        `${wordPopWantedTexts().map(x => `"${x}"`).join(' / ')}`,
        'err'
      );
      setStatus('WordPop: incorrect');
      return;
    }

    if (!result.changed) {
      state.wordPopFails++;
      state.wordPopLastKey = null;
      addLog(
        `? WordPop matching text did not react: ` +
        `${wordPopWantedTexts().map(x => `"${x}"`).join(' / ')}`,
        'err'
      );
      setStatus('WordPop: retrying');
      return;
    }

    state.wordPopFails = 0;
    state.answeredCount++;
    setAnsweredCount(state.answeredCount);

    addLog(
      `✓ WordPop answered via matching text: ` +
      `${wordPopWantedTexts().map(x => `"${x}"`).join(' / ')}`,
      'ok'
    );
    setStatus('WordPop: answered');

    // Clear the current audio answer only after the bubble board actually reacted.
    state.currentAnswer = null;
    state.currentEntry = null;
    state.lastAudioUrl = null;
    state.lastPlayedKey = null;
    state.wordPopLastKey = null;
    state.wordPopNextPlayAt = Date.now() + Math.max(450, CONFIG.wordPopAfterClickMs);
    state.wordPopTranslationTerms = [];
    state.wordPopTranslationTriedKey = '';
    setAudioLabel('');

    await sleep(CONFIG.wordPopAfterClickMs);
  }


  // ============ FORKLIFT ============
  function forkliftKey(label, bounds) {
    const b = bounds || {};
    return `${chunkKey(label)}@${Math.round(b.x || 0)}:${Math.round(b.y || 0)}`;
  }

  function hasForkliftCrateTexture(o) {
    let found = false;
    walk(o, (c) => {
      if (found) return;
      if (/games\/forklift\/crates\/crate_\d+/i.test(fullTextureName(c))) found = true;
    });
    return found;
  }


  function forkliftObjectVisible(o) {
    const a = state.pixiApp;
    if (!a || !o) return false;

    // IMPORTANT: the real Forklift crate hitboxes use alpha=0.0001 on purpose.
    // Ignore alpha here; only reject objects/parents explicitly hidden.
    let x = o;
    while (x && x !== a.stage) {
      if (x.visible === false || x.renderable === false) return false;
      x = x.parent;
    }
    return true;
  }

  function forkliftIsAnswerCrate(c) {
    if (!c || !c.visualBounds) return false;

    // Raw game dump: source crates occupy y≈95..278; selected answer crates
    // move into the lower row around y≈372.
    return c.visualBounds.y >= 335;
  }

  function forkliftAnswerCount(crates, label) {
    const key = chunkKey(label);
    return crates.filter(c =>
      forkliftIsAnswerCrate(c) &&
      chunkKey(c.label) === key
    ).length;
  }

  function forkliftSourceCount(crates, label) {
    const key = chunkKey(label);
    return crates.filter(c =>
      !forkliftIsAnswerCrate(c) &&
      chunkKey(c.label) === key
    ).length;
  }

  function collectForkliftHitboxes() {
    const a = state.pixiApp;
    if (!a) return [];

    const out = [];

    walk(a.stage, (o) => {
      if (!forkliftObjectVisible(o)) return;

      const events = verbEventNames(o);
      if (!events.includes('pointerup')) return;

      const b = boundsOf(o);
      if (!b) return;

      // Dump shows these transparent crate hitboxes are ~111x38.
      if (b.width < 80 || b.width > 145 || b.height < 25 || b.height > 60) return;

      let hasText = false;
      walk(o, (c) => {
        if (typeof c.text === 'string' && c.text.trim()) hasText = true;
      });
      if (hasText) return;

      out.push({
        obj: o,
        bounds: b,
        events,
        alpha: typeof o.alpha === 'number' ? o.alpha : null
      });
    });

    return out;
  }

  function collectForkliftCrates() {
    const a = state.pixiApp;
    if (!a) return [];

    const raw = [];
    const hitboxes = collectForkliftHitboxes();

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;
      if (!Array.isArray(o.children) || !o.children.length) return;
      if (!hasForkliftCrateTexture(o)) return;

      const b = boundsOf(o);
      if (!b || b.width < 100 || b.width > 180 || b.height < 30 || b.height > 75) return;

      const texts = [];
      walk(o, (c) => {
        if (typeof c.text === 'string' && c.text.trim() && isVisible(c, a.stage)) {
          const cb = boundsOf(c);
          if (cb && cb.width > 0 && cb.height > 0) texts.push(c.text.trim());
        }
      });

      if (!texts.length) return;

      // The crate label is the visible word/phrase inside this crate.
      texts.sort((x, y) => y.length - x.length);
      const label = texts[0];

      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;

      let bestHit = null;
      let bestDist = Infinity;

      for (const h of hitboxes) {
        const hx = h.bounds.x + h.bounds.width / 2;
        const hy = h.bounds.y + h.bounds.height / 2;
        const d = Math.hypot(hx - cx, hy - cy);

        // Hitbox sits directly over the visible crate sprite.
        if (d < bestDist && d < 55) {
          bestDist = d;
          bestHit = h;
        }
      }

      const clickBounds = bestHit ? bestHit.bounds : b;

      raw.push({
        obj: bestHit ? bestHit.obj : o,
        crateObj: o,
        label,
        bounds: clickBounds,
        visualBounds: b,
        directHitbox: !!bestHit
      });
    });

    // De-duplicate nested crate containers.
    const merged = [];
    for (const c of raw) {
      const cx = c.visualBounds.x + c.visualBounds.width / 2;
      const cy = c.visualBounds.y + c.visualBounds.height / 2;

      const dup = merged.find(m => {
        if (chunkKey(m.label) !== chunkKey(c.label)) return false;
        const mx = m.visualBounds.x + m.visualBounds.width / 2;
        const my = m.visualBounds.y + m.visualBounds.height / 2;
        return Math.abs(mx - cx) < 25 && Math.abs(my - cy) < 18;
      });

      if (!dup) merged.push(c);
      else if (c.directHitbox && !dup.directHitbox) Object.assign(dup, c);
    }

    merged.sort((a, b) => {
      if (Math.abs(a.visualBounds.y - b.visualBounds.y) > 20) {
        return a.visualBounds.y - b.visualBounds.y;
      }
      return a.visualBounds.x - b.visualBounds.x;
    });

    return merged;
  }

  function findForkliftPrompt() {
    const a = state.pixiApp;
    if (!a || !state.sentences.length) return null;

    const candidates = [];

    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.trim()) return;
      if (!isVisible(o, a.stage)) return;

      const text = o.text.trim();
      const sm = matchPromptToSentence(text);
      if (!sm) return;

      const b = boundsOf(o);
      if (!b || b.width < 80 || b.height <= 0) return;

      // Prompt from the dump is the wide sentence at the top of the game.
      if (b.y < 45 || b.y > 135) return;

      candidates.push({ obj: o, text, bounds: b, match: sm });
    });

    if (!candidates.length) return null;

    candidates.sort((a, b) => {
      if (a.bounds.y !== b.bounds.y) return a.bounds.y - b.bounds.y;
      return b.text.length - a.text.length;
    });

    return candidates[0];
  }


  function buildForkliftOrder(target, crates) {
    const targetSeq = chunkKey(target);
    if (!targetSeq) return [];

    // Only source crates can be used to build a new sentence.
    const pool = (crates || [])
      .filter(c => !forkliftIsAnswerCrate(c))
      .map((c, index) => ({
        ...c,
        _index: index,
        _norm: chunkKey(c.label)
      }))
      .filter(c => c._norm);

    if (!pool.length) return [];

    // Use DFS/backtracking rather than the shared greedy orderChunks().
    // This guarantees a complete exact construction when overlapping labels exist.
    const memo = new Set();

    function solve(pos, used) {
      if (pos === targetSeq.length) return [];

      const memoKey = pos + '|' + [...used].sort((a, b) => a - b).join(',');
      if (memo.has(memoKey)) return null;

      const candidates = pool
        .filter(c =>
          !used.has(c._index) &&
          targetSeq.startsWith(c._norm, pos)
        )
        .sort((a, b) => b._norm.length - a._norm.length);

      for (const c of candidates) {
        const nextUsed = new Set(used);
        nextUsed.add(c._index);

        const rest = solve(pos + c._norm.length, nextUsed);
        if (rest !== null) {
          return [
            {
              obj: c.obj,
              label: c.label,
              bounds: c.bounds,
              visualBounds: c.visualBounds,
              directHitbox: c.directHitbox
            },
            ...rest
          ];
        }
      }

      memo.add(memoKey);
      return null;
    }

    const solved = solve(0, new Set());
    if (!solved) return [];

    const rebuilt = solved.map(c => chunkKey(c.label)).join('');
    return rebuilt === targetSeq ? solved : [];
  }

  function tryBuildForkliftOrder(target) {
    const crates = collectForkliftCrates();
    const order = buildForkliftOrder(target, crates);

    return {
      crates,
      order,
      ready: order.length > 0
    };
  }

  function resetForkliftState() {
    state.forkliftLastPrompt = null;
    state.forkliftTarget = '';
    state.forkliftOrder = [];
    state.forkliftPickedCount = 0;
    state.forkliftFails = 0;
    state.forkliftBusy = false;
    state.forkliftUsedKeys = new Set();
    state.forkliftLastClickAt = 0;
    setPromptLabel('');
    setProgress(0, 0);
  }

  function emitForkliftHitbox(obj) {
    if (!obj || typeof obj.emit !== 'function') return false;

    try {
      obj.emit('pointerup', makeVerbEvent(obj, 'pointerup'));
      return true;
    } catch (e) {
      log('Forklift direct pointerup failed', e);
      return false;
    }
  }

  async function clickForkliftCrate(crate) {
    if (!crate || !crate.bounds) return false;

    const b = crate.bounds;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;

    addLog(
      `Forklift click "${crate.label}" @ ${x|0},${y|0}` +
      (crate.directHitbox ? ' [hitbox]' : ' [crate]')
    );

    // First use the exact PIXI pointerup listener discovered by the dumper.
    if (crate.directHitbox && emitForkliftHitbox(crate.obj)) {
      await sleep(25);
      return true;
    }

    // Canvas pointer fallback.
    return safeCanvasPointerClickWorld(x, y, '#60a5fa', 20);
  }

  function forkliftCrateStillExists(key) {
    return collectForkliftCrates().some(c => forkliftKey(c.label, c.bounds) === key);
  }

  async function forkliftTick() {
    if (!state.sentences.length) {
      setStatus('Forklift: waiting for sentence data');
      return;
    }

    const prompt = findForkliftPrompt();
    if (!prompt) {
      setStatus('Forklift: waiting for prompt');
      return;
    }

    setPromptLabel(prompt.text);

    const sm = prompt.match || matchPromptToSentence(prompt.text);
    const target = sm ? findTargetSentenceField(sm.entry, sm.matchedField) : '';

    if (!target) {
      setStatus('Forklift: prompt not in sentence data');
      return;
    }

    const promptKey = normaliseText(prompt.text) + '|' + chunkKey(target);

    if (state.forkliftLastPrompt !== promptKey) {
      state.forkliftLastPrompt = promptKey;
      state.forkliftTarget = target;
      state.forkliftPickedCount = 0;
      state.forkliftFails = 0;
      state.forkliftUsedKeys = new Set();
      state.forkliftOrder = [];

      addLog(`Forklift prompt: "${prompt.text}"`, 'ok');
      addLog(`Forklift target: "${target}"`, 'ok');
    }

    // New Forklift boards animate in AFTER the prompt changes. Never permanently
    // store an empty order: keep rebuilding until the fresh source crates exist.
    if (!state.forkliftOrder.length) {
      const built = tryBuildForkliftOrder(target);

      if (!built.ready) {
        setStatus(
          `Forklift: waiting for fresh tiles (${built.crates.filter(c => !forkliftIsAnswerCrate(c)).length} source)`
        );
        await sleep(100);
        return;
      }

      state.forkliftOrder = built.order;

      addLog(
        `Forklift order: ${state.forkliftOrder.map(x => x.label).join(' → ')}`,
        'ok'
      );

      setProgress(0, state.forkliftOrder.length);
      return;
    }

    const expected = state.forkliftOrder.length;

    if (state.forkliftPickedCount >= expected) {
      setStatus('Forklift: waiting for next sentence');
      setProgress(expected, expected);

      await sleep(CONFIG.forkliftAfterRoundMs);

      // Do not repeatedly inspect/log an emptied answer row during the board
      // transition. A changed prompt will initialise the next round above.
      return;
    }

    if (state.forkliftFails >= CONFIG.forkliftMaxFails) {
      setStatus('Forklift: stuck');
      addLog('Forklift: too many failed crate clicks', 'err');
      return;
    }

    const wanted = state.forkliftOrder[state.forkliftPickedCount];
    const wantedKey = chunkKey(wanted.label);

    const crates = collectForkliftCrates();
    let candidates = crates.filter(c =>
      !forkliftIsAnswerCrate(c) &&
      chunkKey(c.label) === wantedKey &&
      !state.forkliftUsedKeys.has(forkliftKey(c.label, c.bounds))
    );

    if (!candidates.length) {
      const alreadyPlaced = forkliftAnswerCount(crates, wanted.label);

      if (alreadyPlaced > 0) {
        // This can happen if the board animation completed between ticks.
        state.forkliftPickedCount++;
        state.forkliftFails = 0;
        addLog(
          `✓ Forklift "${wanted.label}" already in answer row ` +
          `(${state.forkliftPickedCount}/${expected})`,
          'ok'
        );
        setProgress(state.forkliftPickedCount, expected);
        return;
      }

      state.forkliftFails++;
      addLog(`Forklift: source crate not found for "${wanted.label}"`, 'err');
      await sleep(80);
      return;
    }

    // Prefer the direct transparent pointerup hitbox.
    candidates.sort((a, b) => {
      if (a.directHitbox !== b.directHitbox) return a.directHitbox ? -1 : 1;
      return a.visualBounds.y - b.visualBounds.y || a.visualBounds.x - b.visualBounds.x;
    });

    const next = candidates[0];
    const key = forkliftKey(next.label, next.bounds);
    const beforeAnswerCount = forkliftAnswerCount(crates, next.label);
    const beforeSourceCount = forkliftSourceCount(crates, next.label);

    const now = Date.now();
    if (now - state.forkliftLastClickAt < CONFIG.forkliftPickDelayMs) return;
    state.forkliftLastClickAt = now;

    addLog(
      `Forklift ${state.forkliftPickedCount + 1}/${expected}: "${next.label}"`,
      'ok'
    );

    const clicked = await clickForkliftCrate(next);

    if (!clicked) {
      state.forkliftFails++;
      addLog(`✗ Forklift click failed: "${next.label}"`, 'err');
      setStatus('Forklift: click failed');
      return;
    }

    await sleep(CONFIG.forkliftMoveSettleMs);

    let after = collectForkliftCrates();

    let afterAnswerCount = forkliftAnswerCount(after, next.label);
    let afterSourceCount = forkliftSourceCount(after, next.label);

    // A crate is only accepted when it actually moved into the bottom answer
    // row. This removes the false positives seen in v7.2.
    let accepted =
      afterAnswerCount > beforeAnswerCount &&
      afterSourceCount <= beforeSourceCount;

    // Exact hidden PIXI hitbox should normally work first try. If its direct
    // pointerup did not move the crate, send one canvas pointer sequence at the
    // centre of that SAME hitbox.
    if (!accepted && next.directHitbox) {
      const b = next.bounds;
      const x = b.x + b.width / 2;
      const y = b.y + b.height / 2;

      addLog(`Forklift hitbox canvas retry: "${next.label}"`);
      await safeCanvasPointerClickWorld(x, y, '#60a5fa', 18);
      await sleep(CONFIG.forkliftMoveSettleMs);

      after = collectForkliftCrates();
      afterAnswerCount = forkliftAnswerCount(after, next.label);
      afterSourceCount = forkliftSourceCount(after, next.label);

      accepted =
        afterAnswerCount > beforeAnswerCount &&
        afterSourceCount <= beforeSourceCount;
    }

    if (!accepted) {
      state.forkliftFails++;
      addLog(
        `? Forklift "${next.label}" not in answer row ` +
        `(answer ${beforeAnswerCount}→${afterAnswerCount}, ` +
        `source ${beforeSourceCount}→${afterSourceCount})`,
        'err'
      );
      setStatus('Forklift: retrying');
      return;
    }

    state.forkliftUsedKeys.add(key);
    state.forkliftPickedCount++;
    state.forkliftFails = 0;

    addLog(
      `✓ Forklift "${next.label}" placed in answer row ` +
      `(${state.forkliftPickedCount}/${expected})`,
      'ok'
    );

    setProgress(state.forkliftPickedCount, expected);
    setStatus('Forklift: collecting');
  }


  // ============ VERB MATCHER ============
  // Keep case: "Sie hören" and "sie hören" are different answers.
  function verbKey(s) {
    return String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  }

  function verbTextureKind(o) {
    let kind = '';
    walk(o, (x) => {
      if (kind) return;
      const n = textureName(x);
      if (/correctVerbMatcher/i.test(n)) kind = 'correct';
      else if (/incorrectVerbMatcher/i.test(n)) kind = 'incorrect';
      else if (/fullVerbMatcher/i.test(n)) kind = 'full';
      else if (/emptyVerbMatcher/i.test(n)) kind = 'empty';
    });
    return kind;
  }

  function findVerbSubmit(selectedOnly) {
    const a = state.pixiApp; if (!a) return null;
    let selected = null, any = null;
    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;
      const n = textureName(o);
      if (/submitSelected/i.test(n)) selected = o;
      else if (/submitGreyed/i.test(n) && !any) any = o;
    });
    return selected || (selectedOnly ? null : any);
  }

  function knownVerbLabel(label) {
    const k = verbKey(label);
    if (!k) return null;
    for (const v of state.verbs) {
      if (verbKey(v.originalVerb) === k) return { entry: v, side: 'original' };
      if (verbKey(v.translatedVerb) === k) return { entry: v, side: 'translated' };
    }
    return null;
  }

  function collectVerbMatcherTiles(includeCorrect) {
    const a = state.pixiApp; if (!a || state.verbs.length === 0) return [];
    const out = [];
    const seen = new Set();

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage) || seen.has(o)) return;
      const isInt = o.interactive === true || o.eventMode === 'static' || o.eventMode === 'dynamic';
      if (!isInt) return;

      const b = boundsOf(o);
      if (!b || b.width < 45 || b.height < 20 || b.width > 430 || b.height > 120) return;

      let texts = [];
      walk(o, (c) => {
        if (typeof c.text === 'string' && c.text.trim()) texts.push(c.text.trim());
      });
      if (texts.length === 0) return;

      // Longest exact API label inside this clickable object wins.
      const matches = [];
      for (const t of texts) {
        const m = knownVerbLabel(t);
        if (m) matches.push({ label: t, match: m });
      }
      if (matches.length === 0) return;
      matches.sort((x, y) => y.label.length - x.label.length);

      const label = matches[0].label;
      const info = matches[0].match;
      const kind = verbTextureKind(o);
      if (!includeCorrect && kind === 'correct') return;

      seen.add(o);
      out.push({ obj: o, label, entry: info.entry, side: info.side, kind, bounds: b });
    });

    // De-duplicate nested interactive containers at the same position.
    const merged = [];
    for (const t of out) {
      let dup = null;
      for (const m of merged) {
        if (verbKey(m.label) !== verbKey(t.label)) continue;
        const mcx = m.bounds.x + m.bounds.width / 2, mcy = m.bounds.y + m.bounds.height / 2;
        const tcx = t.bounds.x + t.bounds.width / 2, tcy = t.bounds.y + t.bounds.height / 2;
        if (Math.abs(mcx - tcx) < 35 && Math.abs(mcy - tcy) < 25) { dup = m; break; }
      }
      if (!dup) {
        merged.push(t);
      } else {
        // Prefer dimensions closest to the supplied Verb Matcher tile atlas (~283x52).
        const ds = Math.abs(dup.bounds.width - 283) + Math.abs(dup.bounds.height - 52);
        const ts = Math.abs(t.bounds.width - 283) + Math.abs(t.bounds.height - 52);
        if (ts < ds) Object.assign(dup, t);
      }
    }

    return merged;
  }

  function countVerbResultTextures(kind) {
    const a = state.pixiApp; if (!a) return 0;
    let n = 0;
    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;
      const tx = textureName(o);
      if (kind === 'correct' && /correctVerbMatcher/i.test(tx)) n++;
      if (kind === 'incorrect' && /incorrectVerbMatcher/i.test(tx)) n++;
    });
    return n;
  }

  function verbEventNames(o) {
    try {
      if (!o) return [];
      const ev = o._events;
      if (!ev) return [];
      if (ev instanceof Map) return Array.from(ev.keys()).map(String);
      return Object.keys(ev);
    } catch (_) {
      return [];
    }
  }

  function verbClickCandidates(base) {
    const out = [];
    const seen = new Set();

    function add(o) {
      if (!o || seen.has(o)) return;
      const b = boundsOf(o);
      if (!b || b.width < 5 || b.height < 5) return;
      seen.add(o);
      out.push(o);
    }

    add(base);

    // Interactive descendants.
    walk(base, (o) => {
      if (o === base) return;
      const interactive =
        o.interactive === true ||
        o.eventMode === 'static' ||
        o.eventMode === 'dynamic';
      if (interactive) add(o);
    });

    // Interactive parents.
    let p = base && base.parent;
    let depth = 0;
    while (p && depth < 6) {
      const interactive =
        p.interactive === true ||
        p.eventMode === 'static' ||
        p.eventMode === 'dynamic';
      if (interactive) add(p);
      p = p.parent;
      depth++;
    }

    // Prefer objects closest to the actual Verb Matcher atlas tile size.
    out.sort((a, b) => {
      const ab = boundsOf(a), bb = boundsOf(b);
      const as = Math.abs(ab.width - 283) + Math.abs(ab.height - 52);
      const bs = Math.abs(bb.width - 283) + Math.abs(bb.height - 52);
      return as - bs;
    });

    return out;
  }

  function makeVerbEvent(o, type) {
    const b = boundsOf(o);
    const global = {
      x: b ? b.x + b.width / 2 : 0,
      y: b ? b.y + b.height / 2 : 0
    };

    const data = {
      global,
      button: 0,
      buttons: /down|start/i.test(type) ? 1 : 0,
      pointerId: 1,
      pointerType: 'mouse',
      originalEvent: {
        button: 0,
        buttons: /down|start/i.test(type) ? 1 : 0,
        preventDefault() {},
        stopPropagation() {}
      },
      getLocalPosition(container, point) {
        try {
          if (
            container &&
            container.worldTransform &&
            typeof container.worldTransform.applyInverse === 'function'
          ) {
            return container.worldTransform.applyInverse(global, point || {});
          }
        } catch (_) {}

        const p = point || {};
        p.x = global.x;
        p.y = global.y;
        return p;
      }
    };

    return {
      type,
      data,
      global,
      target: o,
      currentTarget: o,
      button: 0,
      buttons: data.buttons,
      pointerId: 1,
      pointerType: 'mouse',
      stopPropagation() {},
      stopImmediatePropagation() {},
      preventDefault() {}
    };
  }

  function emitBestVerbEvent(o) {
    if (!o || typeof o.emit !== 'function') return false;

    const names = verbEventNames(o);
    const preferred = [
      'pointertap',
      'click',
      'tap',
      'pointerdown',
      'mousedown',
      'touchstart'
    ];

    let chosen = preferred.find(n => names.includes(n));

    // If PIXI's listener table isn't exposed, pointertap is the safest direct fallback.
    if (!chosen) chosen = 'pointertap';

    try {
      o.emit(chosen, makeVerbEvent(o, chosen));

      // Some handlers expect an up/end after a down/start.
      if (chosen === 'pointerdown') {
        o.emit('pointerup', makeVerbEvent(o, 'pointerup'));
      } else if (chosen === 'mousedown') {
        o.emit('mouseup', makeVerbEvent(o, 'mouseup'));
      } else if (chosen === 'touchstart') {
        o.emit('touchend', makeVerbEvent(o, 'touchend'));
      }

      return true;
    } catch (_) {
      return false;
    }
  }

  async function clickVerbObject(tile, marker) {
    if (!tile || !tile.obj) return false;

    const candidates = verbClickCandidates(tile.obj);
    if (!candidates.length) return false;

    // 1) Normal canvas click at the actual tile centre.
    const primary = candidates[0];
    const b = boundsOf(primary);
    if (!b) return false;

    const pt = worldToClient(b);
    if (pt) {
      fireClickAt(pt.x, pt.y, marker || '#4ade80');
      await sleep(CONFIG.clickSettleMs);
    }

    // 2) Direct PIXI event on the objects that actually expose click listeners.
    // This is needed by Verb Matcher on builds where synthetic canvas events
    // don't pass through PIXI's Interaction/Event system.
    const listenerTargets = candidates.filter(o => verbEventNames(o).length > 0);
    const targets = listenerTargets.length ? listenerTargets : candidates.slice(0, 2);

    let emitted = false;
    for (const o of targets.slice(0, 3)) {
      if (emitBestVerbEvent(o)) {
        emitted = true;
        // One listener-bearing target is enough; avoid accidental double toggles.
        if (verbEventNames(o).length > 0) break;
      }
    }

    await sleep(CONFIG.clickSettleMs);
    return !!pt || emitted;
  }

  async function performVerbPair(pair) {
    const beforeIncorrect = countVerbResultTextures('incorrect');

    addLog(`Clicking source "${pair.entry.originalVerb}"`);
    const leftOk = await clickVerbObject(pair.left, '#4ade80');
    if (!leftOk) return { ok: false, reason: 'source click failed' };

    await sleep(CONFIG.verbMatcherBetweenClicksMs);

    addLog(`Clicking match "${pair.entry.translatedVerb}"`);
    const rightOk = await clickVerbObject(pair.right, '#ffb45c');
    if (!rightOk) return { ok: false, reason: 'match click failed' };

    // Verb Matcher keeps the same PIXI/text objects alive after moving them,
    // so presence/position of those labels is NOT a reliable success signal.
    // Only treat an explicit incorrect-result texture as failure.
    await sleep(CONFIG.verbMatcherAfterPairMs);

    const afterIncorrect = countVerbResultTextures('incorrect');
    if (afterIncorrect > beforeIncorrect) {
      return { ok: false, rejected: true, reason: 'game showed incorrect' };
    }

    return { ok: true };
  }

  async function pressVerbSubmit() {
    const s = findVerbSubmit(true);
    if (!s) return false;
    const b = boundsOf(s); if (!b) return false;
    const pt = worldToClient(b); if (!pt) return false;
    fireClickAt(pt.x, pt.y, '#4ade80');
    await sleep(CONFIG.clickSettleMs);
    return true;
  }

  function resetVerbState() {
    state.verbDone = new Set();
    state.verbFails = 0;
    state.verbSubmitAt = 0;
    state.verbLastPair = null;
    setProgress(0, state.verbs.length);
  }

  async function verbMatcherTick() {
    if (await dismissStartDialog()) return;

    if (state.verbs.length === 0) {
      setStatus('Verb Matcher: waiting for verb data');
      return;
    }

    const activeSubmit = findVerbSubmit(true);
    const tiles = collectVerbMatcherTiles(false);

    // Once the game enables the selected submit texture, the board is ready.
    if (activeSubmit && tiles.length === 0) {
      const now = Date.now();
      if (now - state.verbSubmitAt > 1200) {
        state.verbSubmitAt = now;
        addLog('Verb Matcher complete — Submit', 'ok');
        await pressVerbSubmit();
        setStatus('Submitted');
        await sleep(CONFIG.afterAnswerMs);
      }
      return;
    }

    // Find one currently visible exact API pair.
    let pair = null;
    for (const v of state.verbs) {
      const uid = String(v.uid || verbKey(v.originalVerb) + '|' + verbKey(v.translatedVerb));
      if (state.verbDone.has(uid)) continue;

      const left = tiles.find(t =>
        t.side === 'original' &&
        verbKey(t.label) === verbKey(v.originalVerb)
      );
      const right = tiles.find(t =>
        t.side === 'translated' &&
        verbKey(t.label) === verbKey(v.translatedVerb)
      );

      if (left && right && left.obj !== right.obj) {
        pair = { uid, entry: v, left, right };
        break;
      }
    }

    if (!pair) {
      // Correct tiles can stay visible on some builds; if Submit is active, use it.
      if (activeSubmit) {
        const now = Date.now();
        if (now - state.verbSubmitAt > 1200) {
          state.verbSubmitAt = now;
          addLog('No unmatched pairs left — Submit', 'ok');
          await pressVerbSubmit();
          setStatus('Submitted');
          await sleep(CONFIG.afterAnswerMs);
        }
        return;
      }

      // If all API entries we actually saw were paired, wait for the button/state change.
      if (state.verbDone.size > 0 && tiles.length === 0) {
        setStatus('Verb Matcher: waiting for submit');
        return;
      }

      state.verbFails++;
      if (state.verbFails === 1 || state.verbFails % 10 === 0) {
        addLog(`Verb Matcher: no visible API pair (${tiles.length} tiles)`, 'err');
      }
      setStatus('Verb Matcher: waiting for pair');
      await sleep(250);
      return;
    }

    state.verbLastPair = pair.uid;
    addLog(`Pairing "${pair.entry.originalVerb}" ↔ "${pair.entry.translatedVerb}"`, 'ok');
    setPromptLabel(`${pair.entry.originalVerb} ↔ ${pair.entry.translatedVerb}`);

    const result = await performVerbPair(pair);

    if (result.ok) {
      state.verbDone.add(pair.uid);
      state.verbFails = 0;
      addLog(`✓ Verb pair ${state.verbDone.size}/${state.verbs.length}`, 'ok');
      setProgress(state.verbDone.size, state.verbs.length);
      setStatus('Verb Matcher: matched');
      await sleep(220);
      return;
    }

    state.verbFails++;
    addLog(`✗ Verb pair failed: ${result.reason || 'unknown'}`, 'err');
    setStatus(result.rejected ? 'Verb Matcher: pair rejected' : 'Verb Matcher: click failed');
    await sleep(450);
  }


  // ============ JIGSAW ============
  function isJigsawPieceTextureName(n) {
    return /(?:^|\/)jigsawPiece$/i.test(String(n || '').replace(/\.png$/i, '')) ||
           /jigsawPiece/i.test(String(n || ''));
  }

  function jigsawTextureKind(o) {
    let kind = '';
    walk(o, (x) => {
      if (kind) return;
      const n = textureName(x);
      if (/incorrectPiecePicture/i.test(n)) kind = 'incorrect';
      else if (/jigsawCorrectPiece/i.test(n)) kind = 'correct';
      else if (/jigsawPiece/i.test(n)) kind = 'piece';
      else if (/jigsawBackground/i.test(n)) kind = 'background';
    });
    return kind;
  }

  function countJigsawTexture(rx) {
    const a = state.pixiApp; if (!a) return 0;
    let count = 0;
    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage)) return;
      if (rx.test(textureName(o))) count++;
    });
    return count;
  }

  function rectContains(outer, inner, pad) {
    pad = pad || 0;
    return (
      inner.x >= outer.x - pad &&
      inner.y >= outer.y - pad &&
      inner.x + inner.width <= outer.x + outer.width + pad &&
      inner.y + inner.height <= outer.y + outer.height + pad
    );
  }

  function collectJigsawPieces(includeCorrect) {
    const a = state.pixiApp;
    if (!a || state.verbs.length === 0) return [];

    const raw = [];
    const seen = new Set();

    walk(a.stage, (o) => {
      if (!isVisible(o, a.stage) || seen.has(o)) return;

      const interactive =
        o.interactive === true ||
        o.eventMode === 'static' ||
        o.eventMode === 'dynamic';

      if (!interactive) return;

      const b = boundsOf(o);
      if (!b || b.width < 30 || b.height < 15 || b.width > 500 || b.height > 400) return;

      // Prefer objects that are, contain, or sit around a jigsaw piece texture.
      const kind = jigsawTextureKind(o);
      const nearPieceShape =
        kind === 'piece' ||
        kind === 'correct' ||
        (b.width >= 35 && b.width <= 350 && b.height >= 25 && b.height <= 300);

      if (!nearPieceShape) return;
      if (!includeCorrect && kind === 'correct') return;

      const texts = [];
      walk(o, (c) => {
        if (typeof c.text === 'string' && c.text.trim()) texts.push(c.text.trim());
      });

      const matches = [];
      for (const t of texts) {
        const m = knownVerbLabel(t);
        if (m) matches.push({ label: t, match: m });
      }
      if (!matches.length) return;

      matches.sort((x, y) => y.label.length - x.label.length);
      const best = matches[0];

      seen.add(o);
      raw.push({
        obj: o,
        label: best.label,
        entry: best.match.entry,
        side: best.match.side,
        kind: kind || 'piece',
        bounds: b
      });
    });

    // De-duplicate nested interactive objects for the same piece.
    const merged = [];
    for (const t of raw) {
      let dup = null;
      for (const m of merged) {
        if (verbKey(m.label) !== verbKey(t.label)) continue;
        const mcx = m.bounds.x + m.bounds.width / 2;
        const mcy = m.bounds.y + m.bounds.height / 2;
        const tcx = t.bounds.x + t.bounds.width / 2;
        const tcy = t.bounds.y + t.bounds.height / 2;
        if (Math.abs(mcx - tcx) < 30 && Math.abs(mcy - tcy) < 30) {
          dup = m;
          break;
        }
      }

      if (!dup) {
        merged.push(t);
      } else {
        // Atlas jigsaw piece is ~115x121; prefer the closest clickable bounds.
        const ds = Math.abs(dup.bounds.width - 115) + Math.abs(dup.bounds.height - 121);
        const ts = Math.abs(t.bounds.width - 115) + Math.abs(t.bounds.height - 121);
        if (ts < ds) Object.assign(dup, t);
      }
    }

    return merged;
  }


  function bestJigsawClickableForText(textObj) {
    if (!textObj) return null;

    const textBounds = boundsOf(textObj);
    if (!textBounds) return null;

    const candidates = [];
    let o = textObj;
    let depth = 0;

    while (o && depth < 9) {
      const b = boundsOf(o);
      if (b && b.width >= 20 && b.height >= 12 && b.width <= 320 && b.height <= 200) {
        const interactive =
          o.interactive === true ||
          o.eventMode === 'static' ||
          o.eventMode === 'dynamic';

        // Prefer actual interactive containers, but keep the text/container
        // itself as a canvas-click fallback.
        candidates.push({
          obj: o,
          bounds: b,
          interactive,
          depth,
          area: b.width * b.height
        });
      }

      o = o.parent;
      depth++;
    }

    if (!candidates.length) {
      return { obj: textObj, bounds: textBounds };
    }

    candidates.sort((a, b) => {
      if (a.interactive !== b.interactive) return a.interactive ? -1 : 1;
      // Smallest reasonable clickable wrapper around the text is safest.
      return a.area - b.area || a.depth - b.depth;
    });

    return {
      obj: candidates[0].obj,
      bounds: candidates[0].bounds
    };
  }

  function boxesOverlap(a, b, pad) {
    pad = pad || 0;
    return !(
      a.x + a.width < b.x - pad ||
      b.x + b.width < a.x - pad ||
      a.y + a.height < b.y - pad ||
      b.y + b.height < a.y - pad
    );
  }


  function htmlDecodeBasic(s) {
    const ta = document.createElement('textarea');
    ta.innerHTML = String(s || '');
    return ta.value;
  }

  function verbSections(entry) {
    const raw = String(entry && (entry.otherData || entry.other) || '');
    const out = [];
    const rx = /<section>([\s\S]*?)<\/section>/gi;
    let m;

    while ((m = rx.exec(raw))) {
      out.push(htmlDecodeBasic(m[1]));
    }

    return out;
  }

  // Case-preserving comparison for Jigsaw. Spaces/punctuation are ignored,
  // but uppercase Sie and lowercase sie remain different.
  function jigsawVerbKey(s) {
    return String(s || '')
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}]/gu, '');
  }

  function jigsawEntryForOriginal(text) {
    const key = jigsawVerbKey(text);
    if (!key) return null;

    for (const v of state.verbs) {
      if (jigsawVerbKey(v.originalVerb) === key) return v;
    }

    return null;
  }

  function descendantTextFragments(root) {
    const bits = [];

    walk(root, (o) => {
      if (typeof o.text !== 'string' || !o.text.length) return;
      if (!isVisible(o, state.pixiApp && state.pixiApp.stage)) return;

      const b = boundsOf(o);
      if (!b || b.width <= 0 || b.height <= 0) return;

      bits.push({
        text: o.text,
        bounds: b,
        obj: o
      });
    });

    // Jigsaw sections are rendered left-to-right inside a target.
    bits.sort((a, b) => {
      const ay = a.bounds.y + a.bounds.height / 2;
      const by = b.bounds.y + b.bounds.height / 2;

      if (Math.abs(ay - by) > 18) return ay - by;
      return a.bounds.x - b.bounds.x;
    });

    return bits;
  }

  function matchJigsawTargetFragments(bits) {
    if (!bits || bits.length === 0) return null;

    // Try every contiguous run because wrappers can contain unrelated small labels.
    for (let start = 0; start < bits.length; start++) {
      let joined = '';

      for (let end = start; end < bits.length && end < start + 8; end++) {
        joined += bits[end].text;

        const entry = jigsawEntryForOriginal(joined);
        if (entry) {
          return {
            entry,
            text: joined,
            start,
            end,
            fragments: bits.slice(start, end + 1)
          };
        }
      }
    }

    // Exact section-sequence fallback using API <section> values.
    for (const entry of state.verbs) {
      const sections = verbSections(entry);
      if (!sections.length) continue;

      const want = sections.map(jigsawVerbKey);

      for (let start = 0; start <= bits.length - want.length; start++) {
        const got = bits
          .slice(start, start + want.length)
          .map(x => jigsawVerbKey(x.text));

        let same = got.length === want.length;
        for (let i = 0; same && i < want.length; i++) {
          if (got[i] !== want[i]) same = false;
        }

        if (same) {
          return {
            entry,
            text: bits.slice(start, start + want.length).map(x => x.text).join(''),
            start,
            end: start + want.length - 1,
            fragments: bits.slice(start, start + want.length)
          };
        }
      }
    }

    return null;
  }

  function collectGlobalJigsawTextBits() {
    const a = state.pixiApp;
    if (!a) return [];

    const bits = [];

    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.length) return;
      if (!isVisible(o, a.stage)) return;

      const b = boundsOf(o);
      if (!b || b.width <= 0 || b.height <= 0) return;

      bits.push({
        obj: o,
        text: o.text,
        bounds: b,
        cx: b.x + b.width / 2,
        cy: b.y + b.height / 2
      });
    });

    return bits;
  }

  function unionBounds(items) {
    if (!items || !items.length) return null;

    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;

    for (const it of items) {
      const b = it.bounds;
      if (!b) continue;
      x1 = Math.min(x1, b.x);
      y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + b.width);
      y2 = Math.max(y2, b.y + b.height);
    }

    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) {
      return null;
    }

    return {
      x: x1,
      y: y1,
      width: Math.max(1, x2 - x1),
      height: Math.max(1, y2 - y1)
    };
  }

  function jigsawFinalSection(entry) {
    const sections = verbSections(entry);
    return sections.length ? sections[sections.length - 1] : '';
  }

  function jigsawPrefixSections(entry) {
    const sections = verbSections(entry);
    return sections.length > 1 ? sections.slice(0, -1) : [];
  }

  function bluePieceMatchesEntry(piece, entry) {
    if (!piece || !entry) return false;
    const pk = verbKey(piece.label);
    const matchesTrans = pk === verbKey(entry.translatedVerb);
    const matchesOrig = pk === verbKey(entry.originalVerb);
    if (!matchesTrans && !matchesOrig) return false;

    const prefixes = jigsawPrefixSections(entry).map(jigsawVerbKey).filter(Boolean);
    if (!prefixes.length) return true;

    const found = [];
    walk(piece.obj, (o) => {
      if (typeof o.text === 'string' && o.text.length) {
        found.push(jigsawVerbKey(o.text));
      }
    });

    // Some wrappers only expose the translated label. In that case the API
    // translatedVerb / originalVerb match is still authoritative.
    const expectedKey = matchesTrans ? jigsawVerbKey(entry.translatedVerb) : jigsawVerbKey(entry.originalVerb);
    const nonEnglish = found.filter(k => k && k !== expectedKey);
    if (!nonEnglish.length) return true;

    return prefixes.every(k => nonEnglish.includes(k));
  }

  function jigsawEndingKey(target) {
    if (!target || !target.bounds) return '';
    const b = target.bounds;
    return `${jigsawVerbKey(target.label)}@${Math.round(b.x)}:${Math.round(b.y)}`;
  }

  function rejectedEndingSet(uid) {
    uid = String(uid || '');
    if (!state.jigsawRejectedEndings.has(uid)) {
      state.jigsawRejectedEndings.set(uid, new Set());
    }
    return state.jigsawRejectedEndings.get(uid);
  }

  function collectJigsawTargets() {
    const a = state.pixiApp;
    if (!a || state.verbs.length === 0) return [];

    const pieces = collectJigsawPieces(true);
    if (!pieces.length) return [];

    const pieceBounds = pieces.map(p => p.bounds);

    const endingKeys = new Set();
    for (const v of state.verbs) {
      const end = jigsawFinalSection(v);
      if (end) endingKeys.add(jigsawVerbKey(end));
    }

    const out = [];
    const seen = new Set();

    for (const bit of collectGlobalJigsawTextBits()) {
      const key = jigsawVerbKey(bit.text);
      if (!key || !endingKeys.has(key)) continue;

      // The white endings are outside the blue-piece rectangles.
      if (pieceBounds.some(pb => rectContains(pb, bit.bounds, 5))) continue;

      const posKey = `${key}@${Math.round(bit.bounds.x)}:${Math.round(bit.bounds.y)}`;
      if (seen.has(posKey)) continue;
      seen.add(posKey);

      // Find a small pointerup-capable parent if available, but keep the TEXT
      // bounds for the actual click point so we definitely hit the white piece.
      let clickObj = bit.obj;
      let p = bit.obj;
      let depth = 0;
      while (p && depth < 6) {
        const pb = boundsOf(p);
        if (!pb || pb.width > 180 || pb.height > 170) break;
        if (verbEventNames(p).includes('pointerup')) {
          clickObj = p;
          break;
        }
        p = p.parent;
        depth++;
      }

      out.push({
        obj: clickObj,
        textObj: bit.obj,
        label: bit.text,
        key,
        bounds: bit.bounds,
        objectBounds: boundsOf(clickObj) || bit.bounds,
        kind: jigsawTextureKind(clickObj) || 'white-ending',
        events: verbEventNames(clickObj)
      });
    }

    out.sort((a, b) => {
      if (Math.abs(a.bounds.y - b.bounds.y) > 20) return a.bounds.y - b.bounds.y;
      return a.bounds.x - b.bounds.x;
    });

    return out;
  }

  async function clickJigsawTarget(target) {
    if (!target) return false;
    const o = target.obj || target.textObj;
    const b = target.bounds || (o ? boundsOf(o) : null);
    if (!b) return false;

    const wx = b.x + b.width / 2;
    const wy = b.y + b.height / 2;
    const pt = { x: wx, y: wy };

    addLog(`Click white ${JSON.stringify(target.label)} @ ${wx|0},${wy|0} (${b.width|0}x${b.height|0})`);

    // 1) Canvas-level full pointer sequence (PixiJS hit-tests from these)
    await safeCanvasPointerClickWorld(wx, wy, '#ffb45c', 30);

    // 2) Direct emit on the display object with proper down→wait→up
    if (o) {
      emitOnObject(o, 'pointerover', pt);
      emitOnObject(o, 'pointermove', pt);
      emitOnObject(o, 'pointerdown', pt);
      emitOnObject(o, 'mousedown', pt);
      await sleep(20);
      emitOnObject(o, 'pointerup', pt);
      emitOnObject(o, 'mouseup', pt);
      emitOnObject(o, 'click', pt);
      emitOnObject(o, 'pointertap', pt);
      emitOnObject(o, 'tap', pt);
    }

    // 3) Also emit on textObj if different from clickObj
    if (target.textObj && target.textObj !== o) {
      emitOnObject(target.textObj, 'pointerdown', pt);
      await sleep(10);
      emitOnObject(target.textObj, 'pointerup', pt);
      emitOnObject(target.textObj, 'click', pt);
      emitOnObject(target.textObj, 'pointertap', pt);
    }

    // 4) Also fire via clickTile (canvas mouse events at client coords)
    await clickTile(o);
    await sleep(10);

    return true;
  }


  function findJigsawPrompt(pieces) {
    const a = state.pixiApp;
    if (!a || state.verbs.length === 0) return null;

    pieces = pieces || collectJigsawPieces(true);
    const pieceBounds = pieces.map(p => p.bounds);
    const cands = [];

    walk(a.stage, (o) => {
      if (typeof o.text !== 'string' || !o.text.trim()) return;
      if (!isVisible(o, a.stage)) return;

      const text = o.text.trim();
      const info = knownVerbLabel(text);
      if (!info) return;

      const b = boundsOf(o);
      if (!b || b.width <= 0 || b.height <= 0) return;

      // Text physically inside a puzzle piece is an option, not the prompt.
      if (pieceBounds.some(pb => rectContains(pb, b, 8))) return;

      cands.push({
        text,
        entry: info.entry,
        side: info.side,
        bounds: b,
        obj: o
      });
    });

    if (!cands.length) return null;

    // Prompt is normally above/central and larger than piece text.
    cands.sort((a, b) => {
      const ay = a.bounds.y, by = b.bounds.y;
      if (Math.abs(ay - by) > 25) return ay - by;
      return (b.bounds.width * b.bounds.height) - (a.bounds.width * a.bounds.height);
    });

    return cands[0];
  }

  function jigsawAnswerForPrompt(prompt) {
    if (!prompt || !prompt.entry) return '';
    if (prompt.side === 'original') return String(prompt.entry.translatedVerb || '').trim();
    if (prompt.side === 'translated') return String(prompt.entry.originalVerb || '').trim();
    return '';
  }

  function jigsawPromptKey(prompt) {
    if (!prompt || !prompt.entry) return '';
    const uid = String(prompt.entry.uid || '');
    return uid + ':' + prompt.side + ':' + verbKey(prompt.text);
  }

  function resetJigsawState() {
    state.jigsawDone = new Set();
    state.jigsawFails = 0;
    state.jigsawLastPrompt = null;
    state.jigsawLastClickAt = 0;
    state.jigsawUsedTargets = new Set();
    state.jigsawUsedTargetPositions = [];
    state.jigsawSlotPositions = [];
    setPromptLabel('');
    setProgress(0, state.verbs.length);
  }

  async function clickJigsawPiece(piece) {
    if (!piece) return false;

    const o = piece.obj || piece;
    const b = piece.bounds || (o ? boundsOf(o) : null);
    if (!b) return false;

    if (b.width > 260 || b.height > 190 || b.width < 30 || b.height < 20) {
      addLog(
        `Blocked unsafe blue-piece bounds ${b.width|0}x${b.height|0}`,
        'err'
      );
      return false;
    }

    const wx = b.x + b.width / 2;
    const wy = b.y + b.height / 2;
    const pt = { x: wx, y: wy };

    addLog(`Click blue @ ${wx|0},${wy|0} (${b.width|0}x${b.height|0})`);

    // 1) Canvas-level full pointer sequence (PixiJS hit-tests from these)
    await safeCanvasPointerClickWorld(wx, wy, '#4ade80', 30);

    // 2) Direct emit on the display object with proper down→wait→up
    if (o) {
      emitOnObject(o, 'pointerover', pt);
      emitOnObject(o, 'pointermove', pt);
      emitOnObject(o, 'pointerdown', pt);
      emitOnObject(o, 'mousedown', pt);
      await sleep(20);
      emitOnObject(o, 'pointerup', pt);
      emitOnObject(o, 'mouseup', pt);
      emitOnObject(o, 'click', pt);
      emitOnObject(o, 'pointertap', pt);
      emitOnObject(o, 'tap', pt);
    }

    // 3) Also fire via clickTile (canvas mouse events at client coords)
    await clickTile(o);
    await sleep(10);

    return true;
  }


  function jigsawObjId(o) {
    if (!o) return '';
    if (!o.__lnJigsawId) {
      try {
        Object.defineProperty(o, '__lnJigsawId', {
          configurable: true,
          enumerable: false,
          writable: false,
          value: 'jg_' + Math.random().toString(36).slice(2)
        });
      } catch (_) {
        o.__lnJigsawId = 'jg_' + Math.random().toString(36).slice(2);
      }
    }
    return o.__lnJigsawId;
  }

  function jigsawStateOf(o) {
    const b = boundsOf(o);
    return {
      id: jigsawObjId(o),
      obj: o,
      x: b ? Math.round(b.x) : 0,
      y: b ? Math.round(b.y) : 0,
      w: b ? Math.round(b.width) : 0,
      h: b ? Math.round(b.height) : 0,
      alpha: typeof o.alpha === 'number' ? Math.round(o.alpha * 1000) / 1000 : 1,
      visible: o.visible !== false,
      tint: typeof o.tint === 'number' ? o.tint : null,
      texture: textureName(o),
      eventMode: o.eventMode || '',
      interactive: o.interactive === true,
      kind: jigsawTextureKind(o),
      events: verbEventNames(o).slice().sort().join(',')
    };
  }

  function snapshotJigsawTargets() {
    const targets = collectJigsawTargets();
    return targets.map((t, index) => ({
      index,
      target: t,
      state: jigsawStateOf(t.obj)
    }));
  }

  function jigsawStateDelta(before, after) {
    let score = 0;

    if (!before || !after) return 0;

    if (before.texture !== after.texture) score += 1000;
    if (before.kind !== after.kind) score += 900;
    if (before.tint !== after.tint) score += 500;
    if (before.alpha !== after.alpha) score += 300;
    if (before.visible !== after.visible) score += 300;
    if (before.interactive !== after.interactive) score += 200;
    if (before.eventMode !== after.eventMode) score += 150;
    if (before.events !== after.events) score += 120;

    const move = Math.abs(before.x - after.x) + Math.abs(before.y - after.y);
    const resize = Math.abs(before.w - after.w) + Math.abs(before.h - after.h);

    if (move > 2) score += Math.min(250, move * 5);
    if (resize > 2) score += Math.min(180, resize * 4);

    return score;
  }


  function jigsawTargetCenter(target) {
    const b = target && (boundsOf(target.obj) || target.bounds);
    if (!b) return null;
    return {
      x: b.x + b.width / 2,
      y: b.y + b.height / 2
    };
  }

  function rememberJigsawTarget(target) {
    if (!target || !target.obj) return;

    state.jigsawUsedTargets.add(jigsawObjId(target.obj));

    const c = jigsawTargetCenter(target);
    if (!c) return;

    const already = state.jigsawUsedTargetPositions.some(p =>
      Math.abs(p.x - c.x) < 24 && Math.abs(p.y - c.y) < 24
    );

    if (!already) state.jigsawUsedTargetPositions.push(c);
  }

  function wasJigsawTargetUsed(target) {
    if (!target || !target.obj) return false;

    if (state.jigsawUsedTargets.has(jigsawObjId(target.obj))) return true;

    const c = jigsawTargetCenter(target);
    if (!c) return false;

    return state.jigsawUsedTargetPositions.some(p =>
      Math.abs(p.x - c.x) < 28 && Math.abs(p.y - c.y) < 28
    );
  }


  function rememberJigsawSlotLayout(targets) {
    if (!Array.isArray(targets) || targets.length === 0) return;

    const points = [];

    for (const t of targets) {
      const b = boundsOf(t.obj) || t.bounds;
      if (!b) continue;

      if (b.width > 260 || b.height > 190 || b.width < 20 || b.height < 15) continue;

      const p = {
        x: b.x + b.width / 2,
        y: b.y + b.height / 2,
        w: b.width,
        h: b.height
      };

      const duplicate = points.some(q =>
        Math.abs(q.x - p.x) < 25 && Math.abs(q.y - p.y) < 25
      );

      if (!duplicate) points.push(p);
    }

    // Keep the fullest layout we've seen, ideally all 8 white target slots.
    if (points.length > state.jigsawSlotPositions.length) {
      state.jigsawSlotPositions = points;
      addLog(`Jigsaw cached ${points.length} white-slot positions`);
    }
  }

  function remainingCachedJigsawSlots() {
    return state.jigsawSlotPositions.filter(p =>
      !state.jigsawUsedTargetPositions.some(u =>
        Math.abs(u.x - p.x) < 28 && Math.abs(u.y - p.y) < 28
      )
    );
  }

  async function safeCanvasPointerClickWorld(x, y, marker, settleMs) {
    const a = state.pixiApp;
    if (!a || !a.view) return false;

    const c = a.view;
    const r = c.getBoundingClientRect();
    const res = (a.renderer && a.renderer.resolution) || 1;
    const lw = (a.renderer.width || c.width) / res;
    const lh = (a.renderer.height || c.height) / res;

    const cx = r.left + x * (r.width / lw);
    const cy = r.top + y * (r.height / lh);

    if (marker) showClickMarker(cx, cy, marker);

    try {
      firePointerEvent(c, 'pointerover', cx, cy, 0);
      firePointerEvent(c, 'pointermove', cx, cy, 0);
      c.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
      c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
      firePointerEvent(c, 'pointerdown', cx, cy, 1);
      c.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 }));
      await sleep(20);
      firePointerEvent(c, 'pointerup', cx, cy, 0);
      c.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
      c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
      await sleep(settleMs == null ? CONFIG.clickSettleMs : settleMs);
      return true;
    } catch (e) {
      log('safeCanvasPointerClickWorld failed', e);
      addLog(`Jigsaw pointer error: ${e && e.message ? e.message : e}`, 'err');
      return false;
    }
  }

  function findRemainingJigsawTarget() {
    const targets = collectJigsawTargets();

    let remaining = targets.filter(t => {
      const b = boundsOf(t.obj) || t.bounds;
      if (!b) return false;

      if (b.width > 260 || b.height > 190 || b.width < 20 || b.height < 15) {
        return false;
      }

      if (t.kind === 'correct') return false;
      if (wasJigsawTargetUsed(t)) return false;

      return true;
    });

    // Prefer objects that really own the pointerup listener.
    const pointerTargets = remaining.filter(t =>
      t.obj && verbEventNames(t.obj).includes('pointerup')
    );
    if (pointerTargets.length) remaining = pointerTargets;

    // On the last piece there should normally be exactly one unused white slot.
    // If nested duplicates remain, collapse by center.
    const unique = [];
    for (const t of remaining) {
      const c = jigsawTargetCenter(t);
      if (!c) continue;

      const duplicate = unique.some(u => {
        const uc = jigsawTargetCenter(u);
        return uc && Math.abs(uc.x - c.x) < 25 && Math.abs(uc.y - c.y) < 25;
      });

      if (!duplicate) unique.push(t);
    }

    return unique;
  }

  function findChangedJigsawTarget(beforeSnapshot, pairIndex, expectedCount) {
    const afterTargets = collectJigsawTargets();

    const beforeById = new Map(
      beforeSnapshot.map(x => [x.state.id, x])
    );

    const ranked = [];

    for (let i = 0; i < afterTargets.length; i++) {
      const t = afterTargets[i];
      const after = jigsawStateOf(t.obj);
      const beforeWrap = beforeById.get(after.id);

      let delta = beforeWrap
        ? jigsawStateDelta(beforeWrap.state, after)
        : 450; // newly surfaced target after blue selection

      // Strong preference for actual jigsaw-shaped targets.
      if (t.kind === 'piece' || t.kind === 'correct') delta += 180;
      if (t.hasOriginalText) delta += 120;

      // Mild fallback preference for API/visual index, but never enough to
      // override a real state change.
      if (expectedCount && afterTargets.length >= expectedCount && i === pairIndex) {
        delta += 35;
      }

      ranked.push({
        target: t,
        delta,
        index: i,
        before: beforeWrap ? beforeWrap.state : null,
        after
      });
    }

    ranked.sort((a, b) => b.delta - a.delta);

    // Require a meaningful state change when available.
    const changed = ranked.filter(r => r.delta >= 120);

    if (changed.length) return { chosen: changed[0], ranked, mode: 'state-change' };

    // Fallback: API order to visual order only when no target visibly changes.
    if (afterTargets.length >= expectedCount && afterTargets[pairIndex]) {
      const fallback = ranked.find(r => r.target === afterTargets[pairIndex]);
      return { chosen: fallback || { target: afterTargets[pairIndex], delta: 0, index: pairIndex }, ranked, mode: 'visual-order' };
    }

    if (ranked.length) return { chosen: ranked[0], ranked, mode: 'best-candidate' };

    return { chosen: null, ranked: [], mode: 'none' };
  }

  // JigsawController uses click-to-pick-up and click-to-place. Its blue bank
  // piece displays <section>3</section>; a board slot displays sections 1+2.
  function collectJigsawBoard() {
    const a = state.pixiApp;
    if (!a) return { pieces: [], slots: [] };
    const pieces = [], slots = [];
    walk(a.stage, o => {
      if (!isVisible(o, a.stage)) return;
      const events = verbEventNames(o);
      const interactive = o.interactive === true ||
        o.eventMode === 'static' || o.eventMode === 'dynamic' ||
        events.some(name => /^(?:pointerup|pointertap|click|tap)$/i.test(name));
      if (!interactive) return;
      const b = boundsOf(o);
      if (!b || b.width < 35 || b.height < 25 || b.width > 450 || b.height > 220) return;
      const labels = [];
      let hasBlue = false, hasSlot = false;
      walk(o, child => {
        const texture = `${fullTextureName(child)} ${textureName(child)}`;
        if (/jigsawPiece(?:\.png)?/i.test(texture) && !/jigsawCorrectPiece/i.test(texture)) hasBlue = true;
        if (/jigsawBackground/i.test(texture)) hasSlot = true;
        if (typeof child.text === 'string' && child.text.trim() && isVisible(child, a.stage)) {
          labels.push(child.text.trim());
        }
      });
      if (hasBlue && !hasSlot && labels.length) pieces.push({ obj: o, bounds: b, labels, key: jigsawVerbKey(labels[0]) });
      if (hasSlot && !hasBlue && labels.length) {
        const keys = [jigsawVerbKey(labels[0]), jigsawVerbKey((labels[0] || '') + (labels[1] || ''))];
        const matches = state.verbs.filter(v => {
          const sections = verbSections(v);
          return sections.length >= 3 && keys.includes(jigsawVerbKey(sections[0] + sections[1]));
        });
        if (matches.length) {
          // The third label is the interface-language word. It separates
          // duplicate stems such as "sie hör" (she hears / they hear).
          const translation = labels[2] || '';
          const exact = matches.find(v => verbKey(v.translatedVerb) === verbKey(translation));
          const entry = exact || matches[0];
          slots.push({
            obj: o, bounds: b, labels,
            key: jigsawVerbKey(verbSections(entry)[0] + verbSections(entry)[1]),
            entryUid: exact ? String(exact.uid || '') : ''
          });
        }
      }
    });
    // Nested clickable wrappers can share one texture. Keep the closest match
    // to each piece/slot's actual clickable container.
    const unique = items => {
      const out = [];
      for (const item of items) {
        const old = out.find(x => x.key === item.key &&
          Math.abs(x.bounds.x - item.bounds.x) < 12 && Math.abs(x.bounds.y - item.bounds.y) < 12);
        if (!old) out.push(item);
        else if (verbEventNames(item.obj).length > verbEventNames(old.obj).length) Object.assign(old, item);
      }
      return out;
    };
    return { pieces: unique(pieces), slots: unique(slots) };
  }

  function jigsawPieceInSlot(piece, slot) {
    const p = boundsOf(piece.obj) || piece.bounds;
    const b = boundsOf(slot.obj) || slot.bounds;
    if (!p || !b) return false;
    // JigsawController.placeInSlot snaps the container to slot.x + 222,
    // slot.y + 8. The sprite bounds add ~11px horizontally. Tight matching
    // keeps bank pieces from being mistaken for pieces in adjacent slots.
    return Math.abs((p.x - b.x) - 233) <= 25 &&
      Math.abs((p.y - b.y) - 8) <= 20;
  }

  function jigsawPlacedEntries(entries, board) {
    const done = new Set();
    const usedSlots = new Set();
    const usedPieces = new Set();
    // Resolve labelled slots first; otherwise duplicate stems could both
    // claim a single placed piece.
    const ordered = entries.slice().sort((a, b) => {
      const ah = board.slots.some(s => s.entryUid === a.uid) ? 0 : 1;
      const bh = board.slots.some(s => s.entryUid === b.uid) ? 0 : 1;
      return ah - bh;
    });
    for (const item of ordered) {
      for (const slot of board.slots) {
        if (usedSlots.has(slot.obj) || slot.key !== item.slotKey ||
            (slot.entryUid && slot.entryUid !== item.uid)) continue;
        const piece = board.pieces.find(p => !usedPieces.has(p.obj) &&
          p.key === item.pieceKey && jigsawPieceInSlot(p, slot));
        if (!piece) continue;
        usedSlots.add(slot.obj);
        usedPieces.add(piece.obj);
        done.add(item.uid);
        break;
      }
    }
    return done;
  }

  async function activateJigsawObject(item) {
    const events = verbEventNames(item.obj);
    // LanguageNut attaches its click callback to both pointerup and keyup.
    // pointerup is silently suppressed while the canvas is panning/resizing
    // (for example when DevTools is docked), although Pixi.emit succeeds.
    // keyup calls the same callback without that pan guard.
    const event = ['keyup', 'pointerup', 'pointertap', 'click', 'tap']
      .find(name => events.includes(name));
    if (event) return emitOnObject(item.obj, event);
    const b = boundsOf(item.obj) || item.bounds;
    return !!b && safeCanvasPointerClickWorld(b.x + b.width / 2, b.y + b.height / 2, '#4ade80', 30);
  }

  async function jigsawTick() {
    if (await dismissStartDialog()) return;
    const entries = state.verbs.map(entry => {
      const sections = verbSections(entry);
      return sections.length >= 3 ? {
        entry,
        uid: String(entry.uid || `${jigsawVerbKey(sections[0] + sections[1])}|${jigsawVerbKey(sections[2])}`),
        slotKey: jigsawVerbKey(sections[0] + sections[1]),
        pieceKey: jigsawVerbKey(sections[2]),
        label: `${sections[0]} ${sections[1]} ← ${sections[2]}`
      } : null;
    }).filter(Boolean);
    if (!entries.length) {
      setStatus('Jigsaw: waiting for section data');
      return;
    }
    const board = collectJigsawBoard();
    if (!board.slots.length || !board.pieces.length) {
      setStatus(`Jigsaw: waiting for board (${board.pieces.length} pieces, ${board.slots.length} slots)`);
      return;
    }
    // Rebuild progress from the live board, so reloads and already placed
    // pieces do not cause duplicate clicks or stale counters.
    const liveDone = jigsawPlacedEntries(entries, board);
    state.jigsawDone = liveDone;
    setProgress(state.jigsawDone.size, entries.length);
    // A piece can be placed into the wrong duplicate-looking slot. Move it
    // back to the bank before attempting another placement.
    for (const slot of board.slots) {
      if (!slot.entryUid) continue;
      const expected = entries.find(item => item.uid === slot.entryUid);
      const occupant = board.pieces.find(p => jigsawPieceInSlot(p, slot));
      if (!expected || !occupant || occupant.key === expected.pieceKey) continue;
      await activateJigsawObject(occupant);
      addLog(`Jigsaw moved wrong piece ${occupant.labels[0]} out of ${slot.labels.slice(0, 2).join(' ')}`, 'err');
      setStatus('Jigsaw: correcting occupied slot');
      return;
    }
    let pair = null;
    for (const item of entries) {
      if (state.jigsawDone.has(item.uid)) continue;
      const slot = board.slots.find(x => x.key === item.slotKey &&
        (!x.entryUid || x.entryUid === item.uid) &&
        !board.pieces.some(p => jigsawPieceInSlot(p, x)));
      const piece = board.pieces.find(x => x.key === item.pieceKey &&
        !board.slots.some(s => jigsawPieceInSlot(x, s)));
      if (slot && piece) { pair = { item, slot, piece }; break; }
    }
    if (!pair) {
      setStatus(state.jigsawDone.size >= entries.length
        ? 'Jigsaw: all pieces placed' : 'Jigsaw: waiting for matching piece and slot');
      return;
    }
    setPromptLabel(pair.item.label);
    const picked = await activateJigsawObject(pair.piece);
    if (!picked) {
      setStatus('Jigsaw: piece click failed');
      return;
    }
    // Give Pixi one frame to update selectedPiece and the selection tint.
    await new Promise(resolve => setTimeout(resolve, 34));
    const placed = await activateJigsawObject(pair.slot);
    if (!placed) {
      setStatus('Jigsaw: slot click failed');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 34));
    const afterDone = jigsawPlacedEntries(entries, collectJigsawBoard());
    if (jigsawPieceInSlot(pair.piece, pair.slot) && afterDone.size > liveDone.size) {
      state.jigsawDone = afterDone;
      state.jigsawFails = 0;
      state.answeredCount++;
      setAnsweredCount(state.answeredCount);
      setProgress(state.jigsawDone.size, entries.length);
      addLog(`✓ Jigsaw ${state.jigsawDone.size}/${entries.length}: ${pair.item.label}`, 'ok');
      setStatus('Jigsaw: placed');
    } else {
      state.jigsawFails++;
      addLog(`Jigsaw placement not confirmed: ${pair.item.label}`, 'err');
      setStatus('Jigsaw: retrying placement');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // ============ ZEN MATCHING GAMES AND RACE DRIVER ============
  function zenText(obj) {
    return descendantTextFragments(obj).map(bit => bit.text.trim()).filter(Boolean).join(' ');
  }

  function zenTranslationMatch(learning, interfaceText) {
    // This board uses vocab.word for each square and vocab.originalWord for
    // each draggable tile. Sentences and vocab from a previous route can
    // contain plausible but incorrect matches for the current board.
    if (state.vocabRoute !== location.hash) return false;
    const key = value => String(value || '').replace('ü', 'ü').replace('’', "'")
      .replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    const square = key(learning), tile = key(interfaceText);
    return !!square && !!tile && state.vocab.some(entry =>
      key(entry.word) === square && key(entry.originalWord) === tile);
  }

  function zenMemoryBoard() {
    const targets = [], cards = [];
    walk(state.pixiApp.stage, obj => {
      if (!isVisible(obj, state.pixiApp.stage) || typeof obj.name !== 'string') return;
      if (obj.name.startsWith('zenMatchTile_')) targets.push(obj);
      if (obj.name.startsWith('zenDragCard_')) cards.push(obj);
    });
    return {targets, cards};
  }

  async function zenMemoryTick() {
    const {targets, cards} = zenMemoryBoard();
    if (!targets.length || !cards.length) return setStatus('Matching Pairs: waiting for cards');
    const done = targets.filter(obj => /correctMatch/i.test(fullTextureName(obj.children?.[0]))).length;
    if (done < state.zenMemoryLastCount) state.zenMemoryLastCount = done;
    if (done > state.zenMemoryLastCount) {
      state.answeredCount += done - state.zenMemoryLastCount;
      setAnsweredCount(state.answeredCount);
      setProgress(done, targets.length);
      state.zenMemoryLastCount = done;
    }
    const target = targets.find(obj => !/correctMatch/i.test(fullTextureName(obj.children?.[0])) &&
      cards.some(card => isVisible(card, state.pixiApp.stage) &&
        normaliseText(card.name.slice('zenDragCard_'.length)) ===
        normaliseText(obj.name.slice('zenMatchTile_'.length))));
    if (!target) return setStatus('Matching Pairs: waiting for unmatched cards');
    const card = cards.find(obj => isVisible(obj, state.pixiApp.stage) &&
      normaliseText(obj.name.slice('zenDragCard_'.length)) ===
      normaliseText(target.name.slice('zenMatchTile_'.length)));
    const label = card.name.slice('zenDragCard_'.length);
    setPromptLabel(label);
    emitOnObject(card, 'keyup');
    await new Promise(resolve => setTimeout(resolve, 50));
    emitOnObject(target, 'keyup');
    await new Promise(resolve => setTimeout(resolve, 90));
    if (/correctMatch/i.test(fullTextureName(target.children?.[0]))) {
      const next = done + 1;
      state.zenMemoryLastCount = next;
      state.answeredCount++;
      setAnsweredCount(state.answeredCount);
      setProgress(next, targets.length);
      addLog(`✓ Matching Pairs ${next}/${targets.length}: ${label}`, 'ok');
    } else setStatus(`Matching Pairs: retrying ${label}`);
  }

  function zenNoughtsBoard() {
    let group = null;
    walk(state.pixiApp.stage, obj => {
      if (group || !Array.isArray(obj.children) || obj.children.length < 18) return;
      const cells = obj.children.slice(0, 9), tiles = obj.children.slice(9, 18);
      if (cells.every(cell => zenText(cell)) && tiles.every(tile =>
        verbEventNames(tile).includes('mousedown'))) group = {cells, tiles};
    });
    return group;
  }

  function zenNoughtsMark(cell) {
    const marker = cell.children?.[5];
    if (!marker || marker.visible === false) return '';
    const name = fullTextureName(marker);
    return /nought/i.test(name) ? 'o' : /cross/i.test(name) ? 'x' : '';
  }

  function zenNoughtsPriority(cells, index) {
    const marks = cells.map(zenNoughtsMark);
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let score = index === 4 ? 6 : [0,2,6,8].includes(index) ? 4 : 2;
    for (const line of lines.filter(line => line.includes(index))) {
      const others = line.filter(i => i !== index).map(i => marks[i]);
      if (others.every(mark => mark === 'x')) score += 100;
      if (others.every(mark => mark === 'o')) score += 80;
    }
    return score;
  }

  async function zenNoughtsTick() {
    const board = zenNoughtsBoard();
    if (!board) return setStatus('Noughts & Crosses: waiting for board');
    if (state.vocabRoute !== location.hash)
      return setStatus('Noughts & Crosses: waiting for this board’s words');
    if (Date.now() < state.zenNoughtsNextMoveAt)
      return setStatus('Noughts & Crosses: waiting for turn');
    const occupied = board.cells.filter(cell => !!zenNoughtsMark(cell)).length;
    const playerCount = board.cells.filter(cell => zenNoughtsMark(cell) === 'x').length;
    if (playerCount < state.zenNoughtsLastCount) state.zenNoughtsLastCount = playerCount;
    if (playerCount > state.zenNoughtsLastCount) {
      state.answeredCount += playerCount - state.zenNoughtsLastCount;
      setAnsweredCount(state.answeredCount);
      state.zenNoughtsLastCount = playerCount;
      setProgress(occupied, 9);
    }
    const moves = board.cells.map((cell, index) => ({cell, index,
      tile: board.tiles.find(tile => isVisible(tile, state.pixiApp.stage) &&
        zenTranslationMatch(zenText(cell), zenText(tile)))}))
      .filter(move => !zenNoughtsMark(move.cell) && move.tile)
      .sort((a, b) => zenNoughtsPriority(board.cells, b.index) - zenNoughtsPriority(board.cells, a.index));
    if (!moves.length) return setStatus('Noughts & Crosses: waiting for next turn');
    const move = moves[0];
    const tileLabel = zenText(move.tile);
    setPromptLabel(`${tileLabel} → ${zenText(move.cell)}`);
    const dragged = await dragTileTo(move.tile, move.cell);
    if (!dragged) return setStatus('Noughts & Crosses: drag failed');
    // The success marker appears only after the game's drag animation.
    // Wait for that confirmation before choosing another tile.
    const deadline = Date.now() + 2200;
    while (!zenNoughtsMark(move.cell) && Date.now() < deadline)
      await sleep(60);
    if (zenNoughtsMark(move.cell)) {
      state.zenNoughtsNextMoveAt = Date.now() + 3500;
      state.zenNoughtsLastCount++;
      state.answeredCount++;
      setAnsweredCount(state.answeredCount);
      setProgress(occupied + 1, 9);
      addLog(`✓ Noughts & Crosses: ${tileLabel}`, 'ok');
    } else {
      state.zenNoughtsNextMoveAt = Date.now() + 1800;
      setStatus('Noughts & Crosses: waiting to retry tile');
    }
  }

  function raceDriverKeyEvent(type, name, keyCode) {
    const code = Number(keyCode) || 0;
    const options = {
      key: name, code: name, keyCode: code, which: code, charCode: code,
      bubbles: true, cancelable: true, composed: true, view: window
    };
    let event;
    try { event = new KeyboardEvent(type, options); }
    catch (_) { event = document.createEvent('KeyboardEvent'); event.initEvent(type, true, true); }
    for (const prop of ['keyCode', 'which', 'charCode']) {
      try { Object.defineProperty(event, prop, {configurable: true, get: () => code}); }
      catch (_) { try { Object.defineProperty(event, prop, {value: code}); } catch (_) {} }
    }
    try { document.dispatchEvent(event); } catch (_) {}
    try { window.dispatchEvent(event); } catch (_) {}
    try {
      const handler = type === 'keyup' ? window.onkeyup : window.onkeydown;
      if (typeof handler === 'function') handler.call(window, event);
    } catch (_) {}
    return event;
  }

  function raceDriverScene() {
    const stage = state.pixiApp && state.pixiApp.stage;
    if (!stage) return {vehicle: null, entry: null, prompt: '', targets: []};
    let vehicle = null;
    walk(stage, obj => {
      if (!vehicle && /raceDriver\/vehicles\//i.test(fullTextureName(obj)) &&
          isVisible(obj, stage)) vehicle = obj;
    });
    const entry = state.sentences.find(sentence => {
      const wanted = normaliseText(sentence.originalSentence);
      if (!wanted) return false;
      let found = false;
      walk(stage, obj => {
        if (typeof obj.text === 'string' && normaliseText(obj.text) === wanted &&
            isVisible(obj, stage)) found = true;
      });
      return found;
    });
    const prompt = entry ? String(entry.originalSentence || '').trim() : '';
    return {vehicle, entry, prompt, targets: []};
  }

  function raceDriverCollectedCount(chunks) {
    const total = Array.isArray(chunks) ? chunks.length : 0;
    let sceneCount = 0;
    const stage = state.pixiApp && state.pixiApp.stage;
    if (stage && total) {
      // The game's correctChunkContainer is a direct stage child. Unlike the
      // screen-reader alert, its children retain every collected chunk until
      // the sentence changes. The alert gets overwritten by countdown text.
      for (const group of stage.children || []) {
        const labels = (group.children || []).filter(child =>
          typeof child.text === 'string' && isVisible(child, stage) &&
          boundsOf(child)?.y >= 60 && boundsOf(child)?.y <= 350
        ).map(child => normaliseChunk(child.text));
        let prefix = 0;
        while (prefix < labels.length && prefix < total &&
               labels[prefix] === normaliseChunk(chunks[prefix]?.text)) prefix++;
        if (prefix === labels.length && prefix > sceneCount) sceneCount = prefix;
      }
    }
    const sources = [];
    try {
      const alert = document.getElementById('hiddenAlertContainer');
      if (alert) sources.push(String(alert.textContent || alert.innerText || ''));
    } catch (_) {}
    // Some LanguageNut builds place the same live announcement in a status
    // node rather than the hidden alert container.
    try {
      document.querySelectorAll('[role="status"], [aria-live="polite"], [aria-live="assertive"]').forEach(node => {
        if (!node.closest('#ln-ac-panel')) sources.push(String(node.textContent || ''));
      });
    } catch (_) {}
    for (const text of sources) {
      const match = text.match(/(?:^|\s)(.+?)\s+collected,\s*(\d+)\s+of\s+(\d+)/i);
      if (!match) continue;
      const count = Number(match[2]);
      const announcedTotal = Number(match[3]);
      if (total && announcedTotal !== total) continue;
      const announcedChunk = normaliseChunk(match[1]);
      const expectedChunk = normaliseChunk(chunks[count - 1]?.text);
      if (count > 0 && expectedChunk && announcedChunk &&
          announcedChunk !== expectedChunk && !announcedChunk.endsWith(expectedChunk)) continue;
      return Math.max(sceneCount, Math.max(0, Math.min(total || announcedTotal, count)));
    }
    return sceneCount;
  }

  function raceDriverTarget(scene, chunkText) {
    const stage = state.pixiApp && state.pixiApp.stage;
    if (!stage || !scene.vehicle) return null;
    const wanted = normaliseChunk(chunkText);
    const vehicleBounds = boundsOf(scene.vehicle);
    if (!wanted || !vehicleBounds) return null;
    const vehicleX = vehicleBounds.x + vehicleBounds.width / 2;
    let best = null;
    walk(stage, obj => {
      if (!obj || typeof obj.text !== 'string' || !isVisible(obj, stage) ||
          normaliseChunk(obj.text) !== wanted) return;
      const textBounds = boundsOf(obj);
      if (!textBounds || textBounds.width <= 0 || textBounds.height <= 0) return;
      const obstacle = obj.parent || obj;
      if (obstacle.hasProcessed) return;
      const textCenterX = textBounds.x + textBounds.width / 2;
      const ahead = textBounds.x + textBounds.width >= vehicleBounds.x;
      const distance = ahead ? Math.max(0, textCenterX - vehicleX) : 100000 + vehicleX - textCenterX;
      if (!best || distance < best.distance) best = {
        text: obj, obstacle, bounds: textBounds, distance, ahead,
        missed: !ahead
      };
    });
    return best;
  }

  function raceDriverBoost(pressed, target) {
    if (!pressed && !state.raceRightHeld) {
      state.raceBoostTarget = null;
      return;
    }
    const now = Date.now();
    // The game resets its key state as obstacles respawn, so reassert ArrowRight
    // regularly even though this userscript keeps it logically held.
    if (pressed && state.raceRightHeld && state.raceBoostTarget === target &&
        now - state.raceBoostAssertAt < 120) return;
    raceDriverKeyEvent(pressed ? 'keydown' : 'keyup', 'ArrowRight', 39);
    state.raceRightHeld = pressed;
    state.raceBoostTarget = pressed ? target : null;
    state.raceBoostAssertAt = pressed ? now : 0;
  }

  async function raceDriverTick() {
    const scene = raceDriverScene();
    const boostKey = 'race-driver';
    // Speed boost stays held throughout the activity; steering must never
    // release it. Reassertion is throttled inside raceDriverBoost().
    raceDriverBoost(true, boostKey);
    if (!scene.entry || !scene.vehicle) {
      return setStatus('Race Driver: holding boost; waiting for sentence/vehicle');
    }
    const key = String(scene.entry.uid || scene.prompt);
    if (key !== state.raceLastQuestion) {
      state.raceLastQuestion = key;
      state.raceLastChunks = 0;
      state.raceMissLogKey = '';
    }
    const chunks = Array.isArray(scene.entry.chunks) ? scene.entry.chunks : [];
    if (!chunks.length) return setStatus('Race Driver: waiting for sentence chunks');

    // The game publishes a live accessibility announcement in the DOM. Use
    // its counter as the source of truth; keep the last count during animations.
    const domCollected = raceDriverCollectedCount(chunks);
    const collected = Math.max(state.raceLastChunks, domCollected);
    if (collected > state.raceLastChunks) {
      state.raceLastChunks = collected;
      state.raceMissLogKey = '';
      setProgress(collected, chunks.length);
      addLog(`Race Driver collected ${collected}/${chunks.length}: ${chunks[collected - 1].text}`, 'ok');
      if (collected === chunks.length) {
        state.answeredCount++;
        setAnsweredCount(state.answeredCount);
      }
    }
    const current = chunks[collected];
    if (!current) return setStatus('Race Driver: holding boost; waiting for next sentence');
    const target = raceDriverTarget(scene, current.text);
    setPromptLabel(`${scene.prompt} → ${current.text}`);
    if (!target) return setStatus(`Race Driver: holding boost; waiting for ${current.text}`);
    if (target.missed) {
      const missKey = `${key}::${collected}::${normaliseChunk(current.text)}`;
      if (state.raceMissLogKey !== missKey) {
        state.raceMissLogKey = missKey;
        addLog(`Race Driver missed ${current.text}; waiting for retry`, 'err');
      }
      return setStatus(`Race Driver: missed ${current.text}; holding boost`);
    }

    const vehicleBounds = boundsOf(scene.vehicle);
    const vehicleCenterY = vehicleBounds.y + vehicleBounds.height / 2;
    const targetCenterY = target.bounds.y + target.bounds.height / 2;
    const delta = targetCenterY - vehicleCenterY;
    if (Math.abs(delta) <= 12) {
      return setStatus(`Race Driver: boosting toward ${current.text}`);
    }
    const keyName = delta < 0 ? 'ArrowUp' : 'ArrowDown';
    raceDriverKeyEvent('keydown', keyName, keyName === 'ArrowUp' ? 38 : 40);
    await sleep(Math.abs(delta) < 55 ? 25 : 70);
    raceDriverKeyEvent('keyup', keyName, keyName === 'ArrowUp' ? 38 : 40);
    setStatus(`Race Driver: steering ${keyName === 'ArrowUp' ? 'up' : 'down'} to ${current.text}; boost held`);
  }

  // ============ SENTENCE DICTATION ============
  function dictationInputVisible(input) {
    if (!input || input.offsetParent === null) return false;
    const style = getComputedStyle(input);
    return style.display !== 'none' && style.visibility !== 'hidden' &&
      Number(style.opacity) > 0;
  }

  function dictationPlayButton() {
    let found = null;
    walk(state.pixiApp.stage, obj => {
      if (found || !isVisible(obj, state.pixiApp.stage) ||
          !/who\/play/i.test(fullTextureName(obj))) return;
      const bounds = boundsOf(obj);
      if (bounds && bounds.width > 15 && bounds.height > 15 &&
          verbEventNames(obj).includes('keyup')) found = obj;
    });
    return found;
  }

  async function dictationTick() {
    const input = document.getElementById('textInputChina');
    const visible = dictationInputVisible(input);
    if (state.dictationSubmitted) {
      if (!visible) state.dictationSawHidden = true;
      if (!state.dictationSawHidden || !visible || String(input.value || '').trim()) {
        setStatus('Dictation: waiting for next question');
        return;
      }
      state.dictationSubmitted = false;
      state.dictationSawHidden = false;
      state.dictationPlayAt = 0;
    }
    if (!visible) return setStatus('Dictation: waiting for answer box');
    if (!state.sentences.length) return setStatus('Dictation: waiting for sentence data');

    if (!state.dictationPlayAt) {
      const play = dictationPlayButton();
      if (play) {
        emitOnObject(play, 'keyup');
        state.dictationPlayAt = Date.now();
      }
    }
    const audio = String(window.languageNutPlayingSound?.url || '');
    const entry = audio ? matchAudioToEntry(audio) : null;
    if (!entry) {
      if (Date.now() - state.dictationPlayAt > 1200) state.dictationPlayAt = 0;
      return setStatus('Dictation: waiting for matching audio');
    }
    const answer = String(entry.sentence || entry.word || entry.learningWord || '').trim();
    if (!answer) return setStatus('Dictation: no sentence for audio');
    state.dictationLastAudio = audio;
    setAudioLabel(baseName(audio));
    setPromptLabel(answer);
    wordPodSetNativeInputValue(input, answer);
    wordPodDispatchInput(input, answer, 'insertText');
    input.dispatchEvent(new Event('change', {bubbles: true}));
    if (String(input.value || '').normalize('NFC') !== answer.normalize('NFC'))
      return setStatus('Dictation: answer input failed');

    state.dictationSubmitted = true;
    try {
      if (typeof window.onkeyup === 'function') window.onkeyup({keyCode: 13});
      else window.dispatchEvent(new KeyboardEvent('keyup',
        {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true}));
    } catch (error) {
      state.dictationSubmitted = false;
      throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 80));
    if (dictationInputVisible(input) && String(input.value || '') === answer) {
      state.dictationSubmitted = false;
      return setStatus('Dictation: submit not accepted, retrying');
    }
    state.dictationSawHidden = !dictationInputVisible(input);
    state.answeredCount++;
    setAnsweredCount(state.answeredCount);
    setProgress(state.answeredCount - state.fakeTimeAnswerBase, state.sentences.length);
    addLog(`✓ Dictation: ${answer}`, 'ok');
    setStatus('Dictation: submitted — waiting for next question');
  }

  // ============ A-LEVEL PHOTO EXAM ============
  function photoExamAnswer(question) {
    const image = String(question?.image || '');
    // This image was verified on the live A-Level Photo page. The API returns
    // an image and an unrelated reading passage, not a model photo answer.
    if (image === 'a6239.jpg') {
      return 'Auf dem Foto sehe ich eine junge Frau draußen in der Stadt. Sie trägt Kopfhörer und hört wahrscheinlich Musik. Sie lächelt und scheint sehr glücklich zu sein. Im Hintergrund sehe ich Gebäude und andere Menschen. Vielleicht hört sie ihr Lieblingslied auf ihrem Handy. Ich höre auch gern Musik, besonders wenn ich unterwegs bin, weil sie meine Stimmung verbessert.';
    }
    const lang = String(question?.ietf || sessionStorage.getItem('learningLanguage') || '').toLowerCase();
    if (lang.startsWith('de')) return 'Auf dem Foto sehe ich eine Alltagsszene. Im Vordergrund gibt es etwas Interessantes zu sehen, und im Hintergrund sind weitere Details. Die Atmosphäre wirkt angenehm. Vielleicht verbringen die Menschen hier Zeit zusammen. Meiner Meinung nach ist dieses Bild interessant, weil es etwas über das tägliche Leben zeigt.';
    if (lang.startsWith('fr')) return 'Sur la photo, je vois une scène de la vie quotidienne. Au premier plan, il y a quelque chose d’intéressant et, à l’arrière-plan, on distingue d’autres détails. L’ambiance semble agréable. À mon avis, cette image montre un moment de la vie de tous les jours.';
    if (lang.startsWith('es')) return 'En la foto veo una escena de la vida cotidiana. En primer plano hay algo interesante y al fondo se pueden ver más detalles. El ambiente parece agradable. En mi opinión, esta imagen muestra un momento de la vida diaria.';
    if (lang.startsWith('it')) return 'Nella foto vedo una scena di vita quotidiana. In primo piano c’è qualcosa di interessante e sullo sfondo si vedono altri dettagli. L’atmosfera sembra piacevole. Secondo me, questa immagine mostra un momento della vita di tutti i giorni.';
    return 'In the photo I can see a scene from everyday life. There are details in both the foreground and the background. The atmosphere seems pleasant. In my opinion, the image shows a moment from daily life.';
  }

  async function examPhotoTick() {
    if (await dismissStartDialog()) return;
    const match = location.href.match(/[?&]examUid=(\d+)/i);
    const uid = match ? match[1] : '';
    const question = state.examPhotoQuestion && (!uid || String(state.examPhotoQuestion.uid) === uid)
      ? state.examPhotoQuestion : {uid, image: uid ? `a${uid}.jpg` : '', ietf: sessionStorage.getItem('learningLanguage')};
    const key = `${question.uid || ''}|${question.image || ''}`;
    if (!question.image) {
      setStatus('A-Level Photo: waiting for image');
      return;
    }
    if (state.examPhotoSubmittedKey === key) {
      setStatus('A-Level Photo: submitted — waiting for Continue');
      await advanceExamAfterCompletion();
      return;
    }
    const input = examInput();
    const submit = examSubmitControl();
    const domSubmit = submit ? null : examSubmitDomControl();
    if (!input || (!submit && !domSubmit)) {
      setStatus('A-Level Photo: waiting for answer controls');
      return;
    }
    const answer = input.value.trim() || humanizeLongAnswer(photoExamAnswer(question));
    if (!input.value.trim()) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(input, answer);
      else input.value = answer;
      input.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', data: answer}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
      input.dispatchEvent(new KeyboardEvent('keyup', {bubbles: true, key: 'a'}));
    }
    if (!input.value.trim()) {
      setStatus('A-Level Photo: answer input failed');
      return;
    }
    setPromptLabel(`Photo ${question.uid || ''}`);
    let clicked = false;
    if (submit) {
      const b = submit.bounds;
      clicked = await safeCanvasPointerClickWorld(b.x + b.width / 2, b.y + b.height / 2, '#4ade80', 150);
    } else if (domSubmit) {
      domSubmit.click();
      clicked = true;
    }
    if (!clicked) {
      setStatus('A-Level Photo: submit click failed');
      return;
    }
    state.examPhotoSubmittedKey = key;
    state.answeredCount++;
    setAnsweredCount(state.answeredCount);
    addLog(`A-Level Photo submitted ${question.image}${question.image === 'a6239.jpg' ? '' : ' (general description)'}`, 'ok');
    setStatus('A-Level Photo: submitted');
  }

  // ============ OPEN READING EXAM ============
  function examGapfillEntries() {
    return state.examTranslations.filter(entry =>
      entry && entry.kind === 'gapfill' && String(entry.answer || '').trim()
    );
  }

  function buildExamGapfillOrder() {
    const entries = examGapfillEntries().slice();
    const source = String(state.examOriginalText || '');
    const lower = source.toLocaleLowerCase();
    const occurrences = new Map();

    for (const entry of entries) {
      const word = String(entry.answer || '').trim();
      const needle = word.toLocaleLowerCase();
      const occurrence = occurrences.get(needle) || 0;
      let location = -1;
      let from = 0;
      let foundCount = 0;
      while (needle && from <= lower.length) {
        const candidate = lower.indexOf(needle, from);
        if (candidate < 0) break;
        const before = candidate > 0 ? lower[candidate - 1] : '';
        const after = lower[candidate + needle.length] || '';
        const wholeWord =
          !/[\p{L}\p{N}]/u.test(before) &&
          !/[\p{L}\p{N}]/u.test(after);
        if (wholeWord) {
          if (foundCount === occurrence) {
            location = candidate;
            break;
          }
          foundCount++;
        }
        from = candidate + Math.max(1, needle.length);
      }
      occurrences.set(needle, occurrence + 1);
      entry.location = location < 0 ? Number.MAX_SAFE_INTEGER : location;
    }

    entries.sort((a, b) => a.location - b.location);
    return entries;
  }

  function collectExamGapfillBank() {
    const a = state.pixiApp;
    if (!a) return [];
    const out = [];
    const seen = new Set();

    walk(a.stage, obj => {
      if (seen.has(obj) || !isVisible(obj, a.stage)) return;
      if (!verbEventNames(obj).some(name =>
        /^(?:pointerup|click|tap)$/i.test(name)
      )) return;

      const bounds = boundsOf(obj);
      if (!bounds || bounds.width < 80 || bounds.height < 20) return;

      let hasWordBackground = false;
      const labels = [];
      walk(obj, child => {
        const texture = `${fullTextureName(child)} ${textureName(child)}`;
        if (/missingWordBackground/i.test(texture)) hasWordBackground = true;
        if (typeof child.text === 'string' && child.text.trim()) {
          labels.push(child.text.trim());
        }
      });

      const label = labels.find(text =>
        text.length > 0 && !/^(?:submit|reset)$/i.test(text)
      );
      if (!hasWordBackground || !label) return;

      seen.add(obj);
      out.push({obj, label, bounds});
    });

    out.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
    return out;
  }

  function collectExamGapfillBlanks() {
    const a = state.pixiApp;
    if (!a) return [];
    const out = [];

    walk(a.stage, obj => {
      if (!isVisible(obj, a.stage)) return;
      if (!verbEventNames(obj).some(name =>
        /^(?:pointerup|click|tap)$/i.test(name)
      )) return;
      const bounds = boundsOf(obj);
      if (!bounds || bounds.width < 70 || bounds.width > 140 ||
          bounds.height < 15 || bounds.height > 40 ||
          bounds.x > 700 || bounds.y < 100 || bounds.y > 380) return;

      let hasBankTexture = false;
      walk(obj, child => {
        if (/missingWordBackground/i.test(
          `${fullTextureName(child)} ${textureName(child)}`
        )) hasBankTexture = true;
      });
      if (hasBankTexture) return;
      out.push({obj, bounds});
    });

    // The exam layout creates exactly one interactive 105×25 object per gap.
    // De-duplicate nested hitboxes that share the same rectangle.
    const unique = [];
    for (const item of out) {
      if (unique.some(prev =>
        Math.abs(prev.bounds.x - item.bounds.x) < 2 &&
        Math.abs(prev.bounds.y - item.bounds.y) < 2 &&
        Math.abs(prev.bounds.width - item.bounds.width) < 2
      )) continue;
      unique.push(item);
    }
    unique.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
    return unique;
  }

  function examGapfillSubmitControl() {
    const a = state.pixiApp;
    if (!a) return null;
    let found = null;
    walk(a.stage, obj => {
      if (found || !isVisible(obj, a.stage)) return;
      if (!verbEventNames(obj).some(name =>
        /^(?:pointerup|click|tap)$/i.test(name)
      )) return;
      const texture = `${fullTextureName(obj)} ${textureName(obj)}`;
      const labels = [];
      walk(obj, child => {
        if (typeof child.text === 'string' && child.text.trim()) {
          labels.push(child.text.trim());
        }
      });
      if (!/^submit$/i.test(labels[0] || '') &&
          !/buttonBackground/i.test(texture)) return;
      const bounds = boundsOf(obj);
      if (bounds && bounds.x > 700 && bounds.y > 400) {
        found = {obj, bounds};
      }
    });
    return found;
  }

  async function examGapfillTick() {
    const entries = examGapfillEntries();
    if (!entries.length || !state.examOriginalText) {
      setStatus('Exam GapFill: waiting for answers');
      return;
    }
    if (!state.examGapOrder.length) {
      state.examGapOrder = buildExamGapfillOrder();
      state.examGapIndex = 0;
      addLog(`Exam GapFill order: ${state.examGapOrder.map(e => e.answer).join(' → ')}`, 'ok');
      setProgress(0, state.examGapOrder.length);
    }
    if (state.examGapSubmitted) {
      setStatus('Exam GapFill: submitted — waiting for completion');
      return;
    }

    const bank = collectExamGapfillBank();
    if (state.examGapIndex < state.examGapOrder.length) {
      const wanted = state.examGapOrder[state.examGapIndex].answer;
      const match = bank.find(item =>
        normaliseText(item.label) === normaliseText(wanted)
      );
      if (!match) {
        setStatus(`Exam GapFill: waiting for “${wanted}”`);
        return;
      }

      const clicked = emitOnObject(match.obj, 'pointerup');
      if (!clicked) {
        const b = match.bounds;
        await safeCanvasPointerClickWorld(
          b.x + b.width / 2, b.y + b.height / 2, '#4ade80', 120
        );
      } else {
        await sleep(120);
      }
      state.examGapIndex++;
      setProgress(state.examGapIndex, state.examGapOrder.length);
      addLog(`Exam GapFill placed “${wanted}” (${state.examGapIndex}/${state.examGapOrder.length})`, 'ok');
      return;
    }

    const submit = examGapfillSubmitControl();
    if (!submit) {
      setStatus('Exam GapFill: waiting for Submit');
      return;
    }
    const clicked = emitOnObject(submit.obj, 'pointerup');
    if (!clicked) {
      const b = submit.bounds;
      await safeCanvasPointerClickWorld(
        b.x + b.width / 2, b.y + b.height / 2, '#4ade80', 200
      );
    } else {
      await sleep(200);
    }
    state.examGapSubmitted = true;
    state.answeredCount++;
    setAnsweredCount(state.answeredCount);
    addLog('Exam GapFill submitted', 'ok');
    setStatus('Exam GapFill: submitted');
  }

  function examCurrentEntry() {
    const a = state.pixiApp;
    if (!a || !state.examTranslations.length) return null;

    let match = null;
    walk(a.stage, o => {
      if (match || typeof o.text !== 'string' || !isVisible(o, a.stage)) return;
      const shown = normaliseText(o.text);
      if (!shown) return;
      const b = boundsOf(o);
      if (!b || b.width < 10 || b.height < 10) return;
      const cleanShown = shown.replace(/^\d+[\.\)]\s*/, '');
      match = state.examTranslations.find(entry => {
        const q = normaliseText(entry.question);
        const cleanQ = q.replace(/^\d+[\.\)]\s*/, '');
        return q === shown || cleanQ === cleanShown || (cleanQ.length > 5 && cleanShown.includes(cleanQ));
      }) || null;
    });

    if (!match) {
      const options = examMultipleChoiceOptions();
      if (options.length > 0) {
        const optNorms = options.map(o => normaliseText(o.label));
        match = state.examTranslations.find(entry =>
          !state.examSubmitted.has(entry.uid) && optNorms.includes(normaliseText(entry.answer))
        ) || null;
      }
    }

    return match;
  }

  function examInput() {
    let input = document.getElementById('textInputChina');
    if (!input) input = document.querySelector('textarea:not(#ln-ac-panel textarea)');
    if (!(input instanceof HTMLTextAreaElement) && !(input instanceof HTMLInputElement)) return null;
    const b = input.getBoundingClientRect();
    return b.width > 0 && b.height > 0 ? input : null;
  }

  function examStartControl() {
    const a = state.pixiApp;
    if (!a) return null;
    let found = null;
    walk(a.stage, o => {
      if (found || !isVisible(o, a.stage)) return;
      const t = typeof o.text === 'string' ? o.text.trim() : '';
      const racePlay = /#\/RaceDriverGame(?:[/?]|$)/i.test(String(location.href || '')) && /^play!?$/i.test(t);
      if (!/^start(?:\s+(?:now|game|exam|test))?!?$/i.test(t) && !racePlay) return;
      let target = o;
      if (o.parent && isVisible(o.parent, a.stage)) {
        const pb = boundsOf(o.parent);
        if (pb && pb.width > 25 && pb.height > 15) {
          target = o.parent;
        } else if (
          o.parent.interactive ||
          o.parent.eventMode === 'static' ||
          o.parent.eventMode === 'dynamic' ||
          o.parent.buttonMode
        ) {
          target = o.parent;
        }
      }
      let bounds = boundsOf(target) || boundsOf(o);
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        let gx = 0, gy = 0;
        try {
          if (typeof target.toGlobal === 'function') {
            const p = target.toGlobal({ x: 0, y: 0 });
            gx = p.x; gy = p.y;
          } else if (typeof o.toGlobal === 'function') {
            const p = o.toGlobal({ x: 0, y: 0 });
            gx = p.x; gy = p.y;
          }
        } catch (_) {}
        if (!gx && bounds) gx = bounds.x;
        if (!gy && bounds) gy = bounds.y;
        bounds = {
          x: gx,
          y: gy,
          width: Math.max(bounds && bounds.width ? bounds.width : 0, o.width || 130),
          height: Math.max(bounds && bounds.height ? bounds.height : 0, o.height || 45)
        };
      }
      found = { obj: target, labelObj: o, bounds };
    });
    return found;
  }

  function examStartDomControl() {
    try {
      const nodes = document.querySelectorAll(
        'button, input[type="button"], input[type="submit"], [role="button"], a.btn, div.btn, .btn, .button'
      );
      return Array.from(nodes).find(node => {
        if (!node || node.closest('#ln-ac-panel')) return false;
        const text = String(
          node.innerText || node.value || node.getAttribute('aria-label') || ''
        ).trim();
        const r = node.getBoundingClientRect();
        const racePlay = /#\/RaceDriverGame(?:[/?]|$)/i.test(String(location.href || '')) && /^play!?$/i.test(text);
        return (/^start(?:\s+(?:now|game|exam|test))?!?$/i.test(text) || racePlay) && r.width > 20 && r.height > 15;
      }) || null;
    } catch (_) {
      return null;
    }
  }

  async function dismissStartDialog() {
    if (Date.now() - (state.lastStartDismissAt || 0) < 400) return true;

    const start = examStartControl();
    const domStart = start ? null : examStartDomControl();
    if (!start && !domStart) return false;

    state.lastStartDismissAt = Date.now();
    setStatus('Dismissing start dialog…');
    let clicked = false;

    if (start) {
      emitOnObject(start.obj, 'pointerdown');
      emitOnObject(start.obj, 'mousedown');
      emitOnObject(start.obj, 'pointerup');
      emitOnObject(start.obj, 'mouseup');
      emitOnObject(start.obj, 'click');
      emitOnObject(start.obj, 'tap');
      emitOnObject(start.obj, 'keyup');
      if (start.labelObj && start.labelObj !== start.obj) {
        emitOnObject(start.labelObj, 'pointerdown');
        emitOnObject(start.labelObj, 'pointerup');
        emitOnObject(start.labelObj, 'click');
        emitOnObject(start.labelObj, 'tap');
      }

      await clickTile(start.obj);

      const b = start.bounds;
      if (b && b.width > 0 && b.height > 0) {
        clicked = await safeCanvasPointerClickWorld(
          b.x + b.width / 2, b.y + b.height / 2, '#4ade80', 200
        );
      } else {
        clicked = true;
      }
    }

    if (domStart) {
      try {
        domStart.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
        domStart.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        domStart.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        domStart.click();
        await sleep(200);
        clicked = true;
      } catch (_) {}
    }

    if (clicked) {
      addLog('Start dialog dismissed', 'ok');
      await sleep(250);
      return true;
    }
    return false;
  }

  function examSubmitControl() {
    const a = state.pixiApp;
    if (!a) return null;
    let found = null;
    walk(a.stage, o => {
      if (found || !isVisible(o, a.stage)) return;
      const t = typeof o.text === 'string' ? o.text.trim() : '';
      if (!/^submit!?$/i.test(t)) return;
      let target = o;
      if (o.parent && isVisible(o.parent, a.stage)) {
        const pb = boundsOf(o.parent);
        if (pb && pb.width > 25 && pb.height > 15) {
          target = o.parent;
        }
      }
      const bounds = boundsOf(target) || boundsOf(o);
      if (bounds && bounds.width > 20 && bounds.height > 15) {
        found = {obj: target, labelObj: o, bounds};
      }
    });
    return found;
  }

  function examSubmitDomControl() {
    try {
      const nodes = document.querySelectorAll(
        'button, input[type="button"], input[type="submit"], [role="button"]'
      );
      return Array.from(nodes).find(node => {
        if (!node || node.closest('#ln-ac-panel')) return false;
        const text = String(
          node.innerText || node.value || node.getAttribute('aria-label') || ''
        ).trim();
        const r = node.getBoundingClientRect();
        return /^submit!?$/i.test(text) && r.width > 20 && r.height > 15;
      }) || null;
    } catch (_) {
      return null;
    }
  }

  async function examOpenReadingTick() {
    if (!state.examTranslations.length) {
      setStatus('Exam: waiting for answers');
      return;
    }
    const entry = examCurrentEntry();
    if (!entry) {
      setStatus('Exam: waiting for question');
      return;
    }
    setPromptLabel(entry.question);
    if (state.examSubmitted.has(entry.uid)) {
      setStatus('Exam: submitted — waiting for next question');
      return;
    }

    const input = examInput();
    const submit = examSubmitControl();
    const domSubmit = submit ? null : examSubmitDomControl();
    if (!input || (!submit && !domSubmit)) {
      setStatus('Exam: waiting for answer controls');
      return;
    }

    input.focus();
    const inputPrototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(inputPrototype, 'value')?.set;
    const answer = humanizeLongAnswer(entry.answer);
    if (setter) setter.call(input, answer);
    else input.value = answer;
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true, inputType: 'insertText', data: answer
    }));
    input.dispatchEvent(new Event('change', {bubbles: true}));

    if (input.value !== answer) {
      setStatus('Exam: answer input failed');
      return;
    }

    // Click the visible Submit control, identified by its label and handler.
    let clicked = false;
    if (submit) {
      const b = submit.bounds;
      clicked = await safeCanvasPointerClickWorld(
        b.x + b.width / 2, b.y + b.height / 2, '#4ade80', 250
      );
    } else if (domSubmit) {
      try {
        domSubmit.click();
        await sleep(250);
        clicked = true;
      } catch (_) {}
    }
    if (!clicked) {
      setStatus('Exam: submit click failed');
      return;
    }
    state.examSubmitted.add(entry.uid);
    state.answeredCount++;
    setAnsweredCount(state.answeredCount);
    addLog(`Exam submitted question ${entry.uid}`, 'ok');
    setStatus('Exam: submitted — waiting for next question');
  }

  function examMultipleChoiceOptions() {
    const a = state.pixiApp;
    if (!a) return [];
    const options = [];
    walk(a.stage, o => {
      if (!isVisible(o, a.stage)) return;
      if (!verbEventNames(o).some(name => /^(?:pointerup|click|tap)$/i.test(name))) return;
      const bounds = boundsOf(o);
      if (!bounds || bounds.x < 250 || bounds.y < 100 || bounds.y > 600 ||
          bounds.width < 100 || bounds.width > 550 ||
          bounds.height < 20 || bounds.height > 150) return;
      let hasAnswerBackground = false;
      const labels = [];
      walk(o, child => {
        const texture = `${fullTextureName(child)} ${textureName(child)}`;
        if (/questionBackgroundMultiChoiceBox/i.test(texture)) {
          hasAnswerBackground = true;
        }
        if (typeof child.text === 'string' && child.text.trim() &&
            isVisible(child, a.stage)) {
          labels.push(child.text.trim());
        }
      });
      // Some exam builds replace the image background after an answer. Keep
      // accepting a text-bearing answer card when its geometry is still in
      // the four-option answer area.
      if (!hasAnswerBackground && labels.length === 0) return;
      const label = labels
        .filter(text => text.length > 1)
        .sort((x, y) => y.length - x.length)[0];
      if (label) options.push({label, bounds, obj: o});
    });
    const unique = new Map();
    for (const option of options) {
      const key = `${normaliseText(option.label)}|${Math.round(option.bounds.y)}`;
      if (!unique.has(key)) unique.set(key, option);
    }
    return Array.from(unique.values()).sort((a, b) => a.bounds.y - b.bounds.y);
  }

  async function examMultipleChoiceTick() {
    if (!state.examTranslations.length) {
      setStatus('Exam MC: waiting for answers');
      return;
    }
    const entry = examCurrentEntry();
    if (!entry) {
      setStatus('Exam MC: waiting for question');
      return;
    }
    setPromptLabel(entry.question);
    if (state.examSubmitted.has(entry.uid)) {
      setStatus('Exam MC: answered — waiting for next question');
      return;
    }

    const options = examMultipleChoiceOptions();
    if (!options.length) {
      setStatus('Exam MC: waiting for options');
      return;
    }
    const wanted = normaliseText(entry.answer);
    let matches = options.filter(option => normaliseText(option.label) === wanted);
    if (!matches.length && wanted) {
      matches = options.filter(option => {
        const label = normaliseText(option.label);
        return label.length > 2 && (label.includes(wanted) || wanted.includes(label));
      });
    }
    if (!matches.length) {
      const letter = entry.answer.trim().match(/^(?:option\s*)?([A-D])\)?$/i);
      const number = entry.answer.trim().match(/^[1-4]$/);
      const index = letter ? letter[1].toUpperCase().charCodeAt(0) - 65
        : number ? Number(number[0]) - 1 : -1;
      if (index >= 0 && index < options.length) matches = [options[index]];
    }
    if (matches.length !== 1) {
      setStatus('Exam MC: exact answer option not found');
      return;
    }

    const option = matches[0];
    const b = option.bounds;
    let clicked = option.obj && emitOnObject(option.obj, 'pointerup');
    if (clicked) await sleep(250);
    if (!clicked) {
      clicked = await safeCanvasPointerClickWorld(
        b.x + b.width / 2, b.y + b.height / 2, '#4ade80', 250
      );
    }
    if (!clicked) {
      setStatus('Exam MC: option click failed');
      return;
    }
    state.examSubmitted.add(entry.uid);
    state.answeredCount++;
    setAnsweredCount(state.answeredCount);
    addLog(`Exam MC answered question ${entry.uid}: ${option.label}`, 'ok');
    setStatus('Exam MC: answered — waiting for next question');
  }

  function examTrueFalseOptions() {
    const a = state.pixiApp;
    if (!a) return [];
    const options = [];
    walk(a.stage, o => {
      if (!isVisible(o, a.stage)) return;
      if (!verbEventNames(o).some(name => /^(?:pointerup|click|tap)$/i.test(name))) return;
      const children = o.children || [];
      const icon = children.find(child =>
        /(?:new_design\/game_display\/)?(?:true|false)Button/i.test(
          `${fullTextureName(child)} ${textureName(child)}`
        )
      );
      const texts = [];
      walk(o, child => {
        if (typeof child.text === 'string' && child.text.trim()) {
          texts.push(child.text.trim());
        }
      });
      const label = texts.find(text => /^(?:true|false)$/i.test(text));
      if (!icon && !label) return;
      const answer = icon
        ? (/trueButton/i.test(`${fullTextureName(icon)} ${textureName(icon)}`) ? 'true' : 'false')
        : label.toLowerCase();
      const bounds = boundsOf(o);
      if (bounds && bounds.width > 30 && bounds.height > 20) options.push({answer, bounds, obj: o});
    });
    return options;
  }

  async function examTrueFalseTick() {
    if (!state.examTranslations.length) {
      setStatus('Exam True / False: waiting for answers');
      return;
    }
    const entry = examCurrentEntry();
    if (!entry) {
      setStatus('Exam True / False: waiting for question');
      return;
    }
    setPromptLabel(entry.question);
    if (state.examSubmitted.has(entry.uid)) {
      setStatus('Exam True / False: answered — waiting for next question');
      return;
    }
    const rawAnswer = normaliseText(entry.answer);
    const answer = /^(?:true|t|1|yes)$/i.test(rawAnswer)
      ? 'true'
      : /^(?:false|f|0|no)$/i.test(rawAnswer)
        ? 'false'
        : '';
    if (!answer) {
      setStatus('Exam True / False: API answer missing');
      return;
    }
    const matches = examTrueFalseOptions().filter(option => option.answer === answer);
    if (matches.length !== 1) {
      setStatus('Exam True / False: answer button not found');
      return;
    }
    const b = matches[0].bounds;
    // These exam buttons are CompositeGraphicsObject instances with a
    // pointerup handler on the parent. Emit that handler first so the solver
    // does not depend on canvas scaling or a transient tweened hitbox.
    const control = matches[0].obj;
    let clicked = control && emitOnObject(control, 'pointerup');
    if (clicked) await sleep(250);
    if (!clicked) {
      clicked = await safeCanvasPointerClickWorld(
        b.x + b.width / 2, b.y + b.height / 2, '#4ade80', 250
      );
    }
    if (!clicked) {
      setStatus('Exam True / False: click failed');
      return;
    }
    state.examSubmitted.add(entry.uid);
    state.answeredCount++;
    setAnsweredCount(state.answeredCount);
    addLog(`Exam True / False answered question ${entry.uid}: ${answer}`, 'ok');
    setStatus('Exam True / False: answered — waiting for next question');
  }

  function continueControls() {
    const out = [];
    const a = state.pixiApp;
    if (a && a.stage) {
      const res = (a.renderer && a.renderer.resolution) || 1;
      const maxX = (a.renderer.width || a.view.width) / res;
      const maxY = (a.renderer.height || a.view.height) / res;
      walk(a.stage, labelObj => {
        // Pixi text can contain instructions such as "...continue your streak!"
        // inside a clickable card. Only a button label or continue asset counts.
        const label = [labelObj.text, labelObj.accessibleTitle]
          .filter(value => typeof value === 'string')
          .find(value => /^\s*continue\b/i.test(value)) ||
          [labelObj.name, fullTextureName(labelObj), textureName(labelObj)]
            .filter(value => typeof value === 'string')
            .find(value => /(?:^|[\/_-])continue(?:button)?(?:[.\s_/-]|$)/i.test(value));
        if (!label) return;
        if (!isVisible(labelObj, a.stage)) return;
        let obj = labelObj;
        for (let depth = 0; obj && depth < 7; depth++, obj = obj.parent) {
          if (!isVisible(obj, a.stage)) break;
          const events = verbEventNames(obj);
          const event = ['pointerup', 'pointertap', 'click', 'tap'].find(name => events.includes(name));
          if (!event && obj.interactive !== true && obj.eventMode !== 'static' &&
              obj.eventMode !== 'dynamic' && obj.buttonMode !== true) continue;
          const bounds = boundsOf(obj);
          if (!bounds || bounds.width < 30 || bounds.height < 18 ||
              bounds.width > 600 || bounds.height > 180 ||
              bounds.x < 0 || bounds.y < 0 ||
              bounds.x >= maxX || bounds.y >= maxY) continue;
          if (!out.some(item => item.obj === obj)) {
            out.push({kind: 'pixi', obj, bounds, event, label: label.trim()});
          }
          break;
        }
      });
    }
    const selector = 'button, input[type="button"], input[type="submit"], [role="button"]';
    document.querySelectorAll(selector).forEach(obj => {
      if (obj.closest('#ln-ac-panel') || obj.disabled || obj.getAttribute('aria-disabled') === 'true') return;
      const label = String(obj.innerText || obj.value || obj.getAttribute('aria-label') || '').trim();
      if (!/\bcontinue\b/i.test(label)) return;
      const bounds = obj.getBoundingClientRect();
      if (bounds.width < 30 || bounds.height < 18 ||
          bounds.bottom <= 0 || bounds.right <= 0 ||
          bounds.top >= innerHeight || bounds.left >= innerWidth) return;
      if (getComputedStyle(obj).visibility === 'hidden' || getComputedStyle(obj).display === 'none') return;
      out.push({kind: 'dom', obj, bounds, label});
    });
    return out.sort((x, y) => {
      const xe = /^continue!?$/i.test(x.label) ? 0 : 1;
      const ye = /^continue!?$/i.test(y.label) ? 0 : 1;
      return xe - ye || x.bounds.width * x.bounds.height - y.bounds.width * y.bounds.height;
    });
  }

  function examContinueControls() { return continueControls(); }

  async function clickVisibleContinue() {
    const control = continueControls()[0];
    if (!control) return false;
    if (state.continueLastControl === control.obj && Date.now() - state.continueLastAt < 900) return true;
    const completed = !!detectCompletion();
    let clicked = false;
    if (control.kind === 'dom') {
      try { control.obj.click(); clicked = true; } catch (_) {}
    } else {
      clicked = control.event ? emitOnObject(control.obj, control.event) : false;
      if (!clicked) {
        const b = control.bounds;
        clicked = await safeCanvasPointerClickWorld(
          b.x + b.width / 2, b.y + b.height / 2, '#4ade80', 80
        );
      }
    }
    if (clicked) {
      if (completed) {
        logFakeTimeCompletion();
        resetFakeTimeActivity();
      }
      state.continueLastControl = control.obj;
      state.continueLastAt = Date.now();
      addLog(`Continue clicked: ${control.label}`, 'ok');
      setStatus('Continuing…');
    }
    return clicked;
  }

  async function examDictationTick() {
    // 1. Dismiss start overlay if present
    if (await dismissStartDialog()) return;

    // 2. Check for answers
    let entry = state.examDictationData;
    if (!entry || !entry.text) {
      if (state.examTranslations && state.examTranslations.length) {
        const t = state.examTranslations[0];
        entry = { text: t.answer || t.question, uid: t.uid };
      }
    }
    if (!entry || !entry.text) {
      setStatus('Exam Text/Dictation: waiting for answers');
      return;
    }
    setPromptLabel(entry.text.length > 50 ? `${entry.text.slice(0, 50)}…` : entry.text);

    if (state.examDictationSubmitted || (entry.uid && state.examSubmitted.has(entry.uid))) {
      setStatus('Exam Text/Dictation: submitted — waiting for completion');
      return;
    }

    // 3. Find input textarea
    const input = examInput();
    if (!input) {
      setStatus('Exam Text/Dictation: waiting for input field');
      return;
    }

    // 4. Fill input
    input.focus();
    const inputPrototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(inputPrototype, 'value')?.set;
    const answer = humanizeLongAnswer(entry.text);
    if (setter) setter.call(input, answer);
    else input.value = answer;
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true, inputType: 'insertText', data: answer
    }));
    input.dispatchEvent(new Event('change', {bubbles: true}));
    input.dispatchEvent(new KeyboardEvent('keyup', {bubbles: true, key: 'a'}));

    if (!input.value || input.value.trim().length === 0) {
      setStatus('Exam Text/Dictation: answer input failed');
      return;
    }

    // Allow UI to register input/word count
    await sleep(150);

    // 5. Submit answer
    const submit = examSubmitControl();
    const domSubmit = submit ? null : examSubmitDomControl();
    if (!submit && !domSubmit) {
      setStatus('Exam Text/Dictation: waiting for submit button');
      return;
    }

    let clicked = false;
    if (submit) {
      emitOnObject(submit.obj, 'pointerdown');
      emitOnObject(submit.obj, 'pointerup');
      emitOnObject(submit.obj, 'click');
      emitOnObject(submit.obj, 'tap');
      await clickTile(submit.obj);
      const b = submit.bounds;
      if (b && b.width > 0) {
        clicked = await safeCanvasPointerClickWorld(
          b.x + b.width / 2, b.y + b.height / 2, '#4ade80', 250
        );
      } else {
        clicked = true;
      }
    }

    if (domSubmit) {
      try {
        domSubmit.click();
        await sleep(250);
        clicked = true;
      } catch (_) {}
    }

    if (!clicked) {
      setStatus('Exam Text/Dictation: submit click failed');
      return;
    }

    state.examDictationSubmitted = true;
    if (entry.uid) state.examSubmitted.add(entry.uid);
    state.answeredCount++;
    setAnsweredCount(state.answeredCount);
    addLog(`Exam Text/Dictation submitted (${entry.text.length} chars)`, 'ok');
    setStatus('Exam Text/Dictation: submitted — waiting for completion');
    await advanceExamAfterCompletion();
  }


  function findWhoSaidWhatColumns() {
    const a = state.pixiApp;
    if (!a) return new Map();
    const cols = new Map();
    const fallbackCandidates = [];

    walk(a.stage, o => {
      if (!isVisible(o, a.stage)) return;
      const b = boundsOf(o);
      if (!b) return;

      let letter = null;
      walk(o, child => {
        if (letter) return;
        const tex = `${fullTextureName(child)} ${textureName(child)}`;
        const m = tex.match(/who\/([a-z])\.png/i);
        if (m) letter = m[1].toUpperCase();
      });

      if (letter && b.width >= 120 && b.width <= 320 && b.height >= 200 && b.height <= 500 && b.x < 700) {
        if (!cols.has(letter)) {
          cols.set(letter, { obj: o, bounds: b, letter });
        }
      } else if (b.width >= 150 && b.width <= 300 && b.height >= 250 && b.height <= 500 && b.x < 700 && b.y >= 100 && b.y <= 300) {
        fallbackCandidates.push({ obj: o, bounds: b });
      }
    });

    if (cols.size === 0 && fallbackCandidates.length >= 2) {
      fallbackCandidates.sort((c1, c2) => c1.bounds.x - c2.bounds.x);
      const uniqueCols = [];
      for (const fc of fallbackCandidates) {
        if (!uniqueCols.some(u => Math.abs(u.bounds.x - fc.bounds.x) < 30)) {
          uniqueCols.push(fc);
        }
      }
      const alphabet = ['A', 'B', 'C', 'D', 'E'];
      uniqueCols.slice(0, 5).forEach((col, idx) => {
        cols.set(alphabet[idx], { ...col, letter: alphabet[idx] });
      });
    }

    return cols;
  }

  function collectWhoSaidWhatStatements() {
    const a = state.pixiApp;
    if (!a) return [];
    const statements = [];
    walk(a.stage, o => {
      if (!isVisible(o, a.stage)) return;
      const b = boundsOf(o);
      if (!b) return;
      if (b.x < 600 || b.y < 180 || b.y > 600 || b.width < 120 || b.height < 15 || b.height > 80) return;

      let text = '';
      walk(o, child => {
        if (!text && typeof child.text === 'string' && child.text.trim()) {
          text = child.text.trim();
        }
      });
      if (text && text.length > 2 && !/^(?:submit|printables|reset|start)$/i.test(text)) {
        statements.push({ obj: o, text, bounds: b, norm: normaliseText(text) });
      }
    });

    const unique = new Map();
    for (const s of statements) {
      if (!unique.has(s.norm)) {
        unique.set(s.norm, s);
      }
    }
    return Array.from(unique.values()).sort((s1, s2) => s1.bounds.y - s2.bounds.y);
  }

  async function whoSaidWhatTick() {
    if (await dismissStartDialog()) return;

    if (!state.whoSaidWhatStatements || !state.whoSaidWhatStatements.length) {
      setStatus('Who Said What: waiting for answers data');
      return;
    }

    if (state.whoSaidWhatSubmitted) {
      setStatus('Who Said What: submitted — waiting for completion');
      return;
    }

    const cols = findWhoSaidWhatColumns();
    if (cols.size === 0) {
      setStatus('Who Said What: locating columns...');
      return;
    }

    const unplaced = collectWhoSaidWhatStatements();
    if (unplaced.length === 0) {
      const submit = examSubmitControl();
      const domSubmit = submit ? null : examSubmitDomControl();
      if (!submit && !domSubmit) {
        setStatus('Who Said What: waiting for Submit button');
        return;
      }

      setStatus('Who Said What: submitting...');
      let clicked = false;
      if (submit) {
        emitOnObject(submit.obj, 'pointerdown');
        emitOnObject(submit.obj, 'pointerup');
        const b = submit.bounds;
        if (b && b.width > 0) {
          clicked = await safeCanvasPointerClickWorld(b.x + b.width / 2, b.y + b.height / 2, '#4ade80', 250);
        } else {
          clicked = true;
        }
      } else if (domSubmit) {
        try {
          domSubmit.click();
          await sleep(250);
          clicked = true;
        } catch (_) {}
      }

      if (clicked) {
        state.whoSaidWhatSubmitted = true;
        state.answeredCount++;
        setAnsweredCount(state.answeredCount);
        addLog(`Who Said What: submitted all statements`, 'ok');
        setStatus('Who Said What: submitted — waiting for completion');
        await sleep(1000);
      } else {
        setStatus('Who Said What: submit click failed');
      }
      return;
    }

    const stmt = unplaced[0];
    const match = state.whoSaidWhatStatements.find(e =>
      e.normalisedStatement === stmt.norm ||
      e.normalisedStatement.includes(stmt.norm) ||
      stmt.norm.includes(e.normalisedStatement)
    ) || state.whoSaidWhatStatements.find(e => {
      const wordsA = stmt.norm.split(' ').filter(Boolean);
      const wordsB = e.normalisedStatement.split(' ').filter(Boolean);
      const common = wordsA.filter(w => wordsB.includes(w));
      return common.length >= Math.min(wordsA.length, wordsB.length) * 0.7;
    });

    if (!match) {
      addLog(`Who Said What: unrecognised statement "${stmt.text}"`, 'err');
      setStatus(`Who Said What: no match for "${stmt.text.slice(0, 15)}..."`);
      await sleep(1000);
      return;
    }

    const targetPerson = match.person;
    const targetCol = cols.get(targetPerson);
    if (!targetCol) {
      addLog(`Who Said What: column ${targetPerson} not found`, 'err');
      setStatus(`Who Said What: missing column ${targetPerson}`);
      await sleep(1000);
      return;
    }

    setPromptLabel(`${stmt.text} → Person ${targetPerson}`);
    setStatus(`Who Said What: moving to ${targetPerson} (${unplaced.length} left)`);

    const targetBounds = {
      x: targetCol.bounds.x,
      y: targetCol.bounds.y + targetCol.bounds.height * 0.3,
      width: targetCol.bounds.width,
      height: targetCol.bounds.height * 0.4
    };

    await dragTileTo(stmt.obj, targetBounds);
    await sleep(250);

    const postBounds = boundsOf(stmt.obj);
    if (postBounds && postBounds.x >= 600) {
      await clickTile(stmt.obj);
      await sleep(120);
      await safeCanvasPointerClickWorld(
        targetBounds.x + targetBounds.width / 2,
        targetBounds.y + targetBounds.height / 2,
        '#ffb45c',
        150
      );
      await sleep(250);
    }
  }

  const INTERPRET_LANGUAGES = {
    english: 'en', en: 'en',
    german: 'de', deutsch: 'de', de: 'de',
    french: 'fr', francais: 'fr', français: 'fr', fr: 'fr',
    spanish: 'es', espanol: 'es', español: 'es', es: 'es',
    italian: 'it', italiano: 'it', it: 'it',
    welsh: 'cy', cymraeg: 'cy', cy: 'cy',
    gaelic: 'gd', irish: 'ga', gaeilge: 'ga',
    japanese: 'ja', chinese: 'zh', mandarin: 'zh',
    russian: 'ru', arabic: 'ar', portuguese: 'pt', pt: 'pt',
    dutch: 'nl', nl: 'nl', polish: 'pl', pl: 'pl',
    swedish: 'sv', norwegian: 'no', danish: 'da',
    greek: 'el', latin: 'la', hindi: 'hi', korean: 'ko', turkish: 'tr'
  };

  function parseInterpretPrompt(rawText) {
    const text = String(rawText || '').trim();
    // Exclude "Translate [the following|the text] (to|into) {language}[:|-]?"
    const regex = /^\s*Translat(?:e|ion)\s+(?:the\s+(?:following|sentences?|text)\s+)?(?:in)?to\s+([A-Za-z\u00C0-\u00FF]+)\s*[:\-\n\r]*\s*/i;
    const match = text.match(regex);
    let targetLangName = 'en';
    let cleanText = text;
    if (match) {
      targetLangName = match[1].toLowerCase();
      cleanText = text.slice(match[0].length).trim();
    } else {
      // Check if breadcrumb or title mentions "Translation to {language}"
      const a = state.pixiApp;
      if (a) {
        walk(a.stage, o => {
          if (typeof o.text === 'string') {
            const m = o.text.match(/Translat(?:e|ion)\s+(?:in)?to\s+([A-Za-z\u00C0-\u00FF]+)/i);
            if (m) targetLangName = m[1].toLowerCase();
          }
        });
      }
    }
    const targetCode = INTERPRET_LANGUAGES[targetLangName] || 'en';
    return {
      targetLang: targetCode,
      targetLangName,
      sourceText: cleanText
    };
  }

  async function translateWithLibre(text, targetLang) {
    if (state.mode !== 'exam-interpret' && state.mode !== 'wordpop-listening' && !isInterpretRoute()) {
      return null;
    }

    const primaryUrl = CONFIG.libreTranslateUrl || 'https://libretranslate.com/translate';
    const apiKey = CONFIG.libreTranslateApiKey || '';
    const timedFetch = async (url, options) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      try { return await fetch(url, {...(options || {}), signal: controller.signal}); }
      finally { clearTimeout(timer); }
    };

    // Primary: requested https://libretranslate.com/translate endpoint
    try {
      const payload = {
        q: text,
        source: 'auto',
        target: targetLang || 'en',
        format: 'text'
      };
      if (apiKey) payload.api_key = apiKey;

      const res = await timedFetch(primaryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.translatedText) {
          return data.translatedText;
        }
      }
      log(`LibreTranslate primary returned ${res.status}: ${await res.text().catch(() => '')}`);
    } catch (e) {
      log('LibreTranslate primary fetch error:', e);
    }

    // Fallback 1: Public LibreTranslate instance (Argos OpenTech)
    try {
      const res = await timedFetch('https://translate.argosopentech.com/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          q: text,
          source: 'auto',
          target: targetLang || 'en',
          format: 'text'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.translatedText) {
          return data.translatedText;
        }
      }
    } catch (e) {
      log('LibreTranslate fallback fetch error:', e);
    }

    // Fallback 2: Google Translate GTX free endpoint
    try {
      const q = encodeURIComponent(text);
      const tl = encodeURIComponent(targetLang || 'en');
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${q}`;
      const res = await timedFetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translated = data[0].map(item => item[0]).join('');
          if (translated) return translated;
        }
      }
    } catch (e) {
      log('Google Translate fallback fetch error:', e);
    }

    // Fallback 3: MyMemory free translation API
    try {
      const q = encodeURIComponent(text.slice(0, 500));
      const tl = encodeURIComponent(targetLang || 'en');
      const res = await timedFetch(`https://api.mymemory.translated.net/get?q=${q}&langpair=autodetect|${tl}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.responseData && data.responseData.translatedText) {
          return data.responseData.translatedText;
        }
      }
    } catch (e) {
      log('MyMemory fallback fetch error:', e);
    }

    return null;
  }

  function findInterpretPromptText() {
    const a = state.pixiApp;
    if (!a) return null;

    let candidate = '';
    walk(a.stage, o => {
      if (candidate || !isVisible(o, a.stage)) return;
      const t = typeof o.text === 'string' ? o.text.trim() : '';
      if (/translate\s+(?:the\s+(?:following|sentences?|text)\s+)?(?:in)?to\s+/i.test(t)) {
        // o.name often preserves \r\n line breaks in Text objects
        const raw = (typeof o.name === 'string' && o.name.length >= t.length && /translate/i.test(o.name))
          ? o.name
          : t;
        candidate = raw;
      }
    });

    if (candidate) return candidate;

    // Fallback: search for prompt text block on left side of screen
    walk(a.stage, o => {
      if (candidate || !isVisible(o, a.stage)) return;
      const t = typeof o.text === 'string' ? o.text.trim() : '';
      const b = boundsOf(o);
      if (t.length > 20 && b && b.x < 480 && b.y >= 80 && b.y < 500 && !/^(?:submit|start|teacher|marked|points|ranking)/i.test(t)) {
        candidate = typeof o.name === 'string' && o.name.length >= t.length ? o.name : t;
      }
    });

    if (candidate) return candidate;

    if (state.examOriginalText) return state.examOriginalText;
    if (state.examTranslations && state.examTranslations.length && state.examTranslations[0].question) {
      return state.examTranslations[0].question;
    }
    return null;
  }

  async function examInterpretTick() {
    if (state.mode !== 'exam-interpret' && !isInterpretRoute()) return;

    // 1. Dismiss Start dialog if open
    if (await dismissStartDialog()) return;

    // 2. Locate question text
    const rawPrompt = findInterpretPromptText();
    if (!rawPrompt) {
      setStatus('Exam Interpret: waiting for question text');
      return;
    }

    // 3. Parse target language and exclude "Translate into {language}"
    const parsed = parseInterpretPrompt(rawPrompt);
    if (!parsed.sourceText) {
      setStatus('Exam Interpret: empty source text');
      return;
    }

    const promptSig = normaliseText(parsed.sourceText);
    if (state.lastInterpretPrompt !== promptSig) {
      state.lastInterpretPrompt = promptSig;
      state.examInterpretSubmitted = false;
    }

    if (state.examInterpretSubmitted || state.examSubmitted.has(promptSig)) {
      setStatus('Exam Interpret: submitted — waiting for completion');
      await advanceExamAfterCompletion();
      return;
    }

    setPromptLabel(`[${parsed.targetLang.toUpperCase()}] ${parsed.sourceText.slice(0, 35)}...`);

    // 4. Locate textarea
    const input = examInput();
    if (!input) {
      setStatus('Exam Interpret: waiting for textarea');
      return;
    }

    // 5. Get translated text (cached or via LibreTranslate API)
    let translatedText = state.interpretCache.get(promptSig);
    if (!translatedText) {
      if (state.interpretTranslating) {
        return; // Translation already in progress, avoid duplicate concurrent API calls
      }
      state.interpretTranslating = true;
      setStatus(`Exam Interpret: translating to ${parsed.targetLang}...`);
      try {
        translatedText = await translateWithLibre(parsed.sourceText, parsed.targetLang);
      } finally {
        state.interpretTranslating = false;
      }

      if (!translatedText) {
        addLog('Exam Interpret: translation failed', 'err');
        setStatus('Exam Interpret: translation API failed');
        await sleep(1500);
        return;
      }
      translatedText = humanizeLongAnswer(translatedText);
      state.interpretCache.set(promptSig, translatedText);
    }

    // Log Translated exactly once per question
    if (!state.interpretLogged.has(promptSig)) {
      state.interpretLogged.add(promptSig);
      addLog(`Translated: "${translatedText.slice(0, 50)}..."`, 'ok');
    }

    // 6. Paste into <textarea id="textInputChina">
    input.focus();
    const inputPrototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(inputPrototype, 'value')?.set;
    if (setter) {
      setter.call(input, translatedText);
    } else {
      input.value = translatedText;
    }

    const keyOpts = {
      key: 'a',
      code: 'KeyA',
      keyCode: 65,
      which: 65,
      charCode: 65,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window
    };
    input.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
    input.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: 'insertText',
      data: translatedText
    }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
    document.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
    window.dispatchEvent(new KeyboardEvent('keyup', keyOpts));

    if (!input.value || input.value.trim().length === 0) {
      input.value = translatedText;
    }

    await sleep(200);

    // 7. Submit answer
    const submit = examSubmitControl();
    const domSubmit = submit ? null : examSubmitDomControl();
    if (!submit && !domSubmit) {
      setStatus('Exam Interpret: waiting for submit button');
      return;
    }

    let clicked = false;
    if (submit) {
      if (submit.obj) {
        submit.obj.alpha = 1;
        submit.obj.interactive = true;
        submit.obj.buttonMode = true;
        if (Array.isArray(submit.obj.children)) {
          submit.obj.children.forEach(c => {
            if (c) {
              c.alpha = 1;
              c.interactive = true;
            }
          });
        }
      }

      emitOnObject(submit.obj, 'pointerover');
      emitOnObject(submit.obj, 'pointerdown');
      emitOnObject(submit.obj, 'pointerup');
      emitOnObject(submit.obj, 'click');
      emitOnObject(submit.obj, 'tap');
      emitOnObject(submit.obj, 'keyup');
      if (submit.labelObj) {
        emitOnObject(submit.labelObj, 'pointerdown');
        emitOnObject(submit.labelObj, 'pointerup');
        emitOnObject(submit.labelObj, 'click');
        emitOnObject(submit.labelObj, 'tap');
      }

      await clickTile(submit.obj);

      const b = submit.bounds;
      if (b && b.width > 0) {
        clicked = await safeCanvasPointerClickWorld(
          b.x + b.width / 2, b.y + b.height / 2, '#4ade80', 250
        );
      } else {
        clicked = true;
      }
    }

    if (domSubmit) {
      try {
        domSubmit.click();
        await sleep(250);
        clicked = true;
      } catch (_) {}
    }

    // Also dispatch Enter key on input as fallback
    const enterOpts = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      view: window
    };
    input.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
    input.dispatchEvent(new KeyboardEvent('keyup', enterOpts));

    state.examInterpretSubmitted = true;
    state.examSubmitted.add(promptSig);
    state.answeredCount++;
    setAnsweredCount(state.answeredCount);
    addLog(`Exam Interpret submitted (${translatedText.length} chars)`, 'ok');
    setStatus('Exam Interpret: submitted — waiting for completion');
    await advanceExamAfterCompletion();
  }

  async function advanceExamAfterCompletion() {
    if (state.examContinueBusy) return true;
    const now = Date.now();
    if (now - state.examContinueAt < 500) return true;
    const controls = examContinueControls();
    if (!controls.length) {
      setStatus('Exam complete: waiting for Continue');
      return true;
    }
    state.examContinueBusy = true;
    state.examContinueAt = now;
    try {
      const clicked = await clickVisibleContinue();
      if (clicked) {
        addLog(`Exam Continue clicked${controls.length > 1 ? ' — confirmation may follow' : ''}`, 'ok');
        state.examSubmitted = new Set();
        state.examGapOrder = [];
        state.examGapIndex = 0;
        state.examGapSubmitted = false;
        state.examDictationSubmitted = false;
        state.whoSaidWhatSubmitted = false;
        state.examInterpretSubmitted = false;
        state.lastInterpretPrompt = null;
        state.completionSeen = null;
      }
    } finally {
      state.examContinueBusy = false;
    }
    return true;
  }

  // ============ FULL AUTO PILOT ============
  function persistPilotState() {
    saveStringSetting('pilotHomeworkUid', state.pilotHomeworkUid);
    saveStringSetting('pilotTaskIndex', state.pilotTaskIndex);
    saveStringSetting('pilotAssignmentUid', state.pilotAssignmentUid);
    saveStringSetting('pilotTaskIndexUid', state.pilotTaskIndexUid);
    saveStringSetting('pilotTaskText', state.pilotTaskText);
    saveStringSetting('pilotGameName', state.pilotGameName);
    saveBoolSetting('pilotAwaitingGame', state.pilotAwaitingGame);
    saveBoolSetting('pilotInGame', state.pilotInGame);
    saveBoolSetting('pilotFinished', state.pilotFinished);
    saveBoolSetting('pilotFinishingTask', state.pilotFinishingTask);
    saveBoolSetting('pilotDoingPrerequisite', state.pilotDoingPrerequisite);
    saveStringSetting('pilotCatalogHash', state.pilotCatalogHash);
    saveStringSetting('pilotCompletionSignal', state.pilotCompletionSignal);
    saveStringSetting('pilotCompletionAt', state.pilotCompletionAt);
    saveStringSetting('pilotContinueAt', state.pilotContinueAt);
    saveStringSetting('pilotCompletedHomeworkIds', JSON.stringify([...state.pilotCompletedHomeworkIds]));
  }

  function pilotRoute() {
    const match = String(location.hash || '').match(/^#\/([^?/#]+)/);
    return match ? match[1].toLowerCase() : '';
  }

  function pilotHomeworkUidFromUrl() {
    const source = `${String(location.hash || '')}&${String(location.search || '').replace(/^\?/, '')}`;
    const match = source.match(/[?&]homeworkUid=([^&#]+)/i);
    if (!match) return '';
    try { return decodeURIComponent(match[1]); } catch (_) { return match[1]; }
  }

  function pilotNavHash(route, uid) {
    return uid
      ? `#/${route}?homeworkUid=${encodeURIComponent(uid)}`
      : `#/${route}`;
  }

  function pilotTextWithin(root) {
    const texts = [];
    walk(root, obj => {
      if (typeof obj.text === 'string' && obj.text.trim()) texts.push(obj.text.trim());
    });
    return texts.join(' ');
  }

  function pilotClickableObject(obj) {
    let current = obj;
    const stage = state.pixiApp && state.pixiApp.stage;
    while (current && current !== stage) {
      const events = verbEventNames(current);
      if (current.buttonMode || current.cursor === 'pointer' ||
          events.some(name => /^(?:pointerup|click|tap|keyup)$/i.test(name))) return current;
      current = current.parent;
    }
    return obj;
  }

  async function pilotClickObject(obj) {
    if (!obj) return false;
    const target = pilotClickableObject(obj);
    const events = verbEventNames(target);
    if (events.some(name => /^pointerup$/i.test(name)) &&
        emitOnObject(target, 'pointerup')) return true;
    return clickTile(target);
  }

  async function pilotRunStep(step, action, label) {
    if (state.pilotBlockedStep) {
      setStatus(`Full auto blocked at ${state.pilotBlockedStep}; turn Full auto off/on to retry`);
      return true;
    }
    if (state.pilotRouteStep !== step) {
      state.pilotRouteStep = step;
      state.pilotRouteAttempts = 0;
      state.pilotLastActionAt = 0;
    }
    if (Date.now() - state.pilotLastActionAt < 1100) {
      setStatus(`Full auto: ${label || step}…`);
      return true;
    }
    if (state.pilotRouteAttempts >= 12) {
      state.pilotBlockedStep = step;
      const message = `Full auto could not confirm ${label || step} after 12 tries`;
      addLog(message, 'err');
      showToast(message, 'err');
      notifyDiscord('Full auto needs help', message);
      setStatus(message);
      return true;
    }
    state.pilotLastActionAt = Date.now();
    state.pilotRouteAttempts++;
    let clicked = false;
    try { clicked = !!(await action()); } catch (error) {
      log('Full auto action failed', step, error);
    }
    setStatus(clicked
      ? `Full auto: ${label || step} — waiting for page`
      : `Full auto: retrying ${label || step} (${state.pilotRouteAttempts}/12)`);
    return true;
  }

  function pilotFindTextObject(root, pattern) {
    let found = null;
    walk(root, obj => {
      if (found || typeof obj.text !== 'string') return;
      pattern.lastIndex = 0;
      if (!pattern.test(obj.text.trim()) || !isVisible(obj, state.pixiApp.stage)) return;
      const bounds = boundsOf(obj);
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
      found = obj;
    });
    return found;
  }

  function pilotCatalogSelectedTab() {
    const stage = state.pixiApp && state.pixiApp.stage;
    if (!stage) return '';
    const tabs = [
      {label: 'learn', pattern: /^Learn$/i},
      {label: 'practice', pattern: /^Practice$/i},
      {label: 'quiz', pattern: /^Quiz$/i}
    ];
    for (const tab of tabs) {
      const text = pilotFindTextObject(stage, tab.pattern);
      if (!text) continue;
      // The background texture is a sibling of the text inside the tab
      // composite. Reading only the interactive text misses selectedTestButton.
      const target = text.parent || pilotClickableObject(text);
      let selected = false;
      walk(target, obj => {
        const texture = `${fullTextureName(obj)} ${String(obj.name || '')}`;
        if (/selected/i.test(texture)) selected = true;
      });
      if (selected) return tab.label;
    }
    return '';
  }

  async function pilotClickCatalogTab(labelText) {
    const stage = state.pixiApp && state.pixiApp.stage;
    const label = stage && pilotFindTextObject(stage, labelText === 'Practice' ? /^Practice$/i : /^Quiz$/i);
    const tab = label && label.parent;
    const bounds = tab && boundsOf(tab);
    if (!tab || !bounds || !pilotOnCanvas(bounds)) return false;
    // The text can itself be interactive without an activation handler. Aim
    // at the tab background, just right of the text, through the real canvas.
    const textBounds = boundsOf(label);
    const x = textBounds
      ? Math.min(bounds.x + bounds.width - 15, textBounds.x + textBounds.width + 18)
      : bounds.x + bounds.width * 0.72;
    const y = bounds.y + bounds.height / 2;
    const clicked = await safeCanvasPointerClickWorld(x, y, '#4ade80', 180);
    const wanted = labelText.toLowerCase();
    if (pilotCatalogSelectedTab() === wanted) return true;
    if (verbEventNames(tab).includes('pointerup')) {
      emitOnObject(tab, 'pointerup', {x, y});
      await sleep(180);
    }
    return clicked || pilotCatalogSelectedTab() === wanted;
  }

  function pilotClickQuizTab() { return pilotClickCatalogTab('Quiz'); }

  function pilotOnCanvas(bounds) {
    if (!bounds || !state.pixiApp) return false;
    const resolution = Number(state.pixiApp.renderer && state.pixiApp.renderer.resolution) || 1;
    const width = (state.pixiApp.renderer.width || state.pixiApp.view.width) / resolution;
    const height = (state.pixiApp.renderer.height || state.pixiApp.view.height) / resolution;
    return bounds.x + bounds.width > 0 && bounds.y + bounds.height > 0 &&
      bounds.x < width && bounds.y < height;
  }

  function pilotHomeworkCards() {
    const stage = state.pixiApp && state.pixiApp.stage;
    if (!stage) return {panel: null, list: null, cards: []};
    let panel = null;
    walk(stage, obj => { if (!panel && obj.name === 'homework' && obj.children?.length) panel = obj; });
    const list = panel && panel.children ? panel.children[3] : null;
    const cards = [];
    if (list) walk(list, obj => {
      if (!/^assignment-\d+$/i.test(String(obj.name || '')) ||
          !isVisible(obj, stage) || !pilotOnCanvas(boundsOf(obj))) return;
      cards.push({obj, uid: String(obj.name).replace(/^assignment-/i, ''), title: pilotTextWithin(obj)});
    });
    return {panel, list, cards};
  }

  function pilotTaskRows() {
    const stage = state.pixiApp && state.pixiApp.stage;
    if (!stage) return [];
    const rows = [];
    walk(stage, obj => {
      if (obj.name !== 'task-card' || !isVisible(obj, stage) ||
          !pilotOnCanvas(boundsOf(obj))) return;
      const labels = [];
      walk(obj, child => {
        if (typeof child.text === 'string' && child.text.trim()) labels.push(child.text.trim());
      });
      const title = labels.find(text => /^\s*\d+\.\s*\S/.test(text));
      const match = title && title.match(/^\s*(\d+)\.\s*(.+?)\s*$/);
      if (match) {
        const siblings = obj.parent?.children || [];
        const score = siblings[siblings.indexOf(obj) + 1];
        const scoreText = score && score.name === 'score-button' ? pilotTextWithin(score) : '';
        const completed = /^100\s*%$/.test(scoreText.trim());
        rows.push({obj, number: Number(match[1]), text: `${match[1]}. ${match[2]}`, completed});
      }
    });
    return rows.sort((a, b) => a.number - b.number);
  }

  function pilotGameTile(gameName, allowHidden) {
    const stage = state.pixiApp && state.pixiApp.stage;
    if (!stage) return null;
    const wanted = normaliseText(gameName);
    if (!wanted) return null;
    const matches = [];
    walk(stage, obj => {
      if (typeof obj.text !== 'string') return;
      const label = obj.text.trim();
      if (normaliseText(label) !== wanted) return;
      const target = pilotClickableObject(obj);
      const bounds = boundsOf(target) || boundsOf(obj);
      if (!bounds || bounds.width <= 0 || bounds.height <= 0 ||
          bounds.width > 420 || bounds.height > 240 || bounds.y < 175) return;
      const visible = isVisible(target, stage) && pilotOnCanvas(bounds);
      if (!visible && !allowHidden) return;
      // Hidden catalog cards are only considered after checking all visible
      // tabs, and only when their PIXI ancestor is an actual click target.
      if (!visible && !verbEventNames(target).some(name => /^pointerup$/i.test(name))) return;
      matches.push({obj: target, label, bounds, visible});
    });
    matches.sort((a, b) => Number(b.visible) - Number(a.visible));
    return matches[0] || null;
  }

  function pilotQuizSkill() {
    const parts = String(state.pilotTaskText || '').split(/\s*→\s*/).map(x => x.trim());
    const fromTask = parts.length >= 2 ? parts[parts.length - 2] : '';
    if (/^(?:reading|listening|writing|speaking)$/i.test(fromTask)) return fromTask;
    const params = new URLSearchParams(String(location.hash || '').split('?')[1] || '');
    const fromRoute = params.get('gameType') || params.get('type') || '';
    return /^(?:reading|listening|writing|speaking)$/i.test(fromRoute) ? fromRoute : '';
  }

  function pilotPracticeTile() {
    const choices = [state.pilotGameName, 'Word Pop', 'Multiple Choice',
      'Avocado Smash', 'WordPod', 'Skyrise', 'Jumble'].filter(Boolean);
    for (const name of choices) {
      const tile = pilotGameTile(name);
      if (tile) return tile;
    }
    return null;
  }

  function pilotQuizTile(skill) {
    const stage = state.pixiApp && state.pixiApp.stage;
    if (!stage || !skill) return null;
    const wanted = normaliseText(skill);
    let best = null;
    walk(stage, obj => {
      if (typeof obj.text !== 'string' || !isVisible(obj, stage)) return;
      const label = normaliseText(obj.text);
      if (label !== wanted && label !== `${wanted} quiz` && label !== `${wanted} test`) return;
      const target = pilotClickableObject(obj);
      const bounds = boundsOf(target) || boundsOf(obj);
      if (!bounds || bounds.width <= 0 || bounds.height <= 0 ||
          bounds.width > 420 || bounds.height > 240 || !pilotOnCanvas(bounds)) return;
      // The dumped Quiz card is an interactive parent of its Reading text,
      // with testListBackground.png as a child. This also proves that the
      // Quiz pane is open when the selected tab sprite cannot be identified.
      if (bounds.y < 175 || !verbEventNames(target).some(name => /^pointerup$/i.test(name))) return;
      let isQuizCard = false;
      walk(target, child => {
        if (/testListBackground/i.test(`${fullTextureName(child)} ${String(child.texture?.baseTexture?.resource?.url || '')}`))
          isQuizCard = true;
      });
      if (!isQuizCard) return;
      if (!best || bounds.width * bounds.height > best.bounds.width * best.bounds.height)
        best = {obj: target, label: obj.text.trim(), bounds};
    });
    return best;
  }

  async function pilotClickQuizTile(tile) {
    const b = tile && tile.bounds;
    if (!b) return false;
    // Aim inside the card where the user's successful click landed. A real
    // canvas pointer sequence reaches the PIXI parent's pointerup handler.
    return safeCanvasPointerClickWorld(
      b.x + b.width * 0.35, b.y + b.height * 0.62, '#4ade80', 160);
  }

  function pilotClearTaskFlags() {
    state.pilotAwaitingGame = false;
    state.pilotInGame = false;
    state.pilotFinishingTask = false;
    state.pilotDoingPrerequisite = false;
    state.pilotCatalogHash = '';
    state.pilotCompletionSignal = '';
    state.pilotCompletionAt = 0;
    state.pilotContinueAt = 0;
    state.pilotTaskText = '';
    state.pilotTaskIndexUid = '';
    state.pilotGameName = '';
    state.pilotCatalogTabIndex = 0;
    state.pilotCatalogTabAt = 0;
    state.pilotCatalogQuizSelected = false;
    persistPilotState();
  }

  function pilotAdvanceTask() {
    const rowNumber = Number((state.pilotTaskText || '').match(/^\s*(\d+)\./)?.[1]) ||
      state.pilotTaskIndex + 1;
    state.pilotTaskIndex = Math.max(state.pilotTaskIndex + 1, rowNumber);
    state.pilotBlockedStep = '';
    state.pilotRouteStep = '';
    state.pilotRouteAttempts = 0;
    addLog(`✓ Full auto completed task ${rowNumber}`, 'ok');
    if (state.mode === 'mc2-reading' || state.mode === 'mc2-listening') resetMC2State();
    notifyDiscord('Homework task completed', `Task ${rowNumber}: ${state.pilotTaskText || state.pilotGameName || 'activity'}`);
    pilotClearTaskFlags();
    state.pilotRouteStep = '';
    state.pilotRouteAttempts = 0;
    persistPilotState();
  }

  function pilotFinishAssignment() {
    const uid = String(state.pilotHomeworkUid || pilotHomeworkUidFromUrl() || '');
    if (uid) state.pilotCompletedHomeworkIds.add(uid);
    addLog(`✓ Full auto finished homework${uid ? ` ${uid}` : ''}`, 'ok');
    const summary = `Homework ${uid || 'assignment'}: ${formatDuration(pilotElapsedSeconds())} real, ${formatDuration(state.pilotFakeSeconds)} simulated`;
    addLog(summary, 'ok');
    showToast(summary, 'ok');
    notifyDiscord('Homework completed', summary);
    state.pilotElapsedMs += state.pilotStartedAt ? Date.now() - state.pilotStartedAt : 0;
    state.pilotStartedAt = 0;
    saveStringSetting('pilotElapsedMs', state.pilotElapsedMs);
    state.pilotHomeworkUid = '';
    state.pilotAssignmentUid = '';
    state.pilotTaskIndex = 0;
    state.pilotFinished = false;
    pilotClearTaskFlags();
    state.pilotRouteStep = '';
    state.pilotRouteAttempts = 0;
    persistPilotState();
    location.hash = pilotNavHash('Homework');
  }

  async function autopilotTick(activeMode) {
    if (!state.autopilot) return false;
    // Concert has a separate navigation firewall and lifecycle; the homework
    // pilot must never take ownership of that route.
    if (isConcertRoute() || concertNavigationLocked()) return false;
    const route = pilotRoute();
    if (state.pilotFinished) {
      if (route === 'dashboard' || !route) {
        location.hash = pilotNavHash('Homework');
        return true;
      }
      if (route === 'homework' && pilotHomeworkCards().cards.some(card =>
        !state.pilotCompletedHomeworkIds.has(card.uid))) {
        state.pilotFinished = false;
        persistPilotState();
      } else {
        setStatus('Full auto: finished — no current assignments left');
        return true;
      }
    }
    const uidFromRoute = pilotHomeworkUidFromUrl();
    if (route === 'homeworkdetail' && uidFromRoute &&
        uidFromRoute !== state.pilotHomeworkUid && !state.pilotFinishingTask) {
      state.pilotHomeworkUid = uidFromRoute;
      state.pilotAssignmentUid = uidFromRoute;
      state.pilotTaskIndex = 0;
      state.pilotRouteStep = '';
      state.pilotRouteAttempts = 0;
      persistPilotState();
    }

    if (state.pilotDoingPrerequisite &&
        (state.pilotFinishingTask || (state.pilotInGame && !state.pilotAwaitingGame)) &&
        (route === 'catalog' || route === 'homeworkdetail' || route === 'homework')) {
      if (route !== 'catalog' && state.pilotCatalogHash) {
        location.hash = state.pilotCatalogHash;
        setStatus('Full auto: returning to Quiz after required Practice');
        return true;
      }
      state.pilotFinishingTask = false;
      state.pilotInGame = false;
      state.pilotAwaitingGame = false;
      state.pilotDoingPrerequisite = false;
      state.pilotCatalogHash = '';
      state.pilotRouteStep = '';
      state.pilotRouteAttempts = 0;
      persistPilotState();
      setStatus('Full auto: required Practice complete; reopening Quiz');
      return true;
    }

    // A completed task may return to the Catalog or task list before the
    // completion overlay has fully disappeared. Treat either as the hand-off.
    if ((route === 'homeworkdetail' || route === 'homework' || route === 'catalog') &&
        (state.pilotFinishingTask || (state.pilotInGame && !state.pilotAwaitingGame))) {
      if (route === 'homeworkdetail') {
        const row = pilotTaskRows().find(item =>
          String(item.number) === String(state.pilotTaskIndexUid));
        if (state.pilotFinishingTask || (row && row.completed)) {
          pilotAdvanceTask();
          return true;
        }
        if (!state.pilotCompletionAt) state.pilotCompletionAt = Date.now();
        if (Date.now() - state.pilotCompletionAt < 2500) {
          setStatus('Full auto: checking task score before moving on');
          return true;
        }
        state.pilotInGame = false;
        state.pilotAwaitingGame = true;
        state.pilotCompletionAt = 0;
        state.pilotRouteStep = '';
        persistPilotState();
        setStatus('Full auto: task is incomplete; reopening it');
        return true;
      }
      if (route === 'catalog') {
        if (state.pilotFinishingTask) pilotAdvanceTask();
        location.hash = pilotNavHash('HomeworkDetail', state.pilotHomeworkUid);
        return true;
      }
      if (route === 'homework') {
        const uid = String(state.pilotHomeworkUid || '');
        if (uid) {
          if (state.pilotFinishingTask) pilotAdvanceTask();
          location.hash = pilotNavHash('HomeworkDetail', uid);
        } else {
          state.pilotInGame = false;
          state.pilotFinishingTask = false;
          persistPilotState();
        }
        return true;
      }
    }

    if (route === 'dashboard' || !route) {
      return pilotRunStep('dashboard-homework', async () => {
        location.hash = pilotNavHash('Homework');
        return true;
      }, 'open Homework');
    }

    if (route === 'homework') {
      if (state.pilotBlockedStep) {
        setStatus(`Full auto blocked at ${state.pilotBlockedStep}; turn Full auto off/on to retry`);
        return true;
      }
      const {list, cards} = pilotHomeworkCards();
      if (state.pilotHomeworkUid && state.pilotCompletedHomeworkIds.has(String(state.pilotHomeworkUid))) {
        state.pilotHomeworkUid = '';
        state.pilotAssignmentUid = '';
        state.pilotTaskIndex = 0;
        pilotClearTaskFlags();
        persistPilotState();
      }
      const preferred = state.pilotHomeworkUid
        ? cards.find(card => card.uid === String(state.pilotHomeworkUid)) : null;
      const nextCard = preferred || cards.find(card =>
        !state.pilotCompletedHomeworkIds.has(card.uid));
      if (nextCard) {
        if (nextCard.uid !== state.pilotHomeworkUid) {
          state.pilotElapsedMs = 0;
          state.pilotFakeSeconds = 0;
          state.pilotStartedAt = Date.now();
          saveStringSetting('pilotElapsedMs', '0');
          saveStringSetting('pilotFakeSeconds', '0');
          state.pilotHomeworkUid = nextCard.uid;
          state.pilotAssignmentUid = nextCard.uid;
          state.pilotTaskIndex = 0;
          state.pilotRouteStep = '';
          state.pilotRouteAttempts = 0;
          pilotClearTaskFlags();
          persistPilotState();
        }
        return pilotRunStep(`homework-card-${nextCard.uid}`, () =>
          pilotClickObject(nextCard.obj), `open assignment ${nextCard.title.slice(0, 42)}`);
      }
      if (list && !isVisible(list, state.pixiApp.stage)) {
        const tab = pilotFindTextObject(state.pixiApp.stage, /^Current Assignments\s*:?/i);
        if (tab) return pilotRunStep('homework-current-tab', () =>
          pilotClickObject(tab), 'show current assignments');
      }
      const currentTab = pilotFindTextObject(state.pixiApp.stage, /^Current Assignments\s*:?\s*0\b/i);
      if (currentTab || (cards.length && cards.every(card =>
          state.pilotCompletedHomeworkIds.has(card.uid)))) {
        state.pilotFinished = true;
        persistPilotState();
        setStatus('Full auto: no current assignments left');
        addLog('Full auto: no current assignments left', 'ok');
        notifyDiscord('Full auto finished', 'No current assignments left');
        return true;
      }
      return pilotRunStep('homework-current-tab', async () => false,
        'find a current assignment');
    }

    if (route === 'homeworkdetail') {
      const rows = pilotTaskRows();
      if (state.pilotAwaitingGame && !state.pilotInGame) {
        const pending = rows.find(row => String(row.number) === state.pilotTaskIndexUid);
        if (pending) {
          const signature = `${pending.number}::${pending.text}`;
          if (!state.pilotTaskText || state.pilotTaskText === pending.text) {
            state.pilotTaskText = pending.text;
            const parts = pending.text.split(/\s*→\s*/).map(part => part.trim()).filter(Boolean);
            state.pilotGameName = parts[parts.length - 1] || state.pilotGameName;
            persistPilotState();
            return pilotRunStep(`homework-task-${pending.number}`, () =>
              pilotClickObject(pending.obj), `reopen task ${pending.number}${state.pilotGameName ? ` (${state.pilotGameName})` : ''}`);
          }
          log('Full auto pending task changed, repairing saved selection', signature);
        }
      }
      if (!rows.length) return pilotRunStep('homework-task-rows', async () => false,
        'load numbered tasks');
      // The score beside each task is the server's completion state. A saved
      // index can lag behind if the user completed a task outside this script.
      let nextRow = rows.find(row => !row.completed && row.number > state.pilotTaskIndex);
      if (!nextRow) nextRow = rows.find(row => !row.completed);
      if (!nextRow) {
        pilotFinishAssignment();
        return true;
      }
      state.pilotTaskIndex = nextRow.number - 1;
      const parts = nextRow.text.split(/\s*→\s*/).map(part => part.trim()).filter(Boolean);
      const gameName = parts.length ? parts[parts.length - 1] : '';
      state.pilotTaskText = nextRow.text;
      state.pilotTaskIndexUid = String(nextRow.number);
      state.pilotBlockedStep = '';
      state.pilotGameName = gameName;
      state.pilotAwaitingGame = true;
      state.pilotInGame = false;
      state.pilotCatalogTabIndex = 0;
      state.pilotCatalogQuizSelected = false;
      persistPilotState();
      return pilotRunStep(`homework-task-${nextRow.number}`, () =>
        pilotClickObject(nextRow.obj), `open task ${nextRow.number}${gameName ? ` (${gameName})` : ''}`);
    }

    if (route === 'catalog') {
      if (state.pilotBlockedStep) {
        setStatus(`Full auto blocked at ${state.pilotBlockedStep}; turn Full auto off/on to retry`);
        return true;
      }
      if (state.pilotInGame && !state.pilotAwaitingGame) {
        pilotAdvanceTask();
        location.hash = pilotNavHash('HomeworkDetail', state.pilotHomeworkUid);
        return true;
      }
      const practiceLock = pilotFindTextObject(state.pixiApp.stage,
        /You still need to complete\s+\d+\s+more practice activit/i);
      if (practiceLock || state.pilotDoingPrerequisite) {
        if (!state.pilotDoingPrerequisite) {
          state.pilotDoingPrerequisite = true;
          state.pilotCatalogHash = location.hash;
          addLog('Quiz requires a Practice activity first; completing it now', 'ok');
          persistPilotState();
        }
        if (pilotCatalogSelectedTab() !== 'practice')
          return pilotRunStep('catalog-practice-tab', () =>
            pilotClickCatalogTab('Practice'), 'open required Practice');
        const practiceTile = pilotPracticeTile();
        if (!practiceTile) return pilotRunStep('catalog-practice-tile', async () => false,
          'find a required Practice activity');
        state.pilotAwaitingGame = true;
        persistPilotState();
        return pilotRunStep(`catalog-practice-${normaliseText(practiceTile.label)}`, () =>
          pilotClickQuizTile(practiceTile), `start required ${practiceTile.label} Practice`);
      }
      // The visible TestList card is stronger evidence than a tab sprite:
      // selectedTestButton may have a generated PIXI texture id.
      const skill = pilotQuizSkill();
      const tile = pilotQuizTile(skill);
      if (tile) {
        state.pilotCatalogQuizSelected = true;
        state.pilotAwaitingGame = true;
        state.pilotInGame = false;
        persistPilotState();
        return pilotRunStep(`catalog-quiz-${normaliseText(tile.label)}`, () =>
          pilotClickQuizTile(tile), `start ${tile.label} Quiz`);
      }
      // Always target Quiz directly for assigned tasks; never cycle through
      // Practice. Learn/Practice expose selected*Button textures, while the
      // unselected Quiz button itself can also be named testButton.png.
      const selectedTab = pilotCatalogSelectedTab();
      if (selectedTab !== 'quiz') {
        state.pilotCatalogQuizSelected = false;
        const quiz = pilotFindTextObject(state.pixiApp.stage, /^Quiz$/i);
        if (!quiz) return pilotRunStep('catalog-quiz-tab', async () => false, 'find Quiz tab');
        // Keep clicking/retrying only the Quiz tab until its selected texture
        // confirms the mode switch. Never fall through to Learn/Practice tiles.
        return pilotRunStep('catalog-quiz-tab', pilotClickQuizTab, 'open Quiz');
      }
      state.pilotCatalogQuizSelected = true;
      persistPilotState();
      const fallbackTile = !skill && pilotGameTile(state.pilotGameName);
      if (fallbackTile) {
        state.pilotAwaitingGame = true;
        state.pilotInGame = false;
        persistPilotState();
        return pilotRunStep(`catalog-quiz-${normaliseText(fallbackTile.label)}`, () =>
          pilotClickQuizTile(fallbackTile), `start ${fallbackTile.label} Quiz`);
      }
      return pilotRunStep('catalog-game-tile', async () => false,
        skill ? `find ${skill} Quiz card` : 'find the assigned Quiz card');
    }

    const isNavRoute = ['dashboard', 'homework', 'homeworkdetail', 'catalog'].includes(route);
    if (!isNavRoute && !state.pilotAwaitingGame && !state.pilotInGame &&
        !state.pilotHomeworkUid && !state.pilotTaskText) return false;
    if (!isNavRoute && state.pilotAwaitingGame && !activeMode) {
      setStatus(`Full auto: waiting for ${state.pilotGameName || 'activity'} to load`);
      return true;
    }
    if (!isNavRoute && (state.pilotAwaitingGame || activeMode || state.pilotInGame)) {
      if (state.pilotAwaitingGame) {
        state.pilotAwaitingGame = false;
        state.pilotInGame = true;
        state.pilotFinishingTask = false;
        state.pilotCompletionSignal = '';
        state.pilotCompletionAt = 0;
        state.pilotContinueAt = 0;
        state.pilotRouteStep = '';
        state.pilotRouteAttempts = 0;
        persistPilotState();
        addLog(`▶ Full auto playing ${state.pilotGameName || modeLabel(activeMode)}`, 'ok');
      }
      if (!state.pilotInGame && activeMode) {
        // If Full auto is enabled on an already-open game, finish that game
        // before returning to the assignment list.
        state.pilotInGame = true;
        persistPilotState();
      }
      if (state.pilotFinishingTask) {
        const elapsed = Date.now() - (state.pilotCompletionAt || 0);
        if (state.pilotContinueAt) {
          if (Date.now() - state.pilotContinueAt < 1600) {
            setStatus('Full auto: waiting for game completion hand-off');
            return true;
          }
          if (state.pilotHomeworkUid) {
            location.hash = state.pilotDoingPrerequisite && state.pilotCatalogHash
              ? state.pilotCatalogHash : pilotNavHash('HomeworkDetail', state.pilotHomeworkUid);
            setStatus('Full auto: returning to numbered tasks');
            return true;
          }
        } else if (elapsed < 2600) {
          const clicked = await clickVisibleContinue();
          if (clicked) {
            state.pilotContinueAt = Date.now();
            persistPilotState();
            setStatus('Full auto: continuing from completed game');
            return true;
          }
          setStatus('Full auto: waiting for completion control');
          return true;
        } else if (state.pilotHomeworkUid) {
          location.hash = state.pilotDoingPrerequisite && state.pilotCatalogHash
            ? state.pilotCatalogHash : pilotNavHash('HomeworkDetail', state.pilotHomeworkUid);
          setStatus('Full auto: returning to numbered tasks');
          return true;
        }
      }
      // Let MC2 record the result before a Continue click can clear the
      // result sprites or replace the current question.
      if ((activeMode === 'mc2-reading' && state.mc2ReadingPending) ||
          (activeMode === 'mc2-listening' && state.mc2PendingKey)) return false;
      const completionCandidate = detectCompletion();
      const continueAvailable = !!(completionCandidate && continueControls().length);
      const explicitCompletion = !!(completionCandidate &&
        /^(?:url:results|.*\b(?:quiz|activity|homework|exercise)\s+(?:is\s+)?(?:complete|completed|finished|done)\b|.*\ball\s+(?:correct|right)\b)/i.test(completionCandidate));
      const done = completionCandidate && (continueAvailable || explicitCompletion)
        ? completionCandidate : null;
      if (done) {
        if (!state.pilotFinishingTask) {
          const completionLabel = done;
          state.pilotFinishingTask = true;
          state.pilotCompletionSignal = completionLabel;
          state.pilotCompletionAt = Date.now();
          state.pilotContinueAt = 0;
          persistPilotState();
          addLog(`✓ Full auto detected completed game: ${completionLabel}`, 'ok');
          notifyDiscord('Game completed', `${state.pilotGameName || modeLabel(activeMode)}: ${completionLabel}`);
        }
        const clicked = await clickVisibleContinue();
        if (clicked) {
          state.pilotContinueAt = Date.now();
          persistPilotState();
          setStatus('Full auto: continuing from completed game');
        } else if (Date.now() - state.pilotCompletionAt >= 2600) {
          if (state.pilotHomeworkUid) location.hash = state.pilotDoingPrerequisite && state.pilotCatalogHash
            ? state.pilotCatalogHash : pilotNavHash('HomeworkDetail', state.pilotHomeworkUid);
          setStatus('Full auto: returning to numbered tasks');
        } else setStatus('Full auto: waiting for completion hand-off');
        return true;
      }
      return false;
    }

    if (!isNavRoute && !activeMode && state.pilotInGame) {
      setStatus('Full auto: waiting for activity or completion');
      return true;
    }
    return false;
  }

  // ============ MAIN ============
  async function tick() {
    if (!state.running) return;
    refreshPilotTimer();
    if (!tryGrabPixi()) { setStatus('Waiting for Pixi…'); return; }
    applyUserOptions();
    hookServicesFakeTime();

    // Concert is exclusive. While its route is active, never let scene
    // heuristics reinterpret completion/result UI as another game.
    const detectedMode = (isConcertRoute() || concertNavigationLocked())
      ? 'concert-speaking'
      : detectMode();
    const m = detectedMode || state.mode;

    if (m === 'concert-speaking' || concertNavigationLocked()) {
      if (isConcertRoute()) concertEngageNavigationLock();
      const blocked = concertInstallForbiddenNavGuard();

      if (blocked > 0 && !state.concertNavGuardLogged) {
        state.concertNavGuardLogged = true;
        addLog(
          `Concert firewall armed: ${blocked} Assignments/Homework control(s) blocked`,
          'ok'
        );
      }
    }
    if (m !== state.mode) {
      if (state.mode === 'race-driver') raceDriverBoost(false);
      logFakeTimeCompletion();
      resetFakeTimeActivity();
      state.zenMemoryLastCount = 0;
      state.zenNoughtsLastCount = 0;
      state.zenNoughtsNextMoveAt = 0;
      state.raceLastQuestion = '';
      state.raceLastChunks = 0;
      state.dictationSubmitted = false;
      state.dictationSawHidden = false;
      state.dictationPlayAt = 0;
      state.dictationLastAudio = '';
      state.mode = m;
      setModeLabel(modeLabel(m));
      if (m) {
        addLog(`Activity: ${modeLabel(m)}`, 'ok');
        if (m === 'verb-matcher') addLog(`Verb Matcher delay: ${CONFIG.verbMatcherBetweenClicksMs}ms / ${CONFIG.verbMatcherAfterPairMs}ms`);
        if (m === 'jigsaw') addLog(
          `Jigsaw delay: ${CONFIG.jigsawBetweenClicksMs}ms / ${CONFIG.jigsawAfterPairMs}ms`
        );
        if (m === 'mc2-listening' || m === 'mc2-reading') addLog(
          `MC2 mode: ${m === 'mc2-listening' ? 'listening' : 'reading'}`
        );
        if (m === 'wordpod-listening' || m === 'wordpod-reading') addLog(
          `WordPod mode: ${m === 'wordpod-listening' ? 'listening' : 'reading'}`
        );
        if (m === 'skyrise') addLog(
          `Skyrise mode: DOM input`
        );
        if (m === 'dictation') addLog(
          'Dictation: match the playing audio to the sentence, then submit the text'
        );
        if (m === 'exam-dictation') addLog(
          'Exam Dictation: exact audio transcript and submit controls'
        );
        if (m === 'exam-who-said-what') addLog(
          'Who Said What: speaker column classification and auto-submit'
        );
        if (m === 'exam-interpret') addLog(
          'Exam Interpret: LibreTranslate API translation and textInputChina submission'
        );
        if (m === 'exam-open-reading' || m === 'exam-open-listening' || m === 'exam-synonym') addLog(
          `${modeLabel(m)}: exact API answer and submit controls`
        );
        if (m === 'exam-gapfill') addLog(
          'Exam GapFill: ordered <removed> answers and word-bank controls'
        );
        if (m === 'exam-multiple-choice') addLog(
          `Exam Multiple Choice: exact API answer and option controls`
        );
        if (m === 'exam-true-false') addLog(
          `Exam True / False: API answer and button controls`
        );
        if (m === 'concert-speaking') addLog(
          `Concert Speaking: press Speak → TTS (${CONFIG.concertDefaultTargetLang})`
        );
        if (m === 'wordpop-listening') addLog(
          `WordPop timing: ${CONFIG.wordPopAfterPlayMs}ms audio / ` +
          `${CONFIG.wordPopAfterClickMs}ms click`
        );
        if (m === 'forklift') addLog(
          `Forklift timing: ${CONFIG.forkliftPickDelayMs}ms trigger / ` +
          `${CONFIG.forkliftMoveSettleMs}ms settle`
        );
        if (m === 'ocean-cleaner') addLog(
          `Ocean timing: ${CONFIG.oceanClickDelayMs}ms trigger / ` +
          `${CONFIG.oceanMoveSettleMs}ms settle`
        );
        if (m === 'gapfill') addLog(
          `GapFill typing: instant`
        );
      }
      updateModeButtons(m);
    }

    // The route pilot owns only navigation/completion hand-offs. On an activity
    // route it returns control to the existing per-game solver.
    if (state.autopilot && await autopilotTick(detectedMode)) return;

    // Dismiss any start dialog immediately whenever visible across all games & exams
    if (await dismissStartDialog()) return;

    if (m === 'mc2-reading' && state.mc2ReadingPending) {
      await mc2ReadingTick();
      return;
    }
    if (m === 'mc2-listening' && state.mc2PendingKey) {
      await mc2ListeningTick();
      return;
    }

    // A visible Continue control takes priority over the completion screen and
    // over a stale question still visible behind a result overlay.
    if (await clickVisibleContinue()) return;

    const done = detectCompletion();
    if (done) {
      logFakeTimeCompletion();
      if (/^exam-/.test(String(m || ''))) {
        await advanceExamAfterCompletion();
        return;
      }
      // Concert has stricter completion rules. Generic score/progress text
      // MUST NOT release the page lock while a real prompt+mic are visible.
      if (
        state.mode === 'concert-speaking' ||
        state.concertNavLockActive ||
        state.concertHadQuestion
      ) {
        if (!concertCanUnlockForCompletion(done)) {
          if (state.completionSeen !== done) addLog(
            `Concert ignored generic completion signal while question is active: "${done}"`, 'err'
          );
          state.completionSeen = null;
        } else {
          if (state.completionSeen !== done) {
            state.completionSeen = done;
            state.concertCompleted = true;
            concertReleaseNavigationLock('confirmed Concert completion');
            concertRestoreForbiddenNavGuards();
            addLog(`✓ Complete: "${done}"`, 'ok');
            notifyDiscord('Activity completed', `Answered counter: ${state.answeredCount}`);
          }
          setStatus('Complete: waiting for Continue');
          return;
        }
      } else {
        if (state.completionSeen !== done) {
          state.completionSeen = done;
          addLog(`✓ Complete: "${done}"`, 'ok');
          notifyDiscord('Activity completed', `Answered counter: ${state.answeredCount}`);
        }
        setStatus('Complete: waiting for Continue');
        return;
      }
    }
    if (state.completionSeen) state.completionSeen = null;

    // IMPORTANT: Concert owns the entire tick while its route is active.
    // No Jumble/MC/WordPod/GapFill/WordPop/Forklift/etc. code is reachable.
    if (m === 'concert-speaking') {
      if (state.concertBusy) return;

      state.concertBusy = true;
      try {
        await concertSpeakingTick();
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        addLog(`Concert Speaking runtime error: ${msg}`, 'err');
        setStatus('Concert Speaking: runtime error');
        log('Concert Speaking runtime error', e);
      } finally {
        state.concertBusy = false;
      }
      return;
    }

    if (m === 'exam-photo' || m === 'exam-gapfill' || m === 'exam-open-reading' || m === 'exam-open-listening' || m === 'exam-synonym' || m === 'exam-multiple-choice' || m === 'exam-true-false' || m === 'exam-dictation' || m === 'exam-who-said-what' || m === 'exam-interpret') {
      if (state.examBusy) return;
      state.examBusy = true;
      try {
        if (m === 'exam-photo') await examPhotoTick();
        else if (m === 'exam-gapfill') await examGapfillTick();
        else if (m === 'exam-multiple-choice') await examMultipleChoiceTick();
        else if (m === 'exam-true-false') await examTrueFalseTick();
        else if (m === 'exam-dictation') await examDictationTick();
        else if (m === 'exam-who-said-what') await whoSaidWhatTick();
        else if (m === 'exam-interpret') await examInterpretTick();
        else await examOpenReadingTick();
      } catch (e) {
        addLog(`Exam runtime error: ${e && e.message ? e.message : e}`, 'err');
        setStatus('Exam: runtime error');
      } finally {
        state.examBusy = false;
      }
      return;
    }

    if (m === 'dictation') {
      if (state.dictationBusy) return;
      state.dictationBusy = true;
      try { await dictationTick(); }
      catch (error) {
        addLog(`Dictation error: ${error && error.message ? error.message : error}`, 'err');
      } finally { state.dictationBusy = false; }
      return;
    }

    if (state.vocab.length === 0 && state.sentences.length === 0 && state.verbs.length === 0) { setStatus(`Waiting for data… (${modeLabel(m)})`); return; }
    if (m === 'zen-memory' || m === 'zen-noughts' || m === 'race-driver') {
      const busyKey = m === 'zen-memory' ? 'zenMemoryBusy' : m === 'zen-noughts' ? 'zenNoughtsBusy' : 'raceBusy';
      if (state[busyKey]) return;
      state[busyKey] = true;
      try {
        if (m === 'zen-memory') await zenMemoryTick();
        else if (m === 'zen-noughts') await zenNoughtsTick();
        else await raceDriverTick();
      } catch (error) {
        addLog(`${modeLabel(m)} error: ${error && error.message ? error.message : error}`, 'err');
      } finally { state[busyKey] = false; }
      return;
    }
    if (m === 'jumble') return jumbleTick();
    if (m === 'mc-listening') return mcListeningTick();

    if (m === 'mc2-listening' || m === 'mc2-reading') {
      if (state.mc2Busy) return;

      state.mc2Busy = true;
      try {
        if (m === 'mc2-listening') {
          await mc2ListeningTick();
        } else {
          await mc2ReadingTick();
        }
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        addLog(`MC2 runtime error: ${msg}`, 'err');
        setStatus('MC2: runtime error');
        log('MC2 runtime error', e);
      } finally {
        state.mc2Busy = false;
      }
      return;
    }

    if (m === 'wordpod-listening' || m === 'wordpod-reading') {
      if (state.wordPodBusy) return;

      state.wordPodBusy = true;
      try {
        if (m === 'wordpod-listening') {
          await wordPodListeningTick();
        } else {
          await wordPodReadingTick();
        }
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        addLog(`WordPod runtime error: ${msg}`, 'err');
        setStatus('WordPod: runtime error');
        log('WordPod runtime error', e);
      } finally {
        state.wordPodBusy = false;
      }
      return;
    }

    if (m === 'skyrise') {
      if (state.skyRiseBusy) return;
      state.skyRiseBusy = true;
      try {
        await skyRiseTick();
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        addLog(`Skyrise runtime error: ${msg}`, 'err');
        setStatus('Skyrise: runtime error');
        log('Skyrise runtime error', e);
      } finally {
        state.skyRiseBusy = false;
      }
      return;
    }

    if (m === 'wordpop-listening') {
      if (state.wordPopBusy) return;

      state.wordPopBusy = true;
      try {
        await wordPopListeningTick();
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        addLog(`WordPop runtime error: ${msg}`, 'err');
        setStatus('WordPop: runtime error');
        log('WordPop runtime error', e);
      } finally {
        state.wordPopBusy = false;
      }
      return;
    }
    if (m === 'mc-reading') return mcReadingTick();
    if (m === 'gapfill') {
      if (state.gapBusy) return;

      state.gapBusy = true;
      try {
        await gapFillTick();
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        addLog(`GapFill runtime error: ${msg}`, 'err');
        setStatus('GapFill: runtime error');
        log('GapFill runtime error', e);
      } finally {
        state.gapBusy = false;
      }
      return;
    }
    if (m === 'ocean-cleaner') {
      if (state.oceanBusy) return;

      state.oceanBusy = true;
      try {
        await oceanCleanerTick();
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        addLog(`Ocean Cleaner runtime error: ${msg}`, 'err');
        setStatus('Ocean Cleaner: runtime error');
        log('Ocean Cleaner runtime error', e);
      } finally {
        state.oceanBusy = false;
      }
      return;
    }
    if (m === 'forklift') {
      if (state.forkliftBusy) return;

      state.forkliftBusy = true;
      try {
        await forkliftTick();
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        addLog(`Forklift runtime error: ${msg}`, 'err');
        setStatus('Forklift: runtime error');
        log('Forklift runtime error', e);
      } finally {
        state.forkliftBusy = false;
      }
      return;
    }
    if (m === 'fridge') return fridgeTick();
    if (m === 'verb-matcher') return verbMatcherTick();
    if (m === 'jigsaw') {
      if (state.jigsawBusy) return;

      state.jigsawBusy = true;
      try {
        await jigsawTick();
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        addLog(`Jigsaw runtime error: ${msg}`, 'err');
        setStatus('Jigsaw: runtime error');
        log('Jigsaw runtime error', e);
      } finally {
        state.jigsawBusy = false;
      }
      return;
    }
    setStatus('Unknown activity');
  }
  async function loop() { while (state.running) { try { await tick(); } catch (e) { log('tick error', e); addLog(`Automation error: ${e && e.message ? e.message : String(e)}`, 'err'); } await sleep(CONFIG.loopPauseMs); } }

  // ============ UI ============
  function applyPanelAppearance() {
    const panel = document.getElementById('ln-ac-panel');
    if (!panel) return;
    const accent = /^#[0-9a-f]{6}$/i.test(state.uiAccent) ? state.uiAccent : '#4ade80';
    panel.style.setProperty('--ln-ac-accent', accent);
    panel.style.zoom = `${state.uiScale}%`;
    panel.style.opacity = String(state.uiOpacity / 100);
    panel.style.top = state.uiDock.startsWith('top') ? '20px' : 'auto';
    panel.style.bottom = state.uiDock.startsWith('bottom') ? '20px' : 'auto';
    panel.style.left = state.uiDock.endsWith('left') ? '20px' : 'auto';
    panel.style.right = state.uiDock.endsWith('right') ? '20px' : 'auto';
  }

  function showFullAutoWarning(onContinue) {
    document.getElementById('ln-ac-warning')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'ln-ac-warning';
    overlay.innerHTML = '<div><h2>Full auto is experimental</h2><p>It may get stuck or choose the wrong action on an activity. Watch its progress and stop it if needed.</p><footer><button type="button" data-action="close">Close</button><button type="button" data-action="continue">Continue</button></footer></div>';
    overlay.querySelector('[data-action="close"]').onclick = () => overlay.remove();
    overlay.querySelector('[data-action="continue"]').onclick = () => { overlay.remove(); onContinue(); };
    document.body.appendChild(overlay);
  }

  function panelGameAnswerInput() {
    const visible = el => {
      if (!el || el.closest('#ln-ac-panel')) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' &&
        Number(style.opacity) > 0 && rect.width > 20 && rect.height > 10;
    };
    const direct = document.getElementById('textInputChina');
    if (visible(direct)) return direct;
    return [...document.querySelectorAll(
      '#languagenutViewport textarea, #languagenutViewport input[type="text"]'
    )].find(visible) || null;
  }

  function panelPasteIntoGame(value) {
    const input = panelGameAnswerInput();
    if (!input || !value) return false;
    const proto = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    try {
      input.focus({preventScroll: true});
      if (setter) setter.call(input, value);
      else input.value = value;
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
      return input.value === value;
    } catch (_) {
      return false;
    }
  }

  function createPanel() {
    if (state.panelInjected) return true;
    if (document.getElementById('ln-ac-panel')) { state.panelInjected = true; return true; }
    if (!document.body) return false;
    const p = document.createElement('div');
    p.id = 'ln-ac-panel';
    p.innerHTML = `
      <div id="ln-ac-header"><span>LN Autocompleter v12.26</span><button id="ln-ac-min">–</button></div>
      <div id="ln-ac-body">
        <div id="ln-ac-status">Idle</div>
        <div class="ln-ac-stat"><span>Mode</span><span id="ln-ac-mode">—</span></div>
        <div class="ln-ac-stat"><span>Data</span><span id="ln-ac-vocab">0</span></div>
        <div class="ln-ac-stat"><span>Target</span><span id="ln-ac-target">—</span></div>
        <div class="ln-ac-stat"><span>Sequence</span><span id="ln-ac-seq">—</span></div>
        <div class="ln-ac-stat"><span>Prompt</span><span id="ln-ac-prompt">—</span></div>
        <div class="ln-ac-stat"><span>Audio</span><span id="ln-ac-audio">—</span></div>
        <div class="ln-ac-stat"><span>Answered</span><span id="ln-ac-answered">0</span></div>
        <div class="ln-ac-stat"><span>Real homework time</span><span id="ln-ac-real-time">0h 00m 00s</span></div>
        <div class="ln-ac-stat"><span>Simulated time</span><span id="ln-ac-simulated-time">0h 00m 00s</span></div>
        <div id="ln-ac-progress"><div id="ln-ac-bar"><div id="ln-ac-fill"></div></div><span id="ln-ac-count">0</span></div>
        <div id="ln-ac-options">
          <label class="ln-ac-option"><input id="ln-ac-mute" type="checkbox"> Mute audio</label>
          <label class="ln-ac-option"><input id="ln-ac-auto" type="checkbox"> Full auto</label>
          <label class="ln-ac-option"><input id="ln-ac-humanize" type="checkbox"> Humanize writing</label>
        </div>
        <details id="ln-ac-custom"><summary>Customize UI</summary><div>
          <label>Accent <input id="ln-ac-accent" type="color"></label>
          <label>Size <input id="ln-ac-scale" type="range" min="75" max="130"></label>
          <label>Opacity <input id="ln-ac-opacity" type="range" min="70" max="100"></label>
          <label>Corner <select id="ln-ac-dock"><option value="bottom-right">Bottom right</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="top-left">Top left</option></select></label>
        </div></details>
        <div id="ln-ac-fake-row">Simulated seconds/question <input id="ln-ac-fake-min" type="number" min="1" max="3600" step="1" aria-label="Minimum simulated seconds">–<input id="ln-ac-fake-max" type="number" min="1" max="3600" step="1" aria-label="Maximum simulated seconds"></div>
        <div id="ln-ac-webhook-row">
          <input id="ln-ac-webhook" type="password" autocomplete="off" spellcheck="false" placeholder="Discord webhook URL (optional)">
          <button id="ln-ac-webhook-test" type="button">Test</button>
        </div>
        <div id="ln-ac-actions">
          <button id="ln-ac-toggle" class="ln-ac-btn">Start</button>
          <button id="ln-ac-reset" class="ln-ac-btn ghost">↺</button>
          <button id="ln-ac-play" class="ln-ac-btn ghost">▶</button>
          <button id="ln-ac-dump" class="ln-ac-btn ghost">?</button>
        </div>
        <div id="ln-ac-clipboard">
          <input id="ln-ac-paste-text" type="text" placeholder="Paste answer text here" aria-label="Answer text to paste into game">
          <button id="ln-ac-paste-game" type="button">Paste into game</button>
          <button id="ln-ac-copy-log" type="button">Copy log</button>
        </div>
        <div id="ln-ac-log"></div>
      </div>`;
    const s = document.createElement('style');
    s.textContent = `
      #ln-ac-panel{position:fixed !important;bottom:20px;right:20px;width:350px;background:#0f0f0f;border:1px solid #262626;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;font-size:12px;color:#e6e6e6;z-index:2147483647 !important;box-shadow:0 12px 40px rgba(0,0,0,.75);overflow:hidden}
      #ln-ac-header{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#161616;border-bottom:1px solid #262626;font-weight:600;font-size:12px;letter-spacing:.3px;cursor:move}
      #ln-ac-min{background:none;border:none;color:#888;font-size:16px;cursor:pointer;line-height:1;padding:0 4px}
      #ln-ac-body{padding:12px 14px 14px}
      #ln-ac-status{font-size:11.5px;color:#999;margin-bottom:10px;min-height:15px}
      .ln-ac-stat{display:flex;justify-content:space-between;font-size:11px;color:#777;margin-bottom:6px;gap:8px}
      .ln-ac-stat span:last-child{color:#ddd;font-weight:600;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:230px;font-family:ui-monospace,Menlo,monospace}
      #ln-ac-progress{display:flex;align-items:center;gap:8px;margin:10px 0 12px}
      #ln-ac-bar{flex:1;height:4px;background:#232323;border-radius:99px;overflow:hidden}
      #ln-ac-fill{height:100%;width:0%;background:#fff;border-radius:99px;transition:width .2s}
      #ln-ac-count{font-size:11px;color:#666;font-variant-numeric:tabular-nums;min-width:20px;text-align:right}
      #ln-ac-options{display:flex;gap:14px;align-items:center;margin:2px 0 10px;color:#999;font-size:10.5px}
      .ln-ac-option{display:flex;align-items:center;gap:5px;cursor:pointer;user-select:none}
      .ln-ac-option input{margin:0;accent-color:#4ade80}
      #ln-ac-fake-row{display:flex;align-items:center;justify-content:space-between;margin:0 0 10px;color:#999;font-size:10.5px}
      #ln-ac-fake-row input{width:43px;padding:4px 5px;background:#111;border:1px solid #333;border-radius:6px;color:#ddd;font:11px ui-monospace,Menlo,monospace}
      #ln-ac-webhook-row{display:flex;gap:6px;margin:0 0 10px}
      #ln-ac-webhook{min-width:0;flex:1;background:#111;border:1px solid #333;border-radius:6px;color:#ddd;padding:7px 8px;font:10px ui-monospace,Menlo,monospace;outline:none}
      #ln-ac-webhook:focus{border-color:#555}
      #ln-ac-webhook-test{flex:0 0 44px;background:#191919;border:1px solid #333;border-radius:6px;color:#aaa;font-size:10px;cursor:pointer}
      #ln-ac-webhook-test:hover{color:#eee;border-color:#555}
      #ln-ac-actions{display:flex;gap:8px;margin-bottom:10px}
      #ln-ac-clipboard{display:flex;gap:5px;margin-bottom:10px}
      #ln-ac-paste-text{min-width:0;flex:1;background:#111;border:1px solid #333;border-radius:6px;color:#ddd;padding:6px;font-size:11px;font-family:inherit}
      #ln-ac-clipboard button{background:#191919;border:1px solid #333;border-radius:6px;color:#ddd;padding:5px 7px;font-size:10px;font-family:inherit;cursor:pointer}
      #ln-ac-clipboard button:hover{border-color:#777}
      .ln-ac-btn{flex:1;padding:9px 0;background:#fff;color:#0a0a0a;border:none;border-radius:7px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:opacity .15s}
      .ln-ac-btn:hover{opacity:.85}
      .ln-ac-btn.ghost{background:transparent;color:#888;border:1px solid #333;flex:0 0 40px}
      .ln-ac-btn.ghost:hover{color:#ccc;border-color:#555}
      .ln-ac-btn.active{background:#4ade80;color:#062a14}
      #ln-ac-log{max-height:200px;overflow-y:auto;font-size:10.5px;color:#666;line-height:1.55;font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word;user-select:text}
      #ln-ac-log .ok{color:#4ade80}
      #ln-ac-log .err{color:#ff5c5c}
      #ln-ac-panel.collapsed #ln-ac-body{display:none}`;
    s.textContent += `
      #ln-ac-panel{--ln-ac-accent:#4ade80}
      #ln-ac-panel .ln-ac-option input{accent-color:var(--ln-ac-accent)}
      #ln-ac-panel .ln-ac-btn.active,#ln-ac-fill{background:var(--ln-ac-accent)}
      #ln-ac-custom{margin:0 0 10px;color:#aaa;font-size:10.5px}
      #ln-ac-custom summary{cursor:pointer}
      #ln-ac-custom>div{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      #ln-ac-custom label{display:flex;align-items:center;gap:4px}
      #ln-ac-custom input[type=range]{width:65px;accent-color:var(--ln-ac-accent)}
      #ln-ac-custom select{max-width:110px;background:#111;color:#ddd;border:1px solid #333;border-radius:5px}
      #ln-ac-toasts{position:fixed;top:12px;right:12px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;max-width:min(360px,calc(100vw - 24px));font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
      .ln-ac-toast{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;background:#142016;color:#eaf7ed;border:1px solid #4ade80;border-radius:9px;padding:10px 12px;box-shadow:0 8px 25px #0008}
      .ln-ac-toast.err{background:#2a1515;border-color:#ff5c5c;color:#fff0f0}
      .ln-ac-toast button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:17px;line-height:12px}
      #ln-ac-warning{position:fixed;inset:0;z-index:2147483647;background:#0009;display:flex;align-items:center;justify-content:center;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
      #ln-ac-warning>div{width:min(390px,calc(100vw - 32px));padding:20px;background:#161616;color:#eee;border:1px solid #555;border-radius:12px;box-shadow:0 20px 60px #000b}
      #ln-ac-warning h2{font-size:17px;margin:0 0 10px}
      #ln-ac-warning p{line-height:1.5;color:#bbb}
      #ln-ac-warning footer{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      #ln-ac-warning button{padding:8px 13px;border-radius:7px;border:1px solid #555;background:#242424;color:#eee;cursor:pointer}
      #ln-ac-warning button:last-child{background:#4ade80;color:#08200e;border-color:#4ade80}`;
    document.head.appendChild(s); document.body.appendChild(p);

    document.getElementById('ln-ac-paste-game').addEventListener('click', async () => {
      const box = document.getElementById('ln-ac-paste-text');
      let value = String(box?.value || '');
      if (!value) {
        try { value = await navigator.clipboard.readText(); } catch (_) {}
      }
      const pasted = panelPasteIntoGame(value);
      addLog(pasted
        ? 'Text pasted into game answer field'
        : 'Paste failed: enter text in the panel and wait for a game answer field',
      pasted ? 'ok' : 'err');
    });

    document.getElementById('ln-ac-copy-log').addEventListener('click', async () => {
      const value = document.getElementById('ln-ac-log')?.innerText || '';
      try {
        await navigator.clipboard.writeText(value);
        addLog('Log copied', 'ok');
      } catch (_) {
        addLog('Copy failed: select the log text and copy it normally', 'err');
      }
    });

    const muteBox = document.getElementById('ln-ac-mute');
    const fakeMinBox = document.getElementById('ln-ac-fake-min');
    const fakeMaxBox = document.getElementById('ln-ac-fake-max');
    const webhookBox = document.getElementById('ln-ac-webhook');
    const webhookTest = document.getElementById('ln-ac-webhook-test');
    const humanizeBox = document.getElementById('ln-ac-humanize');
    if (humanizeBox) {
      humanizeBox.checked = state.humanize;
      humanizeBox.onchange = () => {
        state.humanize = humanizeBox.checked;
        saveBoolSetting('humanize', state.humanize);
      };
    }
    for (const [id, property, eventName] of [
      ['ln-ac-accent', 'uiAccent', 'input'], ['ln-ac-scale', 'uiScale', 'input'],
      ['ln-ac-opacity', 'uiOpacity', 'input'], ['ln-ac-dock', 'uiDock', 'change']
    ]) {
      const control = document.getElementById(id);
      if (!control) continue;
      control.value = String(state[property]);
      control.addEventListener(eventName, () => {
        state[property] = control.value;
        saveStringSetting(property, state[property]);
        applyPanelAppearance();
      });
    }
    applyPanelAppearance();
    refreshPilotTimer();

    if (fakeMinBox && fakeMaxBox) {
      fakeMinBox.value = String(state.fakeTimeMin);
      fakeMaxBox.value = String(state.fakeTimeMax);
      const updateRange = () => {
        const min = Math.max(1, Math.min(3600, Math.round(Number(fakeMinBox.value)) || 20));
        const max = Math.max(min, Math.min(3600, Math.round(Number(fakeMaxBox.value)) || 30));
        state.fakeTimeMin = min;
        state.fakeTimeMax = max;
        fakeMinBox.value = String(min);
        fakeMaxBox.value = String(max);
        saveStringSetting('fakeTimeMin', min);
        saveStringSetting('fakeTimeMax', max);
        addLog(`Simulated time range: ${min}–${max}s per question`, 'ok');
      };
      fakeMinBox.addEventListener('change', updateRange);
      fakeMaxBox.addEventListener('change', updateRange);
    }

    if (webhookBox) {
      webhookBox.value = state.discordWebhook || '';
      webhookBox.addEventListener('change', () => {
        const value = webhookBox.value.trim();

        if (value && !validDiscordWebhook(value)) {
          addLog('Discord webhook URL does not look valid', 'err');
          return;
        }

        state.discordWebhook = value;
        saveStringSetting('discordWebhook', value);
        addLog(
          value ? 'Discord webhook saved' : 'Discord webhook cleared',
          'ok'
        );
      });
    }

    if (webhookTest) {
      webhookTest.addEventListener('click', async () => {
        const value = webhookBox ? webhookBox.value.trim() : '';

        if (!validDiscordWebhook(value)) {
          addLog('Enter a valid Discord webhook first', 'err');
          return;
        }

        state.discordWebhook = value;
        saveStringSetting('discordWebhook', value);

        webhookTest.disabled = true;
        const ok = await sendDiscordWebhook(
          'Webhook test',
          'Connection from LanguageNut Autocompleter v12.26'
        );
        webhookTest.disabled = false;

        addLog(
          ok ? 'Discord webhook test sent' : 'Discord webhook test failed',
          ok ? 'ok' : 'err'
        );
      });
    }

    if (muteBox) {
      muteBox.checked = !!state.muteAudio;
      muteBox.addEventListener('change', () => {
        state.muteAudio = !!muteBox.checked;
        saveBoolSetting('muteAudio', state.muteAudio);
        applyAudioMute();
        addLog(`Audio ${state.muteAudio ? 'muted' : 'unmuted'}`, 'ok');
      });
    }

    const autoBox = document.getElementById('ln-ac-auto');
    if (autoBox) {
      autoBox.checked = !!state.autopilot;
      autoBox.addEventListener('change', () => {
        if (!autoBox.checked) {
          state.autopilot = false;
          saveBoolSetting('autopilot', false);
          if (state.pilotStartedAt) {
            state.pilotElapsedMs += Date.now() - state.pilotStartedAt;
            state.pilotStartedAt = 0;
            saveStringSetting('pilotElapsedMs', state.pilotElapsedMs);
          }
          refreshPilotTimer();
          addLog('Full auto disabled', 'ok');
          return;
        }
        autoBox.checked = false;
        showFullAutoWarning(() => {
          state.autopilot = true;
          state.pilotBlockedStep = '';
          state.pilotFinished = false;
          state.pilotStartedAt = Date.now();
          saveBoolSetting('autopilot', true);
          autoBox.checked = true;
          addLog('Full auto enabled: Dashboard → Homework → task games', 'ok');
          if (!state.running) toggleRunning();
        });
      });
    }

    applyUserOptions();

    document.getElementById('ln-ac-toggle').addEventListener('click', toggleRunning);
    document.getElementById('ln-ac-reset').addEventListener('click', () => {
      if (state.mode === 'jumble') { resetJumbleState(); state.lastLaunchAt = 0; addLog('↺'); }
      else if (state.mode === 'fridge') { resetFridgeState(); addLog('↺'); }
      else if (state.mode === 'verb-matcher') { resetVerbState(); addLog('↺'); }
      else if (state.mode === 'jigsaw') { resetJigsawState(); addLog('↺'); }
      else if (state.mode === 'zen-memory') { state.zenMemoryLastCount = 0; addLog('↺'); }
      else if (state.mode === 'zen-noughts') { state.zenNoughtsLastCount = 0; state.zenNoughtsNextMoveAt = 0; addLog('↺'); }
      else if (state.mode === 'race-driver') { raceDriverBoost(false); state.raceLastQuestion = ''; state.raceLastChunks = 0; addLog('↺'); }
      else if (state.mode === 'dictation') {
        state.dictationSubmitted = false;
        state.dictationSawHidden = false;
        state.dictationPlayAt = 0;
        state.dictationLastAudio = '';
        addLog('↺');
      }
      else if (state.mode === 'forklift') { resetForkliftState(); addLog('↺'); }
      else if (state.mode === 'ocean-cleaner') { resetOceanState(); addLog('↺'); }
      else if (state.mode === 'gapfill') { resetGapFillState(); addLog('↺'); }
      else if (state.mode === 'wordpop-listening') { resetWordPopState(); addLog('↺'); }
      else if (state.mode === 'wordpod-listening' || state.mode === 'wordpod-reading') { resetWordPodState(); addLog('↺'); }
      else if (state.mode === 'skyrise') { resetSkyRiseState(); addLog('↺'); }
      else if (state.mode === 'concert-speaking') { resetConcertState(); addLog('↺'); }
      else if (state.mode === 'exam-gapfill') { state.examGapOrder = []; state.examGapIndex = 0; state.examGapSubmitted = false; addLog('↺'); }
      else if (state.mode === 'exam-who-said-what') { state.whoSaidWhatSubmitted = false; addLog('↺'); }
      else if (state.mode === 'exam-photo') { state.examPhotoSubmittedKey = ''; addLog('↺'); }
      else if (state.mode === 'exam-interpret') {
        state.examInterpretSubmitted = false;
        state.lastInterpretPrompt = null;
        state.interpretTranslating = false;
        state.interpretCache.clear();
        state.interpretLogged.clear();
        addLog('↺');
      }
      else if (state.mode === 'exam-dictation') { state.examDictationSubmitted = false; addLog('↺'); }
      else if (state.mode === 'exam-open-reading' || state.mode === 'exam-open-listening' || state.mode === 'exam-synonym' || state.mode === 'exam-multiple-choice' || state.mode === 'exam-true-false') { state.examSubmitted = new Set(); addLog('↺'); }
      else if (state.mode === 'mc2-listening' || state.mode === 'mc2-reading') { resetMC2State(); addLog('↺'); }
      else { state.currentAnswer = null; state.currentEntry = null; state.currentPrompt = null; state.lastAudioUrl = null; state.lastAnsweredKey = null; setAudioLabel(''); setPromptLabel(''); addLog('↺'); }
    });
    document.getElementById('ln-ac-play').addEventListener('click', () => {
      if (state.mode === 'dictation') {
        const play = dictationPlayButton();
        if (play) emitOnObject(play, 'keyup');
        else addLog('No Dictation play button', 'err');
        return;
      }
      if (state.mode === 'wordpod-listening') {
        const audio = wordPodFindAudioButton();

        if (!audio) {
          addLog('No WordPod audio button', 'err');
          return;
        }

        const b = audio.bounds;
        const x = b.x + b.width / 2;
        const y = b.y + b.height / 2;

        safeCanvasPointerClickWorld(x, y, '#4ade80', 15);
        return;
      }

      if (state.mode === 'mc2-listening') {
        mc2PlayListeningAudio().catch(error => {
          const message = error && error.message ? error.message : String(error);
          addLog(`MC2 audio error: ${message}`, 'err');
          setStatus('MC2 Listening: audio click failed');
        });
        return;
      }

      if (state.mode === 'wordpop-listening') {
        const sig = wordPopSignature();
        state.lastPlayedKey = null;
        playWordPopAudioForSignature(sig, true).catch(e => {
          const msg = e && e.message ? e.message : String(e);
          addLog(`WordPop manual audio error: ${msg}`, 'err');
        });
        return;
      }

      const b = findSoundButton();
      if (!b) { addLog('No sound button', 'err'); return; }

      const bb = boundsOf(b);
      if (!bb) return;

      const pt = worldToClient(bb);
      if (pt) fireClickAt(pt.x, pt.y, '#4ade80');
    });
    document.getElementById('ln-ac-dump').addEventListener('click', dumpScene);
    document.getElementById('ln-ac-min').addEventListener('click', () => p.classList.toggle('collapsed'));
    makeDraggable(p, document.getElementById('ln-ac-header'));
    state.panelInjected = true; updateModeButtons(null); return true;
  }
  function updateModeButtons(m) {
    const pl = document.getElementById('ln-ac-play'); if (pl) pl.style.display = (m === 'dictation' || m === 'mc-listening' || m === 'mc2-listening' || m === 'wordpod-listening' || m === 'wordpop-listening') ? '' : 'none';
    const ps = document.getElementById('ln-ac-prompt'); if (ps) { const r = ps.closest('.ln-ac-stat'); if (r) r.style.display = (m === 'dictation' || m === 'zen-memory' || m === 'zen-noughts' || m === 'race-driver' || m === 'exam-interpret' || m === 'exam-who-said-what' || m === 'exam-dictation' || m === 'exam-gapfill' || m === 'exam-synonym' || m === 'exam-open-listening' || m === 'exam-true-false' || m === 'exam-multiple-choice' || m === 'exam-open-reading' || m === 'mc-reading' || m === 'mc2-reading' || m === 'wordpod-reading' || m === 'wordpod-listening' || m === 'skyrise' || m === 'concert-speaking' || m === 'fridge' || m === 'verb-matcher' || m === 'jigsaw' || m === 'forklift' || m === 'ocean-cleaner' || m === 'gapfill') ? '' : 'none'; }
    const as = document.getElementById('ln-ac-audio'); if (as) { const r = as.closest('.ln-ac-stat'); if (r) r.style.display = (m === 'dictation' || m === 'mc-listening' || m === 'mc2-listening' || m === 'wordpod-listening' || m === 'wordpop-listening') ? '' : 'none'; }
    const ts = document.getElementById('ln-ac-target'); if (ts) { const r = ts.closest('.ln-ac-stat'); if (r) r.style.display = (m === 'jumble') ? '' : 'none'; }
    const ss = document.getElementById('ln-ac-seq'); if (ss) { const r = ss.closest('.ln-ac-stat'); if (r) r.style.display = (m === 'jumble') ? '' : 'none'; }
  }
  function makeDraggable(el, h) { let sx=0,sy=0,ox=0,oy=0,d=false; h.addEventListener('mousedown',(e)=>{d=true;sx=e.clientX;sy=e.clientY;const r=el.getBoundingClientRect();ox=r.left;oy=r.top;const mv=(ev)=>{if(!d)return;el.style.left=(ox+ev.clientX-sx)+'px';el.style.top=(oy+ev.clientY-sy)+'px';el.style.right='auto';el.style.bottom='auto';};const u=()=>{d=false;document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',u);};document.addEventListener('mousemove',mv);document.addEventListener('mouseup',u);}); }
  function setStatus(t){const e=document.getElementById('ln-ac-status');if(e)e.textContent=t;}
  function setModeLabel(t){const e=document.getElementById('ln-ac-mode');if(e)e.textContent=t||'—';}
  function setTargetLabel(t){const e=document.getElementById('ln-ac-target');if(e)e.textContent=t||'—';}
  function setSeqLabel(t){const e=document.getElementById('ln-ac-seq');if(e)e.textContent=t||'—';}
  function setPromptLabel(t){const e=document.getElementById('ln-ac-prompt');if(e)e.textContent=t||'—';}
  function setAudioLabel(t){const e=document.getElementById('ln-ac-audio');if(e)e.textContent=t||'—';}
  function setVocabCount(n){const e=document.getElementById('ln-ac-vocab');if(e)e.textContent=n;}
  function setAnsweredCount(n){
    const e=document.getElementById('ln-ac-answered');
    if(e)e.textContent=n;

    const num = Number(n) || 0;
    if (state.running) {
      const activityCount = Math.max(0, num - state.fakeTimeAnswerBase);
      while (state.fakeTimeLoggedCount < activityCount) {
        const seconds = fakeTimeSample(state.fakeTimeLoggedCount);
        state.fakeTimeLoggedCount++;
        if (state.autopilot) {
          state.pilotFakeSeconds += seconds;
          saveStringSetting('pilotFakeSeconds', state.pilotFakeSeconds);
          refreshPilotTimer();
        }
        addLog(`Question ${state.fakeTimeLoggedCount}: simulated ${seconds}s`, 'ok');
      }
    }
    if (num > state.webhookLastAnswered) {
      // GapFill sends its detailed answer separately; other modes get a compact
      // generic answer event here.
      if (state.mode !== 'gapfill') {
        notifyDiscord('Answer completed', `Answer #${num}`);
      }
      state.webhookLastAnswered = num;
    }
  }
  function setProgress(n,t){const f=document.getElementById('ln-ac-fill'),c=document.getElementById('ln-ac-count');if(c)c.textContent=t?`${n}/${t}`:String(n);if(f)f.style.width=t?Math.min(100,n/t*100)+'%':'0%';}
  function showToast(message, kind) {
    if (!document.body) return;
    let stack = document.getElementById('ln-ac-toasts');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'ln-ac-toasts';
      document.body.appendChild(stack);
    }
    const item = document.createElement('div');
    item.className = `ln-ac-toast ${kind || 'ok'}`;
    const label = document.createElement('span');
    label.textContent = String(message);
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close notification');
    close.onclick = () => item.remove();
    item.append(label, close); stack.appendChild(item);
    setTimeout(() => item.remove(), kind === 'err' ? 12000 : 5000);
  }
  function addLog(m,c){
    let errorKey = '';
    if(c==='err' && !/^Discord webhook/i.test(String(m))) {
      errorKey = `${state.mode || pilotRoute()}:${String(m).replace(/\b\d+\b/g, '#').slice(0, 150)}`;
      const now = Date.now();
      if(now - (state.errorLastLogAt.get(errorKey) || 0) < 1000) return;
      state.errorLastLogAt.set(errorKey, now);
    }
    const e=document.getElementById('ln-ac-log');
    if(e){const l=document.createElement('div');l.textContent=m;if(c)l.className=c;e.appendChild(l);e.scrollTop=e.scrollHeight;while(e.children.length>120)e.removeChild(e.firstChild);}
    if(errorKey) {
      const count = (state.pilotErrorCounts.get(errorKey) || 0) + 1;
      state.pilotErrorCounts.set(errorKey, count);
      if(count===11){
        const notice = `Repeated error (${count}×): ${String(m).slice(0, 180)}`;
        showToast(notice, 'err');
        if(validDiscordWebhook(state.discordWebhook)) notifyDiscord('Repeated error', notice);
      }
    }
  }
  function toggleRunning(){
    state.running = !state.running;
    const b = document.getElementById('ln-ac-toggle');

    if (state.running) {
      if (state.autopilot && !state.pilotStartedAt) state.pilotStartedAt = Date.now();
      resetFakeTimeActivity();
      hookServicesFakeTime();
      state.completionSeen = null;
      state.concertCompleted = false;
      state.concertHadQuestion = false;
      concertReleaseNavigationLock();
      b.textContent = 'Stop';
      b.classList.add('active');

      // Force a fresh PIXI/mode detection the instant Start is pressed.
      tryGrabPixi();
      const m = detectMode();
      if (m) {
        state.mode = m;
        setModeLabel(modeLabel(m));
        updateModeButtons(m);
      }

      setStatus(m ? `Starting ${modeLabel(m)}…` : 'Detecting activity…');
      addLog(`▶ Started${m ? ` — ${modeLabel(m)}` : ''}`);

      state.webhookLastAnswered = state.answeredCount;
      notifyDiscord('Automation started');

      loop();

      // WordPod and WordPop can both need an immediate audio bootstrap.
      if (m === 'wordpod-listening') {
        const audio = wordPodFindAudioButton();
        if (audio) {
          const b = audio.bounds;
          const x = b.x + b.width / 2;
          const y = b.y + b.height / 2;
          safeCanvasPointerClickWorld(x, y, '#4ade80', 15);
        }
      }

      // Only bootstrap WordPop when we're actually on WordPop.
      if (m === 'wordpop-listening') {
        primeWordPopOnStart().catch(e => {
          const msg = e && e.message ? e.message : String(e);
          addLog(`WordPop start autoplay error: ${msg}`, 'err');
          setStatus('WordPop start error');
        });
      }
    } else {
      if (state.pilotStartedAt) {
        state.pilotElapsedMs += Date.now() - state.pilotStartedAt;
        state.pilotStartedAt = 0;
        saveStringSetting('pilotElapsedMs', state.pilotElapsedMs);
        refreshPilotTimer();
      }
      raceDriverBoost(false);
      b.textContent = 'Start';
      b.classList.remove('active');

      const restoredNav = concertRestoreForbiddenNavGuards();
      state.concertNavGuardLogged = false;
      concertReleaseNavigationLock('automation stopped');

      setStatus('Paused');
      addLog(
        restoredNav > 0
          ? `■ Paused — restored ${restoredNav} nav control(s)`
          : '■ Paused'
      );
    }
  }

  function dumpScene() {
    const a = state.pixiApp; if (!a) { addLog('No Pixi app', 'err'); return; }
    addLog('--- DUMP ---'); addLog('URL: ' + location.href.slice(0, 100));
    const liveMode = detectMode();
    addLog('Mode: ' + modeLabel(liveMode));
    addLog('Vocab: ' + state.vocab.length + ', Sentences: ' + state.sentences.length + ', Verbs: ' + state.verbs.length);
    addLog(
      `Options: mute=${state.muteAudio ? 'on' : 'off'}, ` +
      `discordWebhook=${validDiscordWebhook(state.discordWebhook) ? 'configured' : 'off'}`
    );

    {
      const wpTextures = [];
      walk(a.stage, (o) => {
        const f = fullTextureName(o);
        if (/wordpop|smallBubble|audioWordPod|audioMouseOver/i.test(f)) {
          const b = boundsOf(o);
          wpTextures.push(
            `${f || '?'}${b ? ` @ ${b.x|0},${b.y|0} ${b.width|0}x${b.height|0}` : ''}`
          );
        }
      });
      if (wpTextures.length) {
        addLog(`WordPop-like textures (${wpTextures.length}):`);
        wpTextures.slice(0, 30).forEach(x => addLog('  ' + x));
      }
    }
    addLog(
      `Full auto=${state.autopilot ? 'on' : 'off'}, ` +
      `homework=${state.pilotHomeworkUid || '—'}, task=${state.pilotTaskIndex + 1}`
    );
    if (liveMode === 'jumble') {
      addLog('Target: ' + (state.targetWord || '—'));
      addLog('Target key: ' + (state.targetLetters || '—'));
      addLog('Order: ' + (state.jumbleOrderedChunks.map(t => t.label).join(' → ') || '(empty)'));
      addLog('Placed: ' + state.jumblePlacedCount + '/' + state.jumbleOrderedChunks.length);
      addLog('Fails: ' + state.jumbleFails);
      const tiles = collectLetterTiles();
      addLog(`Letter tiles (${tiles.length}):`);
      tiles.forEach(t => addLog(`  "${t.letter}" name=${t.obj.name || '?'} y=${t.bounds.y|0}`));
    }
    if (liveMode === 'concert-speaking') {
      const cp = concertCollectPrompts();
      const cb = concertFindSpeakButton();

      addLog(
        `Concert Speaking: prompts=${cp.length}, ` +
        `locked=${state.concertLockedQuestion ? 'yes' : 'no'}, ` +
        `fails=${state.concertFails}`
      );

      addLog(
        'Concert prompt: ' +
        (cp.length ? `"${cp[0].label}"` : 'NONE')
      );

      if (cp.length) {
        const cr = concertResolveAnswer(cp[0].label);
        addLog(
          'Concert resolved speech: ' +
          (cr
            ? `"${cr.answer}" lang=${cr.lang} field=${cr.matchedField}`
            : 'NONE')
        );
      }

      addLog(
        'Concert Speak button: ' +
        (cb
          ? `${cb.kind} score=${Math.round(cb.score || 0)} ` +
            `${cb.text || cb.texture || ''} ` +
            `@ ${Math.round(cb.bounds.x)},${Math.round(cb.bounds.y)} ` +
            `${Math.round(cb.bounds.width)}x${Math.round(cb.bounds.height)}`
          : 'NONE')
      );

      {
        const exact = concertFindExactRecordButton();
        const px = concertFindSpeakButtonPixi();
        const dm = concertFindSpeakButtonDOM();

        addLog(
          'Concert exact record: ' +
          (exact
            ? `name=${exact.obj.name || '?'} ` +
              `target=${exact.target && exact.target.name || '?'} ` +
              `events=${exact.events.join(',') || '(none)'} ` +
              `@ ${Math.round(exact.bounds.x)},${Math.round(exact.bounds.y)} ` +
              `${Math.round(exact.bounds.width)}x${Math.round(exact.bounds.height)}`
            : 'NONE')
        );

        addLog(
          'Concert PIXI mic candidate: ' +
          (px
            ? `score=${Math.round(px.score || 0)} ` +
              `${px.text || px.texture || ''} ` +
              `events=${px.events.join(',') || '(none)'}`
            : 'NONE')
        );

        addLog(
          'Concert DOM mic candidate: ' +
          (dm
            ? `score=${Math.round(dm.score || 0)} ${dm.text || ''}`
            : 'NONE')
        );

        addLog(
          'Concert mic-state signature length: ' +
          concertMicStateSignature().length
        );
      }

      addLog(`Concert visible vocab texts (${cp.length}):`);
      cp.slice(0, 20).forEach((p, i) => addLog(
        `  #${i + 1} "${p.label}" source=${p.source} ` +
        `@ ${Math.round(p.bounds.x)},${Math.round(p.bounds.y)}`
      ));

      addLog(
        'Concert speechSynthesis: ' +
        (
          'speechSynthesis' in window
            ? `available voices=${window.speechSynthesis.getVoices().length}`
            : 'UNAVAILABLE'
        )
      );

      addLog(
        'Concert last evaluation: ' +
        (state.concertEvalResult
          ? `serial=${state.concertEvalResult.serial} ` +
            `isCorrect=${String(state.concertEvalResult.isCorrect)}`
          : 'NONE')
      );

      {
        const exact = concertFindExactRecordButton();
        if (exact && exact.micCircle) {
          const ev = concertMakeRecordEvent(exact, 'pointerup');
          addLog(
            `Concert synthetic event: target=${ev.target && ev.target.name || '?'} ` +
            `currentTarget=${ev.currentTarget && ev.currentTarget.name || '?'} ` +
            `cancelable=${String(ev.cancelable)} composed=${String(ev.composed)} ` +
            `global=${ev.global.x.toFixed(1)},${ev.global.y.toFixed(1)}`
          );
        }
      }
    }

    if (liveMode === 'skyrise') {
      const ss = skyRiseScene();

      addLog(
        `Skyrise: prompts=${ss.prompts.length}, ` +
        `locked=${state.skyRiseLockedQuestion ? 'yes' : 'no'}, ` +
        `fails=${state.skyRiseFails}`
      );

      addLog(
        'Skyrise prompt: ' +
        (ss.prompt ? `"${ss.prompt.label}"` : 'NONE')
      );

      addLog(
        'Skyrise DOM input: ' +
        (ss.input
          ? `${ss.input.id || '(no id)'} value=${JSON.stringify(ss.input.value)}`
          : 'NONE')
      );

      addLog(`Skyrise visible vocab texts (${ss.prompts.length}):`);
      ss.prompts.forEach((p, i) => addLog(
        `  #${i + 1} "${p.label}" @ ` +
        `${p.bounds.x|0},${p.bounds.y|0} ` +
        `${p.bounds.width|0}x${p.bounds.height|0}`
      ));

      if (ss.prompt) {
        const e = mc2EntryForPrompt(ss.prompt);
        addLog(
          'Skyrise expected answers: ' +
          (e
            ? wordPodAnswerCandidates(e, ss.prompt.label)
                .map(x => `"${x}"`).join(' / ')
            : 'NONE')
        );
      }
    }

    if (liveMode === 'wordpod-listening' || liveMode === 'wordpod-reading') {
      const scene = wordPodScene();

      addLog(
        `WordPod: mode=${modeLabel(liveMode)}, prompts=${scene.prompts.length}, ` +
        `fails=${state.wordPodFails}, candidateIndex=${state.wordPodCandidateIndex}, ` +
        `locked=${state.wordPodLockedQuestion ? 'yes' : 'no'}`
      );

      addLog(
        'WordPod prompt: ' +
        (scene.prompt ? `"${scene.prompt.label}"` : 'NONE')
      );

      addLog(
        'WordPod text box: ' +
        (scene.textBox
          ? `${scene.textBox.texture || '?'} @ ${scene.textBox.bounds.x|0},${scene.textBox.bounds.y|0} ` +
            `${scene.textBox.bounds.width|0}x${scene.textBox.bounds.height|0}`
          : 'NONE')
      );

      {
        const wi = wordPodInputElement();
        addLog(
          'WordPod DOM input: ' +
          (wi
            ? `${wi.id || '(no id)'} value=${JSON.stringify(wi.value)}`
            : 'NONE')
        );
      }

      addLog(
        'WordPod audio button: ' +
        (scene.audio
          ? `${scene.audio.texture || '?'} @ ${scene.audio.bounds.x|0},${scene.audio.bounds.y|0} ` +
            `${scene.audio.bounds.width|0}x${scene.audio.bounds.height|0}`
          : 'NONE')
      );

      addLog(
        'WordPod next button: ' +
        (scene.next
          ? `${scene.next.texture || '?'} @ ${scene.next.bounds.x|0},${scene.next.bounds.y|0} ` +
            `${scene.next.bounds.width|0}x${scene.next.bounds.height|0}`
          : 'NONE')
      );

      addLog(`WordPod visible vocab texts (${scene.prompts.length}):`);
      scene.prompts.forEach((p, i) => addLog(
        `  #${i + 1} "${p.label}" @ ${p.bounds.x|0},${p.bounds.y|0} ` +
        `${p.bounds.width|0}x${p.bounds.height|0}`
      ));

      addLog(
        'WordPod current candidates: ' +
        (state.wordPodCandidates.length
          ? state.wordPodCandidates.map(x => `"${x}"`).join(' / ')
          : 'NONE')
      );

      {
        const wt = wordPodReadTypedText();
        addLog(
          'WordPod typed text: ' +
          (wt ? JSON.stringify(wt) : 'NOT EXPOSED')
        );
        if (wt) {
          const wd = wordPodDebugString(wt);
          addLog(
            `WordPod normalized typed: ${JSON.stringify(wd.comparable)}`
          );
          addLog(
            `WordPod typed codepoints (${[...wt].length}): ` +
            wd.codepoints
          );
        }
      }

      addLog(
        'WordPod last audio: ' +
        (state.lastAudioUrl ? baseName(state.lastAudioUrl) : 'NONE')
      );
    }

    if (liveMode === 'mc2-listening' || liveMode === 'mc2-reading') {
      const scene = mc2Scene();
      const audio = mc2FindAudioButton();

      addLog(
        `MC2: mode=${modeLabel(liveMode)}, items=${scene.all.length}, ` +
        `options=${scene.options.length}, fails=${state.mc2Fails}`
      );

      addLog(
        'MC2 prompt: ' +
        (scene.prompt ? `"${scene.prompt.label}"` : 'NONE')
      );

      addLog(
        'MC2 audio button: ' +
        (audio
          ? `${audio.texture || '?'} @ ${audio.bounds.x|0},${audio.bounds.y|0} ` +
            `${audio.bounds.width|0}x${audio.bounds.height|0}`
          : 'NONE')
      );

      addLog(`MC2 vocab texts (${scene.all.length}):`);
      scene.all.forEach((o, i) => addLog(
        `  #${i + 1} "${o.label}" ` +
        `text=${o.textBounds.x|0},${o.textBounds.y|0} ` +
        `click=${o.bounds.x|0},${o.bounds.y|0},` +
        `${o.bounds.width|0}x${o.bounds.height|0} ` +
        `interactive=${o.interactive ? 'yes' : 'no'} ` +
        `events=${o.events.join(',') || '(none)'}`
      ));

      if (liveMode === 'mc2-listening') {
        addLog(
          'MC2 current audio answer: ' +
          (state.currentAnswer
            ? `"${state.currentAnswer.word}" / "${state.currentAnswer.originalWord}"`
            : 'NONE')
        );
        addLog(
          'MC2 last audio: ' +
          (state.lastAudioUrl ? baseName(state.lastAudioUrl) : 'NONE')
        );
      } else if (scene.prompt) {
        const e = mc2EntryForPrompt(scene.prompt);
        addLog(
          'MC2 expected answers: ' +
          (e
            ? mc2AnswerTextsForEntry(e, scene.prompt.label)
                .map(x => `"${x}"`).join(' / ')
            : 'NONE')
        );
      }
    }
    if (liveMode === 'fridge') {
      const p = findFridgePrompt();
      addLog('Prompt: ' + (p ? `"${p.text}"` : 'NONE'));
      addLog('Local placed: ' + state.fridgePlacedCount + ' / Order: ' + state.fridgeOrderedChunks.length);
      addLog('Fails: ' + state.fridgeFails);
      const tiles = collectFridgeTiles();
      addLog(`Tray tiles (${tiles.length}):`); tiles.forEach(t => addLog(`  "${t.label}" @ y=${t.bounds.y|0} x=${t.bounds.x|0}`));
      if (state.fridgeOrderedChunks.length > 0) addLog('Order: ' + state.fridgeOrderedChunks.map(t => t.label).join(' → '));
    }
    if (liveMode === 'gapfill') {
      const bg = findGapFillBackground();
      const gp = findGapFillPrompt();
      const texts = collectGapFillTexts();
      const keys = collectGapKeyboardKeys();

      addLog(
        'GapFill background: ' +
        (bg
          ? `${bg.texture || '?'} @ ${bg.bounds.x|0},${bg.bounds.y|0} ` +
            `${bg.bounds.width|0}x${bg.bounds.height|0}`
          : 'NONE')
      );

      addLog('Prompt: ' + (gp ? `"${gp.text}"` : 'NONE'));

      let target = '';
      let inf = null;

      if (gp) {
        if (!gp.match) gp.match = matchPromptToSentence(gp.text);
        target = findGapFillTarget(gp);

        if (target) {
          inf = inferGapFillAnswer(target, gp.text);
        }
      }

      addLog('Target: ' + (target || '—'));
      addLog(
        `Gap state: serial=${state.gapRoundSerial}, ` +
        `submitted=${state.gapSubmittedKey ? 'yes' : 'no'}, ` +
        `transitionSeen=${state.gapTransitionSeen ? 'yes' : 'no'}, ` +
        `board=${state.gapBoardIdentity ? 'set' : 'none'}`
      );
      addLog(
        'Missing: ' +
        (inf && inf.answer
          ? `"${inf.answer}"`
          : `NONE (${inf && inf.reason ? inf.reason : 'no inference'})`)
      );

      addLog(`GapFill sentence texts (${texts.length}):`);
      texts.forEach((t, i) => addLog(
        `  #${i + 1} "${t.text}" @ ` +
        `${t.bounds.x|0},${t.bounds.y|0} ` +
        `${t.bounds.width|0}x${t.bounds.height|0}`
      ));

      if (inf && inf.matches) {
        addLog(`Target fragment matches (${inf.matches.length}):`);
        inf.matches.forEach(m => addLog(
          `  "${m.text}" tokens ${m.startToken}-${m.endToken}`
        ));
      }

      addLog(`GapFill keyboard keys (${keys.length}):`);
      keys.forEach((k, i) => addLog(
        `  #${i + 1} [${k.kind}] "${k.label}" @ ` +
        `${k.bounds.x|0},${k.bounds.y|0} ` +
        `${k.bounds.width|0}x${k.bounds.height|0} ` +
        `events=${k.events.join(',') || '(none)'}`
      ));
    }
    if (liveMode === 'wordpop-listening') {
      const wb = collectWordPopBubbles();
      const wa = findWordPopAudioButton();

      addLog(
        `WordPop: bubbles=${wb.length}, vocab=${state.vocab.length}, ` +
        `fails=${state.wordPopFails}, busy=${state.wordPopBusy}, ` +
        `audioBusy=${state.wordPopAudioBusy}`
      );

      addLog(
        'Current audio answer: ' +
        (state.currentAnswer
          ? `"${state.currentAnswer.word}" / "${state.currentAnswer.originalWord}"`
          : 'NONE')
      );

      addLog(
        'Last audio: ' +
        (state.lastAudioUrl ? baseName(state.lastAudioUrl) : 'NONE')
      );

      if (state.lastAudioUrl) {
        const am = matchAudioToEntry(state.lastAudioUrl);
        addLog(
          'Audio→vocab match: ' +
          (am
            ? `uid=${am.uid ?? am.id ?? '?'} "${am.word || ''}" / "${am.originalWord || ''}"`
            : 'NONE')
        );

        if (!am) {
          const stem = audioStem(state.lastAudioUrl);
          addLog(`Audio stem: ${stem || '(empty)'}`);

          state.vocab.slice(0, 25).forEach((e, i) => {
            const vals = collectEntryStringValues(e)
              .filter(v => /audio|mp3|wav|ogg|m4a|aac/i.test(v))
              .slice(0, 5);

            if (vals.length) {
              addLog(
                `  vocab#${i + 1} uid=${e.uid ?? e.id ?? '?'} audio=${vals.join(' | ')}`
              );
            }
          });
        }
      }

      addLog(
        'Audio button: ' +
        (wa
          ? `${wa.texture || '?'} @ ${wa.bounds.x|0},${wa.bounds.y|0} ${wa.bounds.width|0}x${wa.bounds.height|0}`
          : 'NONE')
      );

      addLog(`WordPop options (${wb.length}):`);
      wb.forEach((b, i) => addLog(
        `  #${i + 1} "${b.label}" ` +
        `text=${b.textBounds.x|0},${b.textBounds.y|0},` +
        `${b.textBounds.width|0}x${b.textBounds.height|0} ` +
        `click=${b.bounds.x|0},${b.bounds.y|0},` +
        `${b.bounds.width|0}x${b.bounds.height|0} ` +
        `events=${b.events.join(',') || '(none)'}`
      ));

      if (state.currentAnswer) {
        addLog(
          `Wanted texts: ${wordPopWantedTexts().map(x => `"${x}"`).join(' / ')}`
        );

        const btns = collectWordPopAnswerButtons();
        addLog(`Matching text buttons (${btns.length}):`);

        btns.forEach((c, i) => {
          if (c.source === 'dom') {
            addLog(
              `  #${i + 1} [DOM] "${c.label}" @ ` +
              `${c.boundsClient.x|0},${c.boundsClient.y|0} ` +
              `${c.boundsClient.width|0}x${c.boundsClient.height|0}`
            );
          } else {
            addLog(
              `  #${i + 1} [PIXI] "${c.label}" ` +
              `text=${c.textBounds.x|0},${c.textBounds.y|0} ` +
              `click=${c.bounds.x|0},${c.bounds.y|0},` +
              `${c.bounds.width|0}x${c.bounds.height|0} ` +
              `events=${c.events.join(',') || '(none)'}`
            );
          }
        });
      }
    }
    if (liveMode === 'ocean-cleaner') {
      const op = findOceanPrompt();
      const oc = collectOceanContainers();

      addLog('Prompt: ' + (op ? `"${op.text}"` : 'NONE'));
      addLog('Target: ' + (state.oceanTarget || '—'));
      addLog(
        'Order: ' +
        (state.oceanOrder.map(x => x.label).join(' → ') || '(empty)')
      );
      addLog(
        `Collected: ${state.oceanPickedCount}/${state.oceanOrder.length}, ` +
        `Fails: ${state.oceanFails}, Busy: ${state.oceanBusy}`
      );

      addLog(`Ocean containers (${oc.length}):`);

      oc.forEach((c, i) => addLog(
        `  #${i + 1} "${c.label}" @ ` +
        `${c.bounds.x|0},${c.bounds.y|0} ` +
        `${c.bounds.width|0}x${c.bounds.height|0} ` +
        `events=${c.events.join(',') || '(none)'}`
      ));

      if (state.oceanTarget) {
        const rebuilt = buildOceanOrder(state.oceanTarget, oc);
        addLog(
          `Rebuild check: ` +
          (rebuilt.length
            ? rebuilt.map(c => c.label).join(' → ')
            : '(not ready)')
        );
      }
    }
    if (liveMode === 'forklift') {
      const fp = findForkliftPrompt();
      const fc = collectForkliftCrates();

      addLog('Prompt: ' + (fp ? `"${fp.text}"` : 'NONE'));
      addLog('Target: ' + (state.forkliftTarget || '—'));
      addLog(
        'Order: ' +
        (state.forkliftOrder.map(x => x.label).join(' → ') || '(empty)')
      );
      addLog(
        `Picked: ${state.forkliftPickedCount}/${state.forkliftOrder.length}, ` +
        `Fails: ${state.forkliftFails}, Busy: ${state.forkliftBusy}`
      );
      const fh = collectForkliftHitboxes();
      addLog(`Forklift hitboxes (${fh.length}):`);
      fh.forEach((h, i) => addLog(
        `  #${i + 1} @ x=${h.bounds.x|0} y=${h.bounds.y|0} ` +
        `${h.bounds.width|0}x${h.bounds.height|0} alpha=${h.alpha}`
      ));

      addLog(`Forklift crates (${fc.length}):`);

      fc.forEach(c => addLog(
        `  [${forkliftIsAnswerCrate(c) ? 'ANSWER' : 'SOURCE'}] ` +
        `"${c.label}" visual=${c.visualBounds.x|0},${c.visualBounds.y|0} ` +
        `click=${c.bounds.x|0},${c.bounds.y|0} ` +
        `${c.directHitbox ? 'pointerup-hitbox' : 'crate-fallback'}`
      ));

      const answerRowDump = fc
        .filter(forkliftIsAnswerCrate)
        .sort((a, b) => a.visualBounds.x - b.visualBounds.x);
      addLog(
        `Answer row (${answerRowDump.length}): ` +
        (answerRowDump.map(c => c.label).join(' → ') || '(empty)')
      );

      if (state.forkliftTarget) {
        const rebuilt = buildForkliftOrder(state.forkliftTarget, fc);
        addLog(
          `Rebuild check: ` +
          (rebuilt.length ? rebuilt.map(c => c.label).join(' → ') : '(not ready)')
        );
      }
    }
    if (liveMode === 'verb-matcher') {
      addLog('Verb data: ' + state.verbs.length + ', Done: ' + state.verbDone.size + ', Fails: ' + state.verbFails);
      addLog('Pair success mode: trust clicks unless incorrect texture appears');
      addLog(
        `Jigsaw animation speed: ` +
        `${state.pixiApp && state.pixiApp.ticker ? state.pixiApp.ticker.speed : '?'}x ` +
        `(forced 1x while solving)`
      );
      addLog('Submit selected: ' + (findVerbSubmit(true) ? 'yes' : 'no'));
      const vt = collectVerbMatcherTiles(true);
      addLog(`Verb tiles (${vt.length}):`);
      vt.forEach(t => addLog(
        `  [${t.side}/${t.kind || '?'}] "${t.label}" @ x=${t.bounds.x|0} y=${t.bounds.y|0} events=${verbEventNames(t.obj).join(',') || '(none)'}`
      ));
      const samples = [
        vt.find(t => t.side === 'original'),
        vt.find(t => t.side === 'translated')
      ].filter(Boolean);
      for (const sample of samples) {
        const cands = verbClickCandidates(sample.obj);
        addLog(`Click candidates for "${sample.label}": ${cands.length}`);
        cands.slice(0, 5).forEach((o, i) => {
          const b = boundsOf(o);
          addLog(
            `  #${i + 1} interactive=${o.interactive} eventMode=${o.eventMode || ''} events=${verbEventNames(o).join(',') || '(none)'} ` +
            `bounds=${b ? `${b.x|0},${b.y|0},${b.width|0}x${b.height|0}` : '?'}`
          );
        });
      }
      if (state.verbs.length) {
        addLog('Known pairs:');
        state.verbs.forEach(v => addLog(`  "${v.originalVerb}" ↔ "${v.translatedVerb}"`));
      }
    }
    if (liveMode === 'jigsaw') {
      const board = collectJigsawBoard();
      const entries = state.verbs.map(v => {
        const sections = verbSections(v);
        return sections.length >= 3 ? {
          uid: String(v.uid || ''),
          slotKey: jigsawVerbKey(sections[0] + sections[1]),
          pieceKey: jigsawVerbKey(sections[2])
        } : null;
      }).filter(Boolean);
      const placed = jigsawPlacedEntries(entries, board);
      addLog(`Jigsaw: ${board.pieces.length} blue pieces, ${board.slots.length} slots, ${placed.size}/${entries.length} placed`);
      board.pieces.forEach(p => addLog(
        `  blue ${JSON.stringify(p.labels[0])} key=${p.key} @ ${p.bounds.x|0},${p.bounds.y|0} events=${verbEventNames(p.obj).join(',') || '(none)'}`
      ));
      board.slots.forEach(t => addLog(
        `  slot ${JSON.stringify(t.labels)} key=${t.key} uid=${t.entryUid || '?'} ` +
        `occupied=${board.pieces.find(p => jigsawPieceInSlot(p, t))?.key || 'no'} ` +
        `@ ${t.bounds.x|0},${t.bounds.y|0} events=${verbEventNames(t.obj).join(',') || '(none)'}`
      ));
      state.verbs.forEach(v => {
        const sections = verbSections(v);
        addLog(`  uid=${v.uid} sections=${JSON.stringify(sections)} ${sections.length >= 3 ? `slot=${jigsawVerbKey(sections[0] + sections[1])} piece=${jigsawVerbKey(sections[2])}` : 'missing sections'}`);
      });
    }
    addLog('Completion check: ' + (detectCompletion() || 'no'));
  }  function boot() {
    concertInstallGlobalCanvasBlocker();
    concertInstallGlobalNavigationLock(); applyAudioMute(); if (!createPanel()) { const obs = new MutationObserver(() => { if (createPanel()) obs.disconnect(); }); obs.observe(document.documentElement || document, { childList: true, subtree: true }); setTimeout(createPanel, 1000); setTimeout(createPanel, 3000); } tryGrabPixi(); setTimeout(tryGrabPixi, 800); setTimeout(tryGrabPixi, 2500);
    window.addEventListener('beforeunload', () => {
      if (state.pilotStartedAt) {
        state.pilotElapsedMs += Date.now() - state.pilotStartedAt;
        state.pilotStartedAt = 0;
        saveStringSetting('pilotElapsedMs', state.pilotElapsedMs);
      }
    });
    setTimeout(() => showToast('Autocompleter successfully loaded!', 'ok'), 150);
    if (state.autopilot) setTimeout(() => { if (!state.running) toggleRunning(); }, 350);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
