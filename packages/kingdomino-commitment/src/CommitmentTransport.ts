/**
 * Narrow transport interface for the commitment/reveal seed exchange.
 * IGameConnection in the client satisfies this shape — no adapter needed.
 */
export interface CommitmentTransport {
  send(message: { type: string; content?: unknown }): void;
  waitFor<T>(messageType: string): Promise<T>;
}
