'use client'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'

function OverviewRedirectInner() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  useEffect(() => {
    const dest = `/overview/lol/${id}${token ? `?token=${token}` : ''}`
    router.replace(dest)
  }, [id, token])

  return null
}

export default function OverviewRedirect() {
  return (
    <Suspense>
      <OverviewRedirectInner />
    </Suspense>
  )
}
