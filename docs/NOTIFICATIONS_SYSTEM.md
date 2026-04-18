# Notifications System Implementation

A new system-wide notification system has been implemented. This system links user preferences (settings) to real-time events in the inventory and sales modules.

## 🚀 Setup Instructions

### 1. Database Migration (Required)
You must run the provided SQL script to add the `notifications` table and update the `system_settings` table.

1. Go to your Supabase Dashboard -> SQL Editor.
2. Open the file `notifications_setup.sql` from your project root.
3. Copy the contents and run the query.

### 2. Features Implemented

#### ✅ Settings Page
- **Persisted Settings**: The "Notifications" and "Dead Stock" settings in the Settings page now save to the `system_settings` table in the database.
- **Switches**:
  - `low_stock_alert_enabled`: Triggers when items fall below minimum stock.
  - `dead_stock_alert_enabled`: (Logic reserved for future periodic background jobs).
  - `new_purchase_alert_enabled`: Triggers on new purchase invoice.
  - `new_surgery_alert_enabled`: Triggers on new surgery recording.
  - `margin_warning_enabled`: Triggers when a surgery has <= 0 profit.
  - `dead_stock_threshold_months`: Configurable month threshold.

#### ✅ Notification Logic (Backend/Service Layer)
- **New Purchase**: Checks `new_purchase_alert_enabled` in `purchasesService` and creates a notification.
- **New Surgery**: Checks `new_surgery_alert_enabled` in `surgeriesService` and creates a notification.
- **Margin Warning**: Checks `margin_warning_enabled` and `profit <= 0` in `surgeriesService`.
- **Low Stock**: Checks `low_stock_alert_enabled` after surgery/usage and warns if any item falls below `min_stock`.

#### ✅ UI Updates
- **Bell Icon**: Added to the Sidebar (User Section).
- **Red Dot**: Shows when there are unread notifications.
- **Notification List**: Clicking the Bell icon shows a dropdown with recent notifications.
- **Mark as Read**: Clicking a notification or "Mark all read" updates the status.
- **Navigation**: Clicking a notification navigates to the relevant page (e.g., `/sales`, `/inventory`, `/purchases`).

## 📁 Files Modified/Created

- **New**: `notifications_setup.sql` (Database Schema)
- **New**: `src/services/notificationsService.ts` (API for notifications)
- **New**: `src/services/settingsService.ts` (API for settings)
- **Modified**: `src/hooks/useSupabase.ts` (Added hooks)
- **Modified**: `src/pages/Settings.tsx` (Connected to backend)
- **Modified**: `src/components/layout/Sidebar.tsx` (Added Bell icon & Popover)
- **Modified**: `src/services/surgeriesService.ts` (Added trigger logic)
- **Modified**: `src/services/purchasesService.ts` (Added trigger logic)

---
**Developed by:** Claude (Antigravity AI)
**Date:** February 8, 2026
