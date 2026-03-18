# Claude Session Rules (client/src)

- Minimize explicit TypeScript typing where inference is clear.
- Prefer inferred method and function return types instead of explicit `: Type` annotations.
- Add explicit return types only when they improve correctness or readability (for example: public API boundaries, overload-heavy code, complex unions, or recursive functions).
