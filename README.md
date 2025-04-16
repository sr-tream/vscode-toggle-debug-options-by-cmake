# vscode-toggle-debug-options-by-cmake

A VSCode extension that automatically toggles debug configurations in `launch.json` based on the selected CMake preset and build kit.

## Features
- Automatically updates the `presentation.hidden` property in `launch.json` based on matcher rules
- Supports 6 matcher types: `preset-include`, `preset-match`, `kit-include`, `kit-match`, `include`, `match`

## Requirements
- [CMake Tools Extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cmake-tools) for VSCode
- A project configured with CMake presets or build kits

## Usage
1. Install this extension.
2. Open a project with CMake presets or build kits.
3. The extension will automatically toggle the visibility of debug configurations in `launch.json` to match your selection.

## Matcher Types
The extension uses matchers to determine whether a debug configuration should be shown or hidden. You can define these matchers in your `launch.json` file under each configuration's `presentation.cmake` array.

Available matcher types:

| Matcher Type | Description |
|-------------|-------------|
| `preset-include` | Shows the configuration when the current CMake preset name includes the specified value |
| `preset-match` | Shows the configuration when the current CMake preset name matches the specified regex pattern |
| `kit-include` | Shows the configuration when the current CMake kit name includes the specified value |
| `kit-match` | Shows the configuration when the current CMake kit name matches the specified regex pattern |
| `include` | Shows the configuration when either the preset or kit name includes the specified value |
| `match` | Shows the configuration when either the preset or kit name matches the specified regex pattern |

## Examples

### Show a configuration only for Debug preset
```json
{
  "configurations": [
    {
      "name": "Debug Application",
      "type": "cppdbg",
      "request": "launch",
      // ... other debug configuration properties
      "presentation": {
        "cmake": [
          {
            "type": "preset-include",
            "value": "Debug"
          }
        ]
      }
    }
  ]
}
```

### Show a configuration for any GCC kit
```json
{
  "configurations": [
    {
      "name": "GCC Debug",
      "type": "cppdbg",
      "request": "launch",
      // ... other debug configuration properties
      "presentation": {
        "cmake": [
          {
            "type": "kit-match",
            "value": "GCC.*"
          }
        ]
      }
    }
  ]
}
```

### Show a configuration for multiple conditions (Unix or Linux)
```json
{
  "configurations": [
    {
      "name": "Unix/Linux Launch",
      "type": "cppdbg",
      "request": "launch",
      // ... other debug configuration properties
      "presentation": {
        "cmake": [
          {
            "type": "match",
            "value": "(unix|linux)"
          }
        ]
      }
    }
  ]
}
```

## Known Limitations
- CMake variants are not supported (only presets and kits are supported)

## License
This project is licensed under the MIT License.