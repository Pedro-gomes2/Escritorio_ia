'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Clock, User, FolderOpen, Trash2, Pencil, X, Check } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'

type Tarefa = {
  id: string
  titulo: string
  descricao: string | null
  status: string
  prioridade: string
  prazo: string | null
  processos: { titulo: string } | null
  profiles: { nome: string } | null
}

const colunas = [
  { key: 'pendente', label: 'Pendente', color: 'bg-slate-100' },
  { key: 'em_andamento', label: 'Em Andamento', color: 'bg-blue-100' },
  { key: 'revisao', label: 'Revisão', color: 'bg-amber-100' },
  { key: 'concluida', label: 'Concluída', color: 'bg-green-100' },
]

const prioridadeColor: Record<string, string> = {
  baixa: 'bg-slate-100 text-slate-600',
  media: 'bg-amber-100 text-amber-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
}

interface EditForm {
  titulo: string
  descricao: string
  prioridade: string
  prazo: string
}

export default function KanbanBoard({
  tarefas: initialTarefas,
}: {
  tarefas: Tarefa[]
  processos: { id: string; titulo: string }[]
  advogados: { id: string; nome: string }[]
  userId: string
}) {
  const [tarefas, setTarefas] = useState(initialTarefas)
  const [dragging, setDragging] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ titulo: '', descricao: '', prioridade: 'media', prazo: '' })
  const supabase = createClient()
  const router = useRouter()

  async function moveToStatus(id: string, newStatus: string) {
    setTarefas(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    await supabase.from('tarefas').update({ status: newStatus }).eq('id', id)
    router.refresh()
  }

  async function excluir(id: string, titulo: string) {
    if (!confirm(`Excluir a tarefa "${titulo}"?`)) return
    setTarefas(prev => prev.filter(t => t.id !== id))
    await supabase.from('tarefas').delete().eq('id', id)
    router.refresh()
  }

  function abrirEdicao(tarefa: Tarefa) {
    setEditando(tarefa.id)
    setEditForm({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao ?? '',
      prioridade: tarefa.prioridade,
      prazo: tarefa.prazo ? tarefa.prazo.slice(0, 10) : '',
    })
  }

  async function salvarEdicao(id: string) {
    const updates = {
      titulo: editForm.titulo,
      descricao: editForm.descricao || null,
      prioridade: editForm.prioridade,
      prazo: editForm.prazo || null,
    }
    setTarefas(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    setEditando(null)
    await supabase.from('tarefas').update(updates).eq('id', id)
    router.refresh()
  }

  function onDragStart(id: string) { setDragging(id) }
  function onDrop(status: string) {
    if (dragging) { moveToStatus(dragging, status); setDragging(null) }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
      {colunas.map(col => {
        const colTarefas = tarefas.filter(t => t.status === col.key)
        return (
          <div
            key={col.key}
            className="flex-shrink-0 w-72 flex flex-col"
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(col.key)}
          >
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${col.color}`}>
              <span className="text-sm font-semibold text-slate-700">{col.label}</span>
              <span className="text-xs bg-white rounded-full px-2 py-0.5 font-medium text-slate-600">
                {colTarefas.length}
              </span>
            </div>

            <div className="flex-1 bg-slate-100/60 rounded-b-xl p-2 space-y-2 overflow-y-auto min-h-32">
              {colTarefas.map(tarefa => (
                <div
                  key={tarefa.id}
                  draggable={editando !== tarefa.id}
                  onDragStart={() => onDragStart(tarefa.id)}
                  className={cn(
                    'bg-white rounded-lg p-3 shadow-sm border border-slate-100 hover:border-blue-200 transition-colors',
                    editando !== tarefa.id && 'cursor-grab active:cursor-grabbing',
                    dragging === tarefa.id && 'opacity-50'
                  )}
                >
                  {editando === tarefa.id ? (
                    /* Modo edição inline */
                    <div className="space-y-2">
                      <input
                        value={editForm.titulo}
                        onChange={e => setEditForm(f => ({ ...f, titulo: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <textarea
                        value={editForm.descricao}
                        onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))}
                        placeholder="Descrição..."
                        rows={2}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                      />
                      <select
                        value={editForm.prioridade}
                        onChange={e => setEditForm(f => ({ ...f, prioridade: e.target.value }))}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none"
                      >
                        <option value="baixa">Baixa</option>
                        <option value="media">Média</option>
                        <option value="alta">Alta</option>
                        <option value="urgente">Urgente</option>
                      </select>
                      <input
                        type="date"
                        value={editForm.prazo}
                        onChange={e => setEditForm(f => ({ ...f, prazo: e.target.value }))}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none"
                      />
                      <div className="flex gap-1 pt-1">
                        <button
                          onClick={() => salvarEdicao(tarefa.id)}
                          className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                        >
                          <Check className="w-3 h-3" /> Salvar
                        </button>
                        <button
                          onClick={() => setEditando(null)}
                          className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200 transition-colors"
                        >
                          <X className="w-3 h-3" /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Modo visualização */
                    <>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium text-slate-800 leading-tight flex-1">{tarefa.titulo}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', prioridadeColor[tarefa.prioridade])}>
                            {tarefa.prioridade}
                          </span>
                          <button
                            onClick={() => abrirEdicao(tarefa)}
                            className="text-slate-300 hover:text-blue-500 transition-colors p-0.5"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => excluir(tarefa.id, tarefa.titulo)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {tarefa.descricao && (
                        <p className="text-xs text-slate-500 mb-2 line-clamp-2">{tarefa.descricao}</p>
                      )}

                      <div className="space-y-1">
                        {tarefa.processos?.titulo && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <FolderOpen className="w-3 h-3" />
                            <span className="truncate">{tarefa.processos.titulo}</span>
                          </div>
                        )}
                        {tarefa.profiles?.nome && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <User className="w-3 h-3" />
                            <span>{tarefa.profiles.nome}</span>
                          </div>
                        )}
                        {tarefa.prazo && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(tarefa.prazo)}</span>
                          </div>
                        )}
                      </div>

                      {col.key !== 'concluida' && (
                        <div className="flex gap-1 mt-2 pt-2 border-t border-slate-100">
                          {colunas
                            .filter(c => c.key !== col.key)
                            .map(c => (
                              <button
                                key={c.key}
                                onClick={() => moveToStatus(tarefa.id, c.key)}
                                className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                → {c.label}
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}

              {colTarefas.length === 0 && (
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center text-xs text-slate-400">
                  Sem tarefas
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
