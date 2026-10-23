export const defaultLocation = { area: 'Phoenix', municipality: 'eThekwini', province: 'KwaZulu-Natal' }
export const provinces = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape']
export const maxSavedAreas = 3
export const locationKey = (location) => `${(location.area || '').trim().toLocaleLowerCase()}|${(location.municipality || 'eThekwini').trim().toLocaleLowerCase()}|${location.province || 'KwaZulu-Natal'}`
export const locationMatches = (left, right) => locationKey(left) === locationKey(right)

export function readSavedLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem('amanzi-location'))
    if (typeof saved?.area === 'string' && saved.area.trim() && typeof saved?.municipality === 'string' && saved.municipality.trim() && provinces.includes(saved?.province)) return saved
  } catch { /* Use Phoenix when there is no saved area. */ }
  return defaultLocation
}
