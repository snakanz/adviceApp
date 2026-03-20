# Apollo-Style Tailwind CSS Classes Reference

## Complete CSS Class Reference

### Container & Layout

```jsx
// Main container
className="max-w-6xl mx-auto px-6 py-16"

// Two-column grid (content + illustration)
className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start"

// Left column (content)
className="space-y-8"

// Right column (illustration) - hidden on mobile
className="hidden lg:flex items-center justify-center"
```

---

## Typography Classes

### Question Counter
```jsx
className="text-xs uppercase tracking-wide text-muted-foreground font-semibold"
```

### Title
```jsx
className="text-4xl font-bold text-foreground"
```

### Subtitle
```jsx
className="text-lg text-muted-foreground"
```

### Label
```jsx
className="text-sm font-medium text-foreground"
```

### Description Text
```jsx
className="text-sm text-muted-foreground"
```

### Small Helper Text
```jsx
className="text-xs text-muted-foreground"
```

---

## Button & Selection Classes

### Button Pill (Unselected)
```jsx
className="px-4 py-2 rounded-lg border-2 border-border text-foreground hover:border-primary/50 hover:bg-muted/50 transition-all"
```

### Button Pill (Selected)
```jsx
className="px-4 py-2 rounded-lg border-2 border-primary bg-primary/10 text-primary transition-all"
```

### Large Selection Button (Unselected)
```jsx
className="w-full p-4 border-2 border-border rounded-lg text-left hover:border-primary/50 hover:bg-muted/50 transition-all"
```

### Large Selection Button (Selected)
```jsx
className="w-full p-4 border-2 border-primary bg-primary/5 rounded-lg text-left transition-all"
```

### Disabled Button
```jsx
className="w-full p-4 border-2 border-border rounded-lg text-left opacity-50 cursor-not-allowed"
```

---

## Form Input Classes

### Text Input
```jsx
className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
```

### Select Dropdown
```jsx
className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
```

---

## Radio Button Classes

### Radio Button (Unselected)
```jsx
className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center flex-shrink-0"
```

### Radio Button (Selected)
```jsx
className="w-5 h-5 rounded-full border-2 border-primary bg-primary flex items-center justify-center flex-shrink-0"
```

### Radio Button Inner Dot
```jsx
className="w-2 h-2 bg-white rounded-full"
```

---

## Badge Classes

### "Coming Soon" Badge
```jsx
className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full"
```

### "Recommended" Badge
```jsx
className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full"
```

---

## Icon Classes

### Large Icon (in selection buttons)
```jsx
className="w-12 h-12"
```

### Medium Icon (in benefits)
```jsx
className="w-6 h-6"
```

### Small Icon (in badges)
```jsx
className="w-4 h-4"
```

---

## Illustration Placeholder Classes

### Illustration Box
```jsx
className="w-full h-96 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-lg flex items-center justify-center border border-border"
```

### Alternative Gradients
```jsx
// Blue gradient
className="w-full h-96 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg flex items-center justify-center border border-border"

// Green gradient
className="w-full h-96 bg-gradient-to-br from-green-100 to-green-50 rounded-lg flex items-center justify-center border border-border"

// Purple gradient
className="w-full h-96 bg-gradient-to-br from-purple-100 to-purple-50 rounded-lg flex items-center justify-center border border-border"
```

---

## Spacing Classes

### Section Spacing
```jsx
className="space-y-8"  // Large sections
className="space-y-6"  // Medium sections
className="space-y-4"  // Small sections
className="space-y-3"  // Tight sections
```

### Horizontal Spacing
```jsx
className="space-x-3"  // Between buttons
className="space-x-4"  // Between elements
```

### Padding
```jsx
className="p-4"   // Standard padding
className="p-6"   // Large padding
className="px-4 py-2"  // Horizontal/vertical
className="px-6 py-4"  // Large horizontal/vertical
```

### Margin
```jsx
className="mt-4"  // Top margin
className="mb-4"  // Bottom margin
className="ml-auto"  // Push to right
className="mr-auto"  // Push to left
```

---

## Flexbox Classes

### Flex Container
```jsx
className="flex items-center space-x-4"  // Horizontal, centered
className="flex items-start space-x-4"   // Horizontal, top-aligned
className="flex flex-col space-y-4"      // Vertical
```

