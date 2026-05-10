# Fallback Logo Fix - Complete Implementation

## Problem Summary
When first-time users integrated the chatbot on their React websites, the fallback logo was not being shown in the floating action button (FAB). The issue occurred specifically when:
1. A new company/bot was created without a custom logo
2. The default logo image failed to load (CORS, network error, 404, etc.)
3. No fallback mechanism existed to show the bot's initial letter

## Root Cause Analysis

### Backend Issue (main.py:1362)
```python
# OLD - Full URL that might fail due to CORS/network issues
"logo_url": company_data[7] or "https://www.sapybase.com/SB_loading.svg",
```

**Problem**: Using a full HTTPS URL to load an external image in the widget can fail due to:
- CORS restrictions
- Network timeouts
- Image 404 errors
- Mixed content warnings (http on https sites)

### Frontend Issue (sapybase-loader.js)
```javascript
// OLD - No error handling for failed image loads
'<image href="' + safeUrl + '" x="' + ix + '" y="' + iy + '" ' +
'width="' + iw + '" height="' + ih + '" preserveAspectRatio="xMidYMid slice" />'
```

**Problem**: If the image element failed to load:
- No fallback was triggered
- SVG rendered with no visible content
- User saw a blank FAB button

## Solution Implementation

### Fix #1: Backend - Use Relative Path (main.py:1362)
```python
# NEW - Relative path to asset served from Sapybase origin
"logo_url": company_data[7] or "/SB_loading.svg",
```

**Benefits**:
- Assets served from the same origin as config API
- Avoids CORS issues
- Loader will convert to absolute URL (e.g., `/SB_loading.svg` → `https://www.sapybase.com/SB_loading.svg`)

### Fix #2: Frontend - Add Image Error Handling (sapybase-loader.js)
```javascript
// NEW - With error handling fallback
'<image href="' + safeUrl + '" x="' + ix + '" y="' + iy + '" ' +
'width="' + iw + '" height="' + ih + '" preserveAspectRatio="xMidYMid slice" ' +
'onerror="document.getElementById(\'' + fallbackId + '\').style.display=\'block\'" />' +
'<text id="' + fallbackId + '" x="' + (50 + ox) + '" y="' + (52 + oy) + '" ' +
'text-anchor="middle" dominant-baseline="middle" fill="#ffffff" ' +
'style="font-size:38px;font-weight:700;font-family:system-ui,sans-serif;display:none;">' +
initial + '</text>'
```

**Benefits**:
- Image loads with `onerror` handler attached
- If image fails, fallback text (bot initial) is shown
- Graceful degradation - always shows something

### Fix #3: Frontend - Convert Relative Paths to Absolute (sapybase-loader.js)
```javascript
// NEW - In _applyConfig method
let logoUrl = cfg.custom_logo_url || cfg.logo_url || '';

// Convert relative paths to absolute URLs
if (logoUrl && logoUrl.startsWith('/')) {
  logoUrl = IFRAME_ORIGIN + logoUrl;
}
```

**Benefits**:
- Backend can send relative paths safely
- Loader automatically converts them to correct absolute URLs
- Works seamlessly across different deployment environments

## Files Modified

### 1. `/sapybase_ai_engine/main.py` (Line 1362)
- Changed `logo_url` default from full URL to relative path `/SB_loading.svg`

### 2. `/public/sapybase-loader.js`
- Added `fallbackId` to SVG rendering
- Added `onerror` handler to image element
- Added hidden fallback text with bot initial
- Added relative path conversion in `_applyConfig()`

### 3. `/public/sapybase-loader@1.js`
- Applied same changes for consistency
- Uses existing `ASSET_BASE` constant for path resolution

## Testing Checklist

- [ ] New company created → logo shows Sapybase default "S"
- [ ] Default logo loads from `/SB_loading.svg` → FAB shows correctly
- [ ] Default logo fails to load → FAB shows initial letter fallback
- [ ] Custom logo set → FAB shows custom image
- [ ] Custom logo fails to load → FAB shows bot initial letter
- [ ] Multiple FABs on same page → each has unique fallback ID
- [ ] React website with chatbot → logo appears on first load
- [ ] Mobile browser → logo and fallback work correctly

## Database Schema (Already Correct)
The migration `v13_logo_customization.sql` already sets the correct default:
```sql
ALTER TABLE companies 
    ALTER COLUMN logo_url SET DEFAULT '/SB_loading.svg';
```

## Backward Compatibility
- Existing bots with custom logos continue to work
- Custom logo URLs take precedence over default
- Old full-URL defaults still work (fallback handles if unreachable)
- No database schema changes required

## Performance Impact
- No performance impact - same number of API calls
- SVG rendering is lightweight
- Image error handling is native browser functionality
- Fallback text rendering is minimal overhead

## Security Considerations
- All image URLs still validated by backend
- Relative paths cannot be exploited (fixed path only)
- Image `onerror` handler only modifies visible text, not DOM structure
- No eval or dynamic code execution
