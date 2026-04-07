import { LookupTableManager } from '@/components/lookup-table-manager';
import { z } from 'zod';

const uomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  factor: z.string().optional(),
  notes: z.string().optional(),
});

export default function UomsPage() {
  return (
    <LookupTableManager
      title="Units of Measure"
      apiEndpoint="/api/stock/lookups/uoms"
      queryKey={['/api/stock/lookups/uoms']}
      schema={uomSchema}
      description="Manage units of measurement for stock items"
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Enter name' },
        { name: 'description', label: 'Description', placeholder: 'Enter description' },
        { name: 'factor', label: 'Factor', placeholder: 'Enter conversion factor' },
        { name: 'notes', label: 'Notes', placeholder: 'Enter notes' },
      ]}
    />
  );
}
