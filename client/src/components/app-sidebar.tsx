import { Boxes, Users, Clock, FileText, DollarSign, Package, Settings, Link2, Workflow, Tag, Ruler, Palette, Layers, TrendingUp, TrendingDown, List, Percent, Calculator } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";

const mainMenuItems = [
  {
    title: "Timber Catalog",
    url: "/timber",
    icon: Boxes,
  },
  {
    title: "Suppliers",
    url: "/suppliers",
    icon: Users,
  },
  {
    title: "History",
    url: "/history",
    icon: Clock,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: FileText,
  },
  {
    title: "Stock",
    url: "/stock",
    icon: Package,
  },
];

const systemPricingItems = [
  {
    title: "System Pricing",
    url: "/system-pricing",
    icon: DollarSign,
  },
];

const settingsItems = [
  {
    title: "Relations",
    url: "/settings/relations",
    icon: Link2,
  },
  {
    title: "Behaviours",
    url: "/settings/behaviours",
    icon: Workflow,
  },
  {
    title: "Types",
    url: "/settings/types",
    icon: Tag,
  },
  {
    title: "Units of Measure",
    url: "/settings/uoms",
    icon: Ruler,
  },
  {
    title: "Colours",
    url: "/settings/colours",
    icon: Palette,
  },
  {
    title: "Variants",
    url: "/settings/variants",
    icon: Layers,
  },
  {
    title: "Markup Groups",
    url: "/settings/markup-groups",
    icon: TrendingUp,
  },
  {
    title: "Discount Groups",
    url: "/settings/discount-groups",
    icon: TrendingDown,
  },
  {
    title: "Margin Groups",
    url: "/settings/margin-groups",
    icon: Percent,
  },
  {
    title: "Tallies",
    url: "/settings/tallies",
    icon: Calculator,
  },
  {
    title: "Properties",
    url: "/settings/properties",
    icon: List,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Timber Pricing</h2>
            <p className="text-xs text-muted-foreground">Rate Calculator</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(" ", "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Pricing Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemPricingItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(" ", "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
