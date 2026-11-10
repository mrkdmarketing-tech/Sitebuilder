/**
 * Turns an uploaded image or video into small JPEG previews, in the browser
 * (docs/ad-approval.md: "frames are extracted in the browser, no video server").
 * Images: one preview. Videos: up to 8 frames spread across the video, so the
 * AI check can read on-screen text and burned-in subtitles. Audio is ignored.
 */
import type { PreparedMedia } from '../data/approvals'

const MAX_IMAGE_SIDE = 1568 // largest size the AI reads without shrinking
const MAX_FRAME_SIDE = 1280
const MAX_VIDEO_FRAMES = 8

function scale(w: number, h: number, max: number) {
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.round(w * k), h: Math.round(h * k) }
}

function toJpeg(source: CanvasImageSource, w: number, h: number, max: number): Promise<Blob> {
  const { w: cw, h: ch } = scale(w, h, max)
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  canvas.getContext('2d')!.drawImage(source, 0, 0, cw, ch)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make a preview'))), 'image/jpeg', 0.85),
  )
}

async function prepareImage(file: File): Promise<PreparedMedia> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const blob = await toJpeg(img, img.naturalWidth, img.naturalHeight, MAX_IMAGE_SIDE)
    return { kind: 'image', width: img.naturalWidth, height: img.naturalHeight, durationSec: null, frames: [{ t: 0, blob }], warning: null }
  } catch {
    return { kind: 'image', width: null, height: null, durationSec: null, frames: [], warning: "This browser couldn't open the image, so the AI check will skip it." }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function once(el: HTMLMediaElement, event: string, timeoutMs = 15000) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), timeoutMs)
    el.addEventListener(event, () => { clearTimeout(t); resolve() }, { once: true })
    el.addEventListener('error', () => { clearTimeout(t); reject(new Error('unreadable')) }, { once: true })
  })
}

async function prepareVideo(file: File): Promise<PreparedMedia> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.playsInline = true
  video.src = url
  try {
    await once(video, 'loadeddata')
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const count = Math.max(1, Math.min(MAX_VIDEO_FRAMES, Math.ceil(duration / 3)))
    const times = Array.from({ length: count }, (_, i) => Math.min(Math.max(duration - 0.1, 0), 0.5 + (i * Math.max(duration - 0.5, 0)) / count))
    const frames: PreparedMedia['frames'] = []
    for (const t of times) {
      video.currentTime = t
      await once(video, 'seeked')
      frames.push({ t: Math.round(t * 10) / 10, blob: await toJpeg(video, video.videoWidth, video.videoHeight, MAX_FRAME_SIDE) })
    }
    return { kind: 'video', width: video.videoWidth, height: video.videoHeight, durationSec: duration, frames, warning: null }
  } catch {
    return {
      kind: 'video', width: null, height: null, durationSec: null, frames: [],
      warning: "This browser couldn't play the video (often an iPhone HEVC .mov), so the AI check will skip it. Export it as MP4 to include it.",
    }
  } finally {
    video.removeAttribute('src')
    URL.revokeObjectURL(url)
  }
}

export function prepareMedia(file: File): Promise<PreparedMedia> {
  return file.type.startsWith('video/') ? prepareVideo(file) : prepareImage(file)
}

export const ACCEPTED_FILES = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm'

/** "1:05" */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
