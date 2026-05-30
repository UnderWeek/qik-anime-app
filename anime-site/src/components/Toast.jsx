import { useAuth } from '../context/AuthContext.jsx'

export default function Toast() {
  const { toast } = useAuth()
  if (!toast) return null
  return <div className="toast">{toast}</div>
}
