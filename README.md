# Supply-Care (Medical Supply ERP)

Supply-Care is a comprehensive Enterprise Resource Planning (ERP) web application tailored specifically for medical supply businesses and clinics. It provides end-to-end management of inventory, purchasing, sales, invoicing, supplier debts, and financial reporting.

## 🚀 Key Features

### 1. Dashboard & Analytics
- **Real-time Metrics**: High-level overview of total sales, total purchases, outstanding debts, and overall inventory value.
- **Charts and Graphs**: Visual representation of financial data and trends using `recharts`.

### 2. Inventory Management
- **Product Tracking**: Complete CRUD operations for medical supplies and items.
- **Batch Management**: Track specific batches, expiry dates, and lot numbers for medical traceability.
- **Costing Methods**: Intelligent calculation using Weighted Average Cost (WAC) tracking and actual batch cost evaluation.
- **Categorization**: Group products into categories dynamically mapping to the database.

### 3. Sales & Invoicing
- **Point of Sale**: Create and print customized invoices directly.
- **Surgery/Operation Returns**: Logic to handle specific returned items after medical surgeries, dynamically adjusting client costs and restoring inventory.
- **Flexible Payments**: Support for partial payments and tracking unpaid balances on individual sales.

### 4. Purchases & Suppliers
- **Purchase Orders**: Log incoming shipments, defining batch specifics (costs, quantities, expiry dates).
- **Supplier Database**: Maintain profiles for all wholesale distributors and specific suppliers.
- **Purchase Invoices**: Generate records of liabilities accurately mapping to inventory increments.

### 5. Supplier Debts & Financials
- **Debt Tracking**: Monitor aggregate and invoice-level balances due to suppliers.
- **Payment Processing**: Make partial or complete payments against specific supplier invoices. Prevents overpayment through custom validation.
- **Transaction History**: Audit logs for all payments made out to suppliers.

### 6. Reporting & Exports
- **Data Tables**: Rich data views with searching, sorting, and pagination.
- **Excel Exporting**: Generate comprehensive `.xlsx` files detailing financial reports, doctor attendance, deductions, and net payouts.

### 7. Auth & Security
- **Role-Based Access Control (RBAC)**: Fine-grained permissions allowing administrators to manage what staff members can see and do.
- **Supabase Authentication**: Secure login mechanism leveraging Supabase GoTrue Auth.
- **Row Level Security (RLS)**: Enforced backend security ensures users only have access to authorized database segments.

---

## 🛠️ Technology Stack

**Frontend Architecture:**
- **Framework**: [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/) for rapid, modern development.
- **Language**: [TypeScript](https://www.typescriptlang.org/) ensuring strictly typed, bug-resistant code.
- **Routing**: [React Router](https://reactrouter.com/) for single-page application navigation.
- **Data Fetching/State**: [TanStack React Query](https://tanstack.com/query) for optimized server-state management and caching.

**Styling & UI:**
- **CSS Framework**: [Tailwind CSS](https://tailwindcss.com/) for utility-first styling.
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) paired with [Radix UI](https://www.radix-ui.com/) primitives for deeply accessible, customizable components.
- **Icons**: [Lucide React](https://lucide.dev/).
- **Animations**: `tailwindcss-animate` and basic Framer Motion concepts.

**Backend & Integration:**
- **BaaS**: [Supabase](https://supabase.com/).
- **Database**: PostgreSQL (managed by Supabase) equipped with custom RPC functions for complex business logic (e.g. `get_dashboard_stats`, `update_invoice_payment`).
- **File Storage**: Supabase Storage for managing possible attachments or profile avatars.

---

## 💻 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18 or higher recommended)
- `npm` or `yarn` installed.
- A dedicated [Supabase](https://supabase.com/) project set up with the specific database schema for Supply-Care.

### Installation Steps

1. **Clone the repository:**
   ```sh
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server:**
   ```sh
   npm run dev
   ```
   *The application will boot up at `http://localhost:8080/` (or the nearest available port).*

### Building for Production
To build the app for production deployment, run:
```sh
npm run build
```
This generates an optimized static build inside the `dist/` folder, which can be deployed to Vercel, Netlify, or any static hosting service.

---

## 📂 Project Structure Overview

- `src/components/`: Reusable, atomic UI elements (often populated by shadcn-ui).
- `src/pages/`: Main application views (`Dashboard`, `Inventory`, `Sales`, `Purchases`, `SupplierDebts`, `Reports`, `Settings`, etc).
- `src/hooks/`: Custom React hooks, including data fetching hooks wrapping TanStack Query.
- `src/lib/` or `src/utils/`: Utility functions (formatting dates, currency, Supabase client initialization).
- `src/contexts/`: React Contexts (e.g., Auth Provider).
- `public/`: Static assets bypassing the Vite bundler.

---

## 🤝 Editing the Code

### Working with the Database Schema
Any structural changes to data must be reflected in your Supabase SQL definitions. Ensure any changes to `users`, `inventory`, `invoices`, or related junction tables are adequately protected with Supabase's **Row Level Security (RLS)** to avoid `401 Unauthorized` errors during authenticated fetch requests.

### Extending Interfaces
When modifying complex forms (like `CreateInvoice.tsx` or `SupplierDebts.tsx`), adhere to using `react-hook-form` coupled with `zod` for robust schema validation.

---
*Maintained and developed for the absolute modernization of medical inventory management.*
