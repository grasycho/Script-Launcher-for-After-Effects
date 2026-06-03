# ScriptLauncher v4.0 🚀

A powerful, dockable Script Launcher panel for Adobe After Effects. Designed to keep your workspace clean and your workflow fast, it allows you to organize, search, and execute your ExtendScript (`.jsx` / `.js`) files with ease. 

**Compatible with:** After Effects CS6 through CC 2025+ (ExtendScript ES3-safe)

---

## ✨ Features

* **Dual View Modes:** Switch between a compact **List View** and a grid-based **Mini View** (icon-only).
* **Favorites & Recent Tabs:** Quickly access your most-used scripts without digging through folders. Star your go-to scripts or rely on the automatic Recent history.
* **Custom Icons & Tooltips:** Easily assign custom thumbnail icons and hover-tooltips to your scripts for quick visual identification.
* **Smart Search:** Instant, as-you-type filtering to find the exact script you need.
* **Custom Script Folders:** Store your scripts anywhere. Point the launcher to your preferred directory via the built-in Settings dialog.
* **Safe Execution:** Wraps script execution in a single Undo Group (`app.beginUndoGroup`), ensuring that whatever the script does can be cleanly undone with a single `Ctrl+Z` / `Cmd+Z`.
* **Persistent Settings:** Remembers your window size, active tab, view mode, custom folder paths, and history across After Effects sessions using a local JSON settings file.

## 📦 Installation

1. Download `ScriptLauncher_v4.jsx`.
2. Copy the file into your After Effects `ScriptUI Panels` folder:
   * **Windows:** `C:\Program Files\Adobe\Adobe After Effects <Version>\Support Files\Scripts\ScriptUI Panels\`
   * **macOS:** `/Applications/Adobe After Effects <Version>/Scripts/ScriptUI Panels/`
3. Restart After Effects.
4. Open the panel by navigating to **Window > ScriptLauncher_v4.jsx** in the top menu bar.

## 💡 Usage Guide

### 1. Adding Scripts
By default, the launcher looks for a folder named `Scripts` located in the same directory as the launcher itself. 
* You can drop your `.jsx`, `.js`, or `.jsxbin` files directly into this folder.
* **Alternative:** Click the Settings (⚙) icon and choose a completely custom folder anywhere on your machine.

### 2. Adding Custom Icons
To display an icon next to your script, simply place an image file with the **exact same base name** as your script in the same folder.
* *Example:* For `MyScript.jsx`, add `MyScript.png`.
* *Supported formats:* `.png`, `.gif`, `.tif`, `.tiff`, `.jpg`, `.jpeg`, `.bmp`.

### 3. Adding Tooltips
To add custom descriptions that appear when you hover over a script (highly recommended for Mini View), create a plain text file with the same base name.
* *Example:* For `MyScript.jsx`, create `MyScript.txt`.
* Write your description on the first line of the text file.

### 4. Interface Controls
* 🔍 **Search Bar:** Type to filter the current view.
* 📁 **Folder Button:** Opens your current scripts directory directly in Windows Explorer or macOS Finder.
* ▣ **Mini View / ≡ List View:** Toggle how scripts are displayed.
* ↺ **Refresh:** Reloads the script list from your drive (useful if you just added a new file).
* ⚙ **Settings:** Access customization options.

## ⚙️ Configuration (Settings Dialog)

Click the gear icon to customize the launcher:
* **Scripts Folder:** Define a custom path for your script repository.
* **Max Recent Entries:** Choose how many history items to keep (1–20).
* **Mini Icon Size:** Adjust the scaling of grid icons (16px to 128px) to suit your monitor resolution.
* **Clear History:** Wipe your Recent or Favorites lists cleanly.

## 🛠 Technical Details & Compatibility

* **JSON Polyfill Included:** Native support for older ExtendScript engines (like CS6) that lack built-in JSON parsing.
* **ES3-Safe:** Carefully written to avoid modern JS syntax errors in legacy environments.
* **Settings File:** Preferences are saved locally to `ScriptLauncher.settings.json` next to the main `.jsx` file.
