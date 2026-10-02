/** Public dependency entry points, not copied component implementations. */
export const betterAuthUICatalog = [
  {
    module: '@better-auth-ui/heroui',
    category: 'auth, settings, user',
    exports: [
      'Auth',
      'SignIn',
      'SignUp',
      'SignOut',
      'AuthRedirect',
      'ForgotPassword',
      'ResetPassword',
      'VerifyEmail',
      'Settings',
      'UserButton',
      'UserAvatar',
      'UserView',
    ],
  },
  {
    module: '@better-auth-ui/heroui/email',
    category: 'email',
    exports: ['Native email templates'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/admin',
    category: 'admin',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/agent-auth',
    category: 'agent-auth',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/api-key',
    category: 'api-key',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/billing',
    category: 'billing',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/dash',
    category: 'dash',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/delete-user',
    category: 'delete-user',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/device-authorization',
    category: 'device-authorization',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/email-otp',
    category: 'email-otp',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/magic-link',
    category: 'magic-link',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/multi-session',
    category: 'multi-session',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/oauth-provider',
    category: 'oauth-provider',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/organization',
    category: 'organization',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/passkey',
    category: 'passkey',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/sso',
    category: 'sso',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/siwe',
    category: 'siwe',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/theme',
    category: 'theme',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/two-factor',
    category: 'two-factor',
    exports: ['Native components and plugin options'],
  },
  {
    module: '@better-auth-ui/heroui/plugins/username',
    category: 'username',
    exports: ['Native components and plugin options'],
  },
] as const;
