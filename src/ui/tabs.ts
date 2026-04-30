// Segmented-control tab switching.

export function setupTabs(container: HTMLElement): { setActive: (id: string) => void } {
  const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-tab]'));
  const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-panel]'));

  function setActive(id: string): void {
    for (const t of tabs) {
      const on = t.dataset.tab === id;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    }
    for (const p of panels) {
      p.hidden = p.dataset.panel !== id;
    }
  }

  for (const t of tabs) {
    t.addEventListener('click', () => setActive(t.dataset.tab!));
  }

  return { setActive };
}
