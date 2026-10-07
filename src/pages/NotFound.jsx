import { useNavigate } from 'react-router-dom'
import { PageShell } from '@/components/layout/PageShell'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <PageShell>
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon name="pin" size={24} />
        </span>
        <h1 className="mt-4 text-[22px] font-bold">This lane is unmarked</h1>
        <p className="mt-2 max-w-xs text-[14px] text-muted">
          The page you were looking for does not exist. Try the map instead.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go back
          </Button>
          <Button onClick={() => navigate('/search')}>Find parking</Button>
        </div>
      </div>
    </PageShell>
  )
}
