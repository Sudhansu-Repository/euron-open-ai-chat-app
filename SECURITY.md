# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.x (latest minor) | Yes |
| Older minors | No |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's private vulnerability reporting on this repository ("Security"
tab, "Report a vulnerability"):
https://github.com/euron-sde-team/euron-open-ai-chat-app/security/advisories/new

A flaw in the server (authentication, quotas, tools, shared links, push sending) belongs to
[euron-open-ai-chat](https://github.com/euron-sde-team/euron-open-ai-chat/security/advisories/new);
if unsure, report here and we will move it.

Please include the app version and build (Settings, About), the platform and OS version, the server
version, steps to reproduce or a proof of concept, and the impact.

| Stage | Target |
| ----- | ------ |
| Acknowledgement | within 3 business days |
| Initial assessment and severity | within 7 business days |
| Fix or mitigation for critical / high issues | within 30 days |
| Coordinated public disclosure | after a fix is released, credited to you unless you prefer otherwise |

## Scope

In scope, the code in this repository with its default settings:

- **Session storage.** Reading or reusing the refresh token or access token from outside the app,
  tokens reaching logs, MMKV, a WebView or a share sheet, a token sent to a server other than the one
  that issued it, sign-out that leaves a usable session behind.
- **The server picker.** Addresses that should be refused but are accepted (plain HTTP to public
  hosts, credentials in the URL), or switching servers without signing out.
- **Rendering untrusted content.** Answers, sources or tool output that run script, load remote
  content in the math WebView, or open a non-http link.
- **Deep links and push.** Links or notification payloads that open screens or URLs they should not,
  or act on the person's behalf (including `openchat://` scheme handling).
- **Data left on the device.** The offline cache or files surviving a sign-out, or one account's
  chats visible to the next.
- **Transport.** Cleartext traffic in release builds beyond what is documented.
- **Secrets in the repository** (keys, Firebase config, signing material).

Out of scope:

- Rooted or jailbroken devices, and someone holding the unlocked phone.
- Debug-build behaviour (cleartext to a local stack).
- Documented limits: no certificate pinning, no screenshot protection, an unencrypted offline cache
  ([docs/architecture/security.md](docs/architecture/security.md)).
- A person choosing a hostile server on purpose.
- Findings that need leaked deployment secrets or a compromised server.
