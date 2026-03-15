# MOOVIZ — Play Store Graphics Guide

## Required Assets

### 1. App Icon (512x512 PNG)
- **File**: `app-icon-512.png`
- **Spec**: 512x512px, PNG, 32-bit, no alpha/transparency
- **Current source**: `Docs/client/branding/ic_launcher.png`
- **Action**: Export at 512x512 from original vector/high-res source

### 2. Feature Graphic (1024x500 PNG/JPG)
- **File**: `feature-graphic.png`
- **Spec**: 1024x500px, PNG or JPG
- **Design**:
  - Background: MOOVIZ dark (#1B1C1D) with gold accent gradient
  - Center: MOOVIZ logo (from `Docs/client/LOGO.jpg`)
  - Tagline: "משלוחים קהילתיים בזמן אמת" / "Real-Time Community Deliveries"
  - Gold accent line (#D2AC47) at bottom
  - No text smaller than 24px (gets cropped on small displays)

### 3. Screenshots (min 2, max 8)
**Sizes** (pick one per device type):
- Phone: 1080x1920 (16:9) or 1080x2340 (19.5:9)
- 7" Tablet: 1200x1920
- 10" Tablet: 1600x2560

**Recommended 8 screenshots** (in order):

| # | Screen | Hebrew Caption | English Caption |
|---|--------|---------------|-----------------|
| 1 | Feed with nearby deliveries | "מצא משלוחים קרובים אליך" | "Find nearby deliveries" |
| 2 | Create delivery form | "שלח כל פריט בקלות" | "Send any item easily" |
| 3 | Live map tracking | "מעקב בזמן אמת" | "Real-time tracking" |
| 4 | Chat between sender & driver | "צ'אט ישיר עם הנהג" | "Direct chat with driver" |
| 5 | Proof photo capture | "הוכחת איסוף ומסירה" | "Pickup & delivery proof" |
| 6 | Payment confirmation | "אישור תשלום מאובטח" | "Secure payment confirmation" |
| 7 | Driver KYC verification | "אימות נהגים מהיר" | "Quick driver verification" |
| 8 | Rating & profile | "דרגו ובנו מוניטין" | "Rate & build reputation" |

**Screenshot frame design**:
- Dark background (#1B1C1D)
- Phone mockup frame (use a tool like Shotbot, AppMockUp, or Figma)
- Gold (#D2AC47) caption text below phone
- MOOVIZ logo watermark in corner (subtle)

### 4. Video (optional, 30sec-2min)
- YouTube link for promo video
- Landscape 1920x1080 recommended
- Show: sender flow → driver match → live tracking → delivery → payment

## Branding Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Gold | #D2AC47 | Primary accent, headings, buttons |
| Dark Gold | #AE8625 | Secondary headings |
| Light Gold | #F7EF8A | Gradient highlights |
| Dark BG | #1B1C1D | Backgrounds |
| Body text | #CFCBBF | Light text on dark |

## Font
- Headings: **Prata** (serif)
- Body: **Raleway** (sans-serif)
- Hebrew: System default (Heebo recommended for marketing)

## Source Files
| Asset | Location |
|-------|----------|
| MOOVIZ Logo | `Docs/client/LOGO.jpg` |
| App Icon | `Docs/client/branding/ic_launcher.png` |
| Round Icon | `Docs/client/branding/ic_launcher_round.png` |
| KAL Logo (icon) | `Docs/client/branding/kal-logo-icon.png` |
| KAL Logo (full) | `Docs/client/branding/kal-logo-full.png` |

## Tools for Screenshot Generation
- **Shotbot** (shotbot.io) — automated device frames
- **AppMockUp** (app-mockup.com) — free device frames
- **Figma** — custom frames with branding overlay
- **Android Studio** — capture from emulator with device frame
