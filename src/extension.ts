// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as jsonc from 'jsonc-parser';

// Import the CMake Tools API from vscode-cmake-tools package
import { getCMakeToolsApi, Version, CMakeToolsApi, Project, ConfigurationType } from 'vscode-cmake-tools';

// Interface for the CMake presentation matcher in launch.json
interface CMakeMatcher {
  type: 'preset-include' | 'preset-match' | 'kit-include' | 'kit-match' | 'include' | 'match';
  value: string;
}

// Interface for presentation in launch configuration
interface PresentationConfig {
  hidden?: boolean;
  cmake?: CMakeMatcher[];
}

// Interface for launch configuration
interface LaunchConfig {
  presentation?: PresentationConfig;
  [key: string]: any;
}

// Interface for launch.json content
interface LaunchJson {
  configurations: LaunchConfig[];
  [key: string]: any;
}

// Extension state
let currentPreset: string | null = null;
let currentKit: string | null = null;

/**
 * Initialize all the necessary watchers for a CMake project
 */
async function initializeProjectWatchers(project: Project) {
  project.onSelectedConfigurationChanged(async (configType: ConfigurationType) => {
    currentKit = null;
    currentPreset = null;

    // Get the active preset name directly using commands
    if (configType == ConfigurationType.ConfigurePreset || configType == ConfigurationType.BuildPreset) {
      try {
        // First try to get the active build preset (preferred)
        const activeBuildPreset = await vscode.commands.executeCommand('cmake.activeBuildPresetName');
        if (activeBuildPreset && activeBuildPreset !== '__defaultBuildPreset__') {
          console.log(`[vscode-toggle-debug-options-by-cmake] Active build preset found: ${activeBuildPreset}`);
          currentPreset = String(activeBuildPreset);
        } else {
          // Fall back to active configure preset
          const activeConfigurePreset = await vscode.commands.executeCommand('cmake.activeConfigurePresetName');
          if (activeConfigurePreset && activeConfigurePreset !== '__defaultConfigurePreset__') {
            console.log(`[vscode-toggle-debug-options-by-cmake] Active configure preset found: ${activeConfigurePreset}`);
            currentPreset = String(activeConfigurePreset);
          } else {
            console.log('[vscode-toggle-debug-options-by-cmake] No presets available');
          }
        }
      } catch (presetError) {
        console.error(`[vscode-toggle-debug-options-by-cmake] Error getting active preset:`, presetError);
      }
    }

    // Get the actual kit name
    if (configType == ConfigurationType.Kit) {
      try {
        const buildKit = await vscode.commands.executeCommand('cmake.buildKit');
        if (buildKit) {
          console.log(`[vscode-toggle-debug-options-by-cmake] Build kit found: ${buildKit}`);
          currentKit = String(buildKit);
        } else {
          console.log('[vscode-toggle-debug-options-by-cmake] No kit available');
        }
      } catch (kitError) {
        console.error(`[vscode-toggle-debug-options-by-cmake] Error getting build kit:`, kitError);
      }
    }
    updateLaunchConfigurations();
  });

  // Try to directly access current state
  try {
    currentKit = null;
    currentPreset = null;

    // Get the active preset name directly using commands
    try {
      // First try to get the active build preset (preferred)
      const activeBuildPreset = await vscode.commands.executeCommand('cmake.activeBuildPresetName');
      if (activeBuildPreset && activeBuildPreset !== '__defaultBuildPreset__') {
        console.log(`[vscode-toggle-debug-options-by-cmake] Initial active build preset found: ${activeBuildPreset}`);
        currentPreset = String(activeBuildPreset);
      } else {
        // Fall back to active configure preset
        const activeConfigurePreset = await vscode.commands.executeCommand('cmake.activeConfigurePresetName');
        if (activeConfigurePreset && activeConfigurePreset !== '__defaultConfigurePreset__') {
          console.log(`[vscode-toggle-debug-options-by-cmake] Initial active configure preset found: ${activeConfigurePreset}`);
          currentPreset = String(activeConfigurePreset);
        } else {
          console.log('[vscode-toggle-debug-options-by-cmake] No presets available');
        }
      }
    } catch (presetError) {
      console.error(`[vscode-toggle-debug-options-by-cmake] Error getting initial active preset:`, presetError);
    }

    // Get the actual kit name
    if (currentPreset == null) {
      try {
        const buildKit = await vscode.commands.executeCommand('cmake.buildKit');
        if (buildKit) {
          console.log(`[vscode-toggle-debug-options-by-cmake] Initial build kit found: ${buildKit}`);
          currentKit = String(buildKit);
        } else {
          console.log('[vscode-toggle-debug-options-by-cmake] No kit available');
        }
      } catch (kitError) {
        console.error(`[vscode-toggle-debug-options-by-cmake] Error getting initial build kit:`, kitError);
      }
    }

    updateLaunchConfigurations();
  } catch (error) {
    console.error('[vscode-toggle-debug-options-by-cmake] Error getting initial project state:', error);
  }
}

