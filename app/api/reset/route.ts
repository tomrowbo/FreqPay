import { NextResponse } from 'next/server'
import { DEFAULT_STORE, readStore, writeStore } from '@/lib/store'

export function POST() {
  const keepProfile = readStore().profile
  writeStore({ ...structuredClone(DEFAULT_STORE), profile: keepProfile })
  return NextResponse.json({ ok: true })
}
