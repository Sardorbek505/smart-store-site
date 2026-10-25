# Offer, installation journey and screen readability · v33

Review: https://metov.store/?v=33#license and https://metov.store/?v=33#installation

## Offer and licence

The features section identifies tool/parts stores as its audience. The hero's small trial note states Windows 10/11. The trial block now names checkout, inventory and reports, states 14 free days without an activation code, and identifies the licence as one computer. The post-trial note preserves access to existing data; its conditions link opens the licence section of the policy page directly.

Price and licence duration are not invented. The price action explicitly opens WhatsApp with a prepared enquiry about one computer, price, duration and activation. The existing trial FAQ is expanded to cover buying/activating a licence; no extra FAQ row is added. These terms follow the application's trial/licence gate and the existing policy. The page does not send messages or take payments.

## Phone to Windows

Copy and system sharing now transfer `https://metov.store/#installation`, not the landing's hero. The visible field omits `https://` for readability; the copied/shared URL remains canonical and the manually copied address resolves to the same location.

On Windows the direct link has a real download button, three concise installation steps and the stable release's version/size. Every download action uses the already validated official stable installer; an unavailable/invalid release API leaves the official release page as fallback.

On phones, tablets, Mac and Linux the guide shows the handoff card with copy/share actions. An unsupported system share API gets a full-size primary copy button. Share cancellation produces no false success/error; a share error points to copy. Clipboard failure selects the visible address for manual copying. Copy/share itself is only invoked by the visitor.

Device-specific controls and checklist text are selected by an early head attribute before CSS paint, so a direct phone link does not briefly show a Windows download card. Without enhancement modules the phone still has the readable address for manual copying; without JavaScript the generic Windows guide and official release link remain available.

## Visual polish and readable screens

`journey.css` styles the installation as a consistent two-column desktop / stacked phone layout, with numbered steps, a clear action card and shared gutters. The trial's generated 14 remains the main image. Desktop start typography is slightly reduced and phone step previews are enlarged while keeping entire devices within their frames.

All source screenshot previews now have **Увеличить / Вписать**. Enlarging displays the original raster at its native width inside a scrollable, keyboard-focusable stage; visitors can pan both axes to read desktop UI on a phone. Closing restores the fit state. Existing original links, loading/error states, native Escape and focus return remain. No live 3D or animation library is added.

## Validation

`tests/journey-check.py` covers Windows installers and API failure, phone deep links, share success/cancel/failure, unsupported share fallback, clipboard failure, prepared WhatsApp enquiry, platform-specific pre-module rendering, native-width preview zoom/pan/fit and viewport fit at 320×568, 390×844, 844×390 and 1440×900. Remote service responses are stubbed, and no real WhatsApp message or system share is sent by the tests.

Existing browser flows, native components, full image bounds, first paint and mobile scroll/rotation checks are retained. Screenshots are visually reviewed and the published page is checked after deployment. Browser-engine tests do not claim a physical iPhone run.

Accessibility review also corrected the header login link so its accessible name follows its visible phone/desktop label. The final page and zoom dialog were checked with axe WCAG A/AA.
