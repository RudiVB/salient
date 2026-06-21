# Drop your unit art here

Put one transparent PNG per unit, named by its **id**. They load automatically
and replace the placeholder silhouettes — no code changes needed.

## Required filenames (id → unit)
```
rifleman.png   → Rifleman
grenadier.png  → Grenadier
car.png        → Armored Car
recon.png      → Recon Plane
mortar.png     → Mortar Team
guard.png      → Trench Guard
tank.png       → Heavy Tank
gas.png        → Gas Team
fieldgun.png   → Field Gun
storm.png      → Stormtrooper
sniper.png     → Sniper
landship.png   → Landship
howitzer.png   → Heavy Howitzer
```

## Art spec (important)
- **Transparent background** (PNG with alpha).
- **Side view, facing RIGHT.** Enemy units are auto-mirrored to face left.
- Roughly **512–1024 px tall**, full body in frame, small margin.
- Bake your own lighting/shading into the art (sprites are rendered unlit).
- One image = the unit's idle pose. (Sprite-sheet animation is a later upgrade.)

The same PNG is used for both armies; the enemy version is tinted/mirrored at runtime.
