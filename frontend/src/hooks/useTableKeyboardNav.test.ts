import { renderHook, act } from '@testing-library/react';
import { useTableKeyboardNav } from './useTableKeyboardNav';
import { KeyboardEvent } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

/** @vitest-environment jsdom */

describe('useTableKeyboardNav', () => {
  const rowIds = ['id-1', 'id-2', 'id-3'];
  const describeMock = vi.fn((id) => `Track ${id}`);
  const onActiveChangeMock = vi.fn();
  const onOpenMock = vi.fn();
  const shortcutsMock = {
    ' ': vi.fn(),
    t: vi.fn(),
    x: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = (activeId: string | null = null) => {
    return renderHook(() =>
      useTableKeyboardNav({
        rowIds,
        activeId,
        onActiveChange: onActiveChangeMock,
        onOpen: onOpenMock,
        shortcuts: shortcutsMock,
        describe: describeMock
      })
    );
  };

  const createKeyDownEvent = (key: string, target?: HTMLElement, modifiers = {}) => {
    const e = {
      key,
      preventDefault: vi.fn(),
      target: target || document.createElement('div'),
      ...modifiers
    } as unknown as KeyboardEvent<HTMLElement>;
    return e;
  };

  it('moves active index down on J', () => {
    const { result } = setup('id-1');
    act(() => {
      result.current.boxProps.onKeyDown(createKeyDownEvent('j'));
    });
    expect(onActiveChangeMock).toHaveBeenCalledWith('id-2');
  });

  it('moves active index up on K', () => {
    const { result } = setup('id-2');
    act(() => {
      result.current.boxProps.onKeyDown(createKeyDownEvent('k'));
    });
    expect(onActiveChangeMock).toHaveBeenCalledWith('id-1');
  });

  it('sets first item on J if no active item', () => {
    const { result } = setup(null);
    act(() => {
      result.current.boxProps.onKeyDown(createKeyDownEvent('j'));
    });
    expect(onActiveChangeMock).toHaveBeenCalledWith('id-1');
  });

  it('clamps to the end when moving down', () => {
    const { result } = setup('id-3');
    act(() => {
      result.current.boxProps.onKeyDown(createKeyDownEvent('ArrowDown'));
    });
    expect(onActiveChangeMock).toHaveBeenCalledWith('id-3');
  });

  it('clamps to the beginning when moving up', () => {
    const { result } = setup('id-1');
    act(() => {
      result.current.boxProps.onKeyDown(createKeyDownEvent('ArrowUp'));
    });
    expect(onActiveChangeMock).not.toHaveBeenCalled(); // doesn't call if already at 0
  });

  it('calls onOpen on Enter', () => {
    const { result } = setup('id-2');
    act(() => {
      result.current.boxProps.onKeyDown(createKeyDownEvent('Enter'));
    });
    expect(onOpenMock).toHaveBeenCalledWith('id-2');
  });

  it('calls shortcuts correctly', () => {
    const { result } = setup('id-2');
    act(() => {
      result.current.boxProps.onKeyDown(createKeyDownEvent(' '));
    });
    expect(shortcutsMock[' ']).toHaveBeenCalledWith('id-2');

    act(() => {
      result.current.boxProps.onKeyDown(createKeyDownEvent('t'));
    });
    expect(shortcutsMock['t']).toHaveBeenCalledWith('id-2');

    act(() => {
      result.current.boxProps.onKeyDown(createKeyDownEvent('X')); // tests case insensitivity
    });
    expect(shortcutsMock['x']).toHaveBeenCalledWith('id-2');
  });

  it('returns polite announcement string', () => {
    const { result } = setup('id-2');
    expect(result.current.announcement).toBe('2 of 3: Track id-2');
  });

  it('ignores input focus', () => {
    const { result } = setup('id-1');
    const input = document.createElement('input');
    act(() => {
      result.current.boxProps.onKeyDown(createKeyDownEvent('j', input));
    });
    expect(onActiveChangeMock).not.toHaveBeenCalled();
  });

  it('ignores modifier keys', () => {
    const { result } = setup('id-1');
    act(() => {
      result.current.boxProps.onKeyDown(createKeyDownEvent('j', undefined, { ctrlKey: true }));
    });
    expect(onActiveChangeMock).not.toHaveBeenCalled();
  });
});
