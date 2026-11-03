import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  balance,
  checkHealth,
  decide,
  myLeaves,
  pendingLeaves,
  submitLeave,
  type Leave,
  type LeaveType,
} from './api'

export type Tab = 'dashboard' | 'apply' | 'mine' | 'balance' | 'manager'
type Health = 'checking' | 'online' | 'offline'

const icons: Record<string, string[]> = {
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z', 'M14 2v6h6', 'M8 13h8', 'M8 17h8'],
  inbox: ['M4 4h16v16H4z', 'M4 13h4l2 3h4l2-3h4'],
  plus: ['M12 5v14', 'M5 12h14'],
  arrow: ['M7 17 17 7', 'M7 7h10v10'],
  clock: ['M12 8v4l3 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  check: ['m5 12 4 4L19 6'],
  close: ['m18 6-12 12', 'm6 6 12 12'],
  wallet: ['M3 7V5a2 2 0 0 1 2-2h14', 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z', 'M21 12h-5a2 2 0 0 0 0 4h5', 'M16 14h.01'],
  search: ['m21 21-4.3-4.3', 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z'],
  user: ['M20 21a8 8 0 0 0-16 0', 'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  chevron: ['m6 9 6 6 6-6'],
  refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M5.6 9a7 7 0 0 1 11.6-2L20 12', 'M4 12l2.8 5a7 7 0 0 0 11.6-2'],
  shield: ['M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z', 'm9 12 2 2 4-4'],
  leaf: ['M20 4c-8 0-14 4-14 11a5 5 0 0 0 5 5c7 0 11-6 9-16Z', 'M4 20c2-5 6-8 11-10'],
  spark: ['m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z', 'm19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  dashboard: ['M3 3h7v9H3zm11 0h7v5h-7zm0 9h7v9h-7zM3 16h7v5H3z'],
  info: ['M12 16v-4', 'M12 8h.01', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  alert: ['M12 9v4', 'M12 17h.01', 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z']
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(icons[name] ?? icons.file).map((path, index) => <path key={`${name}-${index}`} d={path} />)}
    </svg>
  )
}

function formatDate(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T00:00:00`))
}

function formatDateTime(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function statusLabel(status: Leave['status']) {
  return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U'
}

function countWorkingDays(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate || endDate < startDate) return 0
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  let count = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) {
      count += 1
    }
  }
  return count
}

interface DecisionPrompt {
  id: number
  approved: boolean
  employeeName: string
  leaveType: string
  days: number
  startDate: string
  endDate: string
  comment: string
}

function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [name, setName] = useState(() => localStorage.getItem('leaveflow.name') ?? 'Alex Morgan')
  const [email, setEmail] = useState(() => localStorage.getItem('leaveflow.email') ?? 'alex@example.com')
  const [health, setHealth] = useState<Health>('checking')
  const [rows, setRows] = useState<Leave[]>([])
  const [queue, setQueue] = useState<Leave[]>([])
  const [remaining, setRemaining] = useState<number | null>(null)
  const [pageError, setPageError] = useState('')
  const [queueError, setQueueError] = useState('')
  const [toast, setToast] = useState('')
  const [busyDecision, setBusyDecision] = useState<number | null>(null)
  const [comments, setComments] = useState<Record<number, string>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'>('ALL')
  const [refreshing, setRefreshing] = useState(false)

  // Modals
  const [selectedRequest, setSelectedRequest] = useState<Leave | null>(null)
  const [decisionPrompt, setDecisionPrompt] = useState<DecisionPrompt | null>(null)

  useEffect(() => {
    localStorage.setItem('leaveflow.name', name)
  }, [name])

  useEffect(() => {
    localStorage.setItem('leaveflow.email', email)
  }, [email])

  const refreshMine = useCallback(async () => {
    if (!email.trim()) {
      setRows([])
      setRemaining(null)
      setPageError('')
      return
    }
    try {
      const [requests, leaveBalance] = await Promise.all([myLeaves(email), balance(email)])
      setRows(requests)
      setRemaining(leaveBalance.remainingDays)
      setPageError('')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not load your leave data.')
    }
  }, [email])

  const refreshQueue = useCallback(async () => {
    try {
      setQueue(await pendingLeaves())
      setQueueError('')
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : 'Could not load the manager inbox.')
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const ping = async () => {
      try {
        await checkHealth()
        if (mounted) setHealth('online')
      } catch {
        if (mounted) setHealth('offline')
      }
    }
    void ping()
    const timer = window.setInterval(ping, 10000)
    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    void refreshMine()
    const timer = window.setInterval(() => void refreshMine(), 5000)
    return () => window.clearInterval(timer)
  }, [refreshMine])

  useEffect(() => {
    if (tab !== 'manager') return
    void refreshQueue()
    const timer = window.setInterval(() => void refreshQueue(), 5000)
    return () => window.clearInterval(timer)
  }, [tab, refreshQueue])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3500)
  }

  const metrics = useMemo(() => ({
    total: rows.length,
    waiting: rows.filter((row) => row.status === 'PENDING_APPROVAL').length,
    approved: rows.filter((row) => row.status === 'APPROVED').length,
    rejected: rows.filter((row) => row.status === 'REJECTED').length,
  }), [rows])

  const filteredRows = useMemo(() => {
    let result = rows
    if (statusFilter !== 'ALL') {
      result = result.filter((row) => row.status === statusFilter)
    }
    const term = search.trim().toLowerCase()
    if (!term) return result
    return result.filter((row) => [row.leaveType, row.status, row.statusMessage, row.reason, row.startDate, row.endDate]
      .some((value) => (value ?? '').toLowerCase().includes(term)))
  }, [rows, statusFilter, search])

  async function handleSubmit(event: FormEvent<HTMLFormElement>, form: {
    leaveType: LeaveType; startDate: string; endDate: string; reason: string
  }) {
    event.preventDefault()
    if (!name.trim() || !email.trim()) {
      notify('Add your name and work email in the profile bar first.')
      return
    }
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) {
      notify('Choose a valid leave date range.')
      return
    }
    setRefreshing(true)
    try {
      const created = await submitLeave({
        employeeName: name.trim(),
        employeeEmail: email.trim(),
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
      })
      await refreshMine()
      setTab('mine')
      setSelectedRequest(created)
      notify('Your leave request has been submitted successfully.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not submit the request.')
    } finally {
      setRefreshing(false)
    }
  }

  function promptDecision(request: Leave, approved: boolean) {
    setDecisionPrompt({
      id: request.id,
      approved,
      employeeName: request.employeeName,
      leaveType: request.leaveType,
      days: request.days,
      startDate: request.startDate,
      endDate: request.endDate,
      comment: comments[request.id] ?? ''
    })
  }

  async function confirmDecision() {
    if (!decisionPrompt) return
    const { id, approved, comment } = decisionPrompt
    setBusyDecision(id)
    setQueueError('')
    try {
      await decide(id, approved, comment)
      setDecisionPrompt(null)
      await Promise.all([refreshQueue(), refreshMine()])
      notify(approved ? 'Request approved successfully.' : 'Request rejected successfully.')
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : 'The decision could not be submitted.')
    } finally {
      setBusyDecision(null)
    }
  }

  const pageTitleMap: Record<Tab, string> = {
    dashboard: 'EMPLOYEE DASHBOARD',
    apply: 'APPLY FOR LEAVE',
    mine: 'MY LEAVE REQUESTS',
    balance: 'LEAVE BALANCE',
    manager: 'MANAGER INBOX',
  }
  const pageTitle = pageTitleMap[tab]
  const healthCopy = health === 'online' ? 'Backend connected' : health === 'offline' ? 'Backend unavailable' : 'Checking connection'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Icon name="calendar" size={22} /></div>
          <div><strong>leaveflow</strong><span>PEOPLE OPERATIONS</span></div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className={tab === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('dashboard')}>
            <Icon name="dashboard" /><span>Dashboard</span>
          </button>
          <button className={tab === 'apply' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('apply')}>
            <Icon name="plus" /><span>Apply for leave</span>
          </button>
          <button className={tab === 'mine' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('mine')}>
            <Icon name="file" /><span>My requests</span>{metrics.waiting > 0 && <span className="nav-count">{metrics.waiting}</span>}
          </button>
          <button className={tab === 'balance' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('balance')}>
            <Icon name="wallet" /><span>Leave balance</span>
          </button>
          <button className={tab === 'manager' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('manager')}>
            <Icon name="inbox" /><span>Manager inbox</span>{queue.length > 0 && <span className="nav-count">{queue.length}</span>}
          </button>
        </nav>

        <div className="sidebar-spacer" />
        <div className="help-card">
          <div className="help-icon"><Icon name="shield" size={18} /></div>
          <strong>LeaveFlow Engine</strong>
          <p>Automated business workflow powered by Camunda 8 BPMN & Spring Boot.</p>
        </div>
        <div className="sidebar-footer">
          <div className="avatar">{initials(name)}</div>
          <div className="profile-mini"><strong>{name.trim() || 'Your profile'}</strong><span>{email.trim() || 'Add your work email'}</span></div>
          <Icon name="chevron" size={16} />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>LEAVE MANAGEMENT</span><b>/</b><strong>{pageTitle}</strong></div>
          <div className="topbar-right">
            <div className={`connection-state ${health}`}><span className="state-dot" />{healthCopy}</div>
            <div className="profile-fields">
              <label className="sr-only" htmlFor="employee-name">Your name</label>
              <input id="employee-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" maxLength={120} title="Employee Display Name" />
              <label className="sr-only" htmlFor="employee-email">Work email</label>
              <input id="employee-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Work email" maxLength={180} title="Employee Email" />
            </div>
            <div className="avatar avatar-top">{initials(name)}</div>
          </div>
        </header>

        <div className="page-content">
          {(!name.trim() || !email.trim()) && (
            <section className="mobile-profile-setup" aria-label="Employee profile">
              <div><strong>Set up your profile</strong><p>Enter your name and work email before submitting a leave request.</p></div>
              <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" maxLength={120} /></label>
              <label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" maxLength={180} /></label>
            </section>
          )}
          {pageError && <div className="alert alert-error" role="alert">{pageError}</div>}
          {health === 'offline' && <div className="alert alert-warning" role="status">The interface is loaded, but the API is not reachable. Start Camunda and the Spring Boot backend to use live requests.</div>}

          {/* SCREEN 1: EMPLOYEE DASHBOARD */}
          {tab === 'dashboard' && (
            <div className="screen-container">
              <section className="page-heading heading-with-action">
                <div>
                  <div className="eyebrow">OVERVIEW</div>
                  <h1>Welcome back{name.trim() ? `, ${name.trim().split(' ')[0]}` : ''}.</h1>
                  <p>Here is a summary of your leave status and quick actions.</p>
                </div>
                <div className="action-buttons-group">
                  <div className="date-chip"><Icon name="calendar" size={17} /> {new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}</div>
                  <button className="button button-primary" onClick={() => setTab('apply')}><Icon name="plus" size={17} /> New Request</button>
                </div>
              </section>

              <section className="metric-grid" aria-label="Leave summary">
                <MetricCard icon="wallet" label="Annual leave balance" value={remaining === null ? '—' : `${remaining} days`} note="Available to use" tone="green" />
                <MetricCard icon="file" label="Total requests" value={String(metrics.total)} note="All-time history" tone="blue" />
                <MetricCard icon="clock" label="Awaiting approval" value={String(metrics.waiting)} note="Pending manager review" tone="amber" />
              </section>

              <div className="content-grid">
                <section className="panel dashboard-card">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">RECENT ACTIVITY</div>
                      <h2>Recent Leave Requests</h2>
                      <p>Latest submissions and their current workflow status.</p>
                    </div>
                    <button className="button button-secondary button-small" onClick={() => setTab('mine')}>View all ({rows.length})</button>
                  </div>
                  {rows.length === 0 ? (
                    <div className="empty-state-mini">
                      <Icon name="file" size={28} />
                      <p>You have not submitted any leave requests yet.</p>
                      <button className="button button-primary button-small" onClick={() => setTab('apply')}>Create your first request</button>
                    </div>
                  ) : (
                    <div className="recent-list">
                      {rows.slice(0, 4).map((row) => (
                        <div key={row.id} className="recent-item" onClick={() => setSelectedRequest(row)}>
                          <div className="recent-info">
                            <span className="request-type-icon"><Icon name={row.leaveType === 'ANNUAL' ? 'leaf' : row.leaveType === 'SICK' ? 'shield' : 'calendar'} size={16} /></span>
                            <div>
                              <strong>{row.leaveType} Leave</strong>
                              <small>{formatDate(row.startDate)} – {formatDate(row.endDate)} ({row.days} working {row.days === 1 ? 'day' : 'days'})</small>
                            </div>
                          </div>
                          <div className="recent-right">
                            <StatusPill status={row.status} />
                            <span className="view-details-link">Details ›</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <aside className="right-column">
                  <section className="balance-card">
                    <div className="balance-card-top"><span>ANNUAL LEAVE QUOTA</span><Icon name="leaf" size={19} /></div>
                    <div className="balance-number">{remaining === null ? '—' : remaining}<span> days left</span></div>
                    <div className="balance-track"><span style={{ width: `${remaining === null ? 0 : Math.max(0, Math.min(100, (remaining / 20) * 100))}%` }} /></div>
                    <p>Standard policy entitlement of 20 days per calendar year. Deducted only upon manager approval.</p>
                  </section>

                  <section className="panel steps-panel">
                    <div className="panel-heading compact"><div><div className="eyebrow">CAMUNDA BPMN WORKFLOW</div><h2>Approval Pipeline</h2></div><span className="steps-count">4 STAGES</span></div>
                    <div className="journey-list">
                      <JourneyStep number="01" title="Submit Request" detail="Recorded into database and triggers Camunda process." state="done" />
                      <JourneyStep number="02" title="Business Validation" detail="validate-leave worker verifies working days and balance." state="done" />
                      <JourneyStep number="03" title="Manager Review" detail="Manager approves or rejects with comment." state="current" />
                      <JourneyStep number="04" title="Finalization" detail="finalize-leave worker deducts balance and closes case." />
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          )}

          {/* SCREEN 2: APPLY FOR LEAVE */}
          {tab === 'apply' && (
            <div className="screen-container">
              <section className="page-heading heading-with-action">
                <div>
                  <div className="eyebrow">TIME OFF REQUEST</div>
                  <h1>Apply for Leave</h1>
                  <p>Submit your leave application for automated validation and manager approval.</p>
                </div>
                <div className="date-chip"><Icon name="calendar" size={17} /> {new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}</div>
              </section>

              <div className="content-grid">
                <section className="panel form-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">NEW APPLICATION</div>
                      <h2>Request Details</h2>
                      <p>Fill out the date range and reason for your absence.</p>
                    </div>
                    <div className="panel-icon"><Icon name="calendar" size={21} /></div>
                  </div>
                  <LeaveForm onSubmit={handleSubmit} busy={refreshing} remainingBalance={remaining} />
                </section>

                <aside className="right-column">
                  <section className="balance-card">
                    <div className="balance-card-top"><span>ANNUAL LEAVE</span><Icon name="leaf" size={19} /></div>
                    <div className="balance-number">{remaining === null ? '—' : remaining}<span> days left</span></div>
                    <div className="balance-track"><span style={{ width: `${remaining === null ? 0 : Math.max(0, Math.min(100, (remaining / 20) * 100))}%` }} /></div>
                    <p>Requests for annual leave will be validated against this remaining balance.</p>
                  </section>

                  <section className="panel steps-panel">
                    <div className="panel-heading compact"><div><div className="eyebrow">IMPORTANT RULES</div><h2>Leave Guidelines</h2></div></div>
                    <ul className="guidelines-list">
                      <li><strong>Working days only:</strong> Weekends (Saturday & Sunday) are automatically excluded.</li>
                      <li><strong>Zero days rejected:</strong> Weekend-only date ranges contain 0 working days and will be rejected.</li>
                      <li><strong>Balance deduction:</strong> Days are deducted ONLY after manager approval.</li>
                    </ul>
                  </section>
                </aside>
              </div>
            </div>
          )}

          {/* SCREEN 3: MY LEAVE REQUESTS */}
          {tab === 'mine' && (
            <div className="screen-container">
              <section className="page-heading heading-with-action">
                <div>
                  <div className="eyebrow">YOUR SUBMISSIONS</div>
                  <h1>My Leave Requests</h1>
                  <p>Track your leave applications, approval history, and Camunda workflow status.</p>
                </div>
                <div className="action-buttons-group">
                  <button className="button button-secondary" onClick={() => void refreshMine()}><Icon name="refresh" size={17} /> Refresh</button>
                  <button className="button button-primary" onClick={() => setTab('apply')}><Icon name="plus" size={17} /> New Request</button>
                </div>
              </section>

              <section className="metric-grid metric-grid-small">
                <MetricCard icon="file" label="Total requests" value={String(metrics.total)} note="All submissions" tone="blue" />
                <MetricCard icon="check" label="Approved" value={String(metrics.approved)} note="Successfully granted" tone="green" />
                <MetricCard icon="clock" label="In review" value={String(metrics.waiting)} note="Pending approval" tone="amber" />
              </section>

              <section className="panel requests-panel">
                <div className="table-toolbar">
                  <div className="filter-chips">
                    <button className={statusFilter === 'ALL' ? 'chip active' : 'chip'} onClick={() => setStatusFilter('ALL')}>All ({rows.length})</button>
                    <button className={statusFilter === 'PENDING_APPROVAL' ? 'chip active' : 'chip'} onClick={() => setStatusFilter('PENDING_APPROVAL')}>Pending ({metrics.waiting})</button>
                    <button className={statusFilter === 'APPROVED' ? 'chip active' : 'chip'} onClick={() => setStatusFilter('APPROVED')}>Approved ({metrics.approved})</button>
                    <button className={statusFilter === 'REJECTED' ? 'chip active' : 'chip'} onClick={() => setStatusFilter('REJECTED')}>Rejected ({metrics.rejected})</button>
                  </div>
                  <div className="table-actions">
                    <div className="search-box">
                      <Icon name="search" size={17} />
                      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by reason, type, date..." />
                    </div>
                  </div>
                </div>

                <RequestsTable rows={filteredRows} onSelect={(r) => setSelectedRequest(r)} />
              </section>
            </div>
          )}

          {/* SCREEN 4: LEAVE BALANCE */}
          {tab === 'balance' && (
            <div className="screen-container">
              <section className="page-heading heading-with-action">
                <div>
                  <div className="eyebrow">ALLOWANCES & ENTITLEMENTS</div>
                  <h1>Leave Balance Overview</h1>
                  <p>Comprehensive breakdown of your annual leave allowance and absence records.</p>
                </div>
                <button className="button button-primary" onClick={() => setTab('apply')}><Icon name="plus" size={17} /> Apply For Leave</button>
              </section>

              <div className="balance-screen-grid">
                <div className="panel balance-summary-card">
                  <div className="balance-header">
                    <div className="balance-icon-large"><Icon name="leaf" size={28} /></div>
                    <div>
                      <h2>Annual Leave Balance</h2>
                      <p>Standard paid annual leave allowance for {new Date().getFullYear()}</p>
                    </div>
                  </div>
                  <div className="balance-stats-row">
                    <div className="b-stat"><span>INITIAL ENTITLEMENT</span><strong>20</strong><small>days</small></div>
                    <div className="b-stat"><span>DAYS USED</span><strong>{20 - (remaining ?? 20)}</strong><small>approved days</small></div>
                    <div className="b-stat highlight"><span>REMAINING</span><strong>{remaining === null ? '—' : remaining}</strong><small>days available</small></div>
                  </div>
                  <div className="balance-bar-container">
                    <div className="balance-bar-fill" style={{ width: `${remaining === null ? 0 : Math.max(0, Math.min(100, (remaining / 20) * 100))}%` }} />
                  </div>
                  <div className="balance-bar-labels">
                    <span>0 days</span>
                    <span>10 days</span>
                    <span>20 days</span>
                  </div>
                </div>

                <div className="panel balance-info-card">
                  <h3>Leave Policy Rules</h3>
                  <div className="policy-item">
                    <div className="policy-icon"><Icon name="calendar" size={18} /></div>
                    <div>
                      <strong>Weekday Calculation</strong>
                      <p>Only Monday through Friday count as working days. Saturdays and Sundays are excluded.</p>
                    </div>
                  </div>
                  <div className="policy-item">
                    <div className="policy-icon"><Icon name="check" size={18} /></div>
                    <div>
                      <strong>Approval-Gated Deduction</strong>
                      <p>Days are deducted only when your manager approves your request. Rejections leave your balance untouched.</p>
                    </div>
                  </div>
                  <div className="policy-item">
                    <div className="policy-icon"><Icon name="shield" size={18} /></div>
                    <div>
                      <strong>Idempotent Workflow Execution</strong>
                      <p>Camunda 8 guarantees that worker retries will never double-deduct from your remaining balance.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 5: MANAGER INBOX */}
          {tab === 'manager' && (
            <div className="screen-container">
              <section className="page-heading heading-with-action">
                <div>
                  <div className="eyebrow">MANAGEMENT & APPROVALS</div>
                  <h1>Manager Inbox</h1>
                  <p>Review and decide on employee leave requests currently pending your approval.</p>
                </div>
                <button className="button button-secondary" onClick={() => void refreshQueue()}><Icon name="refresh" size={17} /> Refresh Inbox</button>
              </section>

              {queueError && <div className="alert alert-error" role="alert">{queueError}</div>}
              
              <section className="inbox-summary">
                <div className="inbox-summary-icon"><Icon name="inbox" size={22} /></div>
                <div>
                  <strong>{queue.length} {queue.length === 1 ? 'request' : 'requests'} waiting for your review</strong>
                  <span>Every request shown has passed automated business validation (sufficient days & working days &gt; 0).</span>
                </div>
              </section>

              {queue.length === 0 ? (
                <div className="empty-state panel">
                  <div className="empty-icon"><Icon name="check" size={26} /></div>
                  <h2>Inbox is clear!</h2>
                  <p>There are no leave requests pending manager review at this time.</p>
                </div>
              ) : (
                <div className="manager-list">
                  {queue.map((request) => (
                    <article className="panel manager-card" key={request.id}>
                      <div className="manager-card-top">
                        <div className="manager-person">
                          <div className="avatar avatar-large">{initials(request.employeeName)}</div>
                          <div>
                            <h2>{request.employeeName}</h2>
                            <span>{request.employeeEmail}</span>
                          </div>
                        </div>
                        <div className="top-right-group">
                          <span className="status-pill pending">Pending Approval</span>
                          <button className="button-text-details" onClick={() => setSelectedRequest(request)}>View Details ›</button>
                        </div>
                      </div>

                      <div className="manager-details">
                        <div><span>LEAVE TYPE</span><strong>{request.leaveType} Leave</strong></div>
                        <div><span>REQUESTED DATES</span><strong>{formatDate(request.startDate)} – {formatDate(request.endDate)}</strong></div>
                        <div><span>WORKING DAYS</span><strong>{request.days} {request.days === 1 ? 'day' : 'days'}</strong></div>
                      </div>

                      {request.reason && (
                        <div className="reason-box">
                          <span>EMPLOYEE REASON</span>
                          <p>{request.reason}</p>
                        </div>
                      )}

                      <div className="comment-box-group">
                        <label className="comment-label" htmlFor={`comment-${request.id}`}>Manager Decision Comment <span>Optional</span></label>
                        <textarea
                          id={`comment-${request.id}`}
                          value={comments[request.id] ?? ''}
                          onChange={(event) => setComments((current) => ({ ...current, [request.id]: event.target.value }))}
                          placeholder="Provide feedback or guidance for the employee..."
                          rows={2}
                          maxLength={1000}
                        />
                      </div>

                      <div className="manager-actions">
                        <button
                          className="button button-reject"
                          disabled={busyDecision === request.id}
                          onClick={() => promptDecision(request, false)}
                        >
                          <Icon name="close" size={17} /> Reject
                        </button>
                        <button
                          className="button button-approve"
                          disabled={busyDecision === request.id}
                          onClick={() => promptDecision(request, true)}
                        >
                          <Icon name="check" size={17} /> {busyDecision === request.id ? 'Submitting…' : 'Approve Request'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="security-warning">
                <Icon name="shield" size={18} />
                <div>
                  <strong>Manager access demonstration note</strong>
                  <span>In this demonstration environment, manager endpoints are accessible for testing. In production, configure role-based access control.</span>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 6: REQUEST DETAILS MODAL */}
          {selectedRequest && (
            <div className="modal-backdrop" onClick={() => setSelectedRequest(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <div className="eyebrow">REQUEST #{selectedRequest.id}</div>
                    <h2>{selectedRequest.leaveType} Leave Details</h2>
                  </div>
                  <button className="icon-close" onClick={() => setSelectedRequest(null)} aria-label="Close modal"><Icon name="close" size={20} /></button>
                </div>

                <div className="modal-body">
                  <div className="details-kpis">
                    <div><span>EMPLOYEE</span><strong>{selectedRequest.employeeName}</strong><small>{selectedRequest.employeeEmail}</small></div>
                    <div><span>DURATION</span><strong>{selectedRequest.days} working {selectedRequest.days === 1 ? 'day' : 'days'}</strong><small>{formatDate(selectedRequest.startDate)} to {formatDate(selectedRequest.endDate)}</small></div>
                    <div><span>CURRENT STATUS</span><StatusPill status={selectedRequest.status} /></div>
                  </div>

                  {selectedRequest.reason && (
                    <div className="modal-section">
                      <label>EMPLOYEE REASON</label>
                      <p className="modal-note-text">{selectedRequest.reason}</p>
                    </div>
                  )}

                  <div className="modal-section">
                    <label>LATEST STATUS UPDATE</label>
                    <p className="modal-note-text status-text">{selectedRequest.statusMessage || 'Request is processing through the workflow.'}</p>
                  </div>

                  <div className="modal-section">
                    <label>CAMUNDA 8 WORKFLOW PROGRESSION</label>
                    <div className="workflow-timeline">
                      <div className="timeline-node done">
                        <div className="t-icon"><Icon name="check" size={14} /></div>
                        <div><strong>1. Submitted</strong><p>Request created in DB and BPMN process instance initiated.</p></div>
                      </div>
                      <div className={`timeline-node ${selectedRequest.status !== 'SUBMITTED' ? 'done' : 'current'}`}>
                        <div className="t-icon">{selectedRequest.status !== 'SUBMITTED' ? <Icon name="check" size={14} /> : '2'}</div>
                        <div><strong>2. Automated Validation</strong><p>Worker verified working days and leave entitlement.</p></div>
                      </div>
                      <div className={`timeline-node ${selectedRequest.status === 'APPROVED' || selectedRequest.status === 'REJECTED' ? 'done' : selectedRequest.status === 'PENDING_APPROVAL' ? 'current' : ''}`}>
                        <div className="t-icon">{selectedRequest.status === 'APPROVED' || selectedRequest.status === 'REJECTED' ? <Icon name="check" size={14} /> : '3'}</div>
                        <div><strong>3. Manager Decision</strong><p>{selectedRequest.status === 'APPROVED' ? 'Approved by manager' : selectedRequest.status === 'REJECTED' ? 'Rejected' : 'Awaiting review in manager inbox'}</p></div>
                      </div>
                      <div className={`timeline-node ${selectedRequest.status === 'APPROVED' || selectedRequest.status === 'REJECTED' ? 'done' : ''}`}>
                        <div className="t-icon">{selectedRequest.status === 'APPROVED' || selectedRequest.status === 'REJECTED' ? <Icon name="check" size={14} /> : '4'}</div>
                        <div><strong>4. Finalization</strong><p>{selectedRequest.status === 'APPROVED' ? 'Balance deducted and finalized.' : selectedRequest.status === 'REJECTED' ? 'Process concluded as rejected.' : 'Pending final outcome.'}</p></div>
                      </div>
                    </div>
                  </div>

                  <div className="modal-technical-meta">
                    <div><span>Process Instance Key:</span> <code>{selectedRequest.processInstanceKey ?? 'Pending assign'}</code></div>
                    <div><span>Created At:</span> <span>{formatDateTime(selectedRequest.createdAt)}</span></div>
                    {selectedRequest.updatedAt && <div><span>Updated At:</span> <span>{formatDateTime(selectedRequest.updatedAt)}</span></div>}
                  </div>
                </div>

                <div className="modal-footer">
                  <button className="button button-secondary" onClick={() => setSelectedRequest(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* CONFIRMATION MODAL FOR MANAGER DECISIONS */}
          {decisionPrompt && (
            <div className="modal-backdrop" onClick={() => setDecisionPrompt(null)}>
              <div className="modal-card modal-confirm" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <div className="eyebrow">CONFIRM DECISION</div>
                    <h2>{decisionPrompt.approved ? 'Approve' : 'Reject'} Leave Request?</h2>
                  </div>
                  <button className="icon-close" onClick={() => setDecisionPrompt(null)} aria-label="Cancel"><Icon name="close" size={20} /></button>
                </div>

                <div className="modal-body">
                  <div className="confirm-summary-box">
                    <p>
                      Are you sure you want to <strong>{decisionPrompt.approved ? 'APPROVE' : 'REJECT'}</strong> the request for{' '}
                      <strong>{decisionPrompt.employeeName}</strong>?
                    </p>
                    <div className="confirm-details-list">
                      <div><span>Leave Type:</span> <strong>{decisionPrompt.leaveType} Leave</strong></div>
                      <div><span>Duration:</span> <strong>{decisionPrompt.days} working {decisionPrompt.days === 1 ? 'day' : 'days'}</strong></div>
                      <div><span>Dates:</span> <strong>{formatDate(decisionPrompt.startDate)} – {formatDate(decisionPrompt.endDate)}</strong></div>
                      {decisionPrompt.comment ? (
                        <div><span>Your Comment:</span> <em>"{decisionPrompt.comment}"</em></div>
                      ) : (
                        <div><span>Your Comment:</span> <em>No comment provided</em></div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button className="button button-secondary" onClick={() => setDecisionPrompt(null)}>Cancel</button>
                  <button
                    className={`button ${decisionPrompt.approved ? 'button-approve' : 'button-reject'}`}
                    disabled={busyDecision === decisionPrompt.id}
                    onClick={() => void confirmDecision()}
                  >
                    {busyDecision === decisionPrompt.id ? 'Submitting…' : decisionPrompt.approved ? 'Confirm Approval' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
      {toast && <div className="toast" role="status"><span className="toast-check"><Icon name="check" size={16} /></span>{toast}</div>}
    </div>
  )
}

function MetricCard({ icon, label, value, note, tone }: { icon: string; label: string; value: string; note: string; tone: string }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon name={icon} size={19} /></div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  )
}

function JourneyStep({ number, title, detail, state = '' }: { number: string; title: string; detail: string; state?: string }) {
  return (
    <div className={`journey-step ${state}`}>
      <div className="journey-marker">{state === 'done' ? <Icon name="check" size={15} /> : number}</div>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  )
}

function LeaveForm({
  onSubmit,
  busy,
  remainingBalance
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>, form: { leaveType: LeaveType; startDate: string; endDate: string; reason: string }) => Promise<void>
  busy: boolean
  remainingBalance: number | null
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>('ANNUAL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const workingDays = useMemo(() => countWorkingDays(startDate, endDate), [startDate, endDate])

  function submit(event: FormEvent<HTMLFormElement>) {
    void onSubmit(event, { leaveType, startDate, endDate, reason })
  }

  const isExceeding = leaveType === 'ANNUAL' && remainingBalance !== null && workingDays > remainingBalance

  return (
    <form className="leave-form" onSubmit={submit}>
      <div className="field-group">
        <label htmlFor="leave-type">Type of Leave</label>
        <div className="select-wrap">
          <select id="leave-type" value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveType)}>
            <option value="ANNUAL">Annual Leave (Paid Vacation)</option>
            <option value="SICK">Sick Leave (Medical Absence)</option>
            <option value="UNPAID">Unpaid Leave</option>
          </select>
          <Icon name="chevron" size={17} />
        </div>
      </div>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="start-date">Start Date</label>
          <input
            id="start-date"
            type="date"
            required
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value)
              if (endDate && event.target.value > endDate) setEndDate('')
            }}
          />
        </div>
        <div className="field-group">
          <label htmlFor="end-date">End Date</label>
          <input
            id="end-date"
            type="date"
            required
            min={startDate || undefined}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      </div>

      {startDate && endDate && (
        <div className={`date-calculation-banner ${workingDays === 0 || isExceeding ? 'warning' : 'info'}`}>
          <Icon name={workingDays === 0 || isExceeding ? 'alert' : 'info'} size={18} />
          <div>
            <strong>{workingDays} Working {workingDays === 1 ? 'Day' : 'Days'} Selected</strong>
            {workingDays === 0 && <span>The selected date range falls entirely on a weekend. Requests with 0 working days will be rejected.</span>}
            {isExceeding && <span>This request exceeds your remaining balance of {remainingBalance} days!</span>}
            {workingDays > 0 && !isExceeding && <span>Weekends are excluded automatically.</span>}
          </div>
        </div>
      )}

      <div className="field-group">
        <div className="label-row">
          <label htmlFor="reason">Reason for Leave</label>
          <span>Optional ({reason.length}/1000)</span>
        </div>
        <textarea
          id="reason"
          rows={4}
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Brief note to help your manager review and plan team coverage..."
        />
      </div>

      <div className="form-foot">
        <span><Icon name="shield" size={15} /> Evaluated automatically by Camunda 8 engine.</span>
        <button className="button button-primary button-submit" type="submit" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit Leave Request'} <Icon name="arrow" size={17} />
        </button>
      </div>
    </form>
  )
}

function RequestsTable({ rows, onSelect }: { rows: Leave[]; onSelect: (r: Leave) => void }) {
  if (rows.length === 0) {
    return (
      <div className="table-empty">
        <div className="empty-icon"><Icon name="file" size={23} /></div>
        <strong>No requests to show</strong>
        <p>Submitted leave requests matching your filters will appear here.</p>
      </div>
    )
  }

  return (
    <div className="table-scroll">
      <table className="requests-table">
        <thead>
          <tr>
            <th>REQUEST</th>
            <th>DATES</th>
            <th>DAYS</th>
            <th>STATUS</th>
            <th>UPDATE</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="request-type">
                  <span className="request-type-icon">
                    <Icon name={row.leaveType === 'ANNUAL' ? 'leaf' : row.leaveType === 'SICK' ? 'shield' : 'calendar'} size={16} />
                  </span>
                  <div>
                    <strong>{row.leaveType} Leave</strong>
                    <small>Request #{row.id}</small>
                  </div>
                </div>
              </td>
              <td>
                <strong className="date-range">{formatDate(row.startDate)}</strong>
                <small className="date-end">to {formatDate(row.endDate)}</small>
              </td>
              <td>
                <strong>{row.days}</strong>
                <small>working {row.days === 1 ? 'day' : 'days'}</small>
              </td>
              <td><StatusPill status={row.status} /></td>
              <td><span className="status-note">{row.statusMessage || 'Request received.'}</span></td>
              <td>
                <button className="button-table-action" onClick={() => onSelect(row)}>
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusPill({ status }: { status: Leave['status'] }) {
  return (
    <span className={`status-pill ${status.toLowerCase()}`}>
      <span />
      {statusLabel(status)}
    </span>
  )
}

export default App
