import { LookupTableManager } from '@/components/lookup-table-manager';
import { z } from 'zod';

const colourSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  origin: z.string().optional(),
});

export default function ColoursPage() {
  return (
    <LookupTableManager
      title="Colours"
      apiEndpoint="/api/stock/lookups/colours"
      queryKey={['/api/stock/lookups/colours']}
      schema={colourSchema}
      description="Manage available colours for stock items"
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Enter colour name' },
        { name: 'description', label: 'Description', placeholder: 'Enter description' },
        { name: 'origin', label: 'Origin', placeholder: 'Enter origin' },
      ]}
    />
  );
}
