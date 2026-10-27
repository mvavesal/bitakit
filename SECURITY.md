# Security policy

## Report a vulnerability

Please do not report security issues in public issues, pull requests or Discussions.

Report them privately through GitHub:
[Report a vulnerability](https://github.com/mvavesal/bitakit/security/advisories/new). If that
is not possible, write to [mva.vesal@gmail.com](mailto:mva.vesal@gmail.com).

Include the affected package and version, a description of the issue, steps to reproduce it and
its impact as you understand it. We aim to acknowledge a report within a few working days and to
keep you informed until it is resolved. Once a fix is released, we publish an advisory and credit
you unless you prefer otherwise.

## Supported versions

Security fixes are released for the current release line of the `@bitakit/*` packages
(currently 0.2.x). Update to the latest patch version first; a fix will not be backported to
older lines.

## Scope

Plugins run as trusted code inside the app; BitaKit does not sandbox them. A plugin you install
can do anything your app can. Issues in third-party plugins should be reported to their authors.
