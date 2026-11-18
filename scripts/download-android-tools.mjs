import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createWriteStream, createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createHash } from 'node:crypto'
const dir = new URL('../.local/toolchains/', import.meta.url)
await mkdir(dir, { recursive: true })
const release = JSON.parse(await readFile(new URL('jdk-release.json', dir), 'utf8'))[0].binary.package
const xml = await readFile(new URL('repository.xml', dir), 'utf8')
const entry = xml.match(/<remotePackage path="cmdline-tools;latest"[\s\S]*?<\/remotePackage>/)?.[0]
const windows = entry?.match(/<archive>[\s\S]*?<\/archive>/g)?.find(s => s.includes('<host-os>windows</host-os>'))
if (!windows) throw new Error('Cannot find official Windows SDK tools')
const sdk = 'https://dl.google.com/android/repository/' + windows.match(/<url>(.*?)<\/url>/)[1]
await writeFile(new URL('sources.json', dir), JSON.stringify({ jdk: release.link, sdk }))
for (const [name, url, algorithm, checksum] of [
  ['jdk.zip', release.link, 'sha256', release.checksum],
  ['sdk.zip', sdk, 'sha1', windows.match(/<checksum[^>]*>(.*?)<\/checksum>/)[1]],
]) {
  console.log('Downloading', name, url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const file = new URL(name, dir)
  await pipeline(response.body, createWriteStream(file))
  const hash = createHash(algorithm)
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  if (hash.digest('hex') !== checksum) throw new Error(`Checksum mismatch: ${name}`)
  console.log('Verified', name)
}
