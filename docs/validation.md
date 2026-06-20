# Content validation

The structured content the editor produces is validated at build time. Each
component carries a `validation` block in its `manifest.json`, and
`metalsmith-bundled-components` checks every section's frontmatter against it
during the build. A section that violates its contract fails the build with a
specific error rather than rendering wrong in production.

The editor generates its forms from those same manifests, so authoring through
the editor avoids most of these errors by construction: number fields use a
number widget, closed sets render as selects, booleans render as checkboxes.
This guide matters most when frontmatter is **hand-edited** outside the editor,
where the contract is easy to break by accident.

## Why validation matters

The structured-content approach relies on frontmatter configuration. Small
mistakes cause "silent failures" — the site builds successfully but doesn't
work as expected:

```yaml
# ❌ This builds but breaks functionality
sections:
  - sectionType: banner
    containerFields:
      isAnimated: "false"    # String always evaluates to true!
    text:
      titleTag: "header"     # Invalid HTML - should be h1-h6
    ctas:
      - buttonStyle: "blue"  # CSS class doesn't exist
```

## Common validation errors

### 1. String vs boolean

**Problem**: strings always evaluate to `true` in templates, even `"false"`.

```yaml
# ❌ Wrong - string that always evaluates to true
isAnimated: "false"

# ✅ Correct - actual boolean
isAnimated: false
```

Boolean fields appear throughout the component set — flags like `isReverse`,
`isFullScreen`, `isDisabled`, and the container/background flags
(`containerFields.inContainer`, `containerFields.isAnimated`,
`containerFields.noMargin.top|bottom`, `containerFields.noPadding.top|bottom`,
`containerFields.background.isDark`) and `ctas[].isButton`. The editor renders
each of these as a checkbox, so it always writes a real boolean.

### 2. Invalid heading tags

**Problem**: an invalid heading tag creates poor HTML semantics.

```yaml
# ❌ Wrong - not a valid HTML heading
text:
  titleTag: "header"

# ✅ Correct - valid HTML heading
text:
  titleTag: "h2"
```

**Valid values**: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`.

### 3. Invalid button styles

**Problem**: a button style that isn't a real CSS class renders unstyled.

```yaml
# ❌ Wrong - no .btn-blue class exists
ctas:
  - buttonStyle: "blue"

# ✅ Correct - a real button style
ctas:
  - buttonStyle: "primary"
```

**Valid values**: `primary`, `secondary`, `tertiary`, `inverted`.

### 4. Invalid background screen options

**Problem**: an image-overlay class that doesn't exist.

```yaml
# ❌ Wrong - no such overlay class
containerFields:
  background:
    imageScreen: "medium"

# ✅ Correct - a real overlay option
containerFields:
  background:
    imageScreen: "dark"
```

**Valid values**: `light`, `dark`, `none`.

## Error messages

When validation fails, the build prints a specific, actionable error:

```
❌ Validation Error in src/index.md

Section 0 (banner):
  - containerFields.isAnimated: expected boolean, got string "false"
  - text.titleTag: "header" is invalid. Must be one of: h1, h2, h3, h4, h5, h6
  - ctas[0].buttonStyle: "blue" is invalid. Must be one of: primary, secondary, tertiary, inverted

Tip: String "false" evaluates to true in templates. Use boolean false instead.
```

## Which components are validated

Validation is per-component: every component that ships a `validation` block in
its `manifest.json` is checked. That covers the library's section components
broadly — the boolean, enum, and heading-tag rules above are the recurring
patterns, applied wherever a component declares the corresponding field. The
authoritative list of valid values for any given section is that component's
own `manifest.json` (and its README), not this guide. Because the editor builds
its forms from those manifests, the set of validated fields and the set of
fields the editor exposes are the same set.

## Best practices

### 1. Use actual booleans

```yaml
# ✅ Good
isAnimated: true
isReverse: false

# ❌ Avoid
isAnimated: "true"
isReverse: "false"
```

### 2. Use valid enum values

Always use the predefined values for fields like `titleTag`, `buttonStyle`, and
`imageScreen`. When in doubt, the component's `manifest.json` lists them.

### 3. Test your content

Run `npm run build` to validate. The build fails with helpful error messages
when validation errors are found.

### 4. Prefer the editor for hand-edited content

The editor's forms are generated from the same manifests that drive validation,
so content authored through the editor satisfies the contract by construction.
Hand-editing frontmatter is where the errors above creep in.

## Extending validation

Validation rules live in each component's `manifest.json`. A custom component
adds its own:

```json
{
  "name": "my-component",
  "validation": {
    "required": ["sectionType"],
    "properties": {
      "sectionType": {
        "type": "string",
        "const": "my-component"
      },
      "myBooleanField": {
        "type": "boolean"
      },
      "myEnumField": {
        "type": "string",
        "enum": ["option1", "option2", "option3"]
      }
    }
  }
}
```

This keeps structured content correct so it renders properly in production.
