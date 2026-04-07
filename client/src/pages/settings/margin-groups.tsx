import { LookupTableManager } from '@/components/lookup-table-manager';
import { z } from 'zod';

const marginGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export default function MarginGroupsPage() {
  return (
    <LookupTableManager
      title="Margin Groups"
      apiEndpoint="/api/stock/lookups/margin-groups"
      queryKey={['/api/stock/lookups/margin-groups']}
      schema={marginGroupSchema}
      description="Manage margin groups for stock pricing"
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Enter name' },
        { name: 'description', label: 'Description', placeholder: 'Enter description' },
      ]}
    />
  );
}
