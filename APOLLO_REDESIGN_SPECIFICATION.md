# Apollo-Style Onboarding Redesign Specification

## 🎯 Overview

Redesign Steps 2-5 of the Advicly onboarding to match Apollo's clean, minimal aesthetic with:
- Full-width centered layouts (no cards)
- Large, bold typography
- Button/pill-based selections
- Decorative illustrations on the right
- Flat design with minimal shadows
- Lots of whitespace

---

## 📐 Layout Structure (All Steps)

### Header Section
```
┌─────────────────────────────────────────────────────────────┐
│ Logo + "Setup"          Step X of 8    Sign out             │
│ ─────────────────────────────────────────────────────────── │
│ [Progress Bar]                                              │
└─────────────────────────────────────────────────────────────┘
```

### Content Section (Apollo Style)
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Left Content - 60%]        [Right Illustration - 40%]    │
│                                                             │
│  QUESTION X OF Y (small text)                              │
│                                                             │
│  Large Bold Title                                          │
│  Subtitle text                                             │
│                                                             │
│  [Selection Buttons/Pills]                                 │
│  [Selection Buttons/Pills]                                 │
│  [Selection Buttons/Pills]                                 │
│                                                             │
│  [Action Buttons]                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Design Details

### Typography
- **Question Counter**: `text-xs uppercase text-muted-foreground` (e.g., "QUESTION 1 OF 4")
- **Title**: `text-4xl font-bold text-foreground` (e.g., "Tell us about your business")
- **Subtitle**: `text-lg text-muted-foreground` (e.g., "This helps us personalize your experience")
- **Button Text**: `text-base font-medium`

### Colors
- Background: `bg-background` (light gray #f8f9fb)
- Text: `text-foreground` (dark navy #1e293b)
- Muted: `text-muted-foreground` (gray #6b7280)
- Primary: `#3B82F6` (blue)
- Accent: `#4ade80` (green)

### Spacing
- Container: `max-w-6xl mx-auto px-6 py-16`
- Content grid: `grid grid-cols-2 gap-12` (left content, right illustration)
- Section spacing: `space-y-8`
- Button spacing: `space-y-3` or `space-x-3`

### Buttons/Pills
- **Style**: Flat, no shadows, minimal borders
- **Hover**: Subtle background color change
- **Selected**: Blue border + light blue background
- **Unselected**: Gray border + white background
- **Padding**: `px-6 py-4` for larger buttons
- **Border**: `border-2` for selection state

---

## 📋 Step-by-Step Specifications

### Step 2: Business Profile (Apollo Style)

**Question Counter**: "QUESTION 1 OF 4"

**Title**: "Tell us about your business"

**Subtitle**: "This helps us personalize your experience"

**Form Fields** (Left side):
- Business Name (text input)
- Business Type (button pills - horizontal)
- Team Size (button pills - horizontal)
- Timezone (text input)

**Right Side**: Decorative illustration (yellow/black geometric shapes like Apollo)

**Buttons**: 
- "Continue" (primary, right-aligned)

---

### Step 3: Calendar Intro (Apollo Style)

**Question Counter**: "QUESTION 2 OF 4"

**Title**: "Connect your calendar"

**Subtitle**: "Sync your meetings and let Advicly handle the rest"

**Benefits** (Left side):
- Show as simple text blocks, NOT cards
- Icon + Title + Description
- Minimal styling, no background color
- Spacing: `space-y-6`

**Trust Badge** (Left side):
- Green checkmark + text
- Simple, minimal styling

**Right Side**: Decorative illustration

**Buttons**:
- "Connect Your Calendar" (primary, full-width)
- "Back" (outline, full-width)

---

### Step 4: Calendar Choice (Apollo Style)

**Question Counter**: "QUESTION 3 OF 4"

**Title**: "Which calendar do you use?"

**Subtitle**: "Select your primary calendar provider"

**Calendar Options** (Left side):
- Google Calendar (with icon)
- Outlook Calendar (with icon) - PLACEHOLDER, no functionality
- Calendly (with icon)

**Style**: Button pills with:
- Icon on left
- Title + description on right
- Radio button on right
- Border-2 for selection
- Hover effect

**Right Side**: Decorative illustration

**Buttons**:
- "Back" (outline)
- "Continue" (primary)

---

### Step 5: Calendar Connect (Apollo Style)

**Question Counter**: "QUESTION 4 OF 4"

**Title**: "Connect {Provider} Calendar"

**Subtitle**: "Authorize Advicly to access your calendar"

**Connection UI** (Left side):
- Show provider-specific connection method
- For Google: "Grant Calendar Access" button
- For Calendly: OAuth or Token options
- For Outlook: Placeholder message

**Right Side**: Decorative illustration

**Buttons**:
- "Back" (outline)
- "Skip for now" (ghost)
- "Continue" (primary, disabled until connected)

---

## 🎨 Illustration Placeholder

For now, use a simple colored box on the right side:
```jsx
<div className="hidden lg:flex items-center justify-center">
  <div className="w-full h-96 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-lg flex items-center justify-center">
    <span className="text-muted-foreground text-sm">Illustration</span>
  </div>
</div>
```

Later, replace with actual Apollo-style illustrations.

---

## 🔧 Implementation Notes

1. **Remove Card Components**: Don't use `<Card>` - use plain `<div>` with minimal styling
2. **Full Width**: Use `max-w-6xl` instead of `max-w-2xl`
3. **Two-Column Layout**: Use `grid grid-cols-2 gap-12` for content + illustration
4. **Flat Design**: Remove shadows, use minimal borders
5. **Button Pills**: Use `border-2` and hover effects instead of filled buttons
6. **Whitespace**: Increase padding and spacing throughout
7. **Typography**: Use larger, bolder fonts for titles
8. **Question Counter**: Add "QUESTION X OF Y" at top of each step

---

## 📱 Responsive Design

- Desktop (lg): Two-column layout with illustration
- Tablet (md): Single column, illustration hidden
- Mobile (sm): Single column, illustration hidden

Use `hidden lg:flex` for illustration sections.

---

## ✅ Checklist

- [ ] Step 2: Business Profile - Apollo style
- [ ] Step 3: Calendar Intro - Apollo style
- [ ] Step 4: Calendar Choice - Apollo style with Outlook placeholder
- [ ] Step 5: Calendar Connect - Apollo style
- [ ] All steps have "QUESTION X OF Y" counter
- [ ] All steps have decorative illustration placeholder
- [ ] All steps use flat design (no cards, minimal shadows)
- [ ] All steps use button pills for selections
- [ ] Responsive design works on mobile/tablet
- [ ] Colors match Advicly theme

