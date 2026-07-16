import { useEffect, useRef, useState, useCallback } from 'react'

// Generic data-fetching hook.
// fn: an async function returning data. deps: dependency array to refetch.
export function useApi(fn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(() => {
    let alive = true
    setLoading(true)
    setError(null)
    Promise.resolve()
      .then(() => fnRef.current())
      .then((res) => {
        if (alive) setData(res)
      })
      .catch((e) => {
        if (alive) setError(e)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(run, [run])

  return { data, loading, error, refetch: run }
}
