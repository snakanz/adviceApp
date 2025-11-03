# Calendar Providers - Step 4 Specification

## Overview

Step 4 should display three calendar provider options:
1. **Google Calendar** - Fully functional
2. **Outlook Calendar** - Placeholder (no functionality yet)
3. **Calendly** - Fully functional

---

## Provider Icons & Details

### 1. Google Calendar

**Icon**: Google Calendar logo (blue)

**SVG**:
```jsx
<svg className="w-12 h-12" viewBox="0 0 48 48">
  <path fill="#1976D2" d="M24,9.604c-6.4,0-10.4,3.199-12,9.597c2.4-3.199,5.2-4.398,8.4-3.599 c1.826,0.456,3.131,1.781,4.576,3.247C27.328,21.236,30.051,24,36,24c6.4,0,10.4-3.199,12-9.598c-2.4,3.199-5.2,4.399-8.4,3.6 c-1.825-0.456-3.13-1.781-4.575-3.247C32.672,12.367,29.948,9.604,24,9.604L24,9.604z M12,24c-6.4,0-10.4,3.199-12,9.598 c2.4-3.199,5.2-4.399,8.4-3.599c1.825,0.457,3.13,1.781,4.575,3.246c2.353,2.388,5.077,5.152,11.025,5.152 c6.4,0,10.4-3.199,12-9.598c-2.4,3.199-5.2,4.399-8.4,3.6c-1.826-0.456-3.131-1.781-4.576-3.246C20.672,26.764,17.949,24,12,24 L12,24z"/>
</svg>
```

**Title**: "Google Calendar"

**Description**: "Connect your Google Calendar to automatically sync meetings"

**Status**: ✅ Fully functional

**Auto-Select**: Yes (if user signed in with Google)

---

### 2. Outlook Calendar

**Icon**: Outlook logo (blue)

**SVG**:
```jsx
<svg className="w-12 h-12" viewBox="0 0 48 48">
  <rect fill="#0078D4" width="48" height="48" rx="4"/>
  <path fill="white" d="M12 12h8v8h-8zm10 0h8v8h-8zm10 0h8v8h-8zM12 22h8v8h-8zm10 0h8v8h-8zm10 0h8v8h-8zM12 32h8v8h-8zm10 0h8v8h-8zm10 0h8v8h-8z" opacity="0.3"/>
  <circle cx="24" cy="24" r="8" fill="white" opacity="0.8"/>
</svg>
```

**Title**: "Outlook Calendar"

**Description**: "Connect your Outlook Calendar (coming soon)"

**Status**: 🔄 Placeholder - No functionality yet

**Disabled**: Yes (show as disabled/grayed out)

**Note**: Add a badge saying "Coming Soon"

---

### 3. Calendly

**Icon**: Calendar icon (blue)

**SVG** (use lucide-react):
```jsx
import { Calendar } from 'lucide-react';
<Calendar className="w-12 h-12 text-blue-600" />
```

**Title**: "Calendly"

**Description**: "Can't connect work calendar? Use Calendly instead"

**Status**: ✅ Fully functional

**Auto-Select**: No

---

## Step 4 Layout

```jsx
<div className="max-w-6xl mx-auto px-6 py-16">
  <div className="grid grid-cols-2 gap-12 items-start">
    
    {/* LEFT COLUMN */}
    <div className="space-y-8">
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
        Question 3 of 4
      </p>

      <div className="space-y-3">
        <h1 className="text-4xl font-bold text-foreground">
          Which calendar do you use?
        </h1>
        <p className="text-lg text-muted-foreground">
          Select your primary calendar provider
        </p>
      </div>

      {/* Calendar Provider Options */}
      <div className="space-y-3">
        
        {/* Google Calendar */}
        <button
          onClick={() => handleSelect('google')}
          className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
            selectedProvider === 'google'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              {/* Google Calendar SVG */}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Google Calendar</h3>
              <p className="text-sm text-muted-foreground">
                Connect your Google Calendar to automatically sync meetings
              </p>
            </div>
            <div className="flex-shrink-0">
              {/* Radio button */}
            </div>
          </div>
        </button>

        {/* Outlook Calendar - DISABLED */}
        <button
          disabled
          className="w-full p-4 border-2 border-border rounded-lg text-left opacity-50 cursor-not-allowed"
        >
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              {/* Outlook SVG */}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">Outlook Calendar</h3>
                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                  Coming Soon
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Connect your Outlook Calendar (coming soon)
              </p>
            </div>
            <div className="flex-shrink-0">
              {/* Disabled radio button */}
            </div>
          </div>
        </button>

        {/* Calendly */}
        <button
          onClick={() => handleSelect('calendly')}
          className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
            selectedProvider === 'calendly'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              {/* Calendly SVG */}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Calendly</h3>
              <p className="text-sm text-muted-foreground">
                Can't connect work calendar? Use Calendly instead
              </p>
            </div>
            <div className="flex-shrink-0">
              {/* Radio button */}
            </div>
          </div>
        </button>

      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-8">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          onClick={handleContinue}
          disabled={!selectedProvider}
          className="ml-auto"
        >
          Continue
        </Button>
      </div>
    </div>

    {/* RIGHT COLUMN - Illustration */}
    <div className="hidden lg:flex items-center justify-center">
      <div className="w-full h-96 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg flex items-center justify-center border border-border">
        <span className="text-muted-foreground text-sm">Calendar Integration Illustration</span>
      </div>
    </div>

  </div>
</div>
```

---

## Radio Button Component

For the radio button on the right side of each option:

```jsx
<div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
  selectedProvider === 'google'
    ? 'border-primary bg-primary'
    : 'border-muted-foreground'
}`}>
  {selectedProvider === 'google' && (
    <div className="w-2 h-2 bg-white rounded-full" />
  )}
</div>
```

---

## Outlook Icon SVG (Alternative)

If you want a simpler Outlook icon:

```jsx
<svg className="w-12 h-12" viewBox="0 0 48 48">
  <rect fill="#0078D4" width="48" height="48" rx="4"/>
  <path fill="white" d="M12 14h24v20H12z" opacity="0.2"/>
  <path fill="white" d="M14 16h20v16H14z"/>
  <path fill="#0078D4" d="M16 18h16v12H16z"/>
</svg>
```

---

## Implementation Notes

1. **Outlook is disabled** - Add `disabled` attribute and `opacity-50 cursor-not-allowed`
2. **Coming Soon badge** - Yellow background, small text
3. **Radio buttons** - Show selection state with blue border + white dot
4. **Hover effect** - Subtle border and background color change
5. **Auto-select Google** - If user signed in with Google, pre-select it
6. **Responsive** - Hide illustration on mobile, show on desktop

---

## Colors

- Primary Blue: `#3B82F6`
- Outlook Blue: `#0078D4`
- Border Gray: `#e5e7eb`
- Muted Gray: `#6b7280`
- Yellow Badge: `#FEF3C7` (bg), `#92400E` (text)

