// Tab switching + Raycast-style spatial keyboard navigation.
//
// The metaphor: tabs are a left-to-right axis. Each tab "drills deeper" than
// the last (Quick MER → Funnel → Monte Carlo). Enter advances to the next
// tab, Escape goes back to the previous tab. Arrow keys also work.
//
// Compact mode: when a tab is focused, others fade rather than disappear —
// the Raycast "opacity choreography" pattern. We don't make this opt-in;
// it's the default behavior of the active state.

export function setupTabs(container: HTMLElement): { setActive: (id: string) => void } {
  const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-tab]'));
  const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-panel]'));
  const ids = tabs.map((t) => t.dataset.tab!);

  let activeIdx = 0;

  function setActive(id: string): void {
    const idx = ids.indexOf(id);
    if (idx === -1) return;
    activeIdx = idx;
    for (let i = 0; i < tabs.length; i++) {
      const on = i === idx;
      tabs[i]!.classList.toggle('active', on);
      tabs[i]!.setAttribute('aria-selected', String(on));
      tabs[i]!.tabIndex = on ? 0 : -1;
    }
    for (const p of panels) {
      const on = p.dataset.panel === id;
      p.hidden = !on;
      if (on) {
        // Re-trigger entry animation on switch.
        p.style.animation = 'none';
        // Read offset to flush.
        void p.offsetHeight;
        p.style.animation = '';
      }
    }
  }

  function moveBy(delta: number): void {
    const next = Math.max(0, Math.min(ids.length - 1, activeIdx + delta));
    if (next !== activeIdx) {
      setActive(ids[next]!);
      tabs[next]!.focus();
    }
  }

  for (const t of tabs) {
    t.addEventListener('click', () => setActive(t.dataset.tab!));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        moveBy(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        e.preventDefault();
        moveBy(-1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActive(ids[0]!);
        tabs[0]!.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        setActive(ids[ids.length - 1]!);
        tabs[ids.length - 1]!.focus();
      }
    });
  }

  // Document-level Escape: pop back to the previous tab when no input is focused.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA')) {
      // Let inputs handle their own Escape (e.g., to blur).
      (ae as HTMLElement).blur();
      return;
    }
    if (activeIdx > 0) {
      e.preventDefault();
      moveBy(-1);
    }
  });

  return { setActive };
}
