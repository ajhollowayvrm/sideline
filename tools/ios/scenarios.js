'use strict';
/* Screen scenarios — the one source of truth for both dev loops.

   `tools/ios/web.js` runs these in Playwright WebKit at iPhone metrics (about 2 seconds a screen).
   `tools/ios/shell.js` posts the SAME strings to the DevBridge in `ios/Sources/Shell.swift`, which
   runs them inside the real WKWebView on a booted simulator. One definition, two engines, so a
   difference between the two shots is a difference in the ENGINE and never in the setup.

   Every export here returns a FUNCTION BODY, not an expression. Both drivers wrap it in an async
   function, so `return` works in both and `await` works in both. Keep it that way.

   The bodies call the game's own functions rather than clicking through the UI. `S`, `UI`,
   `render()` and the rest are globals by design — CLAUDE.md names that as the testing seam, and it
   is what makes a screen reachable in one step instead of a tap sequence that breaks on every
   layout change. */

const SEED = 7;          // any fixed seed; the world is deterministic from it
const TEAM = 'ALA';      // a blue-blood, so the recruiting and media screens have something on them
const WEEKS = 6;         // far enough in for a record, a poll, injuries and a recruiting board

/* Screens worth a picture. `pre` scenes run BEFORE a career exists, because they are the screens a
   player meets with no save. Everything after `setup` shares one career, so the world is generated
   once per run rather than once per screen. */
const PRE_SCENES = [
  { name: 'menu',    view: 'menu' },
  { name: 'newgame', view: 'newgame' },
  // Reached from the menu, and both use headerBar(). Neither was swept until a headerBar screen
  // turned out to be drawing its title under the status bar on a real phone.
  { name: 'load',    view: 'load' },
  { name: 'cloud',   view: 'cloud' },
];

const CAREER_SCENES = [
  { name: 'home',       view: 'home' },
  { name: 'roster',     view: 'team',    tab: 'roster' },
  { name: 'coaches',    view: 'team',    tab: 'coaches' },
  { name: 'season',     view: 'season' },
  { name: 'recruiting', view: 'recruit' },
  { name: 'program',    view: 'program' },
  { name: 'media',      view: 'media' },
  { name: 'records',    view: 'records' },
  { name: 'browse',     view: 'browse' },
];

/* Wipe back to a first-run app: no career, no active slot, the main menu. */
function reset() {
  return `
    try { SLOTS.forEach(n => deleteSlot(n)); } catch (e) {}
    setActiveSlot(null);
    S = null;
    UI = { view: 'menu', tab: 'roster', newgame: null };
    closeSheet();
    render();
    return { view: UI.view };
  `;
}

/* Build one career and play it forward. Idempotent: call it twice and the second call only advances
   the clock, because generating 134 rosters again would cost a second for nothing. */
function setup({ seed = SEED, team = TEAM, weeks = WEEKS } = {}) {
  return `
    const seed = ${seed};
    if (!S || S.seed !== seed) {
      const ng = freshNewGame();
      ng.seed = seed;
      ng.coach.first = 'Dev'; ng.coach.last = 'Coach';
      ng.world = genWorld(seed);
      const t = ng.world.teams.find(x => x.abbr === ${JSON.stringify(team)}) || ng.world.teams[0];
      ng.teamId = t.id;
      finishNewGame(ng);     // sets S, then opens the slot sheet the wizard would have shown
      closeSheet();
      setActiveSlot(1);
      writeSlot(1, S);
    }
    if (${weeks} > 0 && S.phase === 'Preseason') startSeason();
    while (S.phase === 'Regular Season' && S.week <= ${weeks}) advanceWeek();
    UI.view = 'home';
    render();
    return { team: controlled().abbr, year: S.year, week: S.week, phase: S.phase };
  `;
}

/* Open one screen. A sheet left open by the previous scene would sit on top of this one. */
function goto(scene) {
  return `
    closeSheet();
    ${scene.name === 'newgame' ? 'UI.newgame = freshNewGame();' : ''}
    UI.view = ${JSON.stringify(scene.view)};
    ${scene.tab ? `UI.tab = ${JSON.stringify(scene.tab)};` : ''}
    render();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { view: document.querySelector('#app').dataset.screen || UI.view,
             tab: document.querySelector('#app').dataset.tab || null,
             overflows: document.documentElement.scrollWidth > window.innerWidth + 1 };
  `;
}

/* What a screen is worth on a phone, measured rather than eyeballed — the properties a screenshot
   hides. Shared by both drivers on purpose: run it in WebKit and in the WKWebView and any
   difference in the answer is a difference in the ENGINE, not in how the two were set up.

   Touch targets are measured by HIT TESTING, not by the bounding box. The box is what a control
   PAINTS; the target is what the finger gets, and a pseudo-element can legitimately extend one past
   the other. So probe outward from the centre with elementFromPoint and report how far the element
   still answers — which is the number Apple's 44pt minimum is actually about. */
