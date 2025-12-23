# Development and Architecture Rules (AI_RULES)

This document defines the technological stack and library usage rules to ensure project consistency, maintainability, and quality.

## 1. Technology Stack

The project is built using the following technologies:

*   **Framework:** React (with Vite for tooling).
*   **Language:** TypeScript (mandatory for all `.tsx` and `.ts` files).
*   **Styling:** Tailwind CSS (used for all design and responsiveness).
*   **UI Components:** shadcn/ui (based on Radix UI).
*   **Routing:** React Router DOM.
*   **State/Data Management:** TanStack React Query (for server state management).
*   **Backend/Database:** Supabase (for database interactions and Edge Functions).
*   **Notifications:** Sonner (for toasts/notifications).
*   **Icons:** Lucide React.

## 2. Library Usage Rules

To maintain consistency, follow these rules when implementing new features:

| Feature | Required Library/Component | Usage Rules |
| :--- | :--- | :--- |
| **User Interface (UI)** | shadcn/ui | Use components from `src/components/ui/` exclusively. Do not create complex UI components from scratch if a shadcn equivalent exists. |
| **Styling** | Tailwind CSS | Use Tailwind classes for all layout, colors, spacing, and responsiveness. Use the `cn` utility function (`@/lib/utils.ts`) for conditional class merging. |
| **Icons** | `lucide-react` | All icons must be imported and used from this package. |
| **Routing** | `react-router-dom` | Use `BrowserRouter`, `Routes`, and `Route`. Keep route definitions centralized in `src/App.tsx`. |
| **Data Fetching** | `@tanstack/react-query` | Use `useQuery` or `useMutation` for all asynchronous backend interactions, especially for managing loading and error states. |
| **Database Interaction** | `supabase` client | Use the Supabase client imported from `@/integrations/supabase/client.ts`. |
| **Notifications** | `sonner` | Use the `sonner` library (already configured in `src/App.tsx`) for displaying success, error, or informational messages to the user. |
| **File Structure** | Standard | Components in `src/components/`, Pages in `src/pages/`, Hooks in `src/hooks/`. Create a separate file for every new component or hook. |