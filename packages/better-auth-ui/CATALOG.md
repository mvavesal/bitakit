# Öffentliche Bibliotheks-Einstiegspunkte

Alle folgenden Komponenten stammen unmittelbar aus `@better-auth-ui/heroui` 1.7.26. Keine Quellcodekopien. Der Foundation-Adapter re-exportiert die öffentlichen Haupt-, Email- und Plugin-Einstiegspunkte. Originale Props/Types bleiben erhalten.

| Originalimport | Foundationimport |
| --- | --- |
| `@better-auth-ui/heroui` | `@bitakit/better-auth-ui` |
| `@better-auth-ui/heroui/email` | `@bitakit/better-auth-ui/email` |
| `@better-auth-ui/heroui/plugins` | `@bitakit/better-auth-ui/plugins` |
| `@better-auth-ui/heroui/plugins/admin` | `@bitakit/better-auth-ui/plugins/admin` |
| `@better-auth-ui/heroui/plugins/agent-auth` | `@bitakit/better-auth-ui/plugins/agent-auth` |
| `@better-auth-ui/heroui/plugins/api-key` | `@bitakit/better-auth-ui/plugins/api-key` |
| `@better-auth-ui/heroui/plugins/billing` | `@bitakit/better-auth-ui/plugins/billing` |
| `@better-auth-ui/heroui/plugins/dash` | `@bitakit/better-auth-ui/plugins/dash` |
| `@better-auth-ui/heroui/plugins/delete-user` | `@bitakit/better-auth-ui/plugins/delete-user` |
| `@better-auth-ui/heroui/plugins/device-authorization` | `@bitakit/better-auth-ui/plugins/device-authorization` |
| `@better-auth-ui/heroui/plugins/email-otp` | `@bitakit/better-auth-ui/plugins/email-otp` |
| `@better-auth-ui/heroui/plugins/magic-link` | `@bitakit/better-auth-ui/plugins/magic-link` |
| `@better-auth-ui/heroui/plugins/multi-session` | `@bitakit/better-auth-ui/plugins/multi-session` |
| `@better-auth-ui/heroui/plugins/oauth-provider` | `@bitakit/better-auth-ui/plugins/oauth-provider` |
| `@better-auth-ui/heroui/plugins/organization` | `@bitakit/better-auth-ui/plugins/organization` |
| `@better-auth-ui/heroui/plugins/passkey` | `@bitakit/better-auth-ui/plugins/passkey` |
| `@better-auth-ui/heroui/plugins/sso` | `@bitakit/better-auth-ui/plugins/sso` |
| `@better-auth-ui/heroui/plugins/siwe` | `@bitakit/better-auth-ui/plugins/siwe` |
| `@better-auth-ui/heroui/plugins/theme` | `@bitakit/better-auth-ui/plugins/theme` |
| `@better-auth-ui/heroui/plugins/two-factor` | `@bitakit/better-auth-ui/plugins/two-factor` |
| `@better-auth-ui/heroui/plugins/username` | `@bitakit/better-auth-ui/plugins/username` |

Hauptkomponenten: Auth, SignIn, SignUp, SignOut, AuthRedirect, ForgotPassword, ResetLinkSent, ResetPassword, VerifyEmail, Settings, AccountSettings, UserProfile, ChangeEmail, SecuritySettings, ChangePassword, LinkedAccounts, ActiveSessions, UserAvatar, UserButton, UserView und weitere öffentliche Hilfskomponenten.

Organisation und MultiSession sind im Content-Host aktiviert. Alle weiteren Erweiterungen benötigen ihre passenden Server-/Client-Plugins und Konfiguration: z. B. SSO einen IdP, Billing einen Zahlungsadapter, Passkeys passende Origin, Social OAuth eigene Credentials. Captcha/One Tap über die nativen Optionen konfigurieren. Das Inventar aktiviert keine Dienste.
