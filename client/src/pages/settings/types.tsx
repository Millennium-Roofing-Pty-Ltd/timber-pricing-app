import { LookupTableManager } from '@/components/lookup-table-manager';
import { z } from 'zod';

const typeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export default function TypesPage() {
  return (
    <LookupTableManager
      title="Types"
      apiEndpoint="/api/stock/lookups/types"
      queryKey={['/api/stock/lookups/types']}
      schema={typeSchema}
      description="Manage stock item types"
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Enter name' },
        { name: 'description', label: 'Description', placeholder: 'Enter description' },
        { name: 'notes', label: 'Notes', placeholder: 'Enter notes' },
      ]}
    />
  );
}