export async function activate(context: vscode.ExtensionContext) {
  // Try to get the CMake Tools API
  const cmakeAPI = await getCMakeToolsAPI();
  if (!cmakeAPI) {
    console.warn('[vscode-toggle-debug-options-by-cmake] CMake Tools API not found, the extension will not function properly.');
    return;
  }

  // Set up the active project watcher
  try {
    // Try to get the active folder first
    const activeFolderPath = cmakeAPI.getActiveFolderPath();

    // Try to get active project directly
    if (activeFolderPath) {
      const activeProjectUri = vscode.Uri.file(activeFolderPath);
      const activeProject = await cmakeAPI.getProject(activeProjectUri);

      if (activeProject) {
        // Set up direct configuration watchers for the active project
        initializeProjectWatchers(activeProject);
      } else {
        console.log('[vscode-toggle-debug-options-by-cmake] Failed to get active project directly');
        // Try one more time with workspace folders
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          const workspaceProject = await cmakeAPI.getProject(workspaceFolders[0].uri);
          if (workspaceProject) {
            initializeProjectWatchers(workspaceProject);
          } else {
            console.log('[vscode-toggle-debug-options-by-cmake] Failed to get project from workspace folder');
          }
        }
      }
    }

    // Also set up the active project watcher as a backup
    // Since we want to track presets and kits, we need to get the active project
    // and watch for changes to the configuration
    cmakeAPI.onActiveProjectChanged(async (projectUri: vscode.Uri | undefined) => {
      if (projectUri) {
        const project = await cmakeAPI.getProject(projectUri);
        if (project) {
          initializeProjectWatchers(project);
        }
      }
    });

  } catch (error) {
    console.error('[vscode-toggle-debug-options-by-cmake] Error setting up CMake project watchers:', error);
  }

  // Register command to manually refresh configurations
  const refreshCommand = vscode.commands.registerCommand('vscode-toggle-debug-options-by-cmake.refreshDebugConfigs', () => {
    vscode.window.showInformationMessage('Refreshing debug configurations based on CMake selection.');
    updateLaunchConfigurations();
  });

  context.subscriptions.push(refreshCommand);
}

/**
 * Gets the CMake Tools API object
 */
async function getCMakeToolsAPI(): Promise<CMakeToolsApi | undefined> {
  try {
    // Use the imported getCMakeToolsApi function
    const api = await getCMakeToolsApi(Version.v3);
    if (!api) {
      vscode.window.showWarningMessage('CMake Tools API is not available. This extension requires CMake Tools to function.');
      return undefined;
    }
    return api;
  } catch (error) {
    console.error('[vscode-toggle-debug-options-by-cmake] Error getting CMake Tools API:', error);
    return undefined;
  }
}

/**
 * Updates launch configurations in .vscode/launch.json based on current CMake state
 */
