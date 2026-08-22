import React from 'react';

/**
 * BUSY ERP-Style Keyboard Navigation Helper
 * Replicates BUSY accounting software fast data entry where pressing 'Enter'
 * seamlessly moves focus to the next logical input field instead of submitting.
 */

export interface FocusOptions {
  onLastFieldEnter?: () => void;
  selectTextOnFocus?: boolean;
}

/**
 * Main keydown handler for Enter key navigation inside forms & invoice tables.
 */
export function handleEnterKeyNavigation(
  e: React.KeyboardEvent<HTMLElement>,
  options: FocusOptions = {}
): boolean {
  // Only intercept 'Enter' key
  if (e.key !== 'Enter') return false;

  const target = e.target as HTMLElement;
  const tagName = target.tagName.toLowerCase();

  // Allow standard multiline behavior in textareas if Shift is pressed
  if (tagName === 'textarea' && e.shiftKey) {
    return false;
  }

  // Allow submit buttons to trigger form submission
  if (tagName === 'button' && target.getAttribute('type') === 'submit') {
    return false;
  }

  // Prevent default form submission / newline behavior
  e.preventDefault();

  // Find the container form or custom keyboard navigation container
  const container =
    target.closest('[data-keyboard-nav-container]') ||
    target.closest('form') ||
    document.body;

  if (!container) return false;

  // Selector for all interactive/focusable form fields
  const focusableSelector = [
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    '[tabindex="0"]:not([disabled])'
  ].join(', ');

  // Filter visible and focusable elements
  const allFocusables = Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector)
  ).filter((el) => {
    // Check if element is visible
    return (
      el.offsetWidth > 0 &&
      el.offsetHeight > 0 &&
      window.getComputedStyle(el).visibility !== 'hidden' &&
      window.getComputedStyle(el).display !== 'none'
    );
  });

  const currentIndex = allFocusables.indexOf(target);

  if (currentIndex !== -1 && currentIndex < allFocusables.length - 1) {
    const nextEl = allFocusables[currentIndex + 1];
    nextEl.focus();

    if (
      (options.selectTextOnFocus ?? true) &&
      nextEl instanceof HTMLInputElement &&
      (nextEl.type === 'text' || nextEl.type === 'number' || nextEl.type === 'search')
    ) {
      nextEl.select();
    }
    return true;
  }

  // If at the last field in the container and a callback is provided
  if (currentIndex === allFocusables.length - 1 && options.onLastFieldEnter) {
    options.onLastFieldEnter();
    return true;
  }

  return false;
}

/**
 * Focuses an element by element ID after a small timeout (e.g. for dynamic row addition)
 */
export function focusElementById(elementId: string, selectText: boolean = true): void {
  setTimeout(() => {
    const el = document.getElementById(elementId);
    if (el) {
      el.focus();
      if (selectText && el instanceof HTMLInputElement) {
        el.select();
      }
    }
  }, 50);
}
