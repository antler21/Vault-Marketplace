import { redirect } from 'next/navigation'

export default function PreviewRedirect({ params }) {
  redirect(`/preview/lol/${params.id}`)
}