### Flex Alignment
```jsx
className="flex items-center justify-between"  // Space between
className="flex items-center justify-center"   // Centered
className="flex items-start"                   // Top-aligned
```

### Flex Grow
```jsx
className="flex-1"        // Take remaining space
className="flex-shrink-0" // Don't shrink
```

---

## Grid Classes

### Grid Layout
```jsx
className="grid grid-cols-1 gap-4"      // Single column
className="grid grid-cols-2 gap-4"      // Two columns
className="grid grid-cols-3 gap-4"      // Three columns
className="grid grid-cols-1 lg:grid-cols-2 gap-12"  // Responsive
```

---

## Responsive Classes

### Hide/Show
```jsx
className="hidden lg:flex"      // Hide on mobile, show on desktop
className="block lg:hidden"     // Show on mobile, hide on desktop
className="hidden md:block"     // Hide on mobile/tablet, show on desktop
```

### Responsive Padding
```jsx
className="px-4 lg:px-6"       // Smaller on mobile, larger on desktop
className="py-8 lg:py-16"      // Smaller on mobile, larger on desktop
```

---

## Color Classes

### Text Colors
```jsx
className="text-foreground"           // Dark navy (#1e293b)
className="text-muted-foreground"     // Gray (#6b7280)
className="text-primary"              // Blue (#3B82F6)
className="text-red-500"              // Red (for required)
className="text-green-600"            // Green (for success)
```

### Background Colors
```jsx
className="bg-background"             // Light gray (#f8f9fb)
className="bg-card"                   // White (#ffffff)
className="bg-muted/50"               // Light gray with opacity
className="bg-primary/5"              // Light blue with opacity
className="bg-primary/10"             // Lighter blue with opacity
className="bg-yellow-100"             // Light yellow
className="bg-blue-50"                // Very light blue
className="bg-green-50"               // Very light green
```

### Border Colors
```jsx
className="border-border"             // Light gray (#e5e7eb)
className="border-primary"            // Blue (#3B82F6)
className="border-primary/50"         // Blue with opacity
className="border-red-200"            // Light red
className="border-green-200"          // Light green
```

---

## Transition Classes

### Smooth Transitions
```jsx
className="transition-all"            // All properties
className="transition-colors"         // Color changes only
className="hover:border-primary/50"   // Hover effect
className="hover:bg-muted/50"         // Hover background
```

---

## Complete Example

```jsx
<div className="max-w-6xl mx-auto px-6 py-16">
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
    
    {/* LEFT COLUMN */}
    <div className="space-y-8">
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
        Question 1 of 4
      </p>
      
      <div className="space-y-3">
        <h1 className="text-4xl font-bold text-foreground">
          Tell us about your business
        </h1>
        <p className="text-lg text-muted-foreground">
          This helps us personalize your experience
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Business Type
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="px-4 py-2 rounded-lg border-2 border-border text-foreground hover:border-primary/50 hover:bg-muted/50 transition-all">
              Option 1
            </button>
            <button className="px-4 py-2 rounded-lg border-2 border-primary bg-primary/10 text-primary transition-all">
              Option 2 (Selected)
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-8">
        <button className="px-4 py-2 border border-border rounded-lg">Back</button>
        <button className="px-4 py-2 bg-primary text-white rounded-lg ml-auto">Continue</button>
      </div>
    </div>

    {/* RIGHT COLUMN */}
    <div className="hidden lg:flex items-center justify-center">
      <div className="w-full h-96 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-lg flex items-center justify-center border border-border">
        <span className="text-muted-foreground text-sm">Illustration</span>
      </div>
    </div>

  </div>
</div>
```

---

## Quick Copy-Paste Snippets

### Container
```jsx
<div className="max-w-6xl mx-auto px-6 py-16">
```

### Two-Column Layout
```jsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
```

### Question Counter
```jsx
<p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
  Question X of Y
</p>
```

### Title
```jsx
<h1 className="text-4xl font-bold text-foreground">
  Title Here
</h1>
```

### Button Pill
```jsx
<button className="px-4 py-2 rounded-lg border-2 border-border text-foreground hover:border-primary/50 hover:bg-muted/50 transition-all">
  Option
</button>
```

### Illustration Box
```jsx
<div className="w-full h-96 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-lg flex items-center justify-center border border-border">
  <span className="text-muted-foreground text-sm">Illustration</span>
</div>
```

