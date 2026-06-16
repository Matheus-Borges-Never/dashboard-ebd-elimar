import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus, Pencil, Trash2 } from 'lucide-react'

function Form({ db, initial, triId, onSave, onCancel }) {
  const [nome, setNome] = useState(initial?.nome || '')
  const [trimestreId, setTrimestreId] = useState(initial?.trimestre_id || triId || '')

  function submit(e) {
    e.preventDefault()
    onSave({ nome, trimestre_id: trimestreId })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Trimestre</label>
          <Select value={trimestreId} onChange={e => setTrimestreId(e.target.value)} required>
            <option value="">— Selecione —</option>
            {(db.trimestres || []).map(t => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Nome da Sala</label>
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Adolescentes" required />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">{initial ? 'Salvar' : 'Criar'}</Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}

export default function Salas({ db, api, toast }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filterTri, setFilterTri] = useState(() => {
    const ativo = (db.trimestres || []).find(t => t.ativo)
    return ativo?.id || db.trimestres?.[0]?.id || ''
  })

  async function save(data) {
    try {
      await api('saveSala', editing ? { ...data, id: editing.id } : data)
      toast({ message: 'Sala salva!' })
      setAdding(false)
      setEditing(null)
    } catch (e) {
      toast({ message: e.message, variant: 'error' })
    }
  }

  async function del(id) {
    if (!confirm('Deletar sala e todos os alunos/presenças vinculados?')) return
    try {
      await api('deleteSala', { id })
      toast({ message: 'Sala deletada.' })
    } catch (e) {
      toast({ message: e.message, variant: 'error' })
    }
  }

  const salas = (db.salas || []).filter(s => !filterTri || s.trimestre_id === filterTri)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Salas</h2>
        {!adding && !editing && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} /> Nova
          </Button>
        )}
      </div>

      <Select value={filterTri} onChange={e => setFilterTri(e.target.value)} className="max-w-xs">
        <option value="">Todos os trimestres</option>
        {(db.trimestres || []).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </Select>

      {adding && <Form db={db} triId={filterTri} onSave={save} onCancel={() => setAdding(false)} />}

      <div className="flex flex-col gap-2">
        {salas.length === 0 && <p className="text-sm text-gray-500">Nenhuma sala encontrada.</p>}
        {salas.map(s => {
          const count = (db.alunos || []).filter(a => a.sala_id === s.id).length
          return (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                {editing?.id === s.id ? (
                  <div className="flex-1">
                    <Form db={db} initial={editing} onSave={save} onCancel={() => setEditing(null)} />
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-gray-900">{s.nome}</p>
                      <p className="text-xs text-gray-500">{count} aluno{count !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="icon" onClick={() => setEditing(s)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => del(s.id)} className="text-red-500 hover:text-red-600">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
