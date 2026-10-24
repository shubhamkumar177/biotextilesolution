// Indicative B2B pricing shown on the site (GBP, excl. VAT, delivered UK).
// Assumes distributor buy prices from the supplier and ~12% landed cost
// (freight, duty, handling). Update these once distributor terms are agreed.
export const PRICING = {
  show: process.env.SHOW_PRICING !== 'false',
  currency: 'GBP',
  washLife: 50,
  standard: [
    { min: 0, max: 9999, label: 'Pilot & samples (up to 10k)', low: 0.38, high: 0.45 },
    { min: 10000, max: 49999, label: '10k – 50k', low: 0.3, high: 0.36 },
    { min: 50000, max: 99999, label: '50k – 100k', low: 0.24, high: 0.3 },
    { min: 100000, max: 249999, label: '100k – 250k', low: 0.2, high: 0.24 },
    { min: 250000, max: 499999, label: '250k – 500k', low: 0.17, high: 0.2 },
    { min: 500000, max: Infinity, label: '500k +', low: 0.14, high: 0.17 },
  ],
  bespoke: { upliftLow: 1.25, upliftHigh: 1.4, setupFrom: 2500 },
};
