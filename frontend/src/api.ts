export type LeaveStatus = 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
export type LeaveType = 'ANNUAL' | 'SICK' | 'UNPAID'

export interface Leave {
  id: number
  employeeName: string
  employeeEmail: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  days: number
  reason: string
  status: LeaveStatus
  statusMessage?: string
  processInstanceKey?: number
  createdAt: string
  updatedAt?: string
}

export interface NewLeave {
  employeeName: string
  employeeEmail: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  reason: string
}

export interface ApiError extends Error {
  status?: number
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new Error('Cannot reach the backend. Check that Spring Boot is running on port 8081.')
  }

  if (!response.ok) {
    let message = response.statusText || 'Request failed'
    const rawBody = await response.text().catch(() => '')
    if (rawBody) {
      try {
        const body = JSON.parse(rawBody) as { message?: string; detail?: string }
        message = body.message || body.detail || message
      } catch {
        message = rawBody
      }
    }
    const error: ApiError = new Error(message)
    error.status = response.status
    throw error
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const query = (value: string) => encodeURIComponent(value.trim())

export const checkHealth = () => http<{ status: string; service: string }>('/api/health')
export const submitLeave = (body: NewLeave) => http<Leave>('/api/leaves', {
  method: 'POST',
  body: JSON.stringify(body),
})
export const myLeaves = (email: string) => http<Leave[]>(`/api/leaves?employeeEmail=${query(email)}`)
export const pendingLeaves = () => http<Leave[]>('/api/leaves/pending')
export const balance = (email: string) => http<{ remainingDays: number }>(
  `/api/leaves/balance?employeeEmail=${query(email)}`,
)
export async function decide(id: number, approved: boolean, comment: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await http<void>(`/api/leaves/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ approved, comment }),
      })
      return
    } catch (error) {
      const status = (error as ApiError).status
      // Camunda's user-task search index may lag briefly after process creation.
      if (status !== 409 || attempt >= 4) throw error
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
    }
  }
}
