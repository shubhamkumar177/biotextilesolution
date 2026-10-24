// Trading disclosures (Companies Act 2006 / Trading Disclosures Regulations 2015).
// Not secrets — set in .env once the company is registered.
export const COMPANY = {
  name: process.env.COMPANY_NAME || 'Bio Textile Solution UK',
  number: process.env.COMPANY_NUMBER || '',
  registeredOffice: process.env.REGISTERED_OFFICE || '',
  vatNumber: process.env.VAT_NUMBER || '',
  email: process.env.CONTACT_EMAIL || '',
};
