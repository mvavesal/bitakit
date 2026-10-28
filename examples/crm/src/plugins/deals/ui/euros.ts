// Deal values are whole euros.
const format = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export const euros = (value: number) => format.format(value);
