# Timber & Stock Pricing Calculator

## Overview
A professional pricing calculator application designed to replace complex spreadsheet workflows. It enables businesses to track supplier rates for both timber specifications and all stock items, analyze historical pricing trends, and calculate optimal pricing with buffer percentages. The system provides clear visualization of pricing trends and comparisons across suppliers and time periods, aiming to enhance efficiency and data clarity in rate management for timber and general stock inventory.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Frameworks**: React 18 with TypeScript, Vite, Wouter for routing, TanStack Query for server state.
- **UI Component System**: Radix UI, shadcn/ui (New York variant), Tailwind CSS, class-variance-authority (CVA).
- **Design Philosophy**: System-based approach (inspired by Carbon Design System) focusing on data clarity, professional efficiency, and spreadsheet familiarity. Features Inter font, light/dark modes, and information-dense layouts.
- **Form Management**: React Hook Form, Zod for validation, @hookform/resolvers.
- **State Management**: Server state via TanStack Query, local UI state via React hooks, theme state in localStorage.

### Backend
- **Server Framework**: Express.js on Node.js with TypeScript for RESTful API.
- **API Structure**: RESTful endpoints for timber sizes, suppliers, stock items, system pricing, dashboard statistics, price trends, and data export.

### Data Storage
- **Database**: PostgreSQL (via Neon serverless).
- **ORM**: Drizzle ORM for type-safe queries and schema management.
- **Schema Design**: 
  - **Pricing System** (Dual Support): `supplier_rates` and `system_pricing_history` support both timber sizes and stock items via nullable `timberSizeId`/`stockId` columns with CHECK constraints ensuring exactly one is present
  - **Stock-Supplier Relationship**: Primary-supplier-plus-associated-suppliers model where each stock item has one `primarySupplierId` (mandatory) with optional additional suppliers via `stock_supplier_links` junction table. Cost updates validate authorization against BOTH primary and linked suppliers.
  - **Timber Sizes**: Now includes `stockCode` field linking timber sizes to stock inventory codes for integrated tracking
  - **Core Tables**: `timber_sizes`, `suppliers`, `stock`, `supplier_rates`, `system_pricing_history`, `stock_supplier_links`, `stock_cost_history`
  - **Constraints**: Unique indexes on supplier-item-period combinations; CHECK constraints enforcing data integrity
- **Migration Strategy**: Drizzle Kit for schema migrations with `db:push` for safe synchronization.

### Authentication & Authorization
- No authentication or authorization is currently implemented; operates as a single-tenant application.

### Key Features & Technical Implementations
- **Comprehensive Data Handling**: Bulk import/export of timber and stock data (CSV/Excel) with validation.
- **Supplier Management**: Detailed supplier views and period-based pricing for both timber and stock items. Supports multiple suppliers per stock item via `stock_supplier_links` junction table.
- **Price Trend Visualization**: Interactive charts for rate changes and multi-supplier comparison.
- **Price Change Notifications**: Real-time toast notifications for new rates based on percentage change.
- **Unified Pricing System**: Supplier rates and system pricing work seamlessly with both timber sizes and stock items:
  - **Market Statistics**: System calculates Market Low/Avg/High from latest supplier rates (respecting `includeInMarket` flag)
  - **Period-Based History**: `system_pricing_history` stores market stats for ALL periods (backdated or current)
  - **Current Rate Updates**: `timberSizes.systemRate` and `stock.supplierCost` only updated when rate is for latest period
  - **Type Guards**: `isTimberRate()` and `isStockRate()` discriminate between timber and stock pricing data
  - **Upsert Logic**: Checks for existing history records before insert to prevent duplicates
  - **TypeScript Safety**: Zero errors; all nullable fields guarded before access
- **Supplier List Enhancement**: Returns both timber AND stock pricing context; stock-only suppliers show latest stock price.
- **Dimensional Accuracy**: Correct display format for timber dimensions (width×thickness) and accurate rate per meter calculations.
- **Reports Page**: Features period selection, dynamic column adjustment, and comprehensive export functionality (Excel, CSV, PDF). Includes % Difference calculation with trending icons.
- **Stock Module**: Comprehensive schema and CRUD operations for stock items, relations, behaviours, types, UOMs, properties, colours, and variants. Supports complex Excel import for stock data with auto-creation of colours and variants. Import logic includes duplicate-safe handling with try/catch to gracefully handle existing colours/variants and update lookup maps for subsequent rows.
- **Supplier Filter UX**: Enhanced filter popover with "Apply" button for multi-selection.
- **Market Calculation Controls**: `includeInMarket` flag for suppliers to influence market calculations, with API support for filtering.
- **Technical Enhancements**: Predicate-based query cache invalidation, division-by-zero guards, `isFinite()` checks, robust error handling, type-safe query branching with `isNotNull()` filters, and a shared utility for consistent timber sorting based on Excel sequence.

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting.

### UI Component Libraries
- **Radix UI**: Accessible React components.
- **shadcn/ui**: Design system and component library.
- **Embla Carousel**: Carousel functionality.
- **cmdk**: Command palette component.
- **Lucide React**: Icon library.

### Styling & Utilities
- **Google Fonts**: Inter, DM Sans, Fira Code, Geist Mono, Architects Daughter.
- **clsx** & **tailwind-merge**: Utilities for conditional class names.
- **date-fns**: Date manipulation and formatting.

### Type Safety & Validation
- **drizzle-zod**: Generates Zod schemas from Drizzle ORM.
- **Zod**: Runtime schema validation.
- **@hookform/resolvers**: Zod integration with React Hook Form.

### Data Visualization & Export
- **Recharts**: React chart library.
- **xlsx**: Excel spreadsheet generation and CSV export.
- **pdfkit**: PDF document generation.