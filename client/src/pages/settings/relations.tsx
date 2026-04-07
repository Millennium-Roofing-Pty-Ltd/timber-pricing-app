import { LookupTableManager } from '@/components/lookup-table-manager';
import { z } from 'zod';

const relationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export default function RelationsPage() {
  return (
    <LookupTableManager
      title="Relations"
      apiEndpoint="/api/stock/lookups/relations"
      queryKey={['/api/stock/lookups/relations']}
      schema={relationSchema}
      description="Manage stock relationships (parent, child, non-stock)"
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Enter name' },
        { name: 'description', label: 'Description', placeholder: 'Enter description' },
      ]}
    />
  );
}
