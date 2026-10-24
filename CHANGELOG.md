# Changelog

All notable changes to the **RailSeat Agent** (`D:\playground\rail`) project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.2.0] - 2026-10-24

### Added
- **Reserved vs Unreserved Duration Breakdown in Listings**:
  - Implemented real-time seat time breakdown on each train card:
    - **Reserved Seat Duration**: Displays exact duration with a confirmed seat (e.g. `8h 20m` or `14h 45m`) with an armchair badge.
    - **Unreserved Travel Duration**: Shows remaining unreserved/general journey time (e.g. `14h 00m` or `0m (Full Journey)`) with an amber status indicator.
  - Implemented multi-day rollover duration computation in `lib/irctc-engine.ts` (`computeDuration`) resolving multi-day train schedules and overnight arrival timestamps accurately.
- **Single-Click Train Number Copy**:
  - Refactored copy action to copy **strictly the train number** (e.g., `14218`, `04087`) directly to clipboard.
  - Added tactile copy button state: `Copy #<trainNo>` $\rightarrow$ `Copied #<trainNo>`.
- **Apple-Grade Minimalist UI Overhaul**:
  - Re-imagined interface following Apple HIG: Cupertino frosted-glass surfaces (`backdrop-blur-2xl`), refined border radiuses (`rounded-3xl` and `rounded-2xl`), and subtle micro-shadows.
  - Tactile typography with SF Pro / Geist tracking, clear visual hierarchy, and restrained color accents.
  - Visual station connector with 1-click station swap (`PNBE` $\leftrightarrow$ `NDLS`).
  - Tactile segmented departure presets (`Any Time`, `Morning 06-12`, `Afternoon 12-18`, `Post 13:00`, `Evening 18-24`).
- **Dark Mode & Light Mode Support**:
  - Integrated Apple-style segmented theme switcher (`Light` / `System` / `Dark`) using `next-themes`.
  - Light mode: crisp white frosted surfaces on `#f5f5f7` canvas with iOS-grade contrast.
  - Dark mode: deep obsidian OLED backdrop (`#000000`) with elevated dark surfaces (`#1c1c1e`).
- **Refined Journey Route Visualizer**:
  - Enhanced horizontal railway progress track with origin, confirmed drop-off stop, and destination milestones.
  - Live coverage percentage and distance metrics breakdown (`coveredDist / totalDist km`).
- **Collapsible IRCTC Session Drawer**:
  - Minimalist disclosure drawer with active session pulse dot and auto-parsing feedback.
