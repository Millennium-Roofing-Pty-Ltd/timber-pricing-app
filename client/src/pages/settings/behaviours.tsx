import { LookupTableManager } from '@/components/lookup-table-manager';
import { z } from 'zod';

const behaviourSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export default function BehavioursPage() {
  return (
    <LookupTableManager
      title="Behaviours"
      apiEndpoint="/api/stock/lookups/behaviours"
      queryKey={['/api/stock/lookups/behaviours']}
      schema={behaviourSchema}
      description="Manage stock behavior types"
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Enter name' },
        { name: 'description', label: 'Description', placeholder: 'Enter description' },
        { name: 'notes', label: 'Notes', placeholder: 'Enter notes' },
      ]}
    />
  );
}
