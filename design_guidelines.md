# Timber Pricing Calculator - Design Guidelines

## Design Approach
**System-Based Approach**: Carbon Design System principles adapted for data-intensive business applications, with modern web aesthetics. This tool replaces complex spreadsheet workflows, requiring exceptional clarity, efficiency, and data density management.

## Core Design Principles
1. **Data Clarity First**: Every element serves data comprehension and comparison
2. **Professional Efficiency**: Minimize clicks, maximize information density
3. **Spreadsheet Familiarity**: Leverage familiar patterns while improving UX
4. **Historical Context**: Clear temporal data visualization

---

## Color Palette

### Light Mode (Primary)
- **Background**: 0 0% 98% (off-white workspace)
- **Surface**: 0 0% 100% (cards, tables)
- **Border**: 220 13% 91% (subtle divisions)
- **Text Primary**: 220 20% 15%
- **Text Secondary**: 220 9% 46%

### Dark Mode
- **Background**: 220 26% 14%
- **Surface**: 220 20% 18%
- **Border**: 220 15% 25%
- **Text Primary**: 210 40% 98%
- **Text Secondary**: 217 19% 60%

### Functional Colors
- **Primary**: 210 100% 45% (data actions, CTAs)
- **Success**: 142 76% 36% (positive trends, lowest price)
- **Warning**: 38 92% 50% (price increases, average)
- **Danger**: 0 84% 60% (highest price alerts)
- **Info**: 199 89% 48% (system rate, calculations)

---

## Typography
- **Font Family**: Inter (via Google Fonts CDN) for exceptional readability in data contexts
- **Headings**: 
  - H1: text-2xl font-semibold (Dashboard titles)
  - H2: text-xl font-semibold (Section headers)
  - H3: text-lg font-medium (Card titles)
- **Body**: text-sm (Primary data text)
- **Data/Numbers**: text-sm font-mono (Pricing, calculations)
- **Labels**: text-xs font-medium uppercase tracking-wide (Form labels, table headers)

---

## Layout System
**Spacing Primitives**: Consistent use of Tailwind units 2, 4, 6, 8, 12, 16
- Micro spacing (between related elements): p-2, gap-2
- Standard spacing (component padding): p-4, p-6
- Section spacing: p-8, py-12
- Container padding: px-4 md:px-8

**Grid Structure**:
- Main container: max-w-7xl mx-auto
- Dashboard: 12-column grid system for flexible layouts
- Data tables: Full-width with horizontal scroll on mobile

---

## Component Library

### Navigation
- **Top Navigation Bar**: Fixed header with app title, quick actions, user profile
- **Sidebar Navigation** (Desktop): Collapsible left sidebar with main sections (Dashboard, Timber Catalog, Suppliers, History)
- **Mobile Navigation**: Bottom tab bar with primary sections

### Data Display Components

**Pricing Dashboard Cards**:
- Glass-morphism cards with subtle backdrop blur
- Clear metric labels with large numerical displays
- Color-coded indicators (green=lowest, yellow=average, red=highest)
- Trend arrows showing percentage changes

**Supplier Comparison Table**:
- Sticky header row with supplier names
- Fixed first column with timber specifications
- Zebra striping for row clarity (subtle alternating backgrounds)
- Cell highlighting on hover
- Color-coded cells based on price positioning
- Inline editing capabilities

**Historical Timeline**:
- Horizontal timeline showing rate update months/years
- Collapsible year sections
- Line charts for price trend visualization
- Percentage change badges at each update point

### Forms & Input

**Timber Size Entry**:
- Multi-field form with clear labels
- Inline validation feedback
- Auto-calculation display for m3 factor
- Dropdown selects for Classification and Grade

**Supplier Rate Input**:
- Quick-add modal with supplier name and rate
- Date picker for update month/year
- Previous rate display for context
- Auto-calculated percentage increase

**System Rate Calculator**:
- Slider input for buffer percentage over average
- Real-time calculation preview
- Visual indicator showing position relative to min/max

### Data Visualization
- **Trend Charts**: Line charts using Chart.js showing historical price movements
- **Comparison Bars**: Horizontal bar charts comparing supplier rates
- **KPI Indicators**: Large numerical displays with trend arrows and percentage changes

---

## Page Layouts

### Dashboard (Home)
- **Header Section**: Current system rate + buffer settings
- **KPI Cards Row**: 4 cards showing Lowest Price, Average Price, Highest Price, % Increase Range
- **Recent Updates**: Timeline of latest supplier rate changes
- **Quick Actions**: Add Timber Size, Add Supplier, Update Rates

### Timber Catalog
- **Filterable Table**: All timber sizes with specifications
- **Add New Button**: Prominent FAB (Floating Action Button)
- **Actions Column**: Edit, Delete, View Supplier Prices

### Supplier Management
- **Supplier Cards Grid**: 3-column grid (2-col tablet, 1-col mobile)
- **Card Content**: Supplier name, current rate, last update date, historical trend sparkline
- **Bulk Update Action**: Update all suppliers simultaneously with date picker

### History View
- **Timeline Visualization**: Year-by-year accordion with month breakdowns
- **Comparative Charts**: Line graphs showing all suppliers over time
- **Export Options**: CSV/PDF export for historical data

---

## Interaction Patterns
- **Hover States**: Subtle background color shifts (opacity-based)
- **Active States**: Slight scale transforms (scale-98)
- **Loading States**: Skeleton screens for data-heavy components
- **Success Feedback**: Toast notifications for CRUD operations
- **Error Handling**: Inline validation with clear error messages

---

## Responsive Strategy
- **Desktop (1024px+)**: Sidebar navigation, multi-column layouts, full data tables
- **Tablet (768-1023px)**: Collapsible sidebar, 2-column grids, horizontal scroll tables
- **Mobile (<768px)**: Bottom navigation, single column, card-based data display, swipeable supplier comparison

---

## Icons
Use **Heroicons** (outline style) via CDN for:
- Navigation icons (chart-bar, table-cells, user-group, clock)
- Action icons (plus, pencil, trash, arrow-path)
- Status indicators (arrow-trending-up, arrow-trending-down)
- Data icons (calculator, currency-dollar)

---

## Accessibility
- WCAG AA contrast ratios maintained across all color combinations
- Keyboard navigation for all interactive elements (focus-visible rings)
- ARIA labels for icon-only buttons
- Screen reader announcements for data updates
- Consistent dark mode implementation including all form inputs and data cells