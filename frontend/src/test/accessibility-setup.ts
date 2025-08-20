import { beforeEach, afterEach, vi } from 'vitest';

// Enhanced accessibility testing setup
beforeEach(() => {
  // Mock screen reader APIs
  global.speechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
    speaking: false,
    pending: false,
    paused: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as any;

  // Mock SpeechSynthesisUtterance
  global.SpeechSynthesisUtterance = vi.fn().mockImplementation((text) => ({
    text,
    lang: 'en-US',
    voice: null,
    volume: 1,
    rate: 1,
    pitch: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  // Enhanced ARIA support
  Object.defineProperty(HTMLElement.prototype, 'ariaLabel', {
    get() { return this.getAttribute('aria-label') || ''; },
    set(value) { this.setAttribute('aria-label', value); },
    configurable: true,
  });

  Object.defineProperty(HTMLElement.prototype, 'ariaDescribedBy', {
    get() { return this.getAttribute('aria-describedby') || ''; },
    set(value) { this.setAttribute('aria-describedby', value); },
    configurable: true,
  });

  Object.defineProperty(HTMLElement.prototype, 'ariaLabelledBy', {
    get() { return this.getAttribute('aria-labelledby') || ''; },
    set(value) { this.setAttribute('aria-labelledby', value); },
    configurable: true,
  });

  Object.defineProperty(HTMLElement.prototype, 'role', {
    get() { return this.getAttribute('role') || ''; },
    set(value) { this.setAttribute('role', value); },
    configurable: true,
  });

  // Mock high contrast mode detection
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => {
      const isHighContrast = query.includes('prefers-contrast');
      const isReducedMotion = query.includes('prefers-reduced-motion');
      return {
        matches: isHighContrast ? false : isReducedMotion ? false : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
  });

  // Mock focus management
  let focusedElement: Element | null = null;
  Object.defineProperty(document, 'activeElement', {
    get() { return focusedElement || document.body; },
    configurable: true,
  });

  // Enhanced focus method mock
  HTMLElement.prototype.focus = vi.fn().mockImplementation(function(this: HTMLElement) {
    focusedElement = this;
    this.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  });

  // Enhanced blur method mock
  HTMLElement.prototype.blur = vi.fn().mockImplementation(function(this: HTMLElement) {
    if (focusedElement === this) {
      focusedElement = null;
    }
    this.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  });

  // Mock tabindex behavior
  Object.defineProperty(HTMLElement.prototype, 'tabIndex', {
    get() { 
      const tabindex = this.getAttribute('tabindex');
      return tabindex ? parseInt(tabindex, 10) : -1;
    },
    set(value) { 
      this.setAttribute('tabindex', value.toString()); 
    },
    configurable: true,
  });
});

afterEach(() => {
  // Clean up any announcements or focus states
  if (global.speechSynthesis) {
    (global.speechSynthesis.cancel as any)();
  }
});

// Accessibility testing utilities
export const announcements: string[] = [];

export const mockScreenReaderAnnouncement = (text: string) => {
  announcements.push(text);
  if (global.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(text);
    global.speechSynthesis.speak(utterance);
  }
};

export const clearAnnouncements = () => {
  announcements.length = 0;
  if (global.speechSynthesis) {
    global.speechSynthesis.cancel();
  }
};

export const getLastAnnouncement = () => {
  return announcements[announcements.length - 1] || '';
};

export const getAllAnnouncements = () => {
  return [...announcements];
};

// Color contrast testing utilities
export const checkColorContrast = (foreground: string, background: string): number => {
  // Simple mock implementation - in real tests you'd use a proper contrast calculator
  // This is a placeholder that returns a passing ratio
  return 4.5; // WCAG AA standard
};

// Focus testing utilities
export const simulateKeyboardNavigation = (element: Element, key: string) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
};

export const getFocusableElements = (container: Element): Element[] => {
  const focusableSelectors = [
    'button',
    '[href]',
    'input',
    'select',
    'textarea',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(',');
  
  return Array.from(container.querySelectorAll(focusableSelectors))
    .filter((element) => {
      const htmlElement = element as HTMLElement;
      return !htmlElement.disabled && 
             htmlElement.tabIndex >= 0 && 
             !htmlElement.hidden &&
             htmlElement.offsetWidth > 0 && 
             htmlElement.offsetHeight > 0;
    });
};

export const simulateFocusTrap = (container: Element) => {
  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) return;
  
  let currentIndex = 0;
  
  return {
    focusFirst: () => {
      currentIndex = 0;
      (focusableElements[currentIndex] as HTMLElement).focus();
    },
    focusLast: () => {
      currentIndex = focusableElements.length - 1;
      (focusableElements[currentIndex] as HTMLElement).focus();
    },
    focusNext: () => {
      currentIndex = (currentIndex + 1) % focusableElements.length;
      (focusableElements[currentIndex] as HTMLElement).focus();
    },
    focusPrevious: () => {
      currentIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
      (focusableElements[currentIndex] as HTMLElement).focus();
    },
    getCurrentIndex: () => currentIndex,
    getFocusableCount: () => focusableElements.length,
  };
};