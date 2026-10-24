const blockedTerms = new Set([
  'asshole', 'bastard', 'bitch', 'bollocks', 'cock', 'cocksucker', 'cunt',
  'dick', 'dickhead', 'fag', 'faggot', 'fuck', 'fucker', 'fucking',
  'motherfucker', 'nigger', 'nigga', 'piss', 'prick', 'pussy', 'shit',
  'shitty', 'slut', 'twat', 'wanker', 'whore',
].map(normalizeToken))

function normalizeToken(token) {
  return token
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[013457@$!]/g, (character) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' })[character])
    .replace(/[^a-z0-9]/g, '')
    .replace(/(.)\1+/g, '$1')
}

export function containsBlockedLanguage(value) {
  return String(value ?? '').split(/\s+/).some((token) => {
    const normalized = normalizeToken(token)
    return blockedTerms.has(normalized)
  })
}

export const USERNAME_LANGUAGE_ERROR = 'That username contains language Amanzi does not allow. Choose a different username.'
export const PASSWORD_LANGUAGE_ERROR = 'That password contains language Amanzi does not allow. Choose a different password.'
export const MESSAGE_LANGUAGE_ERROR = 'Your message contains language Amanzi does not allow. Please edit it and try again.'
