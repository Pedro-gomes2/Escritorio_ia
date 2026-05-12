'use client'

import { useState } from 'react'
import { Folder, Copy, Check, Download } from 'lucide-react'

interface Props {
  nome: string
  pastaPath: string | null
  compact?: boolean  // modo lista: só ícone, sem texto abaixo
}

const BASE_PATH = 'G:\\Meu Drive\\ESCRITÓRIO\\PROCESSOS LUCY'

function gerarCaminho(nome: string, pastaPath: string | null): string {
  if (pastaPath) return pastaPath
  return `${BASE_PATH}\\${nome.trim().toUpperCase()}`
}

function paraFileUrl(caminho: string): string {
  return 'file:///' + caminho.replace(/\\/g, '/').replace(/ /g, '%20')
}

function paraOpenDirUrl(caminho: string): string {
  return 'opendir:///' + caminho.replace(/\\/g, '/').replace(/ /g, '%20')
}

export default function AbrirPasta({ nome, pastaPath, compact = false }: Props) {
  const [copiado, setCopiado] = useState(false)

  const caminho = gerarCaminho(nome, pastaPath)
  const openDirUrl = paraOpenDirUrl(caminho)
  const fileUrl = paraFileUrl(caminho)

  function copiar() {
    navigator.clipboard.writeText(caminho)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <a
          href={openDirUrl}
          onClick={e => { e.preventDefault(); window.location.href = openDirUrl }}
          title={`Abrir pasta: ${caminho}`}
          className="p-1.5 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
        >
          <Folder className="w-4 h-4" />
        </a>
        <button onClick={copiar} title="Copiar caminho" className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
          {copiado ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {/* Tenta opendir:// (requer .reg instalado), fallback para file:// */}
        <a
          href={openDirUrl}
          onClick={e => {
            e.preventDefault()
            // Tenta protocolo customizado primeiro
            const start = Date.now()
            window.location.href = openDirUrl
            // Se não abriu em 500ms (protocolo não instalado), tenta file://
            setTimeout(() => {
              if (Date.now() - start < 1000) window.location.href = fileUrl
            }, 500)
          }}
          title={`Abrir: ${caminho}`}
          className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Folder className="w-4 h-4" />
          Pasta
        </a>
        <button
          onClick={copiar}
          title="Copiar caminho da pasta"
          className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
        >
          {copiado ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
        <a
          href="/abrir-pasta.reg"
          download
          title="Instalar protocolo para abrir pastas automaticamente (fazer uma vez)"
          className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
      {!compact && (
        <p className="text-xs text-slate-400 truncate max-w-xs" title={caminho}>{caminho}</p>
      )}
    </div>
  )
}
