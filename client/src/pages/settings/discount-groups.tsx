import { LookupTableManager } from '@/components/lookup-table-manager';
import { z } from 'zod';

const discountGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export default function DiscountGroupsPage() {
  return (
    <LookupTableManager
      title="Discount Groups"
      apiEndpoint="/api/stock/lookups/discount-groups"
      queryKey={['/api/stock/lookups/discount-groups']}
      schema={discountGroupSchema}
      description="Manage discount category groups for pricing"
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Enter group name' },
        { name: 'description', label: 'Description', placeholder: 'Enter description' },
      ]}
    />
  );
}
