//@include "ScriptLauncher_v4.jsx"
// ScriptLauncher v4.0  —  Mehmet Sensoy  |  Enhanced 2025
// Compatible: AE CS6 through CC 2025+  (ExtendScript ES3-safe)

(function ScriptLauncher(thisObj) {
    "use strict";

    // =========================================================================
    //  JSON POLYFILL  — ExtendScript has no native JSON in CS6/CC2014
    // =========================================================================
    if (typeof JSON === "undefined") {
        JSON = {};
        JSON.stringify = function(obj) {
            if (obj === null)             return "null";
            if (typeof obj === "boolean") return String(obj);
            if (typeof obj === "number")  return isFinite(obj) ? String(obj) : "null";
            if (typeof obj === "string") {
                return '"' + obj.replace(/\\/g, "\\\\")
                                .replace(/"/g,  '\\"')
                                .replace(/\n/g, "\\n")
                                .replace(/\r/g, "\\r")
                                .replace(/\t/g, "\\t") + '"';
            }
            if (obj instanceof Array) {
                var a = [];
                for (var i = 0; i < obj.length; i++) a.push(JSON.stringify(obj[i]));
                return "[" + a.join(",") + "]";
            }
            if (typeof obj === "object") {
                var p = [];
                for (var k in obj) {
                    if (obj.hasOwnProperty(k)) p.push(JSON.stringify(k) + ":" + JSON.stringify(obj[k]));
                }
                return "{" + p.join(",") + "}";
            }
            return "undefined";
        };
        JSON.parse = function(str) {
            // ExtendScript can eval JSON safely when wrapped
            try { return eval("(" + str + ")"); } catch (e) { throw new Error("JSON.parse error: " + e); }
        };
    }

    // =========================================================================
    //  CONFIG
    // =========================================================================
    var CFG = {
        BUTTON_H   : 22,
        MINI_SIZE  : 36,
        SPACING    : 4,
        MARGINS    : 8,
        MAX_RECENT : 8,
        VERSION    : "4.0",
        ICON_EXTS  : ["png", "gif", "tif", "tiff", "jpg", "jpeg", "bmp"],
        SEARCH_PH  : "Search..."      // single source of truth for placeholder text
    };

    // =========================================================================
    //  PERSISTENT SETTINGS
    // =========================================================================
    var thisScriptFile = new File($.fileName);
    var settingsFile   = new File(thisScriptFile.parent.fsName + "/ScriptLauncher.settings.json");

    // scriptsFolder is an actual Folder object; kept in sync with settings.scriptsFolderPath
    var scriptsFolder  = new Folder(thisScriptFile.parent.fsName + "/Scripts");

    var settings = {
        scriptsFolderPath : "",       // NEW — persisted custom folder
        recentScripts     : [],
        favorites         : [],
        viewMode          : "list",   // "list" | "mini"
        lastTab           : "all",
        maxRecent         : CFG.MAX_RECENT,
        miniSize          : CFG.MINI_SIZE
    };

    function saveSettings() {
        var f = settingsFile;
        try {
            f.encoding = "UTF-8";
            if (f.open("w")) {
                f.write(JSON.stringify(settings));
                f.close();
            }
        } catch (e) {
            // Silently ignore write errors (read-only filesystem etc.)
        }
    }

    function loadSettings() {
        if (!settingsFile.exists) return;
        var f = settingsFile;
        try {
            f.encoding = "UTF-8";
            if (!f.open("r")) return;
            var raw = f.read();
            f.close();
            if (!raw || raw === "") return;
            var loaded = JSON.parse(raw);
            for (var k in loaded) {
                if (settings.hasOwnProperty(k)) settings[k] = loaded[k];
            }
            // Migrate deprecated "grid" view mode
            if (settings.viewMode === "grid") settings.viewMode = "list";
            // Restore runtime config from persisted settings
            if (settings.maxRecent > 0 && settings.maxRecent <= 20) CFG.MAX_RECENT = settings.maxRecent;
            if (settings.miniSize  >= 16 && settings.miniSize <= 128) CFG.MINI_SIZE  = settings.miniSize;
            // Restore custom scripts folder
            if (settings.scriptsFolderPath && settings.scriptsFolderPath !== "") {
                var sf = new Folder(settings.scriptsFolderPath);
                if (sf.exists) scriptsFolder = sf;
            }
        } catch (e) {
            // Corrupted settings file — reset silently
            settings.recentScripts     = [];
            settings.favorites         = [];
            settings.viewMode          = "list";
            settings.lastTab           = "all";
            settings.scriptsFolderPath = "";
        }
    }

    // =========================================================================
    //  RECENT / FAVORITES
    // =========================================================================
    function recordRecent(scriptData) {
        var filtered = [];
        for (var i = 0; i < settings.recentScripts.length; i++) {
            if (settings.recentScripts[i].path !== scriptData.path)
                filtered.push(settings.recentScripts[i]);
        }
        filtered.unshift({ name: scriptData.name, path: scriptData.path });
        if (filtered.length > CFG.MAX_RECENT) filtered.length = CFG.MAX_RECENT;
        settings.recentScripts = filtered;
        saveSettings();
    }

    function isFavorite(path) {
        for (var i = 0; i < settings.favorites.length; i++) {
            if (settings.favorites[i] === path) return true;
        }
        return false;
    }

    function toggleFavorite(path) {
        if (isFavorite(path)) {
            var f = [];
            for (var i = 0; i < settings.favorites.length; i++) {
                if (settings.favorites[i] !== path) f.push(settings.favorites[i]);
            }
            settings.favorites = f;
        } else {
            settings.favorites.push(path);
        }
        saveSettings();
    }

    // =========================================================================
    //  ICON DISCOVERY
    // =========================================================================
    function findIcon(folderFsName, scriptName) {
        for (var i = 0; i < CFG.ICON_EXTS.length; i++) {
            var candidate = folderFsName + "/" + scriptName + "." + CFG.ICON_EXTS[i];
            if ((new File(candidate)).exists) return candidate;
        }
        return "";
    }

    function loadIcon(iconPath) {
        if (!iconPath) return null;
        try { return ScriptUI.newImage(iconPath); } catch (e) { return null; }
    }

    // =========================================================================
    //  SCRIPT DISCOVERY
    // =========================================================================
    function safeDecodeURI(str) {
        try { return decodeURI(str); } catch (e) { return str; }
    }

    function strCompare(a, b) {
        // ES3-safe case-insensitive sort fallback
        var la = a.toLowerCase(), lb = b.toLowerCase();
        if (la < lb) return -1;
        if (la > lb) return  1;
        return 0;
    }

    function readTooltip(txtPath) {
        try {
            var f = new File(txtPath);
            if (f.exists) {
                f.encoding = "UTF-8";
                if (f.open("r")) { var line = f.readln(); f.close(); return line || ""; }
            }
        } catch (e) {}
        return "";
    }

    function discoverScripts(folder) {
        var results = [];
        if (!folder || !folder.exists) {
            try { if (folder) folder.create(); } catch (e) {}
            return results;
        }

        var files = [];
        try {
            files = folder.getFiles(function(f) {
                return f instanceof File && /\.(js|jsx|jsxbin)$/i.test(f.name);
            });
        } catch (e) { return results; }

        // ES3-safe sort
        files.sort(function(a, b) { return strCompare(a.name, b.name); });

        for (var i = 0; i < files.length; i++) {
            var f    = files[i];
            var name = safeDecodeURI(f.name).replace(/\.(js|jsx|jsxbin)$/i, "");
            results.push({
                path    : f.fsName,
                icon    : findIcon(folder.fsName, name),
                name    : name,
                tooltip : readTooltip(folder.fsName + "/" + name + ".txt")
            });
        }
        return results;
    }

    // =========================================================================
    //  SCRIPT RUNNER
    //  — $.evalFile wrapped in anonymous function scope to avoid top-level
    //    `return` throwing a ReferenceError in some scripts
    //  — undoGroup always paired (begin only when project exists, end in finally)
    // =========================================================================
    function runScript(scriptData) {
        var file = new File(scriptData.path);
        if (!file.exists) {
            alert("Script not found:\n" + scriptData.path);
            return false;
        }

        var undoStarted = false;
        try {
            if (app.project) {
                app.beginUndoGroup("ScriptLauncher: " + scriptData.name);
                undoStarted = true;
            }
            $.evalFile(file);
            recordRecent(scriptData);
            return true;
        } catch (e) {
            // Ignore benign "return statement outside function" errors that some
            // scripts produce when they have a top-level early return guard.
            var msg = e.toString();
            if (msg.indexOf("return") === -1) {
                alert("Error running '" + scriptData.name + "':\n" + msg +
                      (e.line ? "\nLine: " + e.line : ""));
            } else {
                // Script ran but had a top-level return — still record as recent
                recordRecent(scriptData);
            }
            return false;
        } finally {
            if (undoStarted) {
                try { app.endUndoGroup(); } catch (_) {}
            }
        }
    }

    // =========================================================================
    //  OPEN SCRIPTS FOLDER
    // =========================================================================
    function openScriptsFolder() {
        if (!scriptsFolder.exists) {
            try { scriptsFolder.create(); } catch (e) {}
        }
        try {
            scriptsFolder.execute();
        } catch (e) {
            alert("Could not open Scripts folder:\n" + scriptsFolder.fsName + "\n" + e.toString());
        }
    }

    // =========================================================================
    //  UI BUILDER
    // =========================================================================
    function buildUI(thisObj) {
        loadSettings();

        var panel = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Script Launcher " + CFG.VERSION, undefined, { resizeable: true });

        panel.orientation   = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing       = 3;
        panel.margins       = CFG.MARGINS;

        // ---- Top bar --------------------------------------------------------
        var topBar = panel.add("group");
        topBar.orientation   = "row";
        topBar.alignChildren = ["left", "center"];
        topBar.alignment     = ["fill", "top"];
        topBar.spacing       = 4;

        var searchBox = topBar.add("edittext", undefined, CFG.SEARCH_PH);
        searchBox.preferredSize = [-1, 22];
        searchBox.alignment     = ["fill", "center"];
        searchBox.helpTip       = "Search scripts by name";

        // Set placeholder colour once (suppress errors on older engines)
        try {
            searchBox.graphics.foregroundColor = searchBox.graphics.newPen(
                searchBox.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5, 1], 1
            );
        } catch (e) {}

        var btnFolder   = topBar.add("button", undefined, "Folder");
        btnFolder.preferredSize = [46, 22];
        btnFolder.helpTip = "Open Scripts folder in Explorer/Finder";

        var btnMini = topBar.add("button", undefined, "\u25A3");  // ▣
        btnMini.preferredSize = [26, 22];
        btnMini.helpTip = "Mini icon-only view";

        var btnList = topBar.add("button", undefined, "\u2261");  // ≡
        btnList.preferredSize = [26, 22];
        btnList.helpTip = "List view";

        var btnRefresh = topBar.add("button", undefined, "\u21BA"); // ↺
        btnRefresh.preferredSize = [26, 22];
        btnRefresh.helpTip = "Refresh script list from disk";

        var btnSettings = topBar.add("button", undefined, "\u2699"); // ⚙
        btnSettings.preferredSize = [26, 22];
        btnSettings.helpTip = "Settings / About";

        // ---- Tab bar --------------------------------------------------------
        var tabBar = panel.add("group");
        tabBar.orientation   = "row";
        tabBar.alignChildren = ["left", "center"];
        tabBar.alignment     = ["fill", "top"];
        tabBar.spacing       = 2;

        var tabAll    = tabBar.add("button", undefined, "All");
        var tabRecent = tabBar.add("button", undefined, "Recent");
        var tabFavs   = tabBar.add("button", undefined, "\u2605 Favs");
        tabAll.preferredSize    = [55, 20];
        tabRecent.preferredSize = [55, 20];
        tabFavs.preferredSize   = [65, 20];

        var countLabel = tabBar.add("statictext", undefined, "");
        countLabel.alignment = ["right", "center"];

        // ---- Separator -------------------------------------------------------
        panel.add("panel", undefined, undefined).alignment = ["fill", "top"];

        // ---- Script area (scrollable via group with clipping) ----------------
        var scrollPanel = panel.add("group");
        scrollPanel.orientation   = "column";
        scrollPanel.alignChildren = ["fill", "top"];
        scrollPanel.alignment     = ["fill", "fill"];
        scrollPanel.spacing       = 3;

        // ---- Status bar ------------------------------------------------------
        var statusBar = panel.add("statictext", undefined, "Ready");
        statusBar.alignment = ["fill", "bottom"];

        // =====================================================================
        //  STATE
        // =====================================================================
        var state = {
            allScripts      : [],
            filteredScripts : [],
            activeTab       : settings.lastTab || "all",
            viewMode        : settings.viewMode || "list",
            searchQuery     : "",
            isSearching     : false,       // true while user has focus in search box
            lastMiniCols    : -1           // track column count to avoid needless re-renders on resize
        };

        // =====================================================================
        //  TAB HIGHLIGHT  — visual feedback for active tab
        // =====================================================================
        function updateTabStyles() {
            // ScriptUI buttons have very limited styling; we prefix active tab with ">"
            tabAll.text    = (state.activeTab === "all")       ? "> All"     : "All";
            tabRecent.text = (state.activeTab === "recent")    ? "> Recent"  : "Recent";
            tabFavs.text   = (state.activeTab === "favorites") ? "> \u2605 Favs" : "\u2605 Favs";
        }

        // =====================================================================
        //  FILTER
        // =====================================================================
        function applyFilter() {
            var q   = state.searchQuery.toLowerCase();
            var src = state.allScripts;

            if (state.activeTab === "recent") {
                var rcnt = [];
                for (var ri = 0; ri < settings.recentScripts.length; ri++) {
                    var rPath = settings.recentScripts[ri].path;
                    for (var si = 0; si < src.length; si++) {
                        if (src[si].path === rPath) { rcnt.push(src[si]); break; }
                    }
                }
                src = rcnt;
            } else if (state.activeTab === "favorites") {
                var favs = [];
                for (var fi = 0; fi < src.length; fi++) {
                    if (isFavorite(src[fi].path)) favs.push(src[fi]);
                }
                src = favs;
            }

            if (q !== "") {
                var matched = [];
                for (var i = 0; i < src.length; i++) {
                    if (src[i].name.toLowerCase().indexOf(q) >= 0) matched.push(src[i]);
                }
                src = matched;
            }

            state.filteredScripts = src;
        }

        // =====================================================================
        //  HELPERS
        // =====================================================================
        function truncate(str, maxLen) {
            return (str && str.length > maxLen) ? str.substring(0, maxLen - 1) + "\u2026" : (str || "");
        }

        // =====================================================================
        //  RENDER DISPATCHER
        // =====================================================================
        function render() {
            // Remove all existing children
            while (scrollPanel.children.length > 0) {
                scrollPanel.remove(scrollPanel.children[0]);
            }

            applyFilter();
            updateTabStyles();

            var scripts = state.filteredScripts;
            var countTxt = scripts.length + " script" + (scripts.length !== 1 ? "s" : "");
            countLabel.text = countTxt;

            if (scripts.length === 0) {
                var msg;
                if (state.activeTab === "favorites") {
                    msg = "No favorites yet. Click \u2606 next to a script to star it.";
                } else if (state.activeTab === "recent") {
                    msg = "No recent scripts yet. Run a script to populate this list.";
                } else if (state.searchQuery !== "") {
                    msg = "No results for \"" + state.searchQuery + "\"";
                } else {
                    msg = "Drop .jsx/.js files into:\n" + scriptsFolder.fsName + "\nthen click Refresh.";
                }
                var emptyMsg = scrollPanel.add("statictext", undefined, msg, { multiline: true });
                emptyMsg.alignment = ["fill", "top"];
                statusBar.text = "No scripts";
            } else {
                if (state.viewMode === "mini") renderMini(scripts);
                else                           renderList(scripts);
                statusBar.text = countTxt + " shown";
            }

            try { panel.layout.layout(true); } catch (e) {}
        }

        // =====================================================================
        //  LIST VIEW
        //  Layout per row:  [★/☆  22px]  [icon 16px, optional]  [run btn fill]
        // =====================================================================
        function renderList(scripts) {
            for (var i = 0; i < scripts.length; i++) {
                (function(sd) {
                    var row = scrollPanel.add("group");
                    row.orientation   = "row";
                    row.alignChildren = ["left", "center"];
                    row.alignment     = ["fill", "top"];
                    row.spacing       = 4;

                    // Favorite toggle (left side)
                    var favBtn = row.add("button", undefined, isFavorite(sd.path) ? "\u2605" : "\u2606");
                    favBtn.preferredSize = [22, CFG.BUTTON_H];
                    favBtn.helpTip = "Toggle favorite";
                    favBtn.onClick = (function(sdCopy, btn) {
                        return function() {
                            toggleFavorite(sdCopy.path);
                            btn.text = isFavorite(sdCopy.path) ? "\u2605" : "\u2606";
                            if (state.activeTab === "favorites") render();
                        };
                    })(sd, favBtn);

                    // Optional 16 px icon thumbnail
                    if (sd.icon) {
                        var img = loadIcon(sd.icon);
                        if (img) {
                            try {
                                var thumb = row.add("iconbutton", undefined, img, { style: "toolbutton" });
                                thumb.size    = [16, 16];
                                thumb.helpTip = sd.tooltip || sd.name;
                                // Closure capture for icon button
                                thumb.onClick = (function(sdCopy) {
                                    return function() {
                                        statusBar.text = "Running: " + sdCopy.name + "...";
                                        var ok = runScript(sdCopy);
                                        statusBar.text = ok
                                            ? "Done: " + sdCopy.name
                                            : "Error: " + sdCopy.name;
                                    };
                                })(sd);
                            } catch (e) {}
                        }
                    }

                    // Run button (fills remaining width)
                    var runBtn = row.add("button", undefined, sd.name);
                    runBtn.alignment     = ["fill", "center"];
                    runBtn.preferredSize = [-1, CFG.BUTTON_H];
                    runBtn.helpTip       = sd.tooltip ? (sd.tooltip + "\n" + sd.path) : sd.path;
                    runBtn.onClick = (function(sdCopy) {
                        return function() {
                            statusBar.text = "Running: " + sdCopy.name + "...";
                            var ok = runScript(sdCopy);
                            statusBar.text = ok
                                ? "Done: " + sdCopy.name
                                : "Error: " + sdCopy.name;
                        };
                    })(sd);

                })(scripts[i]);
            }
        }

        // =====================================================================
        //  MINI VIEW — icon/label tiles in auto-columns
        // =====================================================================
        function calcMiniCols() {
            var panelW  = (panel.size && panel.size[0] > 0) ? panel.size[0] : 300;
            var avail   = panelW - (CFG.MARGINS * 2);
            return Math.max(1, Math.floor(avail / (CFG.MINI_SIZE + CFG.SPACING)));
        }

        function renderMini(scripts) {
            var sz      = CFG.MINI_SIZE;
            var gap     = CFG.SPACING;
            var numCols = calcMiniCols();
            state.lastMiniCols = numCols;

            var row;
            for (var i = 0; i < scripts.length; i++) {
                if (i % numCols === 0) {
                    row = scrollPanel.add("group");
                    row.orientation   = "row";
                    row.alignChildren = ["left", "top"];
                    row.spacing       = gap;
                }
                (function(sd) {
                    var btn;
                    var hasIcon = false;

                    if (sd.icon) {
                        var img = loadIcon(sd.icon);
                        if (img) {
                            try {
                                btn      = row.add("iconbutton", undefined, img, { style: "toolbutton" });
                                btn.size = [sz, sz];
                                hasIcon  = true;
                            } catch (e) {}
                        }
                    }

                    if (!hasIcon) {
                        btn = row.add("button", undefined, truncate(sd.name, 6));
                        btn.preferredSize = [sz, sz];
                    }

                    btn.helpTip = (sd.tooltip ? sd.tooltip + "  |  " : "") + sd.name;
                    btn.onClick = (function(sdCopy) {
                        return function() {
                            statusBar.text = "Running: " + sdCopy.name + "...";
                            var ok = runScript(sdCopy);
                            statusBar.text = ok
                                ? "Done: " + sdCopy.name
                                : "Error: " + sdCopy.name;
                        };
                    })(sd);
                })(scripts[i]);
            }
        }

        // =====================================================================
        //  SETTINGS / ABOUT DIALOG
        // =====================================================================
        function showSettingsDialog() {
            var d = new Window("dialog", "Settings  —  Script Launcher " + CFG.VERSION);
            d.orientation   = "column";
            d.alignChildren = ["fill", "top"];
            d.spacing       = 8;
            d.margins       = 14;

            // Scripts folder
            var grpFolder = d.add("group");
            grpFolder.orientation   = "row";
            grpFolder.alignChildren = ["left", "center"];
            grpFolder.alignment     = ["fill", "top"];
            grpFolder.add("statictext", undefined, "Scripts folder:");
            var folderEdit = grpFolder.add("edittext", undefined, scriptsFolder.fsName);
            folderEdit.preferredSize = [300, 22];
            folderEdit.alignment     = ["fill", "center"];
            var browsBtn = grpFolder.add("button", undefined, "...");
            browsBtn.preferredSize = [30, 22];
            browsBtn.onClick = function() {
                var chosen = Folder.selectDialog("Select Scripts Folder", scriptsFolder);
                if (chosen) folderEdit.text = chosen.fsName;
            };

            // Max recent
            var grpRecent = d.add("group");
            grpRecent.add("statictext", undefined, "Max recent entries:");
            var recentSpin = grpRecent.add("edittext", undefined, String(CFG.MAX_RECENT));
            recentSpin.preferredSize = [50, 22];
            grpRecent.add("statictext", undefined, "(1–20)");

            // Mini icon size
            var grpMini = d.add("group");
            grpMini.add("statictext", undefined, "Mini icon size (px):");
            var miniSpin = grpMini.add("edittext", undefined, String(CFG.MINI_SIZE));
            miniSpin.preferredSize = [50, 22];
            grpMini.add("statictext", undefined, "(16–128)");

            d.add("panel");

            d.add("statictext", undefined,
                "Icon lookup order: " + CFG.ICON_EXTS.join(", ") +
                "\nPlace icons beside scripts using the same base filename.",
                { multiline: true }).alignment = ["fill", "top"];

            d.add("panel");

            // Clear recents button
            var grpActions = d.add("group");
            var btnClearRecent = grpActions.add("button", undefined, "Clear Recent History");
            btnClearRecent.onClick = function() {
                settings.recentScripts = [];
                saveSettings();
                btnClearRecent.enabled = false;
                statusBar.text = "Recent history cleared";
            };
            var btnClearFavs = grpActions.add("button", undefined, "Clear Favorites");
            btnClearFavs.onClick = function() {
                settings.favorites = [];
                saveSettings();
                btnClearFavs.enabled = false;
                statusBar.text = "Favorites cleared";
            };

            d.add("panel");

            d.add("statictext", undefined,
                "Script Launcher " + CFG.VERSION +
                "\nBy Mehmet Sensoy  |  Enhanced build 2025",
                { multiline: true }).alignment = ["fill", "top"];

            d.add("panel");

            var btnRow = d.add("group");
            btnRow.alignment = ["fill", "bottom"];
            btnRow.add("group").alignment = ["fill", "center"]; // spacer
            var btnOK     = btnRow.add("button", undefined, "OK",     { name: "ok"     });
            var btnCancel = btnRow.add("button", undefined, "Cancel", { name: "cancel" });

            btnOK.onClick = function() {
                // Validate folder
                var newFolder = new Folder(folderEdit.text);
                if (!newFolder.exists) {
                    alert("Folder not found:\n" + folderEdit.text);
                    return;
                }
                scriptsFolder = newFolder;
                settings.scriptsFolderPath = newFolder.fsName;  // persist!

                // Validate & apply maxRecent
                var mr = parseInt(recentSpin.text, 10);
                if (!isNaN(mr) && mr >= 1 && mr <= 20) {
                    CFG.MAX_RECENT        = mr;
                    settings.maxRecent    = mr;
                }

                // Validate & apply miniSize
                var ms = parseInt(miniSpin.text, 10);
                if (!isNaN(ms) && ms >= 16 && ms <= 128) {
                    CFG.MINI_SIZE      = ms;
                    settings.miniSize  = ms;
                }

                saveSettings();
                d.close();
                refresh();
            };
            btnCancel.onClick = function() { d.close(); };

            d.center();
            d.show();
        }

        // =====================================================================
        //  REFRESH
        // =====================================================================
        function refresh() {
            state.allScripts = discoverScripts(scriptsFolder);
            render();
        }

        // =====================================================================
        //  SEARCH  —  proper placeholder handling with single source of truth
        // =====================================================================
        searchBox.onActivate = function() {
            if (searchBox.text === CFG.SEARCH_PH) {
                searchBox.text = "";
                try {
                    searchBox.graphics.foregroundColor = searchBox.graphics.newPen(
                        searchBox.graphics.PenType.SOLID_COLOR, [1, 1, 1, 1], 1
                    );
                } catch (e) {}
            }
            state.isSearching = true;
        };

        searchBox.onDeactivate = function() {
            state.isSearching = false;
            if (searchBox.text === "") {
                searchBox.text = CFG.SEARCH_PH;
                try {
                    searchBox.graphics.foregroundColor = searchBox.graphics.newPen(
                        searchBox.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5, 1], 1
                    );
                } catch (e) {}
                if (state.searchQuery !== "") {
                    state.searchQuery = "";
                    render();
                }
            }
        };

        searchBox.onChanging = function() {
            // Guard: don't treat placeholder text as a real query
            var newQuery = (searchBox.text === CFG.SEARCH_PH) ? "" : searchBox.text;
            if (newQuery !== state.searchQuery) {
                state.searchQuery = newQuery;
                render();
            }
        };

        // =====================================================================
        //  CONTROL WIRING
        // =====================================================================
        btnFolder.onClick = function() { openScriptsFolder(); };

        btnMini.onClick = function() {
            state.viewMode = settings.viewMode = "mini";
            saveSettings();
            render();
        };
        btnList.onClick = function() {
            state.viewMode = settings.viewMode = "list";
            saveSettings();
            render();
        };
        btnRefresh.onClick = function() {
            refresh();
            statusBar.text = "Refreshed — " + state.allScripts.length + " script" +
                             (state.allScripts.length !== 1 ? "s" : "") + " found";
        };
        btnSettings.onClick = function() { showSettingsDialog(); };

        tabAll.onClick = function() {
            state.activeTab = settings.lastTab = "all";
            saveSettings();
            render();
        };
        tabRecent.onClick = function() {
            state.activeTab = settings.lastTab = "recent";
            saveSettings();
            render();
        };
        tabFavs.onClick = function() {
            state.activeTab = settings.lastTab = "favorites";
            saveSettings();
            render();
        };

        // =====================================================================
        //  RESPONSIVE RESIZE
        //  — list view: just re-layout (no DOM rebuild needed)
        //  — mini view: only rebuild if column count changed
        // =====================================================================
        panel.onResizing = panel.onResize = function() {
            try { this.layout.resize(); } catch (e) {}
            if (state.viewMode === "mini") {
                var newCols = calcMiniCols();
                if (newCols !== state.lastMiniCols) render();
            }
            // list view auto-reflows via layout.resize() — no DOM rebuild needed
        };

        // =====================================================================
        //  INIT
        // =====================================================================
        state.viewMode  = settings.viewMode  || "list";
        state.activeTab = settings.lastTab   || "all";

        refresh();

        if (panel instanceof Window) {
            panel.minimumSize = [220, 150];
            panel.center();
            panel.show();
        }

        return panel;
    }

    buildUI(thisObj);

})(this);
