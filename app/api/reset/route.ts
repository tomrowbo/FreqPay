import { NextResponse } from 'next/server'
import { DEFAULT_STORE, readStore, writeStore } from '@/lib/store'

export function POST() {
  // Back to a fresh account: keep the team, budget and allergies; subscriptions start again from onboarding.
  const keepProfile = { ...readStore().profile, confirmed: false }
  writeStore({ ...structuredClone(DEFAULT_STORE), profile: keepProfile, subscriptions: [] })
  return NextResponse.json({ ok: true })
}
