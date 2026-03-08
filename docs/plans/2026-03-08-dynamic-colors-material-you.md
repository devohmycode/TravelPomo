# Dynamic Colors (Material You) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "System" theme that extracts Android 12+ Material You (Monet) colors from the wallpaper and applies them as `colorA`/`colorB` in the existing theme system.

**Architecture:** A Capacitor plugin (`DynamicColorsPlugin.kt`) reads system Monet colors via `android.R.color.system_accent1_*` and `system_accent3_*` APIs. The JS side calls `getSystemColors()` at mount, receives `{ colorA, colorB, available }`, and injects them into the existing theme system. A new "System" entry appears first in the theme grid on Android only.

**Tech Stack:** Kotlin (Capacitor Plugin), React hooks, existing theme infrastructure

---

### Task 1: Create the DynamicColorsPlugin Kotlin class

**Files:**
- Create: `android/app/src/main/java/com/pomo/focustimer/plugin/DynamicColorsPlugin.kt`

**Step 1: Create the plugin file**

```kotlin
package com.pomo.focustimer.plugin

import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "DynamicColors")
class DynamicColorsPlugin : Plugin() {

    @PluginMethod
    fun getSystemColors(call: PluginCall) {
        val ret = JSObject()

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            ret.put("available", false)
            ret.put("colorA", "#1a3a5c")
            ret.put("colorB", "#e8a830")
            call.resolve(ret)
            return
        }

        try {
            val ctx = context
            val primary = ctx.getColor(android.R.color.system_accent1_500)
            val tertiary = ctx.getColor(android.R.color.system_accent3_500)

            ret.put("available", true)
            ret.put("colorA", colorToHex(primary))
            ret.put("colorB", colorToHex(tertiary))
            call.resolve(ret)
        } catch (e: Exception) {
            ret.put("available", false)
            ret.put("colorA", "#1a3a5c")
            ret.put("colorB", "#e8a830")
            call.resolve(ret)
        }
    }

    private fun colorToHex(color: Int): String {
        val r = (color shr 16) and 0xFF
        val g = (color shr 8) and 0xFF
        val b = color and 0xFF
        return String.format("#%02x%02x%02x", r, g, b)
    }
}
```

**Step 2: Verify the file compiles mentally** — no external dependencies needed beyond Android SDK (API 31+ for `system_accent1_*`).

---

### Task 2: Register the plugin in MainActivity

**Files:**
- Modify: `android/app/src/main/java/com/pomo/focustimer/MainActivity.java`

**Step 1: Add the import and registration**

Add after the existing `ProPurchasePlugin` import:
```java
import com.pomo.focustimer.plugin.DynamicColorsPlugin;
```

Add after the existing `registerPlugin(ProPurchasePlugin.class);`:
```java
registerPlugin(DynamicColorsPlugin.class);
```

**Step 2: Verify the file**

Final `MainActivity.java` should be:
```java
package com.pomo.focustimer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.pomo.focustimer.plugin.PomoTimerPlugin;
import com.pomo.focustimer.plugin.ProPurchasePlugin;
import com.pomo.focustimer.plugin.DynamicColorsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PomoTimerPlugin.class);
        registerPlugin(ProPurchasePlugin.class);
        registerPlugin(DynamicColorsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

---

### Task 3: Create the `useDynamicColors` hook

**Files:**
- Create: `hooks/use-dynamic-colors.ts`

**Step 1: Create the hook**

```typescript
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getPlatform } from "@/lib/platform"

interface DynamicColors {
  colorA: string
  colorB: string
  available: boolean
}

export function useDynamicColors() {
  const [colors, setColors] = useState<DynamicColors | null>(null)
  const fetchedRef = useRef(false)

  const fetchColors = useCallback(async () => {
    if (getPlatform() !== "android") {
      setColors({ colorA: "#1a3a5c", colorB: "#e8a830", available: false })
      return
    }

    try {
      const { Capacitor } = await import("@capacitor/core")
      if (Capacitor.isNativePlatform()) {
        const result = await Capacitor.Plugins["DynamicColors"]?.getSystemColors()
        if (result) {
          setColors({
            colorA: result.colorA,
            colorB: result.colorB,
            available: result.available,
          })
          return
        }
      }
    } catch {
      // Plugin not available
    }

    setColors({ colorA: "#1a3a5c", colorB: "#e8a830", available: false })
  }, [])

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      fetchColors()
    }
  }, [fetchColors])

  return colors
}
```

---

### Task 4: Add "System" theme to the THEMES array and ColorPanel

**Files:**
- Modify: `components/color-panel.tsx`

**Step 1: Add `system` prop to `ThemeOption` and `ColorPanelProps`**

In the `ThemeOption` interface (line ~173), add:
```typescript
interface ThemeOption {
  a: string
  b: string
  label: string
  premium?: boolean
  system?: boolean
}
```

Add to `ColorPanelProps` (after `isPro: boolean`):
```typescript
  systemColors?: { colorA: string; colorB: string; available: boolean } | null
```

Add to the `ColorPanel` function destructured props:
```typescript
  systemColors,
