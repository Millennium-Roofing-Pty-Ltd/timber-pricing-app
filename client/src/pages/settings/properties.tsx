import { LookupTableManager } from '@/components/lookup-table-manager';
import { z } from 'zod';

const propertySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  uom: z.string().optional(),
});

export default function PropertiesPage() {
  return (
    <LookupTableManager
      title="Properties"
      apiEndpoint="/api/stock/lookups/property-definitions"
      queryKey={['/api/stock/lookups/property-definitions']}
      schema={propertySchema}
      description="Manage property definitions for stock specifications"
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Enter property name' },
        { name: 'description', label: 'Description', placeholder: 'Enter description' },
        { name: 'uom', label: 'Unit of Measure', placeholder: 'Enter UOM' },
      ]}
    />
  );
}
