import type { SkillEvent } from "./types";

// Standard event types
export const FLOOR_PLAN_UPDATED = "FLOOR_PLAN_UPDATED";
export const RENDER_GENERATED = "RENDER_GENERATED";
export const PRODUCTS_FOUND = "PRODUCTS_FOUND";
export const FURNITURE_PLACED = "FURNITURE_PLACED";
export const SESSION_COMPLETE = "SESSION_COMPLETE";
export const BRIEF_ANALYZED = "BRIEF_ANALYZED";

type EventHandler = (event: SkillEvent) => void;

/**
 * SkillEventBus — cross-skill event pub/sub.
 * Skills subscribe to events from other skills in their onLoad() method.
 */
export class SkillEventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  /** Subscribe to an event type */
  on(eventType: string, handler: EventHandler): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);
  }

  /** Unsubscribe from an event type */
  off(eventType: string, handler: EventHandler): void {
    this.listeners.get(eventType)?.delete(handler);
  }

  /** Broadcast an event to all registered listeners */
  emit(event: SkillEvent): void {
    const handlers = this.listeners.get(event.type);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (err) {
        console.warn(`Event handler error for "${event.type}":`, err);
      }
    }
  }

  /** Remove all listeners */
  clear(): void {
    this.listeners.clear();
  }
}
