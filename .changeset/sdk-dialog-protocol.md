---
"@featurefountain/browser": minor
---

Own the request dialog in the SDK: one Close button, overlay, Escape, focus trap, and backdrop click, including when the iframe never loads. Speak embed protocol 1 (`ready`, `handshake`, `theme`, `resize`, `close-request`, `submitted`) with strict origin checks, `embed=1`, iframe height from `resize` (100–4096), and theme options after `ready`. Publish the parser from `@featurefountain/browser/protocol`. 0.2.0 replaces 0.1.0 embeds with no compatibility. After the handshake, `refresh-request` renews the embed session and the SDK replies with `session`.
