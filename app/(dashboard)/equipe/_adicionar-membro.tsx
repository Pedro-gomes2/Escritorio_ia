'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react'

export default function AdicionarMembro() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: 'advogado',
    oab: '',
  })

  const set = (f: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [f]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const res = await fetch('/api/equipe/convidar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const json = await res.json()

    if (!res.ok) {
      setErro(json.error ?? 'Erro ao criar membro.')
      setLoading(false)
      return
    }

    setSucesso(true)
    setLoading(false)
    setForm({ nome: '', email: '', senha: '', cargo: 'advogado', oab: '' })

    setTimeout(() => {
      setSucesso(false)
      setAberto(false)
      router.refresh()
    }, 2000)
  }

  const fieldClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5'

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Adicionar membro
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !loading && setAberto(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">Adicionar membro</h2>
              <button
                onClick={() => setAberto(false)}
                disabled={loading}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {sucesso ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle className="w-14 h-14 text-green-500 mb-3" />
                <p className="font-semibold text-slate-700">Membro criado com sucesso!</p>
                <p className="text-sm text-slate-400 mt-1">
                  {form.email || 'O novo membro'} já pode acessar o sistema.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>Nome completo *</label>
                  <input
                    value={form.nome}
                    onChange={set('nome')}
                    required
                    className={fieldClass}
                    placeholder="Dr. João Silva"
                  />
                </div>

                <div>
                  <label className={labelClass}>E-mail *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    required
                    className={fieldClass}
                    placeholder="joao@escritorio.com.br"
                  />
                </div>

                <div>
                  <label className={labelClass}>Senha provisória *</label>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={form.senha}
                      onChange={set('senha')}
                      required
                      minLength={6}
                      className={`${fieldClass} pr-10`}
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Compartilhe com o membro — ele poderá alterar depois.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Cargo</label>
                    <select value={form.cargo} onChange={set('cargo')} className={fieldClass}>
                      <option value="socio">Sócio(a)</option>
                      <option value="advogado">Advogado(a)</option>
                      <option value="estagiario">Estagiário(a)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>OAB</label>
                    <input
                      value={form.oab}
                      onChange={set('oab')}
                      className={fieldClass}
                      placeholder="SP 123456"
                    />
                  </div>
                </div>

                {erro && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                    {erro}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAberto(false)}
                    disabled={loading}
                    className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Criando...' : 'Criar membro'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
