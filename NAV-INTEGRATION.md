# SORC Navigation System Integration Guide

## Overview
The SORC navigation system provides:
- **Hamburger Menu** with D&D Beyond-style section navigation
- **Home Icon** for quick access to homepage
- **Theme Toggle** (Lawful/Evil mode) - two-sided button
- **Badge Component** showing membership tier
- **Floating Avatar** for user profile access

## Files
- `nav-system.js` - Navigation logic and DOM injection
- `nav-system.css` - Complete styling (light/dark theme support)

## Integration

Add these lines to the `<head>` of EVERY HTML page:

```html
<!-- Navigation System Styles -->
<link rel="stylesheet" href="../../nav-system.css">
```

Add these lines at the END of the `<body>` (before closing `</body>`):

```html
<!-- Navigation System -->
<script src="../../nav-system.js"></script>
```

**Path Notes:**
- For files at `content/subdirectory/page.html` (depth 2): use `../../nav-system.js`
- For files at `content/subdirectory/subsubdir/page.html` (depth 3): use `../../../nav-system.js`
- For files at root level (index.html, library.html): use `nav-system.js`

## Theme System

The theme toggle works with the existing lawful-mode class:
- **Lawful Mode (Light)** - Default theme
- **Evil Mode (Dark)** - Dark theme

User preference is saved to localStorage as `sorc_theme`.

## Badge Component

The badge shows membership tier. To update programmatically:

```javascript
// Update badge (will appear on next page load)
localStorage.setItem('sorc_tier', 'Pro Member');
localStorage.setItem('sorc_theme', 'lawful');
```

## Avatar Component

The floating avatar shows user info. To update:

```javascript
localStorage.setItem('sorc_username', 'CharacterName');
localStorage.setItem('sorc_tier', 'Pro Member');
```

## Customization

### Update Navigation Chapters
Edit `RULES_CHAPTERS` array in `nav-system.js` to add/modify chapter structure.

### Update Colors/Branding
Modify CSS variables in `nav-system.css`:
```css
:root {
  --sorc-nav-accent: #c5a042; /* Gold */
  --sorc-nav-text: #2c2c2c;   /* Dark text */
}
```

### Add New Menu Sections
Edit the `PLAY`, `RULES`, `LIBRARY`, `COMMUNITY`, `MARKETPLACE` sections in the HTML template within `nav-system.js`.

## Responsive Design
- Desktop: Full sidebar, badge, and avatar visible
- Tablet: Condensed theme toggle
- Mobile (< 768px): Badge and avatar hidden, navigation optimized

## Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation support
- Semantic HTML structure
- High contrast in both themes
