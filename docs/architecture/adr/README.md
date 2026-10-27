# Architecture decision records

Short records of the decisions that shape Euron Open AI Chat App: the context, what was decided,
and what it costs. The app as built is described in [HLD.md](../HLD.md) and
[app-architecture.md](../app-architecture.md). Decisions on the server side live in
[euron-open-ai-chat](https://github.com/euron-sde-team/euron-open-ai-chat/blob/main/docs/architecture/adr/README.md),
in particular ADR 0005 (turns decoupled through Redis streams), 0013 (native token mode) and 0015
(push armed per answer).

| ADR | Decision |
| --- | --- |
| [0001](0001-bare-react-native-cli.md) | A bare React Native CLI app, not Expo |
| [0002](0002-vendored-api-contract-with-a-drift-check.md) | The server's types and API client are vendored verbatim and checked for drift |
| [0003](0003-native-token-mode-and-keychain.md) | Native token mode: refresh token in the Keychain/Keystore with its server, access token in memory |
| [0004](0004-server-picker.md) | One build, any server: a validated server picker on the welcome screen |
| [0005](0005-send-then-follow-over-xhr.md) | Send with a 202, follow over XHR, hand off to the server in the background |
| [0006](0006-push-opt-in-per-answer.md) | Push is offered in context and armed per answer |
| [0007](0007-read-only-offline-cache.md) | A small, read-only offline cache that belongs to the session |
| [0008](0008-markdown-renderer.md) | Markdown drawn as native views with marked; math as MathML in a sandboxed WebView |
| [0009](0009-design-tokens-mirrored-from-the-web.md) | Design tokens mirrored from the web app |
| [0010](0010-features-switched-by-the-server.md) | Features are switched by the server's `/api/meta`, not by the build |

A change that alters one of these decisions needs a new ADR (or an amendment with its reasoning)
in the same pull request.
