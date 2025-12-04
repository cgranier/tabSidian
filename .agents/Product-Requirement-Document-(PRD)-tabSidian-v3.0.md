---
created: 2025-12-04
tags:
  - projects/tabsidian
---
### **Product Requirement Document (PRD): tabSidian v3.0**

**Version:** 3.0 **Status:** Draft **Source Material:** `tabSidian Product Roadmap.pdf` **Reference Implementation:** `obsidian-clipper` (UX/UI Inspiration)

tabSidian git: https://github.com/cgranier/tabSidian
obsidian-webclipper git: https://github.com/obsidianmd/obsidian-clipper

#### **1. Executive Summary**

The goal of tabSidian v2.0 is to transition the extension from a "one-click" save tool to a robust tab list saver with a configuration dialog. The primary objectives are to support multiple Obsidian Vaults, user-selectable templates at run time, and overhaul the Options/Settings UI to match the usability standards of the official Obsidian Web Clipper.

tabSidian v2.0 focuses on multi-vault support and granular routing for tab sessions. tabSidian captures metadata from **all open tabs** (or specific selections) and formats them into a single Markdown list. Version 2.0 introduces a configuration hierarchy where specific Templates (e.g., "Work Session," "Recipe Collection") can target specific Vaults, Folders, and Filenames automatically, reducing user friction.

#### **2. Core User Stories**

1. **Multi-Vault Support:** As a user, I want to define multiple Obsidian Vaults in settings so I can choose where to save my tabs.  
2. **Default Vault:** As a user, I want to set a "Default Vault" that is pre-selected to reduce friction.  
3. **Save Dialog:** As a user, when I click the extension icon, I want to see a popup dialog allowing me to customize the note before saving.  
4. **Session Routing:** As a user, when I save a "Work Research" session, I want it to automatically go to my "Work" Vault in the `Projects/Research` folder, without manually changing settings every time.  
5. **Fallback Defaults:** As a user, if I don't select a specific template, I want the extension to use my global default Vault and Filename (e.g., `YYYY-MM-DD Tabs`).
6. **Tab List Formatting:** As a user, I want templates that can format tabs differently (e.g., a simple URL list vs. a detailed table with Favicons and "Last Accessed" timestamps).
7. **Template Selection:** As a user, I want to choose the output format (Template) immediately upon clicking the extension icon.
8. **Visual Feedback:** As a user, I want to see a sample representation of the output the selected template will produce. This sample should appear within the extension dialog.

#### **3. Functional Requirements**

##### **3.1 Extension Popup (The "Clipper" Interface)**

- **Trigger:** Clicking the extension icon must open a distinct dialog window instead of immediately executing a save.
- **Data Context:** The extension must immediately fetch metadata for all open tabs (Title, URL, Favicon, Group ID, Window ID, Last Accessed, etc.).
- Reference: owc-popup-dialog.png

- **UI Components:**
    - **Template Dropdown:** The primary control. Changing this updates the fields below based on the Template's configuration.
    - **Vault Dropdown:** Dropdown list of all user-configured vaults. Default set to the user's primary preference or the template's preference. 
    - **Filename Field:** Pre-filled based on the template's pattern (e.g., `Session-{{date}}`). Editable by user. User can override.
    - **Vault Dropdown:** Pre-selected based on the template. User can override.
    - **Folder Path:** Pre-filled based on the template (e.g., `01-What\Clippings`). User can override.
    - **Tab Count Indicator:** Visual indication of how many tabs are being saved (e.g., "Saving 12 tabs").
    - **Preview:** Show a sample output of the Markdown based on the current template.  
    - **Action Button:** "Add to Obsidian" button to execute the URI scheme.

##### **3.2 Settings & Options Page**

- **Layout:** The settings page must be refactored to use a Sidebar layout mimicking `obsidian-clipper`.  
    - **Sidebar Items:** General, Properties, Restricted URLs, Templates.
    - Reference: owc-options-layout.png

- **Vault Management:** (General Tab)
    - User can define multiple Vault names.
    - User designates one "Global Default Vault". (drag to top of list)
    - Reference: vaults-list.png

- **Template Logic (The "Iterator" System):** (Templates Tab)
    - Templates are not just static text; they act as iterators for the tab list.
    - List of templates (e.g., "Daily Reading", "Work Stuff", "Recipes", "YouTube Videos")
    - "New Template" button. 
        
    - **Template Configuration Objects** must store:
        - `templateName`: (e.g., "Daily Log")
        - `targetVault`: (Optional) Overrides global default.
        - `targetFolder`: (Optional) e.g., `01-Inbox`.  
        - `filenamePattern`: (Optional) e.g., `Tabs - {{date}}`.
        - `contentBody`: The markdown structure using Loop syntax.

