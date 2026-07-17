// Gestão de contas de staff (item 3 da v2). Criar/desativar passa pela
// Vercel Function (service role); este ecrã nunca vê a service key.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { chamarApiEquipa, registarAuditoria, usePerfil } from '../../../lib/equipa'
import {
  CampoTexto,
  useAviso,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  CARTAO,
  CAMPO,
} from './comuns'

const CONTA_VAZIA = { nome: '', email: '', password: '', pin: '', papel: 'staff' }

function Equipa() {
  const perfil = usePerfil()
  const [perfis, setPerfis] = useState([])
  const [tabelaEmFalta, setTabelaEmFalta] = useState(false)
  const [aCriar, setACriar] = useState(false)
  const [form, setForm] = useState(CONTA_VAZIA)
  const [ocupado, setOcupado] = useState(false)
  const { mostrarAviso, Aviso } = useAviso()

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('perfis')
      .select('id, email, nome, papel, ativo, pin_hash, criado_em')
      .order('criado_em')
    if (error) setTabelaEmFalta(true)
    else {
      setTabelaEmFalta(false)
      setPerfis(data)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function criar(e) {
    e.preventDefault()
    setOcupado(true)
    try {
      await chamarApiEquipa({ acao: 'criar', ...form, nome: form.nome.trim() })
      registarAuditoria('conta_criada', { email: form.email, papel: form.papel })
      mostrarAviso('Conta criada ✓')
      setACriar(false)
      setForm(CONTA_VAZIA)
      carregar()
    } catch (erro) {
      mostrarAviso(erro.message)
    } finally {
      setOcupado(false)
    }
  }

  async function definirEstado(p, ativo) {
    if (!ativo && !window.confirm(`Desativar a conta de ${p.nome} (${p.email})?`)) return
    setOcupado(true)
    try {
      await chamarApiEquipa({ acao: 'definir_estado', user_id: p.id, ativo })
      registarAuditoria(ativo ? 'conta_reativada' : 'conta_desativada', { email: p.email })
      mostrarAviso(ativo ? 'Conta reativada ✓' : 'Conta desativada ✓')
      carregar()
    } catch (erro) {
      mostrarAviso(erro.message)
    } finally {
      setOcupado(false)
    }
  }

  async function trocarPin(p) {
    const pin = window.prompt(`Novo PIN (4 dígitos) para ${p.nome}:`)
    if (pin == null) return
    if (!/^\d{4}$/.test(pin)) {
      mostrarAviso('PIN tem de ter 4 dígitos.')
      return
    }
    setOcupado(true)
    try {
      await chamarApiEquipa({ acao: 'definir_pin', user_id: p.id, pin })
      registarAuditoria('pin_alterado', { email: p.email })
      mostrarAviso('PIN atualizado ✓')
      carregar()
    } catch (erro) {
      mostrarAviso(erro.message)
    } finally {
      setOcupado(false)
    }
  }

  const alterar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  if (tabelaEmFalta) {
    return (
      <p className={`${CARTAO} p-6 text-grafite-600`}>
        A tabela de perfis ainda não existe. Aplica a migração
        <code className="mx-1 rounded bg-creme-100 px-1.5">docs/sql/2026-07-11-v2-equipa-combos-config.sql</code>
        no SQL Editor do Supabase.
      </p>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-grafite-600/70">
          {perfis.length} contas · o PIN pessoal identifica quem está ao balcão
        </p>
        <button type="button" onClick={() => setACriar((v) => !v)} className={BOTAO_PRIMARIO}>
          + Nova conta
        </button>
      </div>

      {aCriar && (
        <form
          onSubmit={criar}
          className="mt-6 grid gap-4 rounded-2xl border border-ambar-500/40 bg-white/70 p-6 sm:grid-cols-2"
        >
          <CampoTexto rotulo="Nome *" value={form.nome} onChange={alterar('nome')} required />
          <CampoTexto
            rotulo="Email *"
            type="email"
            value={form.email}
            onChange={alterar('email')}
            required
          />
          <CampoTexto
            rotulo="Password inicial * (8+ caracteres)"
            type="text"
            minLength={8}
            value={form.password}
            onChange={alterar('password')}
            required
            autoComplete="off"
          />
          <CampoTexto
            rotulo="PIN pessoal * (4 dígitos)"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={form.pin}
            onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
            required
          />
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Papel *
            </span>
            <select value={form.papel} onChange={alterar('papel')} className={CAMPO}>
              <option value="staff">Staff: sem acesso ao /admin</option>
              <option value="admin">Admin: acesso total</option>
            </select>
          </label>
          <div className="flex items-end justify-end gap-3">
            <button
              type="button"
              onClick={() => setACriar(false)}
              className="cursor-pointer rounded-full border border-creme-300 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-grafite-600"
            >
              Cancelar
            </button>
            <button type="submit" disabled={ocupado} className={BOTAO_PRIMARIO}>
              {ocupado ? 'A criar…' : 'Criar conta'}
            </button>
          </div>
          <p className="text-xs text-grafite-600/70 sm:col-span-2">
            Anota a password e o PIN e entrega-os em mão. Não ficam visíveis
            depois de criares a conta.
          </p>
        </form>
      )}

      <ul className="mt-6 space-y-2">
        {perfis.map((p) => (
          <li
            key={p.id}
            className={`${CARTAO} flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
              p.ativo ? '' : 'opacity-50'
            }`}
          >
            <div>
              <p className="font-semibold text-grafite-900">
                {p.nome}
                <span
                  className={`ml-3 rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest ${
                    p.papel === 'admin'
                      ? 'bg-ambar-500/15 text-ambar-600'
                      : 'border border-grafite-600/30 text-grafite-600/70'
                  }`}
                >
                  {p.papel}
                </span>
                {!p.ativo && (
                  <span className="ml-2 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-red-600">
                    Desativada
                  </span>
                )}
              </p>
              <p className="text-sm text-grafite-600/70">
                {p.email} · PIN {p.pin_hash ? 'definido' : 'por definir'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => trocarPin(p)}
                className={BOTAO_SECUNDARIO}
              >
                Trocar PIN
              </button>
              {p.id !== perfil?.id &&
                (p.ativo ? (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => definirEstado(p, false)}
                    className="cursor-pointer rounded-full border border-red-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-600 hover:border-red-500"
                  >
                    Desativar
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => definirEstado(p, true)}
                    className={BOTAO_SECUNDARIO}
                  >
                    Reativar
                  </button>
                ))}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs leading-relaxed text-grafite-600/70">
        Nota de segurança: isto não substitui as duas ações pendentes no
        Supabase: desligar “Allow new users to sign up” (Authentication →
        Providers) e trocar a password da conta partilhada. Ambas continuam
        necessárias.
      </p>

      {Aviso}
    </div>
  )
}

export default Equipa
