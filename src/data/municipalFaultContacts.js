let directoryPromise

function loadDirectory() {
  directoryPromise ||= import('./municipalFaultDirectory.json').then((module) => module.default)
  return directoryPromise
}

function normalizeName(value) {
  return (value || '').trim().toLocaleLowerCase()
    .replace(/\b(metropolitan|district|local)\s+municipality\b/g, '')
    .replace(/\b(metropolitan|district|local|municipality)\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
}

function hasWaterContact(record) {
  return Boolean(record?.water?.emails?.length || record?.water?.phones?.length || record?.water?.whatsapps?.length)
}

function toContact(record, checkedOn, routedFrom = null) {
  const waterEmail = record.water.emails[0] || ''
  const eThekwiniWaterEmail = record.id === '5' ? 'eservices@durban.gov.za' : ''
  const sourceOverride = eThekwiniWaterEmail ? 'https://emergency.durban.gov.za/press-statement/city-urges-residents-to-reduce-water-consumption-as-demand-soars' : ''
  return {
    name: record.name,
    email: eThekwiniWaterEmail || waterEmail || record.generalEmails[0] || '',
    emailScope: eThekwiniWaterEmail ? 'Official water services contact' : waterEmail ? 'Email listed under water queries' : record.generalEmails[0] ? 'General municipal contact' : '',
    emailForFault: record.id === '3' ? (faultType) => faultType === 'Water leak' || faultType === 'Burst pipe' ? 'waterleaks@tshwane.gov.za' : waterEmail || record.generalEmails[0] || '' : null,
    whatsapp: record.water.whatsapps[0] || record.generalWhatsapps[0] || '',
    phone: record.water.phones[0] || '',
    source: record.sourceUrl,
    emailSource: sourceOverride,
    directorySource: record.sourceUrl,
    checkedOn,
    routedFrom,
  }
}

function findRecord(directory, location) {
  const municipality = typeof location === 'string' ? location : location?.municipality
  const province = typeof location === 'string' ? '' : normalizeName(location?.province)
  const target = normalizeName(municipality)
  if (!target) return null
  const candidates = directory.records.filter((record) => {
    const name = normalizeName(record.name)
    return name === target || name.endsWith(` ${target}`) || target.endsWith(` ${name}`)
  })
  if (!candidates.length) return null
  return candidates.find((record) => province && normalizeName(record.province) === province) || candidates[0]
}

export async function findMunicipalFaultContact(location) {
  const directory = await loadDirectory()
  const recordsById = new Map(directory.records.map((record) => [record.id, record]))
  const localRecord = findRecord(directory, location)
  if (!localRecord) return null

  if (localRecord.category === 'local' && !hasWaterContact(localRecord) && localRecord.parentDistrictId) {
    const district = recordsById.get(localRecord.parentDistrictId)
    if (hasWaterContact(district)) return toContact(district, directory.checkedOn, localRecord.name)
  }
  return toContact(localRecord, directory.checkedOn)
}
