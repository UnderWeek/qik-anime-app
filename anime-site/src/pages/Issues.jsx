import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { backend } from '../api/backend.js'
import { TrashIcon, CheckIcon } from '../components/icons.jsx'
import SEO from '../components/SEO.jsx'

const STATUS_LABELS = {
  open: 'Открыто',
  in_progress: 'В работе',
  fixed: 'Исправлено',
}
const STATUS_COLORS = {
  open: 'var(--danger)',
  in_progress: '#ff9500',
  fixed: 'var(--accent-2)',
}

export default function Issues() {
  const { user, ready, openAuth } = useAuth()
  const [issues, setIssues] = useState(null)
  const [title, setTitle] = useState('')
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState('')

  const load = useCallback(() => {
    backend.listIssues(filter || undefined)
      .then(r => setIssues(Array.isArray(r) ? r : []))
      .catch(() => setIssues([]))
  }, [filter])

  useEffect(() => { load() }, [load])

  const isMaster = user?.isMaster || user?.isAdmin

  if (ready && !user) {
    return (
      <div className="container page">
        <div className="state">
          <h2>Нужна авторизация</h2>
          <p>Войдите в аккаунт, чтобы открыть эту страницу.</p>
          <button className="btn btn-primary" onClick={() => openAuth('login')}>Войти</button>
        </div>
      </div>
    )
  }

  if (ready && !isMaster) {
    return (
      <div className="container page">
        <div className="state">
          <h2>Нет доступа</h2>
          <p>Эта страница доступна только мастерам и администраторам.</p>
        </div>
      </div>
    )
  }

  async function submit(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t || sending) return
    setSending(true)
    try {
      await backend.createIssue(t)
      setTitle('')
      load()
    } catch { /* */ }
    setSending(false)
  }

  async function takeTask(id) {
    await backend.assignIssue(id)
    load()
  }

  async function markFixed(id) {
    await backend.updateIssue(id, 'fixed')
    load()
  }

  async function reopen(id) {
    await backend.updateIssue(id, 'open')
    load()
  }

  async function remove(id) {
    await backend.deleteIssue(id)
    load()
  }

  if (!issues) return <div className="container page"><div className="state">Загрузка…</div></div>

  return (
    <div className="container page">
      <SEO title="Баг-репорты" canonical="https://quickik.ru/issues" />

      <h1 style={{ marginBottom: 24 }}>🐛 Баг-репорты</h1>

      {/* form */}
      <form className="issues-form" onSubmit={submit} style={{
        display: 'flex', gap: 10, marginBottom: 24,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 6,
      }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Опишите баг или что нужно исправить…"
          maxLength={500}
          style={{
            flex: 1, background: 'transparent', border: 'none',
            padding: '10px 12px', color: 'var(--text)', fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || !title.trim()}
          style={{ padding: '10px 20px', borderRadius: 11 }}
        >
          {sending ? '…' : 'Отправить'}
        </button>
      </form>

      {/* filters */}
      <div className="chips" style={{ marginBottom: 20 }}>
        {['', 'open', 'in_progress', 'fixed'].map(s => (
          <button
            key={s}
            className={`chip${filter === s ? ' active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s ? STATUS_LABELS[s] : 'Все'}
          </button>
        ))}
      </div>

      {/* list */}
      {issues.length === 0 ? (
        <div className="state" style={{ padding: 40 }}>
          <p>Список пуст</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {issues.map(issue => (
            <div key={issue.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '14px 18px',
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px',
                borderRadius: 8, color: '#fff',
                background: STATUS_COLORS[issue.status] || 'var(--text-faint)',
                flexShrink: 0,
              }}>
                {STATUS_LABELS[issue.status] || issue.status}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>
                  {issue.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>
                  {issue.reporter?.username || '?'} · {new Date(issue.createdAt).toLocaleString('ru-RU')}
                  {issue.assignee && <> · 👤 {issue.assignee.username}</>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {issue.status === 'open' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => takeTask(issue.id)}
                    style={{ padding: '6px 12px', fontSize: 12 }}>
                    Взять
                  </button>
                )}
                {issue.status === 'in_progress' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => markFixed(issue.id)}
                    style={{ padding: '6px 12px', fontSize: 12, color: 'var(--accent-2)' }}>
                    <CheckIcon width={13} height={13} /> Исправлено
                  </button>
                )}
                {issue.status === 'fixed' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => reopen(issue.id)}
                    style={{ padding: '6px 12px', fontSize: 12 }}>
                    Переоткрыть
                  </button>
                )}
                {(user?.isAdmin) && (
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => remove(issue.id)}
                    style={{ padding: 6, color: 'var(--danger)' }}>
                    <TrashIcon width={13} height={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
