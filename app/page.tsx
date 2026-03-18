import { redirect } from 'next/navigation'

// Root: redirect to Club tab (the loyalty home)
export default function RootPage() {
  redirect('/club')
}
