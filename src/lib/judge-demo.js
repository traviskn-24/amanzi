const judgeDemoAccounts = new Map([
  ['amanzi.judge4@example.com', 'judge4'],
  ['amanzi.judge5@example.com', 'judge5'],
  ['amanzi.judge6@example.com', 'judge6'],
  ['amanzi.judge7@example.com', 'judge7'],
])

export function getJudgeDemoUsername(user) {
  return judgeDemoAccounts.get(user?.email?.trim().toLowerCase()) || ''
}

export function isJudgeDemoUser(user) {
  return Boolean(getJudgeDemoUsername(user))
}
