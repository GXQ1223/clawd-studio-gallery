import { describe, it, expect, vi } from 'vitest';
import { SkillEventBus } from '../lib/skills/event-bus';
import type { SkillEvent } from '../lib/skills/types';

function makeEvent(type: string, payload: any = {}): SkillEvent {
  return { type, payload, source: 'test-skill', timestamp: Date.now() };
}

describe('SkillEventBus', () => {
  it('emit/on: handler receives emitted events', () => {
    const bus = new SkillEventBus();
    const handler = vi.fn();
    const event = makeEvent('RENDER_GENERATED', { url: 'https://example.com/img.png' });

    bus.on('RENDER_GENERATED', handler);
    bus.emit(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('off: removed handler stops receiving', () => {
    const bus = new SkillEventBus();
    const handler = vi.fn();

    bus.on('BRIEF_ANALYZED', handler);
    bus.emit(makeEvent('BRIEF_ANALYZED'));
    expect(handler).toHaveBeenCalledTimes(1);

    bus.off('BRIEF_ANALYZED', handler);
    bus.emit(makeEvent('BRIEF_ANALYZED'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('clear: all listeners removed', () => {
    const bus = new SkillEventBus();
    const handlerA = vi.fn();
    const handlerB = vi.fn();

    bus.on('RENDER_GENERATED', handlerA);
    bus.on('PRODUCTS_FOUND', handlerB);
    bus.clear();

    bus.emit(makeEvent('RENDER_GENERATED'));
    bus.emit(makeEvent('PRODUCTS_FOUND'));

    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).not.toHaveBeenCalled();
  });

  it('error in handler does not crash other handlers', () => {
    const bus = new SkillEventBus();
    const badHandler = vi.fn(() => { throw new Error('boom'); });
    const goodHandler = vi.fn();

    bus.on('SESSION_COMPLETE', badHandler);
    bus.on('SESSION_COMPLETE', goodHandler);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    bus.emit(makeEvent('SESSION_COMPLETE'));
    warnSpy.mockRestore();

    expect(badHandler).toHaveBeenCalledTimes(1);
    expect(goodHandler).toHaveBeenCalledTimes(1);
  });
});