function audit() {
  return `
    const SEL = 'button, a, input, select, [role=button]';
    const label = el => {
      if (el.dataset.tid) return el.dataset.tid;
      const cls = (el.className || '').toString().trim().split(/\\s+/).filter(Boolean).slice(0, 2);
      return el.tagName.toLowerCase() + (cls.length ? '.' + cls.join('.') : '')
        + (el.textContent ? ' "' + el.textContent.trim().slice(0, 14) + '"' : '');
    };
    const owns = (el, hit) => !!hit && (hit === el || el.contains(hit));

    const small = [];
    let obscured = 0, checked = 0, clipped = 0, pressable = 0, pressTotal = 0;
    document.querySelectorAll(SEL).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;                      // not painted
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 2);
      const cy = r.top + r.height / 2;
      // 22px of room on each side of the centre, or the probe measures the SCREEN EDGE instead of
      // the control and reports a full-size row as undersized. The two engines disagreed on exactly
      // one row because of this, and the row was fine.
      if (cy - 22 < 0 || cy + 22 > innerHeight - 1) { clipped++; return; }
      if (!owns(el, document.elementFromPoint(cx, cy))) { obscured++; return; }
      checked++;
      // A control the user has simply scrolled half under the fixed tab bar is not a design defect,
      // it is a scroll position. Distinguish "the control ends here" from "an overlay starts here".
      let blocked = false;
      const fixedOverlay = node => {
        for (let n = node; n && n !== document.body; n = n.parentElement) {
          if (getComputedStyle(n).position === 'fixed') return true;
        }
        return false;
      };
      const reach = dir => {
        let d = 0;
        while (d < 24) {
          const y = cy + dir * (d + 1);
          if (y < 0 || y > innerHeight - 1) break;
          const hitEl = document.elementFromPoint(cx, y);
          if (!owns(el, hitEl)) { if (hitEl && fixedOverlay(hitEl)) blocked = true; break; }
          d++;
        }
        return d;
      };
      const hit = reach(-1) + reach(1) + 1;
      if (hit < 44) {
        if (blocked) clipped++;
        else small.push(label(el) + ' ' + Math.round(r.width) + 'x' + hit);
      }
      // Only things you PRESS. A text field is in the target count because a finger has to land in
      // it, but it answers by taking the caret and it must not flash like a button.
      if (el.matches('button, a, [role=button]')) { pressTotal++; if (pressRule(el)) pressable++; }
    });
    // Does a rule in the stylesheet answer this element's press? A control with the tap highlight
    // suppressed and no :active rule gives the finger nothing at all, which is the defect this
    // number exists to keep from coming back.
    function pressRule(el) {
      for (const sheet of document.styleSheets) {
        let list; try { list = sheet.cssRules; } catch (e) { continue; }
        for (const rule of list) {
          if (!rule.selectorText || rule.selectorText.indexOf(':active') < 0) continue;
          if (rule.selectorText.split(',').some(s => {
            try { return el.matches(s.replace(/:active/g, '').trim()); } catch (e) { return false; }
          })) return true;
        }
      }
      return false;
    }
    /* Does anything paint UNDER the status bar? This is the bug that reached a real phone: the
       status-bar inset lived inline on one of the two things that build a top bar, so every screen
       reached through the other one drew its title beneath the clock.

       Checked by SIMULATING a notch — override the --safe-t token and re-measure — rather than by
       reading the real inset, because no desktop engine has one and the check would be vacuous in
       both the WebKit loop and the Chromium gate. That only works while every consumer goes through
       the token, so envLeak guards the other half: a raw env(safe-area-inset-*) anywhere but the
       :root definition is invisible to this probe and must not exist. */
    const SIM_NOTCH = 59;
    const root = document.documentElement;
    const priorTop = root.style.getPropertyValue('--safe-t');
    root.style.setProperty('--safe-t', SIM_NOTCH + 'px');
    void root.offsetHeight;
    const underStatusBar = [];
    if (window.scrollY < 2) {
      document.querySelectorAll('body *').forEach(el => {
        const paints = el.matches('button, a, input, select, svg, img')
          || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (!paints) return;
        const b = el.getBoundingClientRect();
        if (b.width < 1 || b.height < 1) return;
        if (getComputedStyle(el).visibility === 'hidden') return;
        if (b.top < SIM_NOTCH - 1 && b.bottom > 0) underStatusBar.push(label(el));
      });
    }
    if (priorTop) root.style.setProperty('--safe-t', priorTop); else root.style.removeProperty('--safe-t');

    let envLeak = 0;
    for (const sheet of document.styleSheets) {
      let list; try { list = sheet.cssRules; } catch (e) { continue; }
      for (const rule of list) {
        if (!rule.style || !rule.cssText) continue;
        if (/env\\(safe-area-inset/.test(rule.cssText) && rule.selectorText !== ':root') envLeak++;
      }
    }

    return { statusBar: underStatusBar.length, statusBarWorst: underStatusBar.slice(0, 3), envLeak,
             overflow: document.documentElement.scrollWidth - window.innerWidth,
             targets: small.length, checked, obscured, clipped, pressable, pressTotal, worst: small.slice(0, 3) };
  `;
}

module.exports = { SEED, TEAM, WEEKS, PRE_SCENES, CAREER_SCENES, reset, setup, goto, audit };