```

**Step 2: Build the dynamic THEMES list inside ColorPanel**

At the top of the `ColorPanel` component body (after props destructuring, before `isCustom`), add:
```typescript
  const showSystemTheme = systemColors?.available === true

  const allThemes = showSystemTheme
    ? [{ a: systemColors!.colorA, b: systemColors!.colorB, label: "System", system: true }, ...THEMES]
    : THEMES

  // Adjust index: when System theme is shown, stored indices shift by +1
  const adjustedActiveIndex = showSystemTheme ? activeThemeIndex : activeThemeIndex
```

**Step 3: Replace `THEMES` with `allThemes` in the grid rendering**

Replace the theme grid (lines ~719-728):
```tsx
      <div className="grid grid-cols-3 gap-2 mb-5">
        {allThemes.map((theme, i) => (
          <ThemePreview
            key={theme.label}
            theme={theme}
            active={activeThemeIndex === i}
            onClick={() => { setCustomView(null); handleThemeClick(i) }}
            isPro={isPro}
          />
        ))}
      </div>
```

**Step 4: Update `handleThemeClick` to handle the System theme**

Replace the `handleThemeClick` callback:
```typescript
  const handleThemeClick = useCallback(
    (i: number) => {
      const themes = showSystemTheme
        ? [{ a: systemColors!.colorA, b: systemColors!.colorB, label: "System", system: true }, ...THEMES]
        : THEMES
      const theme = themes[i]
      if (theme.premium && !isPro) {
        const prev = activeThemeIndex
        handlePremiumPreview(
          () => onThemeChange(i),
          () => onThemeChange(prev)
        )
      } else {
        onThemeChange(i)
        onClose()
      }
    },
    [isPro, activeThemeIndex, onThemeChange, handlePremiumPreview, showSystemTheme, systemColors]
  )
```

**Step 5: Update `ThemePreview` to show a special indicator for System theme**

In the `ThemePreview` component, add a system icon hint. Replace the gradient div:
```tsx
      <div
        className="absolute inset-0"
        style={{
          background: theme.system
            ? `conic-gradient(from 0deg, ${theme.a}, ${theme.b}, ${theme.a})`
            : `linear-gradient(135deg, ${theme.a} 0%, ${theme.b} 100%)`,
        }}
      />
```

---

### Task 5: Wire `useDynamicColors` into FlipClock and resolve theme colors

**Files:**
- Modify: `components/flip-clock.tsx`

**Step 1: Import the hook**

Add after existing imports:
```typescript
import { useDynamicColors } from "@/hooks/use-dynamic-colors"
```

**Step 2: Call the hook in `FlipClock`**

Add after `const { isPro, purchasePro, restorePurchase } = usePro()` (line ~94):
```typescript
  const dynamicColors = useDynamicColors()
```

**Step 3: Resolve theme colors accounting for the System theme**

Find where `theme` is computed (around line ~291):
```typescript
const theme = themeIndex === -1
  ? { a: customColorA, b: customColorB, label: "Custom" }
  : THEMES[themeIndex] || THEMES[0]
```

Replace with:
```typescript
  const systemAvailable = dynamicColors?.available === true
  const systemThemeOffset = systemAvailable ? 1 : 0

  const theme = themeIndex === -1
    ? { a: customColorA, b: customColorB, label: "Custom" }
    : systemAvailable && themeIndex === 0
      ? { a: dynamicColors!.colorA, b: dynamicColors!.colorB, label: "System" }
      : THEMES[themeIndex - systemThemeOffset] || THEMES[0]
```

**Step 4: Pass `systemColors` to `ColorPanel`**

Find the `<ColorPanel` JSX and add the prop:
```tsx
  systemColors={dynamicColors}
```

**Step 5: Update `currentTheme` in `ColorPanel` to use the same offset logic**

In `ColorPanel`, replace the `isCustom` / `currentTheme` block:
```typescript
  const isCustom = activeThemeIndex === -1
  const currentTheme = isCustom
    ? { a: customColorA, b: customColorB, label: "Custom" }
    : showSystemTheme && activeThemeIndex === 0
      ? { a: systemColors!.colorA, b: systemColors!.colorB, label: "System" }
      : allThemes[activeThemeIndex] || allThemes[0]
```

---

### Task 6: Build and verify on Android

**Step 1: Build the Next.js static export**

Run: `pnpm build`
Expected: Build succeeds with no errors.

**Step 2: Sync to Capacitor**

Run: `npx cap sync android`
Expected: Sync completes, plugin is picked up.

**Step 3: Open in Android Studio and build**

Run: `npx cap open android` (or build via command line)
Expected: APK builds successfully. On Android 12+ device/emulator, the "System" theme appears first in the color panel with the wallpaper-derived colors. On Android < 12, the "System" theme does not appear.

**Step 4: Commit**

```bash
git add android/app/src/main/java/com/pomo/focustimer/plugin/DynamicColorsPlugin.kt \
      android/app/src/main/java/com/pomo/focustimer/MainActivity.java \
      hooks/use-dynamic-colors.ts \
      components/color-panel.tsx \
      components/flip-clock.tsx
git commit -m "feat: Add Dynamic Colors (Material You) system theme for Android 12+"
```
