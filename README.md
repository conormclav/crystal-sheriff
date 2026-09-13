# Crystal Sheriff: Crystal Clicker

An idle clicker set in the **Crystal Sheriff: Tower Defender** universe. You are **spideybidey4**,
the yellow sheriff cube, and the war is over — the hackers lost, the tower stands, and somebody
noticed the mega crystal is worth money. Click it. Click it a lot.

Hire a ridiculous posse (noobs with spoons, robot auto-clickers, a click farm with a rooster,
kaieke20's disco raid, FIREWALL's bakery, the moon), buy **145 increasingly unhinged upgrades**,
catch golden spam packets, collar bounty hackers, and melt each run down into **Sheriff Stars**
that make the next run permanently faster — while the numbers climb from thousands to MILLION to
BILLION to SEPTILLION and beyond, with a full-screen **NEW NUMBER!** celebration (and its power of
ten) every time a bigger one gets a name.

Plain HTML + CSS + JavaScript (Canvas 2D + Web Audio). No build step, no libraries, no network
calls. Runs offline from a double-click.

## How to open

Double-click `index.html` (or drag it into Chrome, Safari, Firefox or Edge). That's it.

Optional: `python3 -m http.server` in this folder, then visit `http://localhost:8000`.

Works on desktop, and on phones in portrait or landscape (the shop stacks under the arena on
narrow screens; the chrome compresses on short screens; safe-area insets are respected).

## How it plays

- **Click the mega crystal** (or press `Space` / `Enter`) to mine crystals.
- **HIRE THE POSSE** — 21 buildings, from *Noob With A Spoon* (0.1/sec) to the *Crystal Moon
  Drill*, *Shard Nebula Harvester* and *Cube-Verse Portal* (150 quadrillion/sec). Costs grow 12%
  per copy; buy x1 / x10 / x100 / MAX.
- **The auto-clicker army** — *Auto-Clicker 3000s*, *Click Farms* and *Cursor Factories* click the
  crystal for you with YOUR click power, so every click upgrade supercharges them too. Robot
  cursors visibly bonk the crystal in the arena.
- **UPGRADES** — 145 one-shot purchases: five ×2 tiers per building (unlocked at 5/15/35/75/150
  owned), a 17-step ×2 click ladder, crit-click chances (×10 **YEEHAW** crits), "clicks gain % of
  your /sec" synergies, global ×2 multipliers, and specials (golden-packet magnets, WANTED posters,
  robo-finger espresso, the Boss Amnesty Program).
- **Golden spam packets** fly across the arena every couple of minutes. Click one for
  *Crystal Frenzy* (×7 production), *Click Fever* (×15 clicks), *Deadeye* (every click crits),
  a *Lucky Drop*, or a *Tower Bonanza*.
- **Bounty hackers** occasionally sprint across the floor. Click one: **ACCESS DENIED**, big L,
  crystals for you.
- **BIG NUMBERS, ON PURPOSE** — the HUD shows your crystals as a power of ten ("= 10^20"), every
  newly named number (MILLION, BILLION ... VIGINTILLION) throws a full-screen party with its 10^x,
  and past 10^65 the counter switches to pure scientific notation. The mega crystal grows, changes
  colour and gains orbiting shards with every named number you reach.
- **THE TOWER tab** — prestige. Stars are earned from all-time crystals
  (star *n* costs 5B·n³); each star is a permanent +10% to production and clicks (diminishing past
  100 stars). Resetting keeps stars, skins and achievements.
- **Skins** — play as spideybidey4, kaieke20, superted9, hollebunbun, a reformed hacker, or the
  GOLDEN SHERIFF (first prestige). Purely cosmetic, deeply important.
- **51 achievements**, each worth +2% production — including one for every giant number name. The
  news ticker reports frontier events of questionable accuracy.
- **Offline earnings** — the posse keeps mining at 60% while the page is closed (up to 10h; 90% up
  to 14h with Crystal Insurance). Progress autosaves to `localStorage` every 15 seconds.

## Controls

| Action            | Desktop                        | Touch                    |
|-------------------|--------------------------------|--------------------------|
| Mine              | Click the arena, or `Space`/`Enter` | Tap the arena       |
| Catch events      | Click the packet / hacker      | Tap it                   |
| Buy               | Click shop rows / upgrade tiles (hover for tooltips) | Tap  |
| Mute sound        | `M` or 🔊 button               | 🔊 button                |
| Music / save / wipe | 🎵 💾 🗑️ buttons              | same                     |

## Files

```
index.html   page + HUD + shop markup
style.css    neon HUD, shop, tooltips, responsive rules (pixel font embedded)
game.js      everything else: data, economy, canvas scene, audio, save
assets/      music + UI sound pack from Tower Defender (game runs without it)
```

The pixel font (Press Start 2P, SIL Open Font License) is embedded in `style.css` so it works
offline. Small SFX are synthesised with the Web Audio API; the mp3s in `assets/` (Pixabay /
freesound community packs — see `assets/README.md`) are used for music and fanfares.

## Debug / testing hooks

`window.CC` is the live `Game` instance and `window.CC_DATA` holds the data tables. URL params:

- `?crystals=1000000` — start the session with a gift
- `?fast=1` — golden packets and bounty hackers spawn near-constantly

Handy console moves: `CC.earn(1e12)`, `CC.spawnPacket()`, `CC.spawnBandit()`,
`CC.s.stars += 10; CC.recalc()`.

## Credits

Built by **Conor & Ryan McLaverty**. Built, developed, maintained and copyrighted by
**Green Pencil Creative**. © 2026 Green Pencil Creative. All rights reserved.

Based on the characters, look and lore of *Crystal Sheriff: Tower Defender*.
