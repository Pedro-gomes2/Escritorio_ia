import ClienteForm from '../../_components/cliente-form'

export default function NovoClientePage() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Novo Cliente</h1>
      <ClienteForm />
    </div>
  )
}
