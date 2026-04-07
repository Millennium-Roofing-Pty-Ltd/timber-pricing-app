import { LookupTableManager } from '@/components/lookup-table-manager';
import { z } from 'zod';

const markupGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export default function MarkupGroupsPage() {
  return (
    <LookupTableManager
      title="Markup Groups"
      apiEndpoint="/api/stock/lookups/markup-groups"
      queryKey={['/api/stock/lookups/markup-groups']}
      schema={markupGroupSchema}
      description="Manage markup category groups for pricing"
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Enter group name' },
        { name: 'description', label: 'Description', placeholder: 'Enter description' },
      ]}
    />
  );
}
