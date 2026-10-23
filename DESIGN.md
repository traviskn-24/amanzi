# Amanzi design references

Use [Uiverse Elements](https://uiverse.io/elements) as the first stop when choosing or adapting UI elements for Amanzi, including cards, forms, buttons, inputs, controls, and loaders. Prefer its open-source CSS or Tailwind patterns, then adapt them to Amanzi's colors, accessibility needs, and responsive layout instead of dropping unrelated styles directly into the app.

Use [Google Fonts](https://fonts.google.com/) when selecting typography. Current app font: **Nunito Sans**, chosen for its rounded, friendly shapes and clear small-size readability beside the Amanzi wordmark.

## Current visual direction

- Water blue accents, deep navy actions, cool pale blue surfaces, and white cards.
- Rounded, tactile UI with restrained hover lift and soft shadows.
- Keep loading overlays full-screen; the supplied Amanzi video covers the viewport and loops while the underlying operation is active.
- Keep the logo compact in navigation and account flows so it supports the interface instead of dominating it.
- Respect reduced-motion preferences, maintain strong focus states, and keep functional text readable against the chosen surfaces.

## Uiverse elements already adapted into the app

- [Alshahwan's Follow button](https://uiverse.io/alshahwan/ugly-emu-27): adapted as a compact home action with a flex-aligned label and moving arrow, so the text stays readable at phone widths.
- [Praashoo7's neumorphic input](https://uiverse.io/Praashoo7/tame-sloth-39): retained only where the inset treatment fits; the community location search now uses a simpler bordered field with a visible focus ring.
- [Javierrocadev's CSS card](https://uiverse.io/Javierrocadev/red-stingray-37): clipped rounded card surface and soft circular highlight on community posts.
- [CodeByKay's glass card stack](https://uiverse.io/codebykay101/ugly-lion-23): reframed as a dark water-gradient community status panel with frosted status tiles.
- [EmmaxPlay's rounded card](https://uiverse.io/EmmaxPlay/itchy-bobcat-50) and [Pradeepsaranbishnoi's radio control](https://uiverse.io/Pradeepsaranbishnoi/hungry-bat-66): adapted into the update composer and water-status selection cards, retaining Amanzi's native, accessible radio inputs.
- The functional feed sort menu and the About page's glasslike story cards use the same translucent surfaces, soft lift, and keyboard focus treatment adapted from the Uiverse card and button collections.

The home dashboard follows familiar patterns from Amazon's grouped, task-first browsing and Facebook's simplified feed and navigation: area context, a prominent post action, focused feed controls, and related support information. These are layout references, not copied brand styling. Uiverse colors, sizes, and interactions are adapted for Amanzi's mobile layout, accessible contrast, and focus states. See `THIRD_PARTY_NOTICES.md` for MIT notices.
