import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Star } from 'lucide-react'

function Form({ initial, onSave, onCancel }) {
  const [nome, setNome] = useState(initial?.nome || '')
  const [inicio, setInicio] = useState(initial?.inicio || '')
  const [fim, setFim] = useState(initial?.fim || '')

  function submit(e) {
    e.preventDefault()
    onSave({ nome, inicio, fim })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="text-xs font-medium text-gray-600 block mb-1">Nome</label>
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: 2º Trimestre 2026" required />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Início</label>
          <Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Fim</label>
          <Input type="date" value={fim} onChange={e => setFim(e.target.value)} required />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">{initial ? 'Salvar' : 'Criar'}</Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}

export default function Trimestres({ db, api, toast }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)

  async function save(data) {
    try {
      await api('saveTrimestre', editing ? { ...data, id: editing.id } : data)
      toast({ message: 'Trimestre salvo!' })
      setAdding(false)
      setEditing(null)
    } catch (e) {
      toast({ message: e.message, variant: 'error' })
    }
  }

  async function setAtivo(id) {
    try {
      await api('setTrimestreAtivo', { id })
      toast({ message: 'Trimestre ativo atualizado.' })
    } catch (e) {
      toast({ message: e.message, variant: 'error' })
    }
  }

  async function del(id) {
    if (!confirm('Deletar trimestre e todos os dados vinculados?')) return
    try {
      await api('deleteTrimestre', { id })
      toast({ message: 'Trimestre deletado.' })
    } catch (e) {
      toast({ message: e.message, variant: 'error' })
    }
  }

  const list = db.trimestres || []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Trimestres</h2>
        {!adding && !editing && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} /> Novo
          </Button>
        )}
      </div>

      {adding && <Form onSave={save} onCancel={() => setAdding(false)} />}

      <div className="flex flex-col gap-2">
        {list.length === 0 && <p className="text-sm text-gray-500">Nenhum trimestre cadastrado.</p>}
        {list.map(t => (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              {editing?.id === t.id ? (
                <div className="flex-1">
                  <Form initial={editing} onSave={save} onCancel={() => setEditing(null)} />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{t.nome}</p>
                      <p className="text-xs text-gray-500">{t.inicio} → {t.fim}</p>
                    </div>
                    {t.ativo && <Badge variant="success">Ativo</Badge>}
                  </div>
                  <div className="flex gap-1.5">
                    {!t.ativo && (
                      <Button variant="outline" size="sm" onClick={() => setAtivo(t.id)}>
                        <Star size={13} /> Ativar
                      </Button>
                    )}
                    <Button variant="outline" size="icon" onClick={() => setEditing(t)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => del(t.id)} className="text-red-500 hover:text-red-600">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
