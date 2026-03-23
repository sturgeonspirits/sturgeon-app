import { redirect } from 'next/navigation'

// Staff login is now unified — everyone signs in at /auth/login
// Role is detected automatically and staff are redirected to /staff
export default function StaffLoginPage() {
  redirect('/auth/login')
}
