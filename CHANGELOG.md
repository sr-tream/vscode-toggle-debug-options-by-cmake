# Change Log

All notable changes to the "vscode-toggle-debug-options-by-cmake" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.0.1] - 2025-04-16

### Added
- Initial release of the extension
- Automatic toggling of debug configurations based on CMake preset and build kit
- Support for 6 matcher types: `preset-include`, `preset-match`, `kit-include`, `kit-match`, `include`, `match`
- Command to manually refresh debug configurations

### Fixed
- Ensured comments and formatting in launch.json are preserved when making modifications
- Improved error handling for invalid JSON files