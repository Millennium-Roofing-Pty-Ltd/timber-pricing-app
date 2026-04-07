import { LookupTableManager } from '@/components/lookup-table-manager';
import { z } from 'zod';

const variantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export default function VariantsPage() {
  return (
    <LookupTableManager
      title="Variants"
      apiEndpoint="/api/stock/lookups/variants"
      queryKey={['/api/stock/lookups/variants']}
      schema={variantSchema}
      description="Manage stock item variants"
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Enter variant name' },
        { name: 'description', label: 'Description', placeholder: 'Enter description' },
      ]}
    />
  );
}
