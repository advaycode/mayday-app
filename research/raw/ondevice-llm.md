# ondevice-llm — On-device LLM in Flutter for protocol routing (Mayday)

Research date: 2026-08-23. All facts below from pages fetched this session.

## STATUS: IN PROGRESS (draft 1)

---

## 1. flutter_gemma (pub.dev)

- URL: https://pub.dev/packages/flutter_gemma
- **Version 1.6.5, published ~28 hours before 2026-08-23 (i.e. ~2026-08-22).** Extremely active:
  1.6.0 → 1.6.5 all shipped within 3 days. Publisher `sashadenisov.dev` (verified pub.dev publisher).
  422 likes. Docs site fluttergemma.dev.
- Requires **Dart SDK 3.12**.
- Architecture as of 1.0.0 is **modular**: core package + opt-in engines
  (`flutter_gemma_litertlm`, `flutter_gemma_mediapipe`) + feature packages (RAG, speech, agent).
  No engine bundled by default — you call `FlutterGemma.initialize(inferenceEngines: ...)`.
  This is a BREAKING change vs. every pre-1.0 tutorial/blog post you will find online.
- Models supported: Gemma 4 (E2B/E4B), Gemma 3n (E2B/E4B), **Gemma 3 1B, Gemma 3 270M**,
  DeepSeek R1, Qwen3/2.5, Phi-4, FastVLM, SmolLM variants, LLaVA-OneVision.
  Embedding models: **EmbeddingGemma 300M, Gecko 110M — both 768-dim**.
- Model delivery: runtime download from HuggingFace or custom URL w/ progress; **bundled Flutter
  asset**; external file reference (native only). Web uses Cache API (<2GB) / OPFS.
- Platforms: Android (arm64-v8a primary), **iOS 15.0+** (16.0 if using the MediaPipe engine),
  Web, macOS, Windows, Linux. GPU via Metal/Vulkan/WebGPU/DX12. NPU on Snapdragon Android
  and Intel Windows.
- Android API 34+ requires a foreground-service declaration (for background downloads).
- Features: function calling (Gemma 4, 3n, Gemma 3 1B, DeepSeek R1, Qwen, Phi-4), thinking mode,
  on-device RAG via qdrant-edge or SQLite vector stores, STT/TTS packages.
- 1.6.0 added an **ONNX engine** (`ModelFileType.onnx`) with chat-format routing.

### Open issues (github.com/DenisovAV/flutter_gemma/issues) — only **6 open**
- **#195 "constrained decoding" — OPEN, UNTRIAGED, no maintainer response, no labels.**
  Requester wants JSON/schema enforcement *during decoding*. No workaround offered.
  => **flutter_gemma does NOT support grammar/JSON-schema constrained decoding today.**
- #307 (2026-06-06) Fine-tuned FunctionGemma-270M on iOS: **no working GPU path** —
  "int8 `<pad>` / fp16 OOM, and CPU is ~10s/call". iOS + small-model + OOM trap.
- #268 (2026-05-12) FastVLM-0.5B outputs raw tokens on macOS M4 — text and vision both broken.
- #326 (2026-06-19) feature req: Windows ARM64 native binaries.
- #121, #58 LoRA-related.
Low open-issue count is a good sign but note the maintainer ships fast and may close aggressively.

## 2. MediaPipe LLM Inference API — MAINTENANCE-ONLY

- https://developers.google.com/edge/mediapipe/solutions/genai/llm_inference (last updated 2026-06-12)
- Explicitly **"maintenance-only mode"**. Google says migrate to **LiteRT-LM**.
- Models: Gemma-3n E2B/E4B (.litertlm, Android+Web), Gemma-3 1B (.task/.litertlm, Android+Web),
  Gemma-2 2B (.task, all platforms). Config: maxTokens default 512, temperature 0.8, topK 40.
- **No mention of constrained decoding / structured output anywhere in the API docs.**
- iOS projects told to migrate to the LiteRT-LM Swift API.

## 3. LiteRT-LM — the successor
- https://github.com/google-ai-edge/LiteRT-LM — Google's production on-device LLM runtime.
- Swift API for iOS/macOS is open-source and first-party; SPM integration.
- Tool calling / agentic streaming added in C, Swift, JS APIs 2026.
- (more detail pending)

---
TODO: LiteRT-LM details, model sizes, llama.cpp/fllama, ONNX Runtime GenAI, ExecuTorch,
MLC, Cactus, Apple Foundation Models, constrained decoding options, BM25 fallback, verdict.
