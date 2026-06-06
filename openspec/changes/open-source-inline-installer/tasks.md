## 1. Specification

- [x] 1.1 Create OpenSpec proposal, design, and inline installer requirements
- [x] 1.2 Validate OpenSpec change artifacts

## 2. Installer Behavior

- [x] 2.1 Change install script to support public in-place installs by default
- [x] 2.2 Reject copy-app install options before modifying files
- [x] 2.3 Keep patch scope limited to `app.asar` UI injection and re-sign the target app
- [x] 2.4 Update uninstall and verify scripts for the in-place public workflow
- [x] 2.5 Add automatic rollback around install/uninstall mutation failures

## 3. Update Safety

- [x] 3.1 Add an update helper that uninstalls the patch, runs `hermes update`, reinstalls the patch, and verifies
- [x] 3.2 Add a safety check that validates original-target patching, toggle behavior, and Hermes update availability reporting

## 4. Documentation

- [x] 4.1 Rewrite README for open-source users, installation, uninstall, update, troubleshooting, and technical identifiers
- [x] 4.2 Update package scripts and version metadata for the new behavior

## 5. Verification

- [x] 5.1 Run syntax and dictionary checks
- [x] 5.2 Run dry-run safety checks for rejected copy install and accepted in-place install
- [x] 5.3 Verify install/uninstall on a temporary test `.app`
- [ ] 5.4 Install on the local Hermes target and verify signature/toggle
- [ ] 5.5 Run runtime audit for Settings, Skills/Toolsets, Messaging platforms, and installer/update UI
