// Derivatives of the user-approved koi artwork; uses the existing Playwright dependency.
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const source = 'src/assets/seeeekon-koi.png'
const res = 'android/app/src/main/res'
const output = 'docs/brand/seeeekon'
await fs.mkdir(output, { recursive: true })
await fs.mkdir(`${res}/drawable-nodpi`, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage()
  const data = `data:image/png;base64,${(await fs.readFile(source)).toString('base64')}`
  async function render(file, size, { scale = 1, background = '#FFFCFA', round = false, monochrome = false } = {}) {
    const png = await page.evaluate(async ({ data, size, scale, background, round, monochrome }) => {
      const img = new Image()
      img.src = data
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const ctx = canvas.getContext('2d')
      if (round) {
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.clip()
      }
      if (background) {
        ctx.fillStyle = background
        ctx.fillRect(0, 0, size, size)
      }
      const width = size * scale
      ctx.drawImage(img, (size - width) / 2, (size - width) / 2, width, width)
      if (monochrome) {
        ctx.globalCompositeOperation = 'source-in'
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, size, size)
      }
      return canvas.toDataURL('image/png').split(',')[1]
    }, { data, size, scale, background, round, monochrome })
    await fs.writeFile(file, Buffer.from(png, 'base64'))
  }
  await render(`${output}/seeeekon-avatar-2048.png`, 2048, { scale: 0.94 })
  await render(`${output}/seeeekon-avatar-1024.png`, 1024, { scale: 0.94 })
  await render(`${output}/seeeekon-avatar-round-preview.png`, 512, { scale: 0.94, round: true })
  await fs.copyFile(source, `${output}/seeeekon-logo-transparent.png`)
  // The visible artwork fits inside the adaptive icon's central safe circle.
  await render(`${res}/drawable-nodpi/seeeekon_foreground.png`, 432, { scale: 0.62, background: null })
  await render(`${res}/drawable-nodpi/seeeekon_monochrome.png`, 432, { scale: 0.62, background: null, monochrome: true })
  for (const [density, size, foregroundSize] of [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]]) {
    await render(`${res}/mipmap-${density}/ic_launcher.png`, size, { scale: 0.94 })
    await render(`${res}/mipmap-${density}/ic_launcher_round.png`, size, { scale: 0.94, round: true })
    await render(`${res}/mipmap-${density}/ic_launcher_foreground.png`, foregroundSize, { scale: 0.62, background: null })
  }
} finally {
  await browser.close()
}
console.log('Generated seeeekon avatar, transparent logo and Android icons')
