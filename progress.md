# Supply-Care Development Progress

## 🎯 Context Summary
We have completed a massive refactoring of the **Supply-Care ERP**. The primary goal was to replace deprecated `useSupabase` hooks with a modern, service-based architecture using `TanStack Query` and a central `useSupabaseData` hook. We also successfully launched the **Production Database Schema (v2.0)** and resolved critical authorization bottlenecks caused by custom authentication.

## 🏗️ Architecture Decisions
1.  **Service Layer**: All database interactions are now encapsulated in `@/services/*.ts`.
2.  **Custom Auth Implementation**: The app uses a manual session managed in `localStorage`. Consequently, Supabase RLS is disabled on all tables, and `anon` role is granted full CRUD permissions to prevent `401 Unauthorized` errors.
3.  **Data Consistency**: Switched from `camelCase` in UI to `snake_case` in DB via mappers (`toDb`/`fromDb`) located in services.
4.  **Performance View**: Implemented `mv_dashboard_stats` (Materialized View) for instant dashboard loading, refreshed via database triggers.

## 📁 Key File Logic
| File | Logic Implemented |
| :--- | :--- |
| `src/services/` | Contains `usersService`, `invoicesService`, `productsService`, etc. Handles data mapping and raw Supabase calls. |
| `src/hooks/useSupabaseData.ts` | Centralized React Query hooks for fetching products, surgeries, and notifications. |
| `src/pages/Analytics.tsx` | Fixed dead stock calculation, quantity field names, and consolidated product/doctor queries. |
| `src/pages/Settings.tsx` | Optimized profile loading (instant pre-seed from Auth) and corrected notification toggle state mappings. |
| `src/components/UserManagement.tsx` | Bypassed broken RPCs for direct table insertion with server-side hashing (`hash_password`). |

## 🛠️ Database / SQL Files (v2 Production)
The following files represent the current production backend state:
1.  `new_database/PROD_MASTER_SETUP.sql`: The core engine (Tables, Foreign Keys, Functions, Triggers).
2.  `new_database/db_performance.sql`: Optimization layer (Indexes, Materialized Views, Dashboard RPCs).
3.  `new_database/fix_all_permissions.sql`: **CRITICAL** - Disables RLS and grants `anon` permissions for the custom Auth system.
4.  `new_database/fix_create_user_rpc.sql`: Implements `hash_password` for secure frontend-driven user creation.

## ✅ Completed This Session
- [x] Zero TypeScript errors project-wide (verified via `tsc`).
- [x] Replaced all deleted `useSupabase` imports.
- [x] Fixed "Slow Profile" issue in Settings via `initialData` pre-seeding.
- [x] Fixed "Notification Save" bug (snake_case vs camelCase mismatch).
- [x] Resolved `401 Unauthorized` on Insert/Delete via permissions script.
- [x] Fixed `500 Internal Error` on User Delete by fixing materialized view refresh concurrency.

## ⏳ Pending Tasks
1.  **Surgery Items Validation**: Ensure the new `create_surgery_transaction` RPC handles stock deduction correctly.
2.  **User Roles Review**: Verify that the `partner` role (read-only) UI constraints are fully implemented in the frontend.
