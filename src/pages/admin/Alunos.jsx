import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function Alunos({ db, api, toast }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [nome, setNome] = useState('')
  const [salaId, setSalaId] = useState('')
  const [filterTri, setFilterTri] = useState(() => {
    const ativo = (db.trimestres || []).find(t => t.ativo)
    return ativo?.id || db.trimestres?.[0]?.id || ''
  })
  const [filterSala, setFilterSala] = useState('')

  const salas = (db.salas || []).filter(s => !filterTri || s.trimestre_id === filterTri)
  const alunos = (db.alunos || [])
    .filter(a => !filterSala || a.sala_id === filterSala)
    .filter(a => !filterTri || salas.some(s => s.id === a.sala_id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  function openAdd() {
    setNome('')
    setSalaId(filterSala || salas[0]?.id || '')
    setAdding(true)
    setEditing(null)
  }

  function openEdit(a) {
    setNome(a.nome)
    setSalaId(a.sala_id)
    setEditing(a)
    setAdding(false)
  }

  async function save(e) {
    e.preventDefault()
    const nomeFinal = nome.trim().toUpperCase()
    try {
      await api('saveAluno', editing
        ? { id: editing.id, nome: nomeFinal, sala_id: salaId }
        : { nome: nomeFinal, sala_id: salaId })
      toast({ message: 'Aluno salvo!' })
      setAdding(false)
      setEditing(null)
    } catch (err) {
      toast({ message: err.message, variant: 'error' })
    }
  }

  async function del(id) {
    if (!confirm('Deletar aluno e todas as presenças?')) return
    try {
      await api('deleteAluno', { id })
      toast({ message: 'Aluno deletado.' })
    } catch (e) {
      toast({ message: e.message, variant: 'error' })
    }
  }

  const showForm = adding || editing

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Alunos</h2>
        {!showForm && (
          <Button size="sm" onClick={openAdd}>
            <Plus size={15} /> Novo
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={filterTri} onChange={e => { setFilterTri(e.target.value); setFilterSala('') }} className="max-w-xs">
          <option value="">Todos os trimestres</option>
          {(db.trimestres || []).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </Select>
        <Select value={filterSala} onChange={e => setFilterSala(e.target.value)} className="max-w-xs">
          <option value="">Todas as salas</option>
          {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </Select>
      </div>

      {showForm && (
        <form onSubmit={save} className="flex flex-col gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Sala</label>
              <Select value={salaId} onChange={e => setSalaId(e.target.value)} required>
                <option value="">— Selecione —</option>
                {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nome</label>
              <Input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Nome do aluno"
                required
                autoFocus
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">{editing ? 'Salvar' : 'Adicionar'}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setAdding(false); setEditing(null) }}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-500">{alunos.length} aluno{alunos.length !== 1 ? 's' : ''}</p>
        {alunos.length === 0 && <p className="text-sm text-gray-500">Nenhum aluno encontrado.</p>}
        {alunos.map(a => {
          const sala = salas.find(s => s.id === a.sala_id)
          return (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{a.nome}</p>
                  {sala && <p className="text-xs text-gray-500">{sala.nome}</p>}
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="icon" onClick={() => openEdit(a)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => del(a.id)} className="text-red-500 hover:text-red-600">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
