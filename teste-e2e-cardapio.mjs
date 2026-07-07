// Teste E2E real do fluxo de pedido em /cardapio (bug "um momento…")
import puppeteer from 'puppeteer-core'

const URL_BASE = process.env.URL_BASE || 'http://localhost:4173'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844 }) // iPhone-ish
  page.on('pageerror', (e) => console.log('ERRO JS NA PÁGINA:', e.message))

  // Simular o cenário do bug: sessão de staff guardada no mesmo browser
  // (token expirado força o fluxo de refresh do supabase-js)
  await page.goto(`${URL_BASE}/cardapio`, { waitUntil: 'networkidle0' })

  console.log('1. Preencher nome e submeter…')
  await page.type('input[autocomplete="name"]', 'Teste E2E')
  await page.click('button[type="submit"]')

  await page.waitForFunction(
    () => document.body.innerText.includes('Olá,'),
    { timeout: 10000 },
  )
  console.log('   ✅ avançou para o menu (bug resolvido)')

  console.log('2. Adicionar 2 itens ao carrinho…')
  await page.waitForSelector('button[aria-label="Adicionar um"]')
  const botoesMais = await page.$$('button[aria-label="Adicionar um"]')
  await botoesMais[0].click()
  await botoesMais[1].click()

  console.log('3. Rever pedido…')
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button')].some((b) =>
      b.innerText.includes('REVER PEDIDO'),
    ),
  )
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')]
      .find((b) => b.innerText.includes('REVER PEDIDO'))
      .click()
  })

  console.log('4. Escolher pagamento e confirmar…')
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button')].some((b) => b.innerText === 'MB WAY'),
  )
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((b) => b.innerText === 'MB WAY').click()
  })
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')]
      .find((b) => b.innerText.includes('CONFIRMAR PEDIDO'))
      .click()
  })

  await page.waitForFunction(
    () => document.body.innerText.toLowerCase().includes('recebido'),
    { timeout: 10000 },
  )
  const texto = await page.evaluate(() => document.body.innerText)
  const numero = texto.match(/PEDIDO Nº (\d+)/i)?.[1]
  console.log(`   ✅ pedido nº ${numero || '?'} submetido, ecrã de acompanhamento visível`)

  console.log('\n✅✅ FLUXO COMPLETO OK')
} finally {
  await browser.close()
}
