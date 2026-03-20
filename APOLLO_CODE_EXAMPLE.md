# Apollo-Style Code Structure Example

## Template for All Steps

```jsx
import React from 'react';
import { Button } from '../../components/ui/button';

const StepX_Title = ({ data, onNext, onBack }) => {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Two-Column Layout */}
      <div className="grid grid-cols-2 gap-12 items-start">
        
        {/* LEFT COLUMN - Content */}
        <div className="space-y-8">
          
          {/* Question Counter */}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Question X of Y
            </p>
          </div>

          {/* Title & Subtitle */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-foreground">
              Main Title Here
            </h1>
            <p className="text-lg text-muted-foreground">
              Subtitle or description here
            </p>
          </div>

          {/* Content Section */}
          <div className="space-y-6">
            {/* Example: Selection Buttons */}
            <div className="space-y-3">
              <button
                className="w-full p-4 border-2 border-border rounded-lg text-left hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {/* Icon here */}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Option Title</h3>
                    <p className="text-sm text-muted-foreground">Option description</p>
                  </div>
                  <div className="flex-shrink-0">
                    {/* Radio button or checkmark */}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-8">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button onClick={onNext} className="ml-auto">
              Continue
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN - Illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="w-full h-96 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-lg flex items-center justify-center border border-border">
            <span className="text-muted-foreground text-sm">Illustration Placeholder</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StepX_Title;
```

---

## Step 2: Business Profile - Specific Example

```jsx
const Step2_BusinessProfile = ({ data, onNext, user }) => {
  const [formData, setFormData] = useState({...});

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="grid grid-cols-2 gap-12 items-start">
        
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

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Business Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Smith Financial Advisors"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Business Type - Button Pills */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Business Type
              </label>
              <div className="flex flex-wrap gap-2">
                {BUSINESS_TYPES.map(type => (
                  <button
                    key={type}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      formData.business_type === type
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-foreground hover:border-primary/50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Team Size - Button Pills */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Team Size
              </label>
              <div className="flex flex-wrap gap-2">
                {TEAM_SIZES.map(size => (
                  <button
                    key={size.value}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      formData.team_size === size.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-foreground hover:border-primary/50'
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Timezone
              </label>
              <input
                type="text"
                value={formData.timezone}
                className="w-full px-4 py-2 border border-border rounded-lg"
              />
              <p className="text-xs text-muted-foreground">
                Detected automatically from your browser
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-8">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button onClick={handleSubmit} className="ml-auto">
              Continue
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN - Illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="w-full h-96 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-lg flex items-center justify-center border border-border">
            <span className="text-muted-foreground text-sm">Illustration</span>
          </div>
        </div>

      </div>
    </div>
  );
};
```

---

## Key CSS Classes Used

| Element | Classes |
|---------|---------|
| Container | `max-w-6xl mx-auto px-6 py-16` |
| Grid Layout | `grid grid-cols-2 gap-12 items-start` |
| Question Counter | `text-xs uppercase tracking-wide text-muted-foreground font-semibold` |
| Title | `text-4xl font-bold text-foreground` |
| Subtitle | `text-lg text-muted-foreground` |
| Button Pill (Unselected) | `px-4 py-2 rounded-lg border-2 border-border text-foreground hover:border-primary/50` |
| Button Pill (Selected) | `px-4 py-2 rounded-lg border-2 border-primary bg-primary/10 text-primary` |
| Input | `w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary` |
| Illustration Box | `w-full h-96 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-lg flex items-center justify-center border border-border` |
| Responsive Hide | `hidden lg:flex` (hide on mobile/tablet) |

---

## Responsive Behavior

```jsx
{/* Hide illustration on mobile/tablet, show on desktop */}
<div className="hidden lg:flex items-center justify-center">
  {/* Illustration */}
</div>

{/* On mobile, use single column */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
  {/* Content */}
</div>
```

---

## Color Reference

```
Primary Blue: #3B82F6
Primary Light: #3B82F6 with opacity (e.g., bg-primary/10)
Border Gray: #e5e7eb
Muted Gray: #6b7280
Foreground (Text): #1e293b
Background: #f8f9fb
```

---

## Summary

The Apollo style is characterized by:
1. ✅ Full-width two-column layout
2. ✅ Large, bold typography
3. ✅ Button pills for selections (not cards)
4. ✅ Flat design (no shadows)
5. ✅ Lots of whitespace
6. ✅ Question counter at top
7. ✅ Decorative illustration on right
8. ✅ Minimal borders and styling
9. ✅ Responsive design (single column on mobile)

