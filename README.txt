MaintLog Pro - Digital Daily Maintenance Activity Report
======================================================
Developed by: Mahamed Algaroshy
Version: 2.0.0 (2026)

1. OVERVIEW
-----------
MaintLog Pro is a specialized, web-based digital logbook designed for industrial maintenance teams. It replaces traditional paper-based "Daily Maintenance Activity Reports" and static Excel spreadsheets with an interactive, intelligent application.

It retains the familiar visual structure of industry-standard factory forms while adding dynamic database management, customization options, and smart calculation tools.

2. KEY FEATURES
---------------

A. STRUCTURED REPORTING
   - Three-Shift Format: Automatically divided into Night, Morning, and Evening shifts with distinct color-coding for quick visual identification (Dark Slate, Yellow, Orange).
   - Dynamic Sections with Isolated Databases: 
     - Create and manage custom sections (e.g., Filling, Packaging, Utilities) via the settings icon in the header.
     - **Isolated Data**: Each section maintains its own independent list of Machines, Engineers, and Spare Parts.
     - **Rename Sections**: Easily rename sections; data is automatically migrated.
   - Dynamic Rows: Users can add (+) or remove (trash icon) rows.

B. SMART GRID INTERFACE
   1. MACHINE COLUMN (with Manager):
      - Dropdown list of machines specific to the selected Section.
      - Machine Manager: Click the 'Settings' (gear) icon in the column header to Add/Edit/Delete machines.

   2. LINE COLUMN:
      - Multi-select popup for production lines (e.g., "1, 3, 5").
      - **Toggle Visibility**: Can be hidden via App Settings for non-production environments.

   3. TOTAL TIME (Calculator):
      - Click the 'Clock' icon to open the Time Calculator.
      - Input multiple start/stop intervals to automatically calculate duration (e.g., 08:00-09:00 + 13:00-13:30 = 1h 30m).
      - **Toggle Visibility**: Can be hidden via App Settings.

   4. SPARE PARTS & QUANTITY (Database System):
      - Click the cell to open the Spare Parts Database Modal.
      - **Search & Select**: Quickly find parts from the left panel.
      - **Manage Database**:
        - **Create**: Click "New" to add parts.
        - **Edit**: Hover over a part in the list and click the Pencil icon.
        - **Delete**: Hover over a part and click the Trash icon to remove it.
      - **Duplicate Check**: The system alerts you if you try to create a part with a name or number that already exists.

C. WORKFLOW OPTIMIZATION
   - **Pre-loaded Engineers**: Easily select engineers from a checkbox list. Add new ones on the fly.
   - **Efficient Data Entry**: 
     - Use Tab to navigate between fields.
     - Type in dropdowns to filter options.
     - Auto-resizing text areas for long descriptions.
   - **Visual Clarity**: Alternate row shading and clear borders aid readability.

D. CUSTOMIZATION (SETTINGS)
   - Color Palettes: Choose from distinct color palettes (Blue, Green, Slate, etc.).
   - Font Control: Change Font Family and Size (Small to XL).
   - Compact Mode: Toggle "Compact Row Mode" to reduce row height and padding, fitting more data on a single printed page.
   - **Column Visibility**: Show or hide 'Line' and 'Time' columns.
   - **Confirm Row Deletion**: Toggle safety prompt before deleting rows.
   - **Spell Check**: Enable/Disable browser spell check.

E. EXPORT & REPORTING
   - **Print / PDF**: Generates a clean, borderless print view optimized for landscape A4 paper. Header/Footer URLs are automatically removed.
   - **CSV Export**: Download data in standard CSV format for import into Excel, PowerBI, or ERP systems.
   - **Shift Filtering**: Choose to print/export only specific shifts (e.g., Night Shift only).

F. DATA PRIVACY & OFFLINE CAPABILITY
   - **Zero-Install Deployment**: Runs entirely in the browser. No server setup required.
   - **Local Storage**: All data is stored securely in the user's browser (LocalStorage). 
   - **Privacy**: No data is sent to the cloud. Your maintenance logs remain on your device.
   - **Offline Use**: The app functions 100% offline once loaded.

3. HOW TO USE
-------------
1. Login using provided credentials (default: admin/admin).
2. Select 'Section' (or create a new one using the gear icon) and 'Date'.
3. Use the Settings (Gear icon in toolbar) to customize colors, fonts, column visibility, and layout density.
4. Add engineers to the shift roster using the "Select Engineers" dropdown. 
   - Default Engineer: Mahamed Algaroshy is pre-loaded. Add more via the dropdown input.
5. Log activities manually. Use the time calculator for precise duration tracking.
6. Click 'Print / PDF' to export. Choose "Print All Shifts" or a specific shift.

4. INSTALLATION & LOCAL USE
---------------------------
1. Install dependencies: `npm install`
2. Run locally: `npm run dev`
3. Build for production: `npm run build`

5. TROUBLESHOOTING
------------------
- "My data is gone": Ensure you are on the correct date and section. Check if browser cache was cleared.
- "Printing looks wrong": Ensure "Background Graphics" is enabled in your browser print settings.
- "Cannot update part": Ensure you are not changing the name to one that already exists (duplicates are prevented).
- "Inputs look hidden": If inputs are hard to see, ensure your browser theme or extensions aren't overriding high-contrast modes.
