import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const projectUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!projectUrl || !serviceRoleKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the ignored .env.local file first.')
  process.exit(1)
}

const demoAccounts = [
  { email: 'amanzi.judge1@example.com', name: 'Demo Neighbour 1' },
  { email: 'amanzi.judge2@example.com', name: 'Demo Neighbour 2' },
  { email: 'amanzi.judge3@example.com', name: 'Demo Neighbour 3' },
]

const admin = createClient(projectUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listError) {
  console.error(`Could not check for existing demo accounts: ${listError.message}`)
  process.exit(1)
}

const existingEmails = new Set((existing.users || []).map((user) => user.email?.toLowerCase()))
const collisions = demoAccounts.filter(({ email }) => existingEmails.has(email.toLowerCase()))
if (collisions.length) {
  console.error(`Stopped without creating accounts because these addresses already exist: ${collisions.map(({ email }) => email).join(', ')}`)
  console.error('Do not reset or overwrite existing credentials automatically. Inspect them in Supabase Auth first.')
  process.exit(1)
}

const created = []
for (const account of demoAccounts) {
  const password = randomBytes(24).toString('base64url')
  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: account.name, demo_account: true },
  })

  if (error) {
    console.error(`Could not create ${account.email}: ${error.message}`)
    if (created.length) {
      console.error('Save the credentials already created before deciding whether to retry:')
      for (const item of created) console.error(`${item.email}  ${item.password}`)
    }
    process.exit(1)
  }
  created.push({ email: data.user.email, password })
}

console.log('Demo accounts created. Save these passwords securely; they are shown only once.')
console.log('Each account must enroll TOTP on first sign-in before it can post or chat.')
for (const account of created) console.log(`${account.email}  ${account.password}`)
