import { describe, expect, it, vi } from 'vitest';
import { requireElement, setRectangle } from '../../testing/DomGeometry.test-support';
import { getVisibility } from './Visibility';

describe('getVisibility', () => {
  it.each(['style="display:none"', 'style="visibility:hidden"', 'aria-hidden="true"', 'hidden'])
  ('祖先の %s を非表示とする', attribute => {
    document.body.innerHTML = `<div ${attribute}><button>対象</button></div>`;
    expect(getVisibility(requireElement('button')).hidden).toBe(true);
  });

  it('hidden input と面積ゼロを非表示とする', () => {
    document.body.innerHTML = '<input type="hidden"><button>対象</button>';
    setRectangle(requireElement('button'), 0, 0, 0, 0);
    expect(getVisibility(requireElement('input')).hidden).toBe(true);
    expect(getVisibility(requireElement('button')).hidden).toBe(true);
  });

  it.each([[-100, 0], [0, -50], [1024, 0], [0, 768]])('画面外の (%s,%s) を検出する', (left, top) => {
    document.body.innerHTML = '<button>対象</button>';
    vi.stubGlobal('innerWidth', 1024);
    vi.stubGlobal('innerHeight', 768);
    try {
      setRectangle(requireElement('button'), left, top, 100, 50);
      expect(getVisibility(requireElement('button')).offscreen).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('部分的に画面内なら可視とし、中心が画面外なら遮蔽判定を省く', () => {
    document.body.innerHTML = '<button>対象</button>';
    setRectangle(requireElement('button'), -90, 0, 100, 50);
    expect(getVisibility(requireElement('button'))).toEqual({ hidden: false, offscreen: false, blocker: null });
    expect(document.elementFromPoint).not.toHaveBeenCalled();
  });

  it('中心で自分か子孫に当たれば遮蔽されていない', () => {
    document.body.innerHTML = '<button><span>対象</span></button>';
    const button = requireElement('button');
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    expect(getVisibility(button).blocker).toBeNull();
    vi.mocked(document.elementFromPoint).mockReturnValue(requireElement('span'));
    expect(getVisibility(button).blocker).toBeNull();
    expect(document.elementFromPoint).toHaveBeenLastCalledWith(50, 25);
  });

  it('elementFromPoint がなくても観測できる', () => {
    document.body.innerHTML = '<button>対象</button>';
    Reflect.deleteProperty(document, 'elementFromPoint');
    expect(getVisibility(requireElement('button')).blocker).toBeNull();
  });
});
