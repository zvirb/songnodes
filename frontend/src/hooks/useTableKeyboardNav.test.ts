import { renderHook, act } from '@testing-library/react';
import { useTableKeyboardNav, type TableNavKeyEvent } from './useTableKeyboardNav';
import { vi, describe, it, expect, beforeEach } from 'vitest';

/** @vitest-environment jsdom */

const createKeyDownEvent = (
  key: string,
  target?: HTMLElement,
  modifiers: Partial<Pick<TableNavKeyEvent, 'ctrlKey' | 'metaKey' | 'altKey'>> = {}
): TableNavKeyEvent => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  preventDefault: vi.fn<() => void>(),
  target: target || document.createElement('div'),
  ...modifiers
});

describe('useTableKeyboardNav', () => {
  const rowIds = ['id-1', 'id-2', 'id-3'];
  const describeMock = vi.fn<(id: string) => string>((id) => `Track ${id}`);
  const onActiveChangeMock = vi.fn<(id: string | null) => void>();
  const onOpenMock = vi.fn<(id: string) => void>();
  const shortcutsMock = {
    ' ': vi.fn<(id: string) => void>(),
    t: vi.fn<(id: string) => void>(),
    x: vi.fn<(id: string) => void>()
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
