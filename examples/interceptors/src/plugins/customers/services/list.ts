import { defineService } from '@bitakit/core';

export type Customer = { id: number; name: string; status: 'active' | 'archived' };

// The customers, kept in memory for this visit. This plugin knows nothing about the audit
// and guard plugins; they watch and gate it from their own folders.
export default defineService(({ store }) => {
  const state = store<{ customers: Customer[] }>({
    customers: [
      { id: 1, name: 'Northwind Traders', status: 'active' },
      { id: 2, name: 'Contoso', status: 'active' },
      { id: 3, name: 'Fabrikam', status: 'archived' },
    ],
  });
  let next = 4;
  const change = (id: number, update: (customer: Customer) => Customer | undefined) =>
    state.set((current) => ({
      customers: current.customers.flatMap((customer) => {
        if (customer.id !== id) return [customer];
        const updated = update(customer);
        return updated ? [updated] : [];
      }),
    }));
  return {
    state,
    add(name: string) {
      const taken = state
        .get()
        .customers.some((customer) => customer.name.toLowerCase() === name.toLowerCase());
      if (taken) throw new Error(`${name} is already a customer.`);
      const customer: Customer = { id: next++, name, status: 'active' };
      state.set((current) => ({ customers: [...current.customers, customer] }));
      return customer;
    },
    archive: (id: number) => change(id, (customer) => ({ ...customer, status: 'archived' })),
    remove: (id: number) => change(id, () => undefined),
  };
});
