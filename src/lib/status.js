export const AVAILABILITY = {
  available: { label: 'Available', tone: 'success' },
  filling: { label: 'Filling Fast', tone: 'warning' },
  full: { label: 'Full', tone: 'danger' },
}

export const BOOKING_STATUS = {
  upcoming: { label: 'Upcoming', tone: 'accent' },
  active: { label: 'Checked in', tone: 'success' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
}

export const VERIFICATION = {
  verified: { label: 'Verified host', tone: 'success' },
  pending: { label: 'Verification pending', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

export const ISSUE_STATUS = {
  open: { label: 'Open', tone: 'danger' },
  in_review: { label: 'In review', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
}

export const TONE_CLASS = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-accent-soft text-accent',
  neutral: 'bg-surface-sunken text-muted',
  muted: 'bg-surface-sunken text-muted/80',
}

export const TONE_DOT = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  accent: 'bg-accent',
  neutral: 'bg-muted',
  muted: 'bg-muted/60',
}

export const SEVERITY = {
  high: { label: 'High', tone: 'danger' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'neutral' },
}