async function updateLaunchConfigurations() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    console.log('No workspace folder is open');
    return;
  }

  for (const folder of workspaceFolders) {
    const launchJsonPath = path.join(folder.uri.fsPath, '.vscode', 'launch.json');
    try {
      // Check if launch.json exists
      if (!fs.existsSync(launchJsonPath)) {
        console.log(`[vscode-toggle-debug-options-by-cmake] No launch.json found at ${launchJsonPath}`);
        continue;
      }

      // Read and parse launch.json with comments support
      const launchJsonContent = fs.readFileSync(launchJsonPath, 'utf8');
      // Use jsonc-parser to handle JSON with comments
      const errors: jsonc.ParseError[] = [];
      const launchJson: LaunchJson = jsonc.parse(launchJsonContent, errors, {
        allowTrailingComma: true,
        allowEmptyContent: true,
        disallowComments: false
      });

      if (errors.length > 0) {
        console.error(`[vscode-toggle-debug-options-by-cmake] Errors parsing launch.json:`, errors);
        continue;
      }

      let configChanged = false;

      // Process each configuration
      if (launchJson.configurations && Array.isArray(launchJson.configurations)) {
        for (const config of launchJson.configurations) {
          // Skip configs without presentation.cmake
          if (!config.presentation || !config.presentation.cmake || !Array.isArray(config.presentation.cmake) || config.presentation.cmake.length === 0) {
            continue;
          }

          // Check each matcher
          const matchers = config.presentation.cmake as CMakeMatcher[];
          const matchResult = evaluateMatchers(matchers);

          // Update hidden property if it's different
          if (config.presentation.hidden !== !matchResult) {
            config.presentation.hidden = !matchResult;
            configChanged = true;
          }
        }
      }

      // Save the file if there were changes
      if (configChanged) {
        // Instead of using JSON.stringify, use jsonc's modify and applyEdits to preserve comments
        let result = launchJsonContent;
        
        if (launchJson.configurations && Array.isArray(launchJson.configurations)) {
          for (let i = 0; i < launchJson.configurations.length; i++) {
            const config = launchJson.configurations[i];
            // Only modify configurations that have been changed
            if (config.presentation && config.presentation.cmake) {
              // Use modify to update the 'hidden' property while preserving comments
              const edits = jsonc.modify(
                result,
                ['configurations', i, 'presentation', 'hidden'],
                config.presentation.hidden,
                { formattingOptions: { tabSize: 4, insertSpaces: true, eol: '\n' } }
              );
              result = jsonc.applyEdits(result, edits);
            }
          }
        }
        
        fs.writeFileSync(launchJsonPath, result, 'utf8');
      }
    } catch (error) {
      console.error(`[vscode-toggle-debug-options-by-cmake] Error updating launch.json: ${error}`);
    }
  }
}

/**
 * Evaluates all matchers against current CMake state
 * @param matchers The array of matchers to evaluate
 * @returns true if any matcher matches, false otherwise
 */
function evaluateMatchers(matchers: CMakeMatcher[]): boolean {
  // If we don't have preset or kit info, we can't match
  if (!currentPreset && !currentKit) {
    return false;
  }

  // Check each matcher
  for (const matcher of matchers) {
    switch (matcher.type) {
      case 'preset-include':
        if (currentPreset && currentPreset.includes(matcher.value)) {
          return true;
        }
        break;

      case 'preset-match':
        if (currentPreset && new RegExp(matcher.value).test(currentPreset)) {
          return true;
        }
        break;

      case 'kit-include':
        if (currentKit && currentKit.includes(matcher.value)) {
          return true;
        }
        break;

      case 'kit-match':
        if (currentKit && new RegExp(matcher.value).test(currentKit)) {
          return true;
        }
        break;

      case 'include':
        // Check both preset and kit
        if ((currentPreset && currentPreset.includes(matcher.value)) ||
          (currentKit && currentKit.includes(matcher.value))) {
          return true;
        }
        break;

      case 'match':
        // Check both preset and kit
        if ((currentPreset && new RegExp(matcher.value).test(currentPreset)) ||
          (currentKit && new RegExp(matcher.value).test(currentKit))) {
          return true;
        }
        break;
    }
  }

  // No matcher succeeded
  return false;
}

export function deactivate() {
  // Clean up is handled by context.subscriptions
  console.log('[vscode-toggle-debug-options-by-cmake] Extension deactivated');
}