- **Properties UI**: (Properties Tab)
	- **Frontmatter Metadata:** User should be able to map specific variables to frontmatter properties using standard tags.
	- **Frontmatter Fieldnames:** User should be able to override the field names and use custom values (e.g., `created` instead of `created-date`)
	- **Import/Export:** Ability to Import/Export `types.json` for property configurations.
  - Reference: owc-all-properties.png

#### **4. Technical Constraints**

- **URI Scheme:** Must continue to use the Obsidian URI scheme (`obsidian://new?vault=...`) to trigger the creation of the note.
- **Storage:** All configurations (Vault lists, templates) must be saved in `chrome.storage.sync` or `local` to persist across sessions.
- **URI Scheme Construction:**
    - The extension constructs a _single_ `obsidian://new` (or `advanced-uri`) call.
    - The `content` parameter of the URI will contain the fully rendered list of tabs.
- **Storage:** `chrome.storage` must handle the hierarchical logic (Global Default < Template Default < User Override).

### **Agent Task List**

Give these tasks to your coding agents sequentially or in parallel depending on your team structure.

#### **Phase 1: Data Structure & Backend (Agent A)**

- [ ] **Task 1.1: Storage Schema Migration.**
    - Update `chrome.storage` to support the new `vaults` array.
    - Refactor `templates` to include routing metadata: `defaultVault`, `defaultFolder`, `filenamePattern`.
    - Reference: note-name-location-vault.png
- [ ] **Task 1.2: Migration Script.** Write a script that runs on update `onInstalled`. It should take the user's existing single vault setting and migrate it into the new `vaults` array and set it as default.
- [ ] **Task 1.3: Fallback Logic.** Implement a helper function `resolveSaveTarget(templateId)`:
    - _IF_ Template has `targetVault` -> Use it.
    - _ELSE_ Use Global Default Vault.
    - _IF_ Template has `targetFolder` -> Use it.
    - _ELSE_ Use Global Default Folder.

#### **Phase 2: Settings UI Overhaul (Agent B)**

- [ ] **Task 2.1: Scaffold Settings Layout.** Create a new `options.html` and `options.css`. Implement a sidebar layout (Left: Navigation, Right: Content). Reference: owc-options-layout.png
- [ ] **Task 2.2: General Tab Implementation.** Build the UI to add/remove Vaults. Include validation (if empty, extension will default to save a file to the user's drive, instead of opening an Obsidian URI) and "Enter to add" functionality. If two or more Vaults are entered, user can drag and drop to order the Vaults. Top vault will be the default. Reference: vaults-list.png
- [ ] **Task 2.3: Template Editor UI.** Build the "Templates" tab.
    - Left column: List of templates. Reference: owc-template-sidebar.png
    - Right column: Fields for "Note name", "Note location", "Vault" dropdown (populated from General Tab), and Content Body. 
    - Update the Template Editor UI to include the new routing fields:  
	    - **Input:** "Default Filename" (with variable support like `{{date}}`).
	    - **Input:** "Default Folder Path".
	    - **Dropdown:** "Default Vault" (populated from the Vault Manager list).
	    - **Editor:** The Markdown body editor.
- **Task 2.4: Properties Tab.** Implement the table view for mapping variables to Frontmatter keys (mimicking the "All properties" screenshot). Reference: owc-all-properties.png

#### **Phase 3: Popup Interface (Agent C)**

- [ ] **Task 3.1: Popup Scaffolding.** Replace the background script "auto-save" trigger with a `popup.html` implementation. Reference: owc-popup-dialog.png
- [ ] **Task 3.2: Data Fetching.** On popup load, query `chrome.tabs.query({})` to get the current window's tabs.
- [ ] **Task 3.3: Dynamic Defaults.**
    - When the user selects a Template from the dropdown:
    - **Event:** Fire `onTemplateChange`.
    - **Action:** Update the "Vault", "Folder", and "Filename" input fields in the popup with the values from that template .  
- [ ] **Task 3.4: Dynamic Form Logic.**
    - When the user changes the "Template" dropdown, programmatically update the "Vault" and "Folder" fields to match that template's configuration.  
    - If the user _manually_ changes the Vault/Folder in the popup _after_ a template loaded, do not overwrite it if they switch templates again (optional UX refinement).
- [ ] **Task 3.5: "Add to Obsidian" Action.** Construct the final URI string based on the _currently selected_ form values (not just defaults) and launch it.

#### **Phase 4: Polish & Refinement (Agent D)**

- **Task 4.1: Styling Match.** Apply CSS to the Popup to match the purple/clean aesthetic shown in the roadmap screenshots (rounded corners, specific button styles). Reference: owc-popup-dialog.png, owc-options-layout.png.
- **Task 4.2: Version Display.** Add the version number display and "Changelog" link in the settings footer. Reference: version-changelog.png


