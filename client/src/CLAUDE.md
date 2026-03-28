# Claude Session Rules (client/src)

- Minimize explicit TypeScript typing where inference is clear.
- Prefer inferred method and function return types instead of explicit `: Type` annotations.
- Add explicit return types only when they improve correctness or readability (for example: public API boundaries, overload-heavy code, complex unions, or recursive functions).
- Prefer named exports.
- Do not use default exports.
- Keep one primary responsibility per file.
- Multiple exports are fine when they support the same job, theme, or focus, but avoid files that mix unrelated concerns.
- Prefer OOP (classes) for game state: sessions, rounds, players, connections, and flow orchestration.
- Prefer pure functions for game logic: card manipulation, board scoring, deck operations, and seed/order calculations.
