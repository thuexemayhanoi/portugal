// Official NAP rules (owner's single source of truth = business block of site/data.json).
// Used by the build-time site audit and by the live audit of the deployed site.

export function businessProblems(lb, b) {
  const out = [];
  const same = (label, actual, expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) out.push(`${label} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  };
  const types = [].concat(lb['@type'] || []);
  if (!types.includes('LocalBusiness')) out.push('@type must include LocalBusiness');
  same('name', lb.name, b.canonicalName);
  if (!(lb.alternateName || []).includes(b.gbpName)) out.push('alternateName must include the Google Business Profile name');
  same('telephone', lb.telephone, b.phone.e164);
  same('address.streetAddress', lb.address?.streetAddress, b.address.streetAddress);
  same('address.addressCountry', lb.address?.addressCountry, b.address.countryCode);
  const joined = [lb.address?.streetAddress, lb.address?.addressLocality, lb.address?.addressRegion].join(', ');
  if (!b.address.full.startsWith(joined)) out.push(`address "${joined}" does not match the official address`);
  const spec = lb.openingHoursSpecification || [];
  const days = new Set(spec.flatMap((s) => [].concat(s.dayOfWeek)));
  if (days.size !== 7 || spec.some((s) => s.opens !== b.hours.opens || s.closes !== b.hours.closes)) {
    out.push(`openingHoursSpecification must be ${b.hours.opens}–${b.hours.closes} on 7 days`);
  }
  if (lb.hasMap !== b.maps || !b.maps.includes(`cid=${b.mapsCid}`)) out.push('hasMap must be the Google Maps CID URL');
  for (const u of lb.sameAs || []) if (!b.sameAs.includes(u)) out.push(`sameAs ${u} is not in the official list`);
  for (const k of ['email', 'geo', 'aggregateRating', 'review', 'faxNumber']) if (k in lb) out.push(`"${k}" is not published by the business`);
  if (lb.address && 'postalCode' in lb.address) out.push('postalCode is not published by the business');
  return out;
}
