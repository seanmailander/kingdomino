import type { GameEvent } from "./GameEvent";

type Listener<T extends GameEvent> = (event: T) => void;

export class GameEventBus {
  private listeners = new Map<string, Set<Listener<never>>>();

  on<T extends GameEvent["type"]>(
    type: T,
    listener: (e: Extract<GameEvent, { type: T }>) => void,
  ): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener as Listener<never>);
    return () => this.listeners.get(type)?.delete(listener as Listener<never>);
  }

  emit(event: GameEvent): void {
    this.listeners.get(event.type)?.forEach((fn) => fn(event as never));
  }
}
