export async function fetchData() {
  const res = await fetch('/api/data', { cache: 'no-store' })
  if (!res.ok) throw new Error('Falha ao carregar dados')
  return res.json()
}

export async function adminApi(action, data = {}, senha) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha, action, ...data }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Erro desconhecido')
  return json
}
