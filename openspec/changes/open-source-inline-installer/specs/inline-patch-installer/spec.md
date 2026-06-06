## ADDED Requirements

### Requirement: In-place installation
The system SHALL install the Chinese UI switcher into a user-selected existing Hermes Desktop `.app` without creating an additional `.app` bundle.

#### Scenario: Default install targets existing Hermes
- **WHEN** the user runs the documented install command without a copy target
- **THEN** the installer patches the selected Hermes app in place and does not create `/Applications/Hermes.zh.app`

#### Scenario: Copy install is rejected
- **WHEN** the user provides a copy-target option
- **THEN** the installer exits before modifying files and explains that public installs are in-place only

### Requirement: Reversible UI patch
The system SHALL limit modifications to the UI patch injection so uninstall can remove the Chinese UI layer without deleting user data or Hermes backend files.

#### Scenario: Uninstall removes injection
- **WHEN** the user runs the uninstall command against a patched Hermes app
- **THEN** `dist/index.html` no longer contains the switcher marker and `dist/hermes-zh-ui.js` is removed from `app.asar`

#### Scenario: User data remains untouched
- **WHEN** install or uninstall runs
- **THEN** files under `~/.hermes`, Hermes profiles, API key files, gateway config, and update config are not modified by the patcher

### Requirement: Failed operations rollback
The system SHALL restore the selected app's previous `app.asar` when an install or uninstall mutation fails before completion.

#### Scenario: Install verification fails
- **WHEN** the installer writes the patched `app.asar` but signing or injection verification fails
- **THEN** the installer restores the pre-install `app.asar` and reports that rollback was attempted

#### Scenario: Uninstall verification fails
- **WHEN** uninstall removes the UI injection but signing or verification fails
- **THEN** uninstall restores the pre-uninstall `app.asar` and reports that rollback was attempted

### Requirement: Update-safe workflow
The system SHALL provide a documented helper workflow that removes the UI patch, runs upstream Hermes update, reinstalls the UI patch, and verifies the result.

#### Scenario: Update helper preserves upstream update
- **WHEN** the user runs the update helper
- **THEN** the helper uninstalls the UI patch before invoking `hermes update`, then reinstalls and verifies the UI patch after the upstream update completes

#### Scenario: Native Hermes update remains functional
- **WHEN** the user runs the native Hermes updater without the helper
- **THEN** Hermes update is not blocked by the Chinese UI patch; the patch may be overwritten and can be reinstalled afterward

### Requirement: Validation for public reuse
The system SHALL include checks that confirm syntax, dictionary samples, install state, signature state, runtime toggle behavior, and obvious untranslated UI candidates.

#### Scenario: Release checks pass
- **WHEN** the maintainer runs the documented validation commands
- **THEN** syntax checks, dictionary checks, signature checks, runtime toggle checks, and runtime UI audit complete successfully
