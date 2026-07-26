# PENDENTE — Fechar a exposição de `pin_hash` (patch do PinGate)

**Autor:** Daniel Cunha · **Data:** 2026-07-20 · **Estado:** FASE 1 APLICADA (2026-07-26)

> **Seguimento 2026-07-26:** migrações `verificar_pin_fase1`, `pin_estado_helper`
> e `pins_definidos_admin` aplicadas em produção; patch do frontend commitado
> (EquipaLayout + Admin/Equipa deixaram de ler `pin_hash`). Falta: deploy,
> teste dos 2 PINs em produção pelo Leandro, e só depois a SECÇÃO FINAL da
> migração (fechar leitura de perfis + revogar pin_hash).
**Migração que acompanha:** `supabase/migrations/PENDENTE_20260721_verificar_pin.sql`

---

## O problema

`src/pages/equipa/EquipaLayout.jsx` (linhas ~121-143) recebe a lista completa de
perfis, **incluindo o campo `pin_hash`**, e compara os hashes no browser:

```js
const comPin = perfis.filter((p) => p.ativo !== false && p.pin_hash)
for (const p of comPin) {
  if ((await hashPin(p.id, valor)) === p.pin_hash) { ... }
}
```

O hash é `sha256('<user_id>:<pin>')`, sem sal e sem KDF (`api/equipa.js:8`).
O PIN tem 4 dígitos — 10 000 combinações. Qualquer pessoa com uma sessão da
equipa abre a consola do browser, lê os hashes e obtém o PIN de admin em
segundos, offline. A política `perfis leitura autenticada` (`USING (true)`) é
o que permite a leitura.

## A correcção

Mover a comparação para o servidor. O browser envia o PIN; a base de dados
devolve apenas a identidade. O hash deixa de sair da BD e a política pode
então ser fechada.

## Ordem de aplicação — não inverter

1. Aplicar a migração (cria `verificar_pin` e `existem_pins`; nada fecha ainda).
2. Deploy deste patch.
3. Confirmar em produção que os dois perfis activos entram com o PIN.
4. Só então correr a **secção final** da migração, que fecha a leitura de
   `perfis` e revoga o `pin_hash`.

Fechar a política antes do passo 3 tranca a equipa fora do balcão.

## Patch

### 1. `src/pages/equipa/EquipaLayout.jsx`

Substituir o componente `PinGate` (linhas ~118-143) por:

```jsx
// PIN pessoal: identifica quem está ao balcão (alimenta o audit_log).
// A verificação é feita no servidor (RPC verificar_pin) — o hash nunca
// chega ao browser. Ver docs/pin/PENDENTE-pingate.md.
function PinGate({ aoDesbloquear }) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [haPins, setHaPins] = useState(null)

  useEffect(() => {
    let ativo = true
    supabase.rpc('existem_pins').then(({ data }) => {
      if (ativo) setHaPins(data === true)
    })
    return () => { ativo = false }
  }, [])

  async function verificar(valor) {
    setPin(valor)
    setErro(false)
    setMensagem('')
    if (valor.length < 4) return

    const { data, error } = await supabase.rpc('verificar_pin', { p_pin: valor })

    if (error) {
      // Bloqueio por excesso de tentativas devolve mensagem própria
      setMensagem(error.message || 'Erro a verificar o PIN.')
      setErro(true)
      setPin('')
      return
    }

    const perfil = Array.isArray(data) ? data[0] : data
    if (perfil?.id) {
      aoDesbloquear({ id: perfil.id, nome: perfil.nome, papel: perfil.papel })
      return
    }

    if (haPins === false && valor === PIN_PARTILHADO) {
      aoDesbloquear({ id: null, nome: 'Equipa', papel: null })
      return
    }

    setErro(true)
    setPin('')
  }
  // ... resto do JSX inalterado, com duas trocas:
  //   `comPin.length > 0` → `haPins`
  //   mostrar {mensagem} no <p role="alert"> quando existir
}
```

### 2. Alterações de suporte no mesmo ficheiro

- Acrescentar `useEffect` ao import de `react`.
- Garantir que `supabase` está importado (`../../lib/supabase`).
- Remover `hashPin` do import de `../../lib/equipa` — deixa de ser usado aqui.
- Onde o `PinGate` é instanciado, deixar de passar `perfis`:
  `<PinGate aoDesbloquear={...} />`
- No JSX, `comPin.length > 0 ? 'Introduz o teu PIN pessoal' : 'Introduz o PIN do turno'`
  passa a `haPins ? ... : ...`.

### 3. `src/lib/equipa.js`

`hashPin` deixa de ser preciso no cliente. Confirmar se mais algum sítio o usa
antes de remover — `api/equipa.js` tem a sua própria cópia no servidor, essa
mantém-se (é ela que grava o hash ao criar conta e ao redefinir PIN).

### 4. Consulta de perfis

Verificar se a consulta que alimentava o `PinGate` ainda seleciona `pin_hash`.
Se sim, retirar o campo do `select` — depois da secção final da migração, pedi-lo
passa a devolver erro.

## O que isto não resolve

O esquema de hash continua a ser sha256 sem sal. Mantido de propósito para não
obrigar a redefinir todos os PINs no mesmo dia. Endurecer para bcrypt
(`crypt()` + `gen_salt('bf')`, já disponível via pgcrypto) é uma segunda fase e
obriga a redefinir os PINs um a um.

Mitigação entretanto: a migração cria `public.pin_tentativas` e bloqueia a conta
durante 15 minutos ao fim de 10 tentativas falhadas, o que torna a força bruta
pela API impraticável mesmo com o esquema fraco.
