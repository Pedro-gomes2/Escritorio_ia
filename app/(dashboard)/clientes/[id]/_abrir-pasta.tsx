'use client'

import { useState } from 'react'
import { Folder, Copy, Check } from 'lucide-react'

interface Props {
  nome: string
}

// Caminho base configurável — ajuste aqui conforme necessário
const BASE_PATH = 'G:\\Meu Drive\\ESCRITÓRIO\\PROCESSOS LUCY'

function nomePasta(nome: string) {
  // Normaliza o nome para usar como nome de pasta (remove caracteres inválidos)
  return nome.trim().toUpperCase()
}

export default function AbrirPasta({ nome }: Props) {
  const [copiado, setCopiado] = useState(false)

  const caminhoWindows = `${BASE_PATH}\\${nomePasta(nome)}`
  // file:// usa barras normais e encode de espaços
  const caminhoFile = 'file:///' + caminhoWindows.replace(/\\/g, '/').replace(/ /g, '%20')

  function copiar() {
    navigator.clipboard.writeText(caminhoWindows)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={caminhoFile}
        title={`Abrir: ${caminhoWindows}`}
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
    </div>
  )
}
