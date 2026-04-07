import { LookupTableManager } from '@/components/lookup-table-manager';
import { z } from 'zod';

const tallySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export default function TalliesPage() {
  return (
    <LookupTableManager
      title="Tallies"
      apiEndpoint="/api/stock/lookups/tallies"
      queryKey={['/api/stock/lookups/tallies']}
      schema={tallySchema}
      description="Manage tally settings for stock items with tally behaviour"
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Enter name' },
        { name: 'description', label: 'Description', placeholder: 'Enter description' },
        { name: 'notes', label: 'Notes', placeholder: 'Enter notes' },
      ]}
    />
  );
}